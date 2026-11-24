import { NextResponse } from "next/server";
import { listChats, upsertChat } from "@/lib/db";
import { nid, nowIso } from "@/lib/ids";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const auth = await requireAuth(req.headers);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const chats = await listChats();
  const mine = (chats || []).filter((c) => (c as any).userId === auth.user.id);
  return NextResponse.json({ chats: mine });
}

export async function POST(req: Request) {
  const auth = await requireAuth(req.headers);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const timestamp = nowIso();
  const chat = {
    id: nid(),
    title: "New manuscript",
    createdAt: timestamp,
    updatedAt: timestamp,
    userId: auth.user.id,
  };
  await upsertChat(chat);
  return NextResponse.json({ chat });
}
