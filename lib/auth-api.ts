import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { verifyJwt, createSessionToken } from "./jwt";
import { SESSION_NAME } from "./auth";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

function hashPassword(password: string, salt?: string) {
  const s = salt || randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(password + s).digest("hex");
  return { salt: s, hash };
}

export { hashPassword };

export function verifyPassword(password: string, stored: { salt: string; hash: string }) {
  const { hash } = hashPassword(password, stored.salt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(stored.hash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const { cookies } = await import("next/headers");
    const store = cookies();
    const token = store.get(SESSION_NAME)?.value;
    if (!token) return null;
    const user = verifyJwt(token);
    return user;
  } catch {
    return null;
  }
}

export async function requireAuth(headers: Headers) {
  const cookie = headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|; )${SESSION_NAME}=([^;]+)`));
  if (!match) return { error: "Unauthorized", status: 401 };
  const token = match[1];
  const user = verifyJwt(token);
  if (!user) return { error: "Session expired", status: 401 };
  return { user };
}

export async function createSession(user: SessionUser): Promise<string> {
  const token = createSessionToken(user);
  const { cookies } = await import("next/headers");
  const store = cookies();
  store.set(SESSION_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 30 * 24 * 60 * 60,
    path: "/",
  });
  return token;
}
