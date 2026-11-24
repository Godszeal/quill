import { NextResponse } from "next/server";
import { listChats, upsertChat } from "@/lib/db";
import { nid, nowIso } from "@/lib/ids";

export const dynamic = "force-dynamic";

export async function GET() {
  const chats = await listChats();
  return NextResponse.json({ chats });
}

export async function POST() {
  const timestamp = nowIso();
  const chat = {
    id: nid(),
    title: "New manuscript",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  await upsertChat(chat);
  return NextResponse.json({ chat });
}
