import type { SourcePaper } from "./types";

export function mcpConfigured() {
  return Boolean(process.env.MCP_SERVER_URL);
}

export async function mcpResearch(topic: string): Promise<SourcePaper[]> {
  const base = process.env.MCP_SERVER_URL;
  if (!base) return [];
  try {
    const res = await fetch(new URL("/mcp/research", base).toString(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, limit: 24 }),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const items = Array.isArray(data) ? data : data.papers || data.results || [];
    return items
      .map((item: Record<string, unknown>, i: number) => ({
        id: String(item.id || item.doi || `mcp:${i}`),
        title: String(item.title || "Untitled"),
        year: Number(item.year) || new Date().getFullYear(),
        authors: Array.isArray(item.authors) ? (item.authors as string[]) : [],
        doi: item.doi ? String(item.doi) : undefined,
        venue: item.venue ? String(item.venue) : "MCP research",
        citedBy: Number(item.citedBy || item.cited_by_count) || 0,
        abstract: item.abstract ? String(item.abstract) : "",
        url: item.url ? String(item.url) : undefined,
        pdfUrl: item.pdfUrl ? String(item.pdfUrl) : undefined,
        isOa: Boolean(item.isOa),
        origin: "openalex" as const,
      }))
      .filter((p: SourcePaper) => p.title.length > 6);
  } catch {
    return [];
  }
}
