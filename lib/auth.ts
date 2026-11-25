import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";

const SESSION_NAME = "quill_session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;
const JWT_SECRET = process.env.AUTH_SECRET || "quill-dev-secret-change-me";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

function base64Url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function signJwt(payload: object): string {
  const header = base64Url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = base64Url(Buffer.from(JSON.stringify(payload)));
  const signingInput = `${header}.${body}`;
  const sig = createHash("sha256").update(signingInput + "." + JWT_SECRET).digest();
  return `${signingInput}.${base64Url(sig)}`;
}

function verifyJwt(token: string): { user: SessionUser; exp: number } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const [headerB64, bodyB64, sigB64] = parts;
    const signingInput = `${headerB64}.${bodyB64}`;
    const expected = createHash("sha256").update(signingInput + "." + JWT_SECRET).digest();
    const expectedB64 = base64Url(expected);
    if (!timingSafeEqual(Buffer.from(sigB64, "base64"), Buffer.from(expectedB64, "base64"))) return null;
    const body = JSON.parse(Buffer.from(bodyB64, "base64").toString("utf8"));
    if (!body.user || typeof body.exp !== "number") return null;
    if (Date.now() > body.exp * 1000) return null;
    return { user: body.user as SessionUser, exp: body.exp };
  } catch {
    return null;
  }
}

function hashPassword(password: string, salt?: string) {
  const s = salt || randomBytes(16).toString("hex");
  const hash = createHash("sha256").update(password + s).digest("hex");
  return { salt: s, hash };
}

export function verifyPassword(password: string, stored: { salt: string; hash: string }) {
  const { hash } = hashPassword(password, stored.salt);
  const a = Buffer.from(hash, "hex");
  const b = Buffer.from(stored.hash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function setSessionCookie(token: string) {
  const store = cookies();
  store.set(SESSION_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });
}

export function clearSessionCookie() {
  const store = cookies();
  store.set(SESSION_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
}

export async function getSessionUser(): Promise<SessionUser | null> {
  try {
    const store = cookies();
    const token = store.get(SESSION_NAME)?.value;
    if (!token) return null;
    const decoded = verifyJwt(token);
    if (!decoded) return null;
    return decoded.user;
  } catch {
    return null;
  }
}

export async function createSession(user: SessionUser): Promise<string> {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const token = signJwt({ user, exp });
  setSessionCookie(token);
  return token;
}

export async function requireAuth(headers: Headers) {
  const cookie = headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|; )${SESSION_NAME}=([^;]+)`));
  if (!match) return { error: "Unauthorized", status: 401 };
  const token = match[1];
  const decoded = verifyJwt(token);
  if (!decoded) return { error: "Session expired", status: 401 };
  return { user: decoded.user };
}

export async function ensureChatOwnership(chatId: string, userId: string) {
  const { getChat } = await import("./db");
  const chat = await getChat(chatId);
  if (!chat) return { error: "Chat not found", status: 404 };
  if ((chat as any).userId && (chat as any).userId !== userId) {
    return { error: "Forbidden", status: 403 };
  }
  return { chat };
}

export { hashPassword };
