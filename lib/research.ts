import type { SourcePaper } from "./types";
import { mcpResearch } from "./mcp";

const UA = "Quill/1.0 (mailto:research@quill.app)";

function decodeInvertedAbstract(index: Record<string, number[]> | undefined) {
  if (!index) return "";
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const pos of positions) words[pos] = word;
  }
  return words.filter(Boolean).join(" ");
}

function clean(text: string) {
  return text.replace(/\s+/g, " ").trim();
}

async function searchOpenAlex(query: string, limit: number): Promise<SourcePaper[]> {
  const year = new Date().getFullYear();
  const url = new URL("https://api.openalex.org/works");
  url.searchParams.set("search", query);
  url.searchParams.set("filter", `from_publication_date:${year - 4}-01-01`);
  url.searchParams.set("sort", "cited_by_count:desc");
  url.searchParams.set("per_page", String(Math.min(limit, 50)));
  url.searchParams.set(
    "select",
    "id,display_name,publication_year,cited_by_count,doi,authorships,primary_location,abstract_inverted_index,open_access"
  );

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": UA },
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const results = Array.isArray(data.results) ? data.results : [];

  return results.map((work: Record<string, unknown>) => {
    const authorships = (work.authorships as Array<{ author?: { display_name?: string } }>) || [];
    const loc = (work.primary_location as {
      source?: { display_name?: string };
      landing_page_url?: string;
      pdf_url?: string;
      is_oa?: boolean;
    }) || {};
    const oa = work.open_access as { is_oa?: boolean } | undefined;
    return {
      id: String(work.id || ""),
      title: clean(String(work.display_name || "Untitled")),
      year: Number(work.publication_year) || year,
      authors: authorships.map((a) => a.author?.display_name || "Unknown").filter(Boolean).slice(0, 8),
      doi: work.doi ? String(work.doi).replace("https://doi.org/", "") : undefined,
      venue: loc.source?.display_name,
      citedBy: Number(work.cited_by_count) || 0,
      abstract: clean(decodeInvertedAbstract(work.abstract_inverted_index as Record<string, number[]>)),
      url: loc.landing_page_url || (work.doi ? String(work.doi) : undefined),
      pdfUrl: loc.pdf_url,
      isOa: Boolean(loc.is_oa || oa?.is_oa),
      origin: "openalex" as const,
    };
  });
}

async function searchCrossref(query: string, limit: number): Promise<SourcePaper[]> {
  const url = new URL("https://api.crossref.org/works");
  url.searchParams.set("query", query);
  url.searchParams.set("rows", String(Math.min(limit, 40)));
  url.searchParams.set("sort", "published");
  url.searchParams.set("order", "desc");
  url.searchParams.set("mailto", "research@quill.app");
  url.searchParams.set("filter", `from-pub-date:${new Date().getFullYear() - 4}`);

  const res = await fetch(url.toString(), {
    headers: { "User-Agent": UA },
    next: { revalidate: 0 },
  });
  if (!res.ok) return [];
  const data = await res.json();
  const items = data?.message?.items || [];

  return items.map((item: Record<string, unknown>) => {
    const titleArr = item.title as string[] | undefined;
    const authorArr = (item.author as Array<{ given?: string; family?: string }>) || [];
    const container = item["container-title"] as string[] | undefined;
    const issued = item.issued as { "date-parts"?: number[][] } | undefined;
    const year = issued?.["date-parts"]?.[0]?.[0] || new Date().getFullYear();
    const abstractHtml = typeof item.abstract === "string" ? item.abstract : "";
    return {
      id: `crossref:${item.DOI || titleArr?.[0] || Math.random()}`,
      title: clean(titleArr?.[0] || "Untitled"),
      year: Number(year),
      authors: authorArr
        .map((a) => [a.given, a.family].filter(Boolean).join(" "))
        .filter(Boolean)
        .slice(0, 8),
      doi: item.DOI ? String(item.DOI) : undefined,
      venue: container?.[0],
      citedBy: Number(item["is-referenced-by-count"]) || 0,
      abstract: clean(abstractHtml.replace(/<[^>]+>/g, " ")),
      url: item.URL ? String(item.URL) : item.DOI ? `https://doi.org/${item.DOI}` : undefined,
      isOa: false,
      origin: "crossref" as const,
    };
  });
}

export async function harvestSources(topic: string, limit = 48): Promise<SourcePaper[]> {
  const [oa, cr, mcp] = await Promise.allSettled([
    searchOpenAlex(topic, limit),
    searchCrossref(topic, Math.ceil(limit / 2)),
    mcpResearch(topic),
  ]);
  const papers = [
    ...(oa.status === "fulfilled" ? oa.value : []),
    ...(cr.status === "fulfilled" ? cr.value : []),
    ...(mcp.status === "fulfilled" ? mcp.value : []),
  ];

  const seen = new Set<string>();
  const unique: SourcePaper[] = [];
  for (const paper of papers) {
    const key = (paper.doi || paper.title).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    if (!paper.title || paper.title.length < 8) continue;
    unique.push(paper);
  }

  unique.sort((a, b) => b.year - a.year || b.citedBy - a.citedBy);
  return unique.slice(0, limit);
}
