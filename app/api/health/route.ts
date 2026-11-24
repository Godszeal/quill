import { NextResponse } from "next/server";
import { usingMongo } from "@/lib/db";
import { mcpConfigured } from "@/lib/mcp";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    mongo: usingMongo(),
    mcp: mcpConfigured(),
    name: "Quill",
  });
}
