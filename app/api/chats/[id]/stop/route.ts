import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-api";
import { abortRegistry } from "@/lib/abort";

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
