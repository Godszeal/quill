import { NextResponse } from "next/server";
import { getChat, getProjectByChat, listMessages, usingMongo } from "@/lib/db";
import { mcpConfigured } from "@/lib/mcp";

export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { id: string } }) {
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
