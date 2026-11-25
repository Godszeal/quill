import { NextResponse } from "next/server";
import { abortRegistry } from "@/lib/abort";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  let controller = abortRegistry.get(id);
  if (!controller) {
    controller = new AbortController();
    abortRegistry.set(id, controller);
  }
  controller.abort();
  return NextResponse.json({ ok: true, stopped: true });
}
