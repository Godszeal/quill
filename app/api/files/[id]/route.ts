import { NextResponse } from "next/server";
import { getProject, readBinaryFile } from "@/lib/db";
import { requireAuth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req.headers);
  if ("error" in auth) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }
  const buffer = await readBinaryFile(params.id);
  if (!buffer) return NextResponse.json({ error: "File not found" }, { status: 404 });

  const url = new URL(req.url);
  const name = url.searchParams.get("name") || "manuscript";
  const inline = url.searchParams.get("inline") === "1";
  const isPdf = name.toLowerCase().endsWith(".pdf");
  const mime = isPdf
    ? "application/pdf"
    : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": mime,
      "Content-Length": String(buffer.length),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${name}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}

export async function POST(req: Request) {
  const { projectId, fileId } = await req.json();
  const project = await getProject(projectId);
  const file = project?.files.find((f) => f.id === fileId);
  if (!file) return NextResponse.json({ error: "Missing" }, { status: 404 });
  return NextResponse.json({ file });
}
