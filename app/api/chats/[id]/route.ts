import { NextResponse } from "next/server";
import { getChat, getProjectByChat, listMessages, usingMongo } from "@/lib/db";
import { mcpConfigured } from "@/lib/mcp";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req.headers);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const chat = await getChat(params.id);
  if (!chat) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if ((chat as any).userId && (chat as any).userId !== auth.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const [messages, project] = await Promise.all([listMessages(params.id), getProjectByChat(params.id)]);
  return NextResponse.json({
    chat,
    messages,
    project,
    env: { mongo: usingMongo(), mcp: mcpConfigured() },
  });
}
