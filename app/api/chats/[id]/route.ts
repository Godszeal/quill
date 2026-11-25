import { NextResponse } from "next/server";
import { deleteChat, getChat, getProjectByChat, listMessages, upsertChat, usingMongo } from "@/lib/db";
import { mcpConfigured } from "@/lib/mcp";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const chat = await getChat(params.id);
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [messages, project] = await Promise.all([listMessages(params.id), getProjectByChat(params.id)]);
  return NextResponse.json({
    chat,
    messages,
    project,
    env: { mongo: usingMongo(), mcp: mcpConfigured() },
  });
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const chat = await getChat(params.id);
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { title } = await req.json();
  if (!title || typeof title !== "string" || !title.trim()) {
    return NextResponse.json({ error: "Title required" }, { status: 400 });
  }
  await upsertChat({
    ...chat,
    title: title.trim(),
    updatedAt: new Date().toISOString(),
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  const chat = await getChat(params.id);
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await deleteChat(params.id);
  return NextResponse.json({ ok: true });
}
