import { MongoClient, Db } from "mongodb";
import { randomBytes } from "crypto";
import { hashPassword } from "@/lib/auth";

let _authDb: Db | null = null;

async function connectAuthDb(): Promise<Db | null> {
  if (_authDb) return _authDb;
  const uri = process.env.MONGODB_URI || "";
  if (!uri) return null;
  try {
    const client = new MongoClient(uri);
    await client.connect();
    const db = client.db(process.env.MONGODB_DB || "quill");
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
  const id = `user_${require("crypto").randomBytes(8).toString("hex")}`;
  await db.collection("users").insertOne({ id, email, name, salt, hash, createdAt: new Date() });
  return { id, email, name };
}
