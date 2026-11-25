import { createHash, randomBytes, timingSafeEqual } from "crypto";

const JWT_SECRET = process.env.AUTH_SECRET || "quill-dev-secret-change-me";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

export type SessionUser = {
  id: string;
  email: string;
  name: string;
};

function base64Url(buf: Buffer): string {
  return buf.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function signJwt(user: SessionUser): string {
  const exp = Math.floor(Date.now() / 1000) + SESSION_MAX_AGE;
  const header = base64Url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const body = base64Url(Buffer.from(JSON.stringify({ user, exp })));
  const signingInput = `${header}.${body}`;
  const sig = createHash("sha256").update(signingInput + "." + JWT_SECRET).digest();
  return `${signingInput}.${base64Url(sig)}`;
}

export function verifyJwt(token: string): SessionUser | null {
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
    return body.user as SessionUser;
  } catch {
    return null;
  }
}

export function createSessionToken(user: SessionUser): string {
  return signJwt(user);
}
