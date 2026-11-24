import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { Chat } from "@/lib/types";

const SESSION_NAME = "quill_session";
const SESSION_MAX_AGE = 30 * 24 * 60 * 60;

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
    const db = await connectAuthDb();
    if (!db) return null;
    const row = await db.collection("sessions").findOne({ token, expiresAt: { $gt: new Date() } });
    if (!row) return null;
    return row.user as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function createSession(user: SessionUser) {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  const db = await connectAuthDb();
  if (!db) throw new Error("Auth database unavailable");
  await db.collection("sessions").deleteMany({ "user.id": user.id });
  await db.collection("sessions").insertOne({ token, user, expiresAt, createdAt: new Date() });
  setSessionCookie(token);
  return token;
}

let _authDb: any = null;
async function connectAuthDb() {
  if (_authDb) return _authDb;
  const { connectMongo } = await import("./db");
  const { MongoClient, Db } = await import("mongodb");
  const uri = process.env.MONGODB_URI || "";
  if (!uri) return null;
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || "quill");
    await db.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
    await db.collection("users").createIndex({ email: 1 }, { unique: true });
    _authDb = db;
    return db;
  } catch {
    return null;
  }
}

export async function findUserByEmail(email: string) {
  const db = await connectAuthDb();
  if (!db) return null;
  return db.collection("users").findOne({ email });
}

export async function createUser(email: string, password: string, name: string) {
  const db = await connectAuthDb();
  if (!db) throw new Error("Auth database unavailable");
  const existing = await db.collection("users").findOne({ email });
  if (existing) throw new Error("Email already registered");
  const { salt, hash } = hashPassword(password);
  const id = `user_${randomBytes(8).toString("hex")}`;
  await db.collection("users").insertOne({ id, email, name, salt, hash, createdAt: new Date() });
  return { id, email, name };
}

export async function requireAuth(headers: Headers) {
  const cookie = headers.get("cookie") || "";
  const match = cookie.match(new RegExp(`(?:^|; )${SESSION_NAME}=([^;]+)`));
  if (!match) return { error: "Unauthorized", status: 401 };
  const token = match[1];
  const db = await connectAuthDb();
  if (!db) return { error: "Auth unavailable", status: 503 };
  const row = await db.collection("sessions").findOne({ token, expiresAt: { $gt: new Date() } });
  if (!row) return { error: "Session expired", status: 401 };
  return { user: row.user as unknown as SessionUser };
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
