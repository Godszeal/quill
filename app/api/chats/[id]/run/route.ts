import { NextResponse } from "next/server";
import { addMessage, getChat, upsertChat } from "@/lib/db";
import { nid, nowIso } from "@/lib/ids";
import { createProjectDraft, runPipeline } from "@/lib/pipeline";
import type { CitationStyle, DocumentType } from "@/lib/types";
import { harvestSources } from "@/lib/research";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function POST() {
  return NextResponse.json({ ok: true, imports: "loaded" });
}
