import { MongoClient, Db, GridFSBucket, ObjectId } from "mongodb";
import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type { Chat, ChatMessage, Project, ProjectFile } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_DIR = path.join(DATA_DIR, "files");
const TMP_DIR = "/tmp/quill-data";
const TMP_FILE_DIR = path.join(TMP_DIR, "files");

type Collections = {
  chats: Chat[];
  messages: (ChatMessage & { chatId: string })[];
  projects: Project[];
};

const emptyStore = (): Collections => ({
  chats: [],
  messages: [],
  projects: [],
});

let mongoClient: MongoClient | null = null;
let mongoDb: Db | null = null;
let fileCache: Collections | null = null;
let useInMemoryFallback = false;

function mongoUri() {
  return process.env.MONGODB_URI || "";
}

async function connectMongo(): Promise<Db | null> {
  const uri = mongoUri();
  if (!uri) return null;
  if (mongoDb) return mongoDb;
  try {
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    mongoDb = mongoClient.db(process.env.MONGODB_DB || "quill");
    await mongoDb.collection("chats").createIndex({ updatedAt: -1 });
    await mongoDb.collection("messages").createIndex({ chatId: 1, createdAt: 1 });
    await mongoDb.collection("projects").createIndex({ chatId: 1 });
    return mongoDb;
  } catch {
    mongoClient = null;
    mongoDb = null;
    return null;
  }
}

function stripMongo<T>(doc: (T & { _id?: unknown }) | null): T | null {
  if (!doc) return null;
  const copy = { ...doc };
  delete copy._id;
  return copy;
}

async function ensureFileStore() {
  if (useInMemoryFallback) {
    if (!fileCache) fileCache = emptyStore();
    return;
  }
  const dir = process.env.VERCEL ? TMP_DIR : DATA_DIR;
  const fileDir = process.env.VERCEL ? TMP_FILE_DIR : FILE_DIR;
  try {
    await mkdir(dir, { recursive: true });
    await mkdir(fileDir, { recursive: true });
  } catch {
    useInMemoryFallback = true;
    if (!fileCache) fileCache = emptyStore();
    return;
  }
  const storePath = path.join(dir, "store.json");
  try {
    const raw = await readFile(storePath, "utf8");
    fileCache = JSON.parse(raw) as Collections;
  } catch {
    fileCache = emptyStore();
    try {
      await writeFile(storePath, JSON.stringify(fileCache, null, 2));
    } catch {
      useInMemoryFallback = true;
    }
  }
}

async function persistFileStore() {
  if (!fileCache || useInMemoryFallback) return;
  const dir = process.env.VERCEL ? TMP_DIR : DATA_DIR;
  try {
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, "store.json"), JSON.stringify(fileCache, null, 2));
  } catch {
    useInMemoryFallback = true;
  }
}

export { connectMongo };

export function usingMongo() {
  return Boolean(mongoUri());
}

export async function listChats(): Promise<Chat[]> {
  const db = await connectMongo();
  if (db) {
    const rows = await db.collection<Chat>("chats").find({}).sort({ updatedAt: -1 }).toArray();
    return rows.map((row) => stripMongo(row)!);
  }
  await ensureFileStore();
  return [...(fileCache?.chats || [])].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getChat(id: string): Promise<Chat | null> {
  const db = await connectMongo();
  if (db) return stripMongo(await db.collection<Chat>("chats").findOne({ id }));
  await ensureFileStore();
  return fileCache?.chats.find((c) => c.id === id) || null;
}

export async function upsertChat(chat: Chat) {
  const db = await connectMongo();
  if (db) {
    await db.collection("chats").updateOne({ id: chat.id }, { $set: chat }, { upsert: true });
    return;
  }
  await ensureFileStore();
  const idx = fileCache!.chats.findIndex((c) => c.id === chat.id);
  if (idx >= 0) fileCache!.chats[idx] = chat;
  else fileCache!.chats.unshift(chat);
  await persistFileStore();
}

export async function listMessages(chatId: string): Promise<ChatMessage[]> {
  const db = await connectMongo();
  if (db) {
    const rows = await db
      .collection<ChatMessage & { chatId: string }>("messages")
      .find({ chatId })
      .sort({ createdAt: 1 })
      .toArray();
    return rows.map((row) => {
      const { chatId: _chatId, ...rest } = row as ChatMessage & { chatId: string; _id?: unknown };
      delete (rest as { _id?: unknown })._id;
      return rest as ChatMessage;
    });
  }
  await ensureFileStore();
  return (fileCache?.messages || [])
    .filter((m) => m.chatId === chatId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map(({ chatId: _c, ...rest }) => rest as ChatMessage);
}

export async function addMessage(chatId: string, message: ChatMessage) {
  const db = await connectMongo();
  if (db) {
    await db.collection("messages").insertOne({ ...message, chatId });
    return;
  }
  await ensureFileStore();
  fileCache!.messages.push({ ...message, chatId });
  await persistFileStore();
}

export async function getProject(id: string): Promise<Project | null> {
  const db = await connectMongo();
  if (db) return stripMongo(await db.collection<Project>("projects").findOne({ id }));
  await ensureFileStore();
  return fileCache?.projects.find((p) => p.id === id) || null;
}

export async function getProjectByChat(chatId: string): Promise<Project | null> {
  const db = await connectMongo();
  if (db) return stripMongo(await db.collection<Project>("projects").findOne({ chatId }));
  await ensureFileStore();
  return fileCache?.projects.find((p) => p.chatId === chatId) || null;
}

export async function deleteChat(id: string) {
  const db = await connectMongo();
  if (db) {
    await db.collection("chats").deleteOne({ id });
    await db.collection("messages").deleteMany({ chatId: id });
    await db.collection("projects").deleteOne({ chatId: id });
    return;
  }
  await ensureFileStore();
  if (fileCache) {
    fileCache.chats = fileCache.chats.filter((c) => c.id !== id);
    fileCache.messages = fileCache.messages.filter((m) => m.chatId !== id);
    fileCache.projects = fileCache.projects.filter((p) => p.chatId !== id);
    await persistFileStore();
  }
}

export async function upsertProject(project: Project) {
  const db = await connectMongo();
  if (db) {
    await db.collection("projects").updateOne({ id: project.id }, { $set: project }, { upsert: true });
    return;
  }
  await ensureFileStore();
  const idx = fileCache!.projects.findIndex((p) => p.id === project.id);
  if (idx >= 0) fileCache!.projects[idx] = project;
  else fileCache!.projects.push(project);
  await persistFileStore();
}

export async function saveBinaryFile(file: ProjectFile, buffer: Buffer) {
  const db = await connectMongo();
  if (db) {
    const bucket = new GridFSBucket(db, { bucketName: "exports" });
    await new Promise<void>((resolve, reject) => {
      const stream = bucket.openUploadStream(file.id, {
        metadata: { name: file.name, format: file.format, mime: file.mime },
      });
      stream.on("finish", () => resolve());
      stream.on("error", reject);
      stream.end(buffer);
    });
    return;
  }
  await ensureFileStore();
  const fileDir = process.env.VERCEL ? TMP_FILE_DIR : FILE_DIR;
  try {
    await mkdir(fileDir, { recursive: true });
    await writeFile(path.join(fileDir, file.id), buffer);
  } catch {
    // File system is read-only; file export not available in this environment
  }
}

export async function readBinaryFile(fileId: string): Promise<Buffer | null> {
  const db = await connectMongo();
  if (db) {
    const bucket = new GridFSBucket(db, { bucketName: "exports" });
    const files = await db.collection("exports.files").find({ filename: fileId }).toArray();
    if (!files.length) return null;
    const chunks: Buffer[] = [];
    await new Promise<void>((resolve, reject) => {
      const stream = bucket.openDownloadStream(files[0]._id as ObjectId);
      stream.on("data", (c) => chunks.push(Buffer.from(c)));
      stream.on("end", () => resolve());
      stream.on("error", reject);
    });
    return Buffer.concat(chunks);
  }
  try {
    const fileDir = process.env.VERCEL ? TMP_FILE_DIR : FILE_DIR;
    return await readFile(path.join(fileDir, fileId));
  } catch {
    return null;
  }
}

export async function clearAllData(): Promise<void> {
  const db = await connectMongo();
  if (db) {
    await db.collection("chats").deleteMany({});
    await db.collection("messages").deleteMany({});
    await db.collection("projects").deleteMany({});
    try {
      const bucket = new GridFSBucket(db, { bucketName: "exports" });
      const files = await db.collection("exports.files").find({}).toArray();
      for (const f of files) {
        await bucket.delete(f._id as ObjectId);
      }
    } catch {
      // ignore GridFS cleanup errors
    }
    return;
  }
  await ensureFileStore();
  if (fileCache) {
    fileCache.chats = [];
    fileCache.messages = [];
    fileCache.projects = [];
    await persistFileStore();
  }
  // Clear exported files from disk
  try {
    const fileDir = process.env.VERCEL ? TMP_FILE_DIR : FILE_DIR;
    const entries = await (() => {
      try {
        return require("fs/promises").readdir(fileDir);
      } catch {
        return [];
      }
    })();
    for (const entry of entries) {
      try {
        await require("fs/promises").unlink(path.join(fileDir, entry));
      } catch {
        // ignore
      }
    }
  } catch {
    // ignore
  }
}
