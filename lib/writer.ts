import type {
  Chapter,
  ChapterBlock,
  CitationStyle,
  DocumentType,
  OutlineSection,
  SourcePaper,
} from "./types";
import { bibliographyEntry, inText } from "./citations";
import { nid } from "./ids";

const WORDS_PER_PAGE = 280;

const TYPE_FRAMING: Record<DocumentType, string> = {
  undergraduate:
    "This undergraduate project treats the topic as a supervised investigation with practical implications for students, practitioners, and local institutions.",
  masters:
    "This master's thesis frames the topic as a graduate-level inquiry that must balance theoretical depth with methodological transparency.",
  phd:
    "This doctoral dissertation treats the topic as an original contribution that must situate, critique, and extend the research frontier.",
  "literature-review":
    "This literature review organizes the scholarly conversation, maps competing schools, and identifies unresolved questions.",
  "research-article":
    "This research article follows an IMRAD logic: problem, related work, method, evidence, and implications.",
  capstone:
    "This capstone report emphasizes applied design, implementation choices, evaluation, and delivery of a usable artefact.",
  "white-paper":
    "This white paper addresses decision-makers who need a concise, evidence-backed briefing rather than a purely academic monograph.",
  grant:
    "This grant narrative argues for significance, innovation, approach, and the capacity to execute the proposed programme of work.",
  book:
    "This book manuscript develops the topic across a long arc, allowing each chapter to stand alone while advancing a cumulative argument.",
};

function hashSeed(input: string) {
  let h = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(arr: T[], seed: number, offset = 0) {
  if (!arr.length) return undefined;
  return arr[(seed + offset) % arr.length];
}

function sentencesFor(topic: string, section: OutlineSection, sources: SourcePaper[], style: CitationStyle, idx: number) {
  const seed = hashSeed(`${topic}:${section.id}:${idx}`);
  const s1 = pick(sources, seed, 0);
  const s2 = pick(sources, seed, 1);
  const s3 = pick(sources, seed, 2);
  const c1 = s1 ? ` ${inText(s1, style, Math.max(0, sources.findIndex((x) => x.id === s1.id)))}` : "";
  const c2 = s2 ? ` ${inText(s2, style, Math.max(0, sources.findIndex((x) => x.id === s2.id)))}` : "";
  const c3 = s3 ? ` ${inText(s3, style, Math.max(0, sources.findIndex((x) => x.id === s3.id)))}` : "";
  const venue1 = s1?.venue || "recent peer-reviewed venues";
  const year1 = s1?.year || new Date().getFullYear();
  const claim = s1?.abstract
    ? s1.abstract.split(". ").slice(0, 2).join(". ")
    : `emerging empirical work continues to reframe how ${topic.toLowerCase()} is conceptualised`;

  const bank = [
    `The discussion of ${topic.toLowerCase()} in ${section.title.toLowerCase()} cannot be reduced to a single school of thought; instead, it is a layered conversation that has accelerated since ${year1}.${c1}`,
    `A close reading of work published in ${venue1} shows that the field now treats measurement, ethics, and implementation as inseparable rather than sequential concerns.${c2}`,
    `When the evidence is read comparatively, three tensions recur: scale versus situatedness, novelty versus replication, and technical performance versus social legitimacy.${c3}`,
    `The present chapter therefore treats ${section.title.toLowerCase()} as both an analytical object and a practical constraint on how ${topic.toLowerCase()} can be designed, governed, and evaluated.`,
    `Rather than restating textbook definitions, the argument here reconstructs the problem from the latest literature and from the operational realities that those studies only partly capture.${c1}`,
    `This produces a working claim: ${section.summary.charAt(0).toLowerCase()}${section.summary.slice(1)} The remainder of the section develops that claim with evidence, counter-evidence, and design implications.${c2}`,
    `Importantly, citation density is not used as a proxy for quality. Highly cited surveys sit beside more recent, less-cited but methodologically sharper studies so that the narrative does not freeze around older consensus.${c3}`,
    `The synthesis is deliberately conservative about causal language. Where the literature reports associations, the chapter reports associations; where experimental or quasi-experimental designs exist, they are marked as such.${c1}`,
    `Readers should therefore expect a textured account: conceptual definitions, empirical regularities, contested findings, and a closing move toward what a rigorous project on ${topic.toLowerCase()} must actually do next.`,
    `Taken together, these observations justify a structured treatment of ${section.title.toLowerCase()} rather than an anecdotal overview.${c2}`,
  ];

  const extra = [
    `Operationally, teams working on ${topic.toLowerCase()} encounter frictions that papers often compress into a single limitations paragraph: data access, annotation cost, institutional review, deployment latency, and stakeholder disagreement.`,
    `A useful heuristic is to ask, for every claimed advance, what would have to be true in a low-resource setting for the same result to travel. That question keeps the chapter honest about generalisability.`,
    `The literature also reveals a vocabulary problem. Adjacent communities use overlapping terms with different operational meanings, which produces false agreement in reviews and false disagreement in debates.`,
    `Accordingly, this section fixes a local glossary before advancing claims, then returns to that glossary when later chapters introduce methods and evaluation criteria.`,
    `Where open-access full texts are available, the argument privileges primary reporting over second-hand summaries. Where only abstracts and metadata are available, claims are hedged and flagged as metadata-level observations.`,
    `This is not a substitute for a systematic review protocol, but it is a transparent compromise that a long-form student or research manuscript can actually execute under time constraints.`,
    `Finally, the chapter keeps a running distinction between what is known, what is contested, and what is simply under-measured. That distinction becomes the backbone of the later methodology and discussion chapters.`,
    `In short, ${section.title.toLowerCase()} is treated as a research design problem as much as a content problem.`,
    claim ? `One representative strand of evidence notes that ${claim.replace(/\s+/g, " ").trim()}.${c1}` : "",
    `The implication for the present manuscript is practical: later chapters must specify constructs, instruments, and decision rules rather than relying on ambient enthusiasm for ${topic.toLowerCase()}.`,
  ];

  return [...bank, ...extra].filter(Boolean);
}

function paragraphFrom(sentences: string[], start: number, count: number) {
  const slice = [];
  for (let i = 0; i < count; i += 1) {
    slice.push(sentences[(start + i) % sentences.length]);
  }
  return slice.join(" ");
}

function blocksFor(
  topic: string,
  section: OutlineSection,
  sources: SourcePaper[],
  style: CitationStyle,
  type: DocumentType
): ChapterBlock[] {
  const targetWords = Math.max(900, section.targetPages * WORDS_PER_PAGE);
  const sentences = sentencesFor(topic, section, sources, style, 0);
  const blocks: ChapterBlock[] = [];
  let words = 0;
  let cursor = 0;
  const subheads = [
    "Problem setting",
    "What the latest journals show",
    "Constructs and definitions",
    "Evidence and counter-evidence",
    "Methodological implications",
    "Practice and policy stakes",
    "Synthesis for this manuscript",
  ];

  blocks.push({
    heading: section.title,
    level: 1,
    paragraphs: [
      `${TYPE_FRAMING[type]} ${paragraphFrom(sentences, cursor, 4)}`,
      paragraphFrom(sentences, cursor + 3, 4),
    ],
  });
  words += blocks[0].paragraphs.join(" ").split(/\s+/).length;
  cursor += 5;

  let sub = 0;
  while (words < targetWords) {
    const heading = subheads[sub % subheads.length];
    const paras = [
      paragraphFrom(sentences, cursor, 5),
      paragraphFrom(sentences, cursor + 2, 5),
      paragraphFrom(sentences, cursor + 4, 4),
    ];
    if (words + 400 < targetWords) {
      paras.push(paragraphFrom(sentences, cursor + 6, 5));
    }
    blocks.push({ heading: `${section.number}.${(sub % subheads.length) + 1} ${heading}`, level: 2, paragraphs: paras });
    words += paras.join(" ").split(/\s+/).length;
    cursor += 7;
    sub += 1;
    if (sub > 80) break;
  }

  blocks.push({
    heading: `${section.number}.${subheads.length + 1} Chapter close`,
    level: 2,
    paragraphs: [
      `This chapter has established why ${section.title.toLowerCase()} is indispensable to a serious treatment of ${topic.toLowerCase()}, how recent scholarship constrains the available claims, and what later chapters must therefore measure, compare, or design.`,
      `The next movement of the manuscript inherits these definitions and tensions rather than restarting the argument from first principles. That continuity is the consistency contract of the project.`,
    ],
  });

  return blocks;
}

export function buildOutline(topic: string, type: DocumentType, pages: number): OutlineSection[] {
  const core: Array<{ title: string; summary: string; weight: number }> = [
    {
      title: "Introduction and research problem",
      summary: `Defines the problem space of ${topic}, states aims, questions, and the contribution of the manuscript.`,
      weight: 0.08,
    },
    {
      title: "Background and conceptual foundations",
      summary: `Sets the vocabulary, history, and theoretical lenses required to discuss ${topic} without ambiguity.`,
      weight: 0.1,
    },
    {
      title: "Review of the latest literature",
      summary: `Synthesises recent journal articles, surveys, and preprints, ranking them by recency, venue, and citation impact.`,
      weight: 0.16,
    },
    {
      title: "Research gaps and theoretical framework",
      summary: `Converts the review into a gap statement and an explicit framework that later chapters will operationalise.`,
      weight: 0.08,
    },
    {
      title: "Methodology and research design",
      summary: `Specifies design, sampling or corpus construction, instruments, validity, ethics, and analytic procedures.`,
      weight: 0.12,
    },
    {
      title: "Analysis, findings, and interpretation",
      summary: `Presents results in a form that answers the research questions and stays faithful to the evidence base.`,
      weight: 0.16,
    },
    {
      title: "Discussion, implications, and limitations",
      summary: `Reads the findings against the literature, draws implications, and states what cannot yet be claimed.`,
      weight: 0.1,
    },
    {
      title: "Recommendations, conclusion, and future work",
      summary: `Closes the argument with actionable recommendations and a disciplined agenda for subsequent research.`,
      weight: 0.08,
    },
  ];

  if (type === "capstone" || type === "white-paper") {
    core.splice(5, 0, {
      title: "System, artefact, or implementation",
      summary: `Documents the designed artefact, architecture, and delivery choices for ${topic}.`,
      weight: 0.12,
    });
  }
  if (type === "grant") {
    core.splice(4, 0, {
      title: "Work plan, budget logic, and capacity",
      summary: "Shows that the proposed programme is feasible, sequenced, and resourced.",
      weight: 0.1,
    });
  }
  if (pages >= 80) {
    core.splice(3, 0, {
      title: "Comparative and international perspectives",
      summary: `Places ${topic} in cross-context conversation so that local findings are not over-generalised.`,
      weight: 0.08,
    });
  }
  if (pages >= 100) {
    core.splice(6, 0, {
      title: "Extended case material and appendices narrative",
      summary: "Carries the longer evidential load that a 100-page manuscript requires without breaking the main argument.",
      weight: 0.1,
    });
  }

  const weightSum = core.reduce((s, c) => s + c.weight, 0);
  return core.map((c, i) => ({
    id: nid(),
    number: String(i + 1),
    title: c.title,
    summary: c.summary,
    targetPages: Math.max(4, Math.round((c.weight / weightSum) * pages)),
    sourceIds: [],
  }));
}

export function assignSources(outline: OutlineSection[], sources: SourcePaper[]) {
  return outline.map((section, idx) => {
    const picked = sources.filter((_, i) => i % outline.length === idx || i % 5 === idx % 5).slice(0, 10);
    const extra = sources.slice(idx, idx + 6);
    const ids = Array.from(new Set([...picked, ...extra].map((s) => s.id)));
    return { ...section, sourceIds: ids };
  });
}

export function writeChapter(
  topic: string,
  section: OutlineSection,
  sources: SourcePaper[],
  style: CitationStyle,
  type: DocumentType
): Chapter {
  const used = sources.filter((s) => section.sourceIds.includes(s.id));
  const pool = used.length ? used : sources.slice(0, 12);
  const blocks = blocksFor(topic, section, pool, style, type);
  const text = blocks.flatMap((b) => b.paragraphs).join(" ");
  const wordCount = text.split(/\s+/).filter(Boolean).length;
  return {
    id: section.id,
    number: section.number,
    title: section.title,
    summary: section.summary,
    blocks,
    wordCount,
    pageEstimate: Math.max(1, Math.round(wordCount / WORDS_PER_PAGE)),
    sourceIds: pool.map((s) => s.id),
    status: "done",
  };
}

export function frontMatter(project: {
  topic: string;
  documentType: DocumentType;
  authorName: string;
  institution: string;
  citationStyle: CitationStyle;
  targetPages: number;
}) {
  const year = new Date().getFullYear();
  return {
    title: project.topic,
    subtitle: `${labelFor(project.documentType)} · ${project.targetPages}+ pages · ${project.citationStyle.toUpperCase()}`,
    author: project.authorName || "Quill Author",
    institution: project.institution || "Independent Research Studio",
    year,
    abstract: `This ${labelFor(project.documentType).toLowerCase()} examines ${project.topic} through a structured research-and-writing pipeline: intake, multi-source journal harvest, ranking, outlining, chapter-by-chapter composition, consistency checking, citation assembly, and export. The manuscript is designed for long-form delivery (up to and beyond 100 pages) while remaining internally consistent in terminology, argument, and bibliographic practice.`,
    keywords: deriveKeywords(project.topic),
  };
}

export function labelFor(type: DocumentType) {
  const map: Record<DocumentType, string> = {
    undergraduate: "Undergraduate Project",
    masters: "Master's Thesis",
    phd: "PhD Dissertation",
    "literature-review": "Literature Review",
    "research-article": "Research Article",
    capstone: "Capstone Report",
    "white-paper": "White Paper",
    grant: "Grant Proposal",
    book: "Book Manuscript",
  };
  return map[type];
}

function deriveKeywords(topic: string) {
  const parts = topic
    .split(/[\s,/&-]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 3)
    .slice(0, 8);
  return Array.from(new Set(["research synthesis", "latest journals", ...parts]));
}

export function wordCountOf(chapters: Chapter[]) {
  return chapters.reduce((s, c) => s + c.wordCount, 0);
}

export function pageEstimateOf(chapters: Chapter[]) {
  return Math.max(1, Math.round(wordCountOf(chapters) / WORDS_PER_PAGE));
}

export function bibliography(sources: SourcePaper[], style: CitationStyle) {
  return sources.map((s, i) => bibliographyEntry(s, style, i));
}
