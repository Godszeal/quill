import { NextResponse } from "next/server";
import { addMessage, getChat, upsertChat } from "@/lib/db";
import { nid, nowIso } from "@/lib/ids";
import { createProjectDraft, runPipeline } from "@/lib/pipeline";
import type { CitationStyle, DocumentType } from "@/lib/types";
import { harvestSources } from "@/lib/research";
import { requireAuth } from "@/lib/auth-api";
import { llmNameChat, llmChat } from "@/lib/llm";

export const dynamic = "force-dynamic";

type Body = {
  prompt: string;
  documentType?: DocumentType;
  citationStyle?: CitationStyle;
  targetPages?: number;
  authorName?: string;
  institution?: string;
  fileType?: "pdf" | "docx" | "both";
  /** Optional. When "write" or omitted, server still infers so greetings stay chat. */
  mode?: "write" | "research" | "chat";
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req.headers);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const chat = await getChat(params.id);
    if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    if ((chat as any).userId && (chat as any).userId !== auth.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = (await req.json()) as Body;
    const prompt = (body.prompt || "").trim();
    if (!prompt) return NextResponse.json({ error: "Prompt required" }, { status: 400 });

    await addMessage(params.id, {
      id: nid(),
      role: "user",
      kind: "text",
      content: prompt,
      createdAt: nowIso(),
    });

    await upsertChat({
      ...chat,
      title: chat.title === "New manuscript" ? await llmNameChat(prompt) : chat.title,
      updatedAt: nowIso(),
    });

    // Always prefer inference for short greetings even if the UI sends mode=write.
    const inferred = inferMode(prompt);
    const mode =
      body.mode === "research" || body.mode === "chat"
        ? body.mode
        : inferred;

    if (mode === "research") {
      const sources = await harvestSources(prompt, 24);
      await addMessage(params.id, {
        id: nid(),
        role: "assistant",
        kind: "sources",
        content: `Latest journal harvest for “${prompt}”: ${sources.length} papers from OpenAlex and Crossref.`,
        createdAt: nowIso(),
        meta: { sources },
      });
      return NextResponse.json({ ok: true, mode });
    }

    if (mode === "chat") {
      const reply = await llmChat(prompt);
      await addMessage(params.id, {
        id: nid(),
        role: "assistant",
        kind: "text",
        content: reply,
        createdAt: nowIso(),
      });
      return NextResponse.json({ ok: true, mode });
    }

    const encoder = new TextEncoder();
    const project = createProjectDraft({
      chatId: params.id,
      topic: prompt,
      documentType: body.documentType || "undergraduate",
      citationStyle: body.citationStyle || "apa",
      targetPages: clampPages(body.targetPages),
      authorName: body.authorName || "Author",
      institution: body.institution || "Institution",
      fileType: body.fileType || "both",
    });

    const stream = new ReadableStream({
      async start(controller) {
        const send = (payload: unknown) => {
          controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));
        };
        try {
          send({ type: "start", projectId: project.id });
          await runPipeline(project, async (next, message) => {
            send({
              type: "tick",
              project: slim(next),
              message,
            });
          });
          send({ type: "done", project: slim(project) });
        } catch (error) {
          send({ type: "error", error: error instanceof Error ? error.message : "Failed" });
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

function inferMode(prompt: string): NonNullable<Body["mode"]> {
  const q = prompt.toLowerCase().trim();
  if (
    /^(help|hi|hello|hey|yo|sup|thanks|thank you|ok|okay|cool|great|nice|good morning|good afternoon|good evening)\b/.test(
      q
    )
  )
    return "chat";
  if (/^(what can you do|how does this work|who are you|what is quill|how are you)\b/.test(q)) return "chat";
  if (q.length <= 48 && /^(ai|llm|chat|talk|converse|assistant|agent)\b/.test(q)) return "chat";
  if (/\b(find|search|latest journals?|papers? only|harvest|sources only)\b/.test(q) && q.length < 180)
    return "research";
  return "write";
}

function clampPages(pages?: number) {
  const n = Number(pages) || 40;
  return Math.min(160, Math.max(12, Math.round(n)));
}

function slim(project: ReturnType<typeof createProjectDraft>) {
  return {
    id: project.id,
    status: project.status,
    steps: project.steps,
    commands: project.commands.slice(-8),
    outline: project.outline,
    sources: project.sources.slice(0, 12),
    files: project.files,
    wordCount: project.wordCount,
    pageEstimate: project.pageEstimate,
    currentChapterIndex: project.currentChapterIndex,
    chapters: project.chapters.map((c) => ({
      id: c.id,
      number: c.number,
      title: c.title,
      status: c.status,
      wordCount: c.wordCount,
      pageEstimate: c.pageEstimate,
    })),
    topic: project.topic,
    documentType: project.documentType,
    citationStyle: project.citationStyle,
    targetPages: project.targetPages,
    error: project.error,
  };
}
