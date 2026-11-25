import { NextResponse } from "next/server";
import { getChat, getProjectByChat } from "@/lib/db";
import { runPipeline } from "@/lib/pipeline";
import { requireAuth } from "@/lib/auth-api";

export const dynamic = "force-dynamic";

type SlimProject = Pick<
  ReturnType<typeof import("@/lib/pipeline").createProjectDraft>,
  | "id"
  | "status"
  | "steps"
  | "commands"
  | "outline"
  | "files"
  | "sources"
  | "wordCount"
  | "pageEstimate"
  | "currentChapterIndex"
  | "topic"
  | "documentType"
  | "citationStyle"
  | "targetPages"
> & { chapters: Array<{ id: string; number: string; title: string; status: string; wordCount: number; pageEstimate: number }>; error?: string };

function slim(project: any): SlimProject {
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
    chapters: project.chapters.map((c: any) => ({
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

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req.headers);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const chat = await getChat(params.id);
  if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 });
  if ((chat as any).userId && (chat as any).userId !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const project = await getProjectByChat(params.id);
  if (!project) return NextResponse.json({ error: "No project found" }, { status: 404 });
  if (project.status === "complete" || project.status === "error") {
    return NextResponse.json({ ok: true, status: project.status });
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(JSON.stringify(payload) + "\n"));
      };
      try {
        send({ type: "resume", projectId: project.id });
        await runPipeline(project, async (next, message) => {
          send({ type: "tick", project: slim(next), message });
        }, true);
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
}
