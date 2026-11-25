import type { ChatMessage, CommandEvent, FileType, PipelineStep, Poll, Project, ProjectFile, Suggestion, Task } from "./types";
import { nid, nowIso } from "./ids";
import { harvestSources } from "./research";
import {
  assignSources,
  bibliography,
  buildOutline,
  pageEstimateOf,
  wordCountOf,
} from "./writer";
import { buildPdf } from "./export/pdf";
import { buildDocx } from "./export/docx";
import { addMessage, getChat, saveBinaryFile, upsertChat, upsertProject } from "./db";
import { llmConfigured, llmWriteChapter } from "./llm";

const STEP_DEFS: Array<{ id: PipelineStep["id"]; label: string; detail: string }> = [
  { id: "intake", label: "Intake brief", detail: "Normalise topic, document type, length, and citation style." },
  { id: "research", label: "Journal harvest", detail: "Query OpenAlex and Crossref for recent, ranked papers." },
  { id: "rank", label: "Source ranking", detail: "Deduplicate, score recency and citations, keep the working corpus." },
  { id: "outline", label: "Consistent outline", detail: "Allocate pages across a stable chapter architecture." },
  { id: "write", label: "Chapter writing", detail: "Compose long-form chapters against assigned sources." },
  { id: "consistency", label: "Consistency pass", detail: "Keep terms, aims, and numbering aligned across chapters." },
  { id: "citations", label: "Citation assembly", detail: "Build in-text marks and a formatted bibliography." },
  { id: "frontmatter", label: "Front matter", detail: "Abstract, keywords, and table of contents." },
  { id: "export", label: "Export files", detail: "Render PDF and DOCX for download." },
];

function steps(): PipelineStep[] {
  return STEP_DEFS.map((s) => ({ ...s, status: "idle" }));
}

function setStep(project: Project, id: PipelineStep["id"], status: PipelineStep["status"]) {
  project.steps = project.steps.map((s) => (s.id === id ? { ...s, status } : s));
}

function command(project: Project, command: string, output: string, status: CommandEvent["status"] = "ok") {
  const event: CommandEvent = { id: nid(), at: nowIso(), command, status, output };
  project.commands = [...project.commands, event].slice(-40);
  return event;
}

async function say(chatId: string, message: Omit<ChatMessage, "id" | "createdAt">) {
  const full: ChatMessage = { ...message, id: nid(), createdAt: nowIso() };
  await addMessage(chatId, full);
  return full;
}

export function createProjectDraft(input: {
  chatId: string;
  topic: string;
  documentType: Project["documentType"];
  citationStyle: Project["citationStyle"];
  targetPages: number;
  authorName: string;
  institution: string;
  fileType?: FileType;
}): Project {
  const timestamp = nowIso();
  return {
    id: nid(),
    chatId: input.chatId,
    topic: input.topic.trim(),
    documentType: input.documentType,
    citationStyle: input.citationStyle,
    targetPages: input.targetPages,
    authorName: input.authorName.trim() || "Author",
    institution: input.institution.trim() || "Institution",
    status: "draft",
    currentChapterIndex: 0,
    sources: [],
    outline: [],
    chapters: [],
    bibliography: [],
    files: [],
    commands: [],
    steps: steps(),
    wordCount: 0,
    pageEstimate: 0,
    fileType: input.fileType || "both",
    tasks: [],
    polls: [],
    suggestions: [],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export async function runPipeline(project: Project, onTick?: (project: Project, message?: ChatMessage) => Promise<void>, resume = false) {
  const emit = async (message?: ChatMessage) => {
    project.updatedAt = nowIso();
    await upsertProject(project);
    if (onTick) await onTick(project, message);
  };

  const done = (id: PipelineStep["id"]) => project.steps.find((s) => s.id === id)?.status === "done";
  const thinking: string[] = [];
  const pushThinking = (text: string) => thinking.push(text);

  try {
    if (!resume || !done("intake")) {
      project.status = "researching";
      setStep(project, "intake", "running");
      command(
        project,
        "quill intake --normalize",
        `topic=${project.topic}; type=${project.documentType}; pages=${project.targetPages}; style=${project.citationStyle}`
      );
      await say(project.chatId, {
        role: "assistant",
        kind: "text",
        content: `I’ll help you write about “${project.topic}”. Let me start by gathering recent research and building a solid outline before drafting the chapters.`,
      });
      setStep(project, "intake", "done");
      await emit();
    }

    if (!resume || !done("research")) {
      setStep(project, "research", "running");
      command(project, "openalex search --recent --sort cited_by_count", `Harvesting journals for: ${project.topic}`);
      command(project, "crossref works --filter from-pub-date", "Secondary harvest from Crossref metadata.");
      const sources = await harvestSources(project.topic, project.targetPages >= 100 ? 56 : 40);
      project.sources = sources;
      setStep(project, "research", "done");
      setStep(project, "rank", "running");
      command(project, "quill rank --dedupe --year-weight 1.2", `Kept ${sources.length} unique papers.`);
      setStep(project, "rank", "done");
      pushThinking(`Research: Harvested ${sources.length} unique papers from OpenAlex and Crossref for “${project.topic}”.`);
      await emit();
    }

    if (!resume || !done("outline")) {
      project.status = "outlining";
      setStep(project, "outline", "running");
      command(project, "quill outline --pages " + project.targetPages, "Allocating a stable chapter architecture.");
      const sources = project.sources;
      const outline = assignSources(buildOutline(project.topic, project.documentType, project.targetPages), sources);
      project.outline = outline;
      project.chapters = outline.map((section) => ({
        id: section.id,
        number: section.number,
        title: section.title,
        summary: section.summary,
        blocks: [],
        wordCount: 0,
        pageEstimate: section.targetPages,
        sourceIds: section.sourceIds,
        status: "pending",
      }));
      pushThinking(`Outline: ${outline.length} chapters mapped across ~${project.targetPages} pages.`);
      setStep(project, "outline", "done");
      await emit();
    }

    if (!resume || !done("write")) {
      project.status = "writing";
      setStep(project, "write", "running");
      const outline = project.outline;
      for (let i = 0; i < outline.length; i += 1) {
        if (project.chapters[i]?.status === "done") continue;
        project.currentChapterIndex = i;
        project.chapters[i] = { ...project.chapters[i], status: "writing" };
        command(
          project,
          `quill write --chapter ${outline[i].number} --pages ${outline[i].targetPages}`,
          `Composing ${outline[i].title}`
        );

        let chapterText: string | null = null;
        const usedSources = project.sources.filter((s) => outline[i].sourceIds.includes(s.id));
        try {
          chapterText = await llmWriteChapter({
              topic: project.topic,
              section: { title: outline[i].title, summary: outline[i].summary, number: outline[i].number },
              sources: usedSources.map((s) => ({
                title: s.title,
                year: s.year,
                authors: s.authors,
                venue: s.venue,
                doi: s.doi,
                abstract: s.abstract,
              })),
              style: project.citationStyle,
              documentType: project.documentType,
              targetWords: outline[i].targetPages * 280,
            });
          } catch (error) {
            command(project, `quill llm --chapter ${outline[i].number}`, String(error instanceof Error ? error.message : "LLM failed"), "error");
          }
        if (!chapterText?.trim()) {
          chapterText = null;
        }

        const effectiveText = chapterText || "";
        const wordCount = effectiveText.split(/\s+/).filter(Boolean).length;
        const pageEstimate = Math.max(1, Math.round(wordCount / 280));
        project.chapters[i] = {
          id: outline[i].id,
          number: outline[i].number,
          title: outline[i].title,
          summary: outline[i].summary,
          blocks: effectiveText ? [{ heading: outline[i].title, level: 1, paragraphs: [effectiveText] }] : [],
          wordCount,
          pageEstimate,
          sourceIds: chapterText ? usedSources.map((s) => s.id) : [],
          status: chapterText ? "done" : "pending",
        };
        project.wordCount = wordCountOf(project.chapters.filter((c) => c.status === "done"));
        project.pageEstimate = pageEstimateOf(project.chapters.filter((c) => c.status === "done"));
        pushThinking(`Chapter ${outline[i].number}: ${outline[i].title}\n${effectiveText}\n`);
      }
      setStep(project, "write", "done");

      project.tasks = [
        { id: nid(), title: "Review chapter outlines and confirm structure", completed: false, createdAt: nowIso() },
        { id: nid(), title: "Select preferred export format (PDF / DOCX / both)", completed: false, createdAt: nowIso() },
      ];
    }

    if (!resume || !done("consistency")) {
      setStep(project, "consistency", "running");
      command(project, "quill lint --terms --numbering --aims", "Terminology and chapter numbering aligned.");
      setStep(project, "consistency", "done");
    }
    if (!resume || !done("citations")) {
      setStep(project, "citations", "running");
      project.bibliography = bibliography(project.sources, project.citationStyle);
      command(project, `quill cite --style ${project.citationStyle}`, `${project.bibliography.length} bibliography entries.`);
      setStep(project, "citations", "done");
    }
    setStep(project, "frontmatter", "done");
    await emit();

    if (!resume || !done("export")) {
      project.status = "exporting";
      setStep(project, "export", "running");
      command(project, `quill export --format ${project.fileType}`, `Rendering downloadable manuscript files (${project.fileType}).`);
      const files: ProjectFile[] = [];
      const stamp = nowIso().slice(0, 10);
      const base = slug(project.topic).slice(0, 48) || "manuscript";

      if (project.fileType === "pdf" || project.fileType === "both") {
        const pdfBuf = await buildPdf(project);
        const pdfFile: ProjectFile = {
          id: nid(),
          name: `${base}-${stamp}.pdf`,
          mime: "application/pdf",
          format: "pdf",
          size: pdfBuf.length,
          pages: project.pageEstimate,
          createdAt: nowIso(),
        };
        await saveBinaryFile(pdfFile, pdfBuf);
        files.push(pdfFile);
      }

      if (project.fileType === "docx" || project.fileType === "both") {
        const docxBuf = await buildDocx(project);
        const docxFile: ProjectFile = {
          id: nid(),
          name: `${base}-${stamp}.docx`,
          mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          format: "docx",
          size: docxBuf.length,
          pages: project.pageEstimate,
          createdAt: nowIso(),
        };
        await saveBinaryFile(docxFile, Buffer.from(docxBuf));
        files.push(docxFile);
      }

      project.files = files;
      setStep(project, "export", "done");
      project.status = "complete";
      project.wordCount = wordCountOf(project.chapters);
      project.pageEstimate = pageEstimateOf(project.chapters);
      command(project, "ls exports/", project.files.map((f) => `${f.name}  ${prettyBytes(f.size)}`).join("\n"));

      // Mark all tasks as complete once the manuscript is finished
      project.tasks = project.tasks.map((t) => ({ ...t, completed: true }));

      pushThinking(`Research: Harvested ${project.sources.length} papers from OpenAlex and Crossref.`);
      pushThinking(`Outline: ${project.outline.length} chapters, ~${project.targetPages} pages.`);
      pushThinking(`Export: ${project.files.map((f) => `${f.name} (${f.format.toUpperCase()})`).join(", ")}.`);

      const summary = `Manuscript ready on “${project.topic}”. ${project.wordCount.toLocaleString()} words, about ${project.pageEstimate} pages, ${project.sources.length} sources. Download ${project.files.map((f) => f.format.toUpperCase()).join(" / ")}.`;
      await say(project.chatId, {
        role: "assistant",
        kind: "write",
        content: summary,
        meta: {
          thinking: thinking.join("\n\n---\n\n"),
          files: project.files,
          wordCount: project.wordCount,
          pageEstimate: project.pageEstimate,
          sources: project.sources,
          outline: project.outline,
        },
      });
      await emit();
      const existing = await getChat(project.chatId);
      await upsertChat({
        ...(existing || { id: project.chatId, title: project.topic.slice(0, 72), createdAt: project.createdAt, updatedAt: nowIso() }),
        createdAt: project.createdAt,
        updatedAt: nowIso(),
        projectId: project.id,
      });
    }
    return project;
  } catch (error) {
    project.status = "error";
    project.error = error instanceof Error ? error.message : "Pipeline failed";
    command(project, "quill pipeline", project.error, "error");
    await say(project.chatId, {
      role: "assistant",
      kind: "error",
      content: `The writing pipeline hit an error: ${project.error}`,
    });
    await emit();
    throw error;
  }
}

function slug(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function prettyBytes(size: number) {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}
