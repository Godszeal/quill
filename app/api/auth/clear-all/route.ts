import { NextResponse } from "next/server";
import { clearAllData } from "@/lib/db";
import { clearSessionCookie } from "@/lib/auth";
import { requireAuth } from "@/lib/auth-api";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const auth = await requireAuth(req.headers);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    await clearAllData();
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to clear data" },
      { status: 500 }
    );
  }

  clearSessionCookie();
  return NextResponse.json({ ok: true });
}
