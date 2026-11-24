export type DocumentType =
  | "undergraduate"
  | "masters"
  | "phd"
  | "literature-review"
  | "research-article"
  | "capstone"
  | "white-paper"
  | "grant"
  | "book";

export type CitationStyle =
  | "apa"
  | "mla"
  | "chicago"
  | "ieee"
  | "harvard"
  | "vancouver";

export type ProjectStatus =
  | "draft"
  | "researching"
  | "outlining"
  | "writing"
  | "assembling"
  | "exporting"
  | "complete"
  | "error";

export type PipelineStepId =
  | "intake"
  | "research"
  | "rank"
  | "outline"
  | "write"
  | "consistency"
  | "citations"
  | "frontmatter"
  | "export";

export interface SourcePaper {
  id: string;
  title: string;
  year: number;
  authors: string[];
  doi?: string;
  venue?: string;
  citedBy: number;
  abstract?: string;
  url?: string;
  pdfUrl?: string;
  isOa: boolean;
  origin: "openalex" | "crossref";
}

export interface OutlineSection {
  id: string;
  number: string;
  title: string;
  summary: string;
  targetPages: number;
  sourceIds: string[];
}

export type ChapterBlockLevel = 1 | 2 | 3;

export interface ChapterBlock {
  heading: string;
  level: ChapterBlockLevel;
  paragraphs: string[];
}

export interface Chapter {
  id: string;
  number: string;
  title: string;
  summary: string;
  blocks: ChapterBlock[];
  wordCount: number;
  pageEstimate: number;
  sourceIds: string[];
  status: "pending" | "writing" | "done";
}

export interface CommandEvent {
  id: string;
  at: string;
  command: string;
  status: "running" | "ok" | "error";
  output: string;
}

export interface PipelineStep {
  id: PipelineStepId;
  label: string;
  detail: string;
  status: "idle" | "running" | "done" | "error";
}

export interface ProjectFile {
  id: string;
  name: string;
  mime: string;
  format: "pdf" | "docx";
  size: number;
  pages: number;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  kind:
    | "text"
    | "plan"
    | "sources"
    | "outline"
    | "progress"
    | "file"
    | "command"
    | "error";
  content: string;
  createdAt: string;
  meta?: Record<string, unknown>;
}

export interface Chat {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  projectId?: string;
  userId?: string;
}

export interface Project {
  id: string;
  chatId: string;
  topic: string;
  documentType: DocumentType;
  citationStyle: CitationStyle;
  targetPages: number;
  authorName: string;
  institution: string;
  status: ProjectStatus;
  currentChapterIndex: number;
  sources: SourcePaper[];
  outline: OutlineSection[];
  chapters: Chapter[];
  bibliography: string[];
  files: ProjectFile[];
  commands: CommandEvent[];
  steps: PipelineStep[];
  wordCount: number;
  pageEstimate: number;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export const DOCUMENT_TYPES: { value: DocumentType; label: string; hint: string }[] = [
  { value: "undergraduate", label: "Undergraduate project", hint: "Final-year / capstone-style report" },
  { value: "masters", label: "Master's thesis", hint: "Structured graduate thesis" },
  { value: "phd", label: "PhD dissertation", hint: "Long-form doctoral manuscript" },
  { value: "literature-review", label: "Literature review", hint: "Survey of latest journals" },
  { value: "research-article", label: "Research article", hint: "IMRAD journal paper" },
  { value: "capstone", label: "Capstone report", hint: "Applied project documentation" },
  { value: "white-paper", label: "White paper", hint: "Technical briefing" },
  { value: "grant", label: "Grant proposal", hint: "Funded-research narrative" },
  { value: "book", label: "Book manuscript", hint: "Multi-chapter scholarly book" },
];

export const CITATION_STYLES: { value: CitationStyle; label: string }[] = [
  { value: "apa", label: "APA 7" },
  { value: "mla", label: "MLA 9" },
  { value: "chicago", label: "Chicago" },
  { value: "ieee", label: "IEEE" },
  { value: "harvard", label: "Harvard" },
  { value: "vancouver", label: "Vancouver" },
];

export const PAGE_OPTIONS = [20, 40, 60, 80, 100, 120, 150];
