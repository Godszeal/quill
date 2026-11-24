import { NextResponse } from "next/server";
import { addMessage, getChat, upsertChat } from "@/lib/db";
import { nid, nowIso } from "@/lib/ids";
import type { CitationStyle, DocumentType } from "@/lib/types";

export const dynamic = "force-dynamic";

type Body = {
  prompt: string;
  documentType?: DocumentType;
  citationStyle?: CitationStyle;
  targetPages?: number;
  authorName?: string;
  institution?: string;
  mode?: "write" | "research" | "chat";
};

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const chat = await getChat(params.id);
    if (!chat) return NextResponse.json({ error: "Chat not found" }, { status: 404 });

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
      title: chat.title === "New manuscript" ? prompt.slice(0, 72) : chat.title,
      updatedAt: nowIso(),
    });

    const mode = body.mode || inferMode(prompt);
    if (mode === "chat") {
      await addMessage(params.id, {
        id: nid(),
        role: "assistant",
        kind: "text",
        content: helpText(),
        createdAt: nowIso(),
      });
      return NextResponse.json({ ok: true, mode });
    }

    return NextResponse.json({ ok: true, mode, id: params.id });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

function inferMode(prompt: string): Body["mode"] {
  const q = prompt.toLowerCase();
  if (/^(help|hi|hello|what can you do|how does this work)\b/.test(q)) return "chat";
  if (/\b(find|search|latest journals?|papers? only|harvest)\b/.test(q) && q.length < 180) return "research";
  return "write";
}

function helpText() {
  return [
    "I am Quill, a long-form research writing agent.",
    "Give me a topic, pick document type, citation style, and page length, then I will:",
    "1. Harvest recent journals from OpenAlex and Crossref",
    "2. Rank and deduplicate sources",
    "3. Lock a consistent chapter outline",
    "4. Write 20–150+ pages chapter by chapter",
    "5. Assemble citations and export PDF + DOCX",
    "You can also ask me to search papers only, or start a new chat anytime.",
  ].join("\n");
}
