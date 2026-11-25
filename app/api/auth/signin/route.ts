import { NextResponse } from "next/server";
import { verifyPassword, createSession } from "@/lib/auth";
import { findUserByEmail } from "@/lib/auth-db";

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }
    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    const ok = verifyPassword(password, { salt: user.salt, hash: user.hash });
    if (!ok) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }
    await createSession({ id: user.id, email: user.email, name: user.name });
    return NextResponse.json({ ok: true, user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Signin failed" }, { status: 500 });
  }
}
