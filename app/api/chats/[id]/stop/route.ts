import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-api";

// In-memory abort registry keyed by chatId.
// Works within a single serverless instance; sufficient to signal stop.
export const abortRegistry = new Map<string, AbortController>();

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req.headers);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const id = params.id;
  let controller = abortRegistry.get(id);
  if (!controller) {
    controller = new AbortController();
    abortRegistry.set(id, controller);
  }
  controller.abort();
  return NextResponse.json({ ok: true, stopped: true });
}
