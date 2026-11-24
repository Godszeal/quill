import type { CitationStyle, SourcePaper } from "./types";

function authorList(authors: string[], style: CitationStyle) {
  if (!authors.length) return "Unknown";
  if (style === "ieee" || style === "vancouver") {
    return authors
      .map((name) => {
        const parts = name.split(" ");
        const last = parts.pop() || name;
        const initials = parts.map((p) => `${p[0]}.`).join(" ");
        return initials ? `${initials} ${last}` : last;
      })
      .join(", ");
  }
  if (authors.length === 1) return authors[0];
  if (authors.length === 2) return `${authors[0]} & ${authors[1]}`;
  return `${authors[0]} et al.`;
}

export function inText(paper: SourcePaper, style: CitationStyle, index: number) {
  const lead = paper.authors[0]?.split(" ").slice(-1)[0] || "Unknown";
  switch (style) {
    case "ieee":
    case "vancouver":
      return `[${index + 1}]`;
    case "mla":
      return `(${lead} ${paper.year})`;
    case "chicago":
      return `(${lead} ${paper.year})`;
    case "harvard":
      return `(${lead}, ${paper.year})`;
    default:
      return authorsInApa(paper);
  }
}

function authorsInApa(paper: SourcePaper) {
  const last = (name: string) => name.split(" ").slice(-1)[0];
  if (paper.authors.length === 0) return `(Unknown, ${paper.year})`;
  if (paper.authors.length === 1) return `(${last(paper.authors[0])}, ${paper.year})`;
  if (paper.authors.length === 2) {
    return `(${last(paper.authors[0])} & ${last(paper.authors[1])}, ${paper.year})`;
  }
  return `(${last(paper.authors[0])} et al., ${paper.year})`;
}

export function bibliographyEntry(paper: SourcePaper, style: CitationStyle, index: number) {
  const authors = authorList(paper.authors, style);
  const doi = paper.doi ? ` https://doi.org/${paper.doi.replace(/^https?:\/\/doi.org\//, "")}` : "";
  const venue = paper.venue ? `${paper.venue}. ` : "";
  switch (style) {
    case "ieee":
      return `[${index + 1}] ${authors}, "${paper.title}," ${venue}${paper.year}.${doi}`;
    case "mla":
      return `${authors}. "${paper.title}." ${venue}${paper.year}.${doi}`;
    case "chicago":
      return `${authors}. "${paper.title}." ${venue}${paper.year}.${doi}`;
    case "harvard":
      return `${authors} (${paper.year}) '${paper.title}', ${venue}${doi}`.trim();
    case "vancouver":
      return `${index + 1}. ${authors}. ${paper.title}. ${venue}${paper.year}.${doi}`;
    default:
      return `${authors} (${paper.year}). ${paper.title}. ${venue}${doi}`.trim();
  }
}

export function citeMany(papers: SourcePaper[], style: CitationStyle, all: SourcePaper[]) {
  const marks = papers.map((p) => inText(p, style, Math.max(0, all.findIndex((x) => x.id === p.id))));
  if (style === "ieee" || style === "vancouver") {
    return marks.join("");
  }
  return marks.join("; ");
}
