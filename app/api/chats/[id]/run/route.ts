import { NextResponse } from "next/server";
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
  const body = (await req.json()) as Body;
  return NextResponse.json({ ok: true, id: params.id, prompt: body.prompt });
}
