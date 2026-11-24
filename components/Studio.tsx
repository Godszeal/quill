"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import {
  BookMarked,
  ChevronRight,
  EllipsisVertical,
  Loader2,
  Menu,
  Plus,
  Search,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { CITATION_STYLES, DOCUMENT_TYPES, PAGE_OPTIONS } from "@/lib/types";
import type { Chat, ChatMessage, CitationStyle, DocumentType, Project } from "@/lib/types";
import { SelectField } from "./SelectField";
import { RichText } from "./RichText";
import { CommandCard, extraFor } from "./MessageCards";

type SlimProject = Pick<
  Project,
  | "id"
  | "status"
  | "steps"
  | "commands"
  | "outline"
  | "files"
  | "wordCount"
  | "pageEstimate"
  | "currentChapterIndex"
  | "topic"
  | "documentType"
  | "citationStyle"
  | "targetPages"
> & { chapters: Array<{ id: string; number: string; title: string; status: string; wordCount: number; pageEstimate: number }> };

export function Studio() {
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [project, setProject] = useState<SlimProject | null>(null);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [sidebar, setSidebar] = useState(typeof window === "undefined" ? true : window.innerWidth < 768);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>("undergraduate");
  const [citationStyle, setCitationStyle] = useState<CitationStyle>("apa");
  const [targetPages, setTargetPages] = useState("40");
  const [authorName, setAuthorName] = useState("");
  const [institution, setInstitution] = useState("");
  const [mode, setMode] = useState<"write" | "research">("write");
  const scroller = useRef<HTMLDivElement>(null);
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [typingChars, setTypingChars] = useState(0);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadChats = async () => {
    const res = await fetch("/api/chats");
    const data = await res.json();
    setChats(data.chats || []);
    return (data.chats || []) as Chat[];
  };

  const openChat = async (id: string) => {
    setChatId(id);
    if (typeof window !== "undefined" && window.innerWidth < 768) setSidebar(false);
    const res = await fetch(`/api/chats/${id}`);
    const data = await res.json();
    setMessages(data.messages || []);
    setProject(data.project || null);
  };

  const newChat = async () => {
    const res = await fetch("/api/chats", { method: "POST" });
    const data = await res.json();
    await loadChats();
    setMessages([]);
    setProject(null);
    setChatId(data.chat.id);
    if (typeof window !== "undefined" && window.innerWidth < 768) setSidebar(false);
    setSettingsOpen(false);
  };

  const deleteChat = async (id: string) => {
    if (!window.confirm("Delete this chat?")) return;
    await fetch(`/api/chats/${id}`, { method: "DELETE" });
    await loadChats();
    if (chatId === id) {
      const list = chats.filter((c) => c.id !== id);
      if (list[0]) await openChat(list[0].id);
      else await newChat();
    }
  };

  useEffect(() => {
    (async () => {
      const list = await loadChats();
      if (list[0]) await openChat(list[0].id);
      else await newChat();
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [messages, project, busy]);

  useEffect(() => {
    if (!typingMessageId) {
      setTypingChars(0);
      return;
    }
    const msg = messages.find((m) => m.id === typingMessageId);
    if (!msg) return;
    const target = msg.content.length;
    if (typingChars >= target) return;
    typingTimer.current = setTimeout(() => setTypingChars((c) => Math.min(c + 3, target)), 20);
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [typingMessageId, typingChars, messages]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, []);

  const submit = async (event?: FormEvent, preset?: string) => {
    event?.preventDefault();
    const text = (preset || prompt).trim();
    if (!text || busy) return;
    let id = chatId;
    if (!id) {
      const res = await fetch("/api/chats", { method: "POST" });
      const data = await res.json();
      id = data.chat.id;
      setChatId(id);
    }
    setPrompt("");
    setBusy(true);
    setMessages((m) => [
      ...m,
      { id: crypto.randomUUID(), role: "user", kind: "text", content: text, createdAt: new Date().toISOString() },
    ]);
    try {
      const res = await fetch(`/api/chats/${id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: text,
          documentType,
          citationStyle,
          targetPages: Number(targetPages),
          authorName,
          institution,
          mode,
        }),
      });
      const ctype = res.headers.get("content-type") || "";
      if (ctype.includes("ndjson") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() || "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const evt = JSON.parse(line);
            if (evt.project) setProject(evt.project);
            if (evt.message) {
              setMessages((m) => [...m, evt.message]);
              if (evt.message.role === "assistant" && evt.message.kind === "text") {
                setTypingMessageId(evt.message.id);
                setTypingChars(0);
              }
            }
          }
        }
      } else {
        await openChat(id!);
      }
      await loadChats();
    } finally {
      setBusy(false);
      if (id)       await openChat(id);
    }
  };

  return (
    <div className="flex h-[100dvh] bg-[#fafafa] text-[#181818]">
      {/* Sidebar */}
      <aside
        className={`hidden lg:flex flex-col w-72 border-r border-[#e5e5e5] bg-white z-20 transition-all duration-300 ${
          sidebar ? "" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-[#e5e5e5] bg-white shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-[#181818] flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">Q</span>
            </div>
            <span className="text-sm font-semibold tracking-tight">Quill</span>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <div className="flex items-center justify-between px-2">
            <button
              onClick={newChat}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-sm font-medium hover:bg-[#f2f2f2] transition-colors"
            >
              <Plus className="w-4 h-4" /> New chat
            </button>
          </div>

          <div className="space-y-1">
            {chats.map((c) => (
              <button
                key={c.id}
                onClick={() => openChat(c.id)}
                onContextMenu={(e) => {
                  e.preventDefault();
                  deleteChat(c.id);
                }}
                className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                  c.id === chatId
                    ? "bg-[#f2f2f2] text-[#181818]"
                    : "text-[#666] hover:bg-[#f2f2f2]"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{c.title}</p>
                  <p className="truncate text-[10px] text-[#888] mt-0.5">{new Date(c.updatedAt).toLocaleDateString()}</p>
                </div>
                <EllipsisVertical className="w-4 h-4 opacity-0 group-hover:opacity-100 text-[#666]" />
              </button>
            ))}
          </div>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebar && typeof window !== "undefined" && window.innerWidth < 768 && (
        <div className="lg:hidden fixed inset-0 z-30 bg-black/40 backdrop-blur-sm" onClick={() => setSidebar(false)} />
      )}
      {sidebar && typeof window !== "undefined" && window.innerWidth < 768 && (
        <aside className="lg:hidden fixed left-0 top-0 z-40 w-[85vw] max-w-md h-full bg-white border-r border-[#e5e5e5] shadow-xl transform transition-transform duration-300 flex flex-col">
          <div className="h-12 flex items-center justify-between px-4 border-b border-[#e5e5e5] shrink-0">
            <span className="font-semibold text-sm">Chats</span>
            <button onClick={() => setSidebar(false)} className="text-[#666] hover:text-[#181818]">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <button
              onClick={newChat}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-sm font-medium hover:bg-[#f2f2f2] transition-colors"
            >
              <Plus className="w-4 h-4" /> New chat
            </button>
            <div className="space-y-1">
              {chats.map((c) => (
                <button
                  key={c.id}
                  onClick={() => { openChat(c.id); setSidebar(false); }}
                  className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    c.id === chatId ? "bg-[#f2f2f2] text-[#181818]" : "text-[#666] hover:bg-[#f2f2f2]"
                  }`}
                >
                  <p className="truncate text-sm">{c.title}</p>
                </button>
              ))}
            </div>
          </div>
        </aside>
      )}

      {/* Main */}
      <main className="flex-1 flex flex-col relative">
        <header className="h-16 border-b border-[#e5e5e5] bg-white/80 backdrop-blur flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 text-[#666] hover:text-[#181818]" onClick={() => setSidebar(!sidebar)}>
              <Menu className="w-5 h-5" />
            </button>
            <div className="flex flex-col">
              <p className="text-sm font-semibold truncate max-w-[400px]">{project?.topic || "Start a new manuscript"}</p>
              <p className="text-[11px] text-[#666] truncate max-w-[400px]">
                {busy ? "Writing in progress…" : project?.status === "complete" ? `${project.pageEstimate} pages ready` : "Long-form research writing agent"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSettingsOpen(!settingsOpen)}
              className="p-2 rounded-full text-[#666] hover:bg-[#f2f2f2] hover:text-[#181818] transition-colors"
              aria-label="Settings"
            >
              <EllipsisVertical className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* Chat area */}
        <div ref={scroller} className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="mx-auto max-w-3xl w-full">
            {!messages.length && !busy ? (
              <EmptyState onPick={(t) => submit(undefined, t)} />
            ) : (
              <div className="space-y-6">
                {messages.map((m) => (
                  <article key={m.id} className="flex gap-4">
                    {m.role === "user" ? (
                      <>
                        <div className="hidden md:block w-8 h-8 rounded-full bg-[#f2f2f2] flex items-center justify-center">
                          <span className="text-[10px] text-[#666]">U</span>
                        </div>
                        <div className="ml-auto max-w-[85%]">
                          <div className="rounded-2xl rounded-bl-none bg-[#f2f2f2] p-4 text-sm leading-relaxed text-[#181818]">
                            {m.content}
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-8 h-8 rounded-full bg-[#181818] flex items-center justify-center shrink-0">
                          <span className="text-[10px] font-bold text-white">Q</span>
                        </div>
                        <div className="max-w-[90%]">
                          {m.kind !== "plan" ? (
                            <div className="rounded-2xl rounded-br-none border border-[#e5e5e5] bg-white p-4">
                              <TypingText text={m.content} chars={typingMessageId === m.id ? typingChars : m.content.length} />
                            </div>
                          ) : null}
                          {extraFor(m)}
                        </div>
                      </>
                    )}
                  </article>
                ))}
                {project && busy ? (
                  <article className="flex gap-4">
                    <div className="w-8 h-8 rounded-full bg-[#181818] flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-white">Q</span>
                    </div>
                    <div className="max-w-[90%]">
                      <div className="rounded-2xl rounded-br-none border border-[#e5e5e5] bg-white p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <Loader2 className="w-3 h-3 animate-spin text-[#181818]" />
                          <span className="text-xs font-medium text-[#181818]">
                            {project.steps.find((s) => s.status === "running")?.label || "Writing in progress…"}
                          </span>
                        </div>
                        <div className="w-full bg-[#f2f2f2] rounded-full h-1.5 mb-3">
                          <div
                            className="bg-[#181818] h-1.5 rounded-full transition-all duration-500"
                            style={{ width: `${Math.round(((project.steps.filter((s) => s.status === "done").length) / Math.max(project.steps.length, 1)) * 100)}%` }}
                          />
                        </div>
                        <ol className="grid gap-2 sm:grid-cols-2 text-[10px]">
                          {project.steps.map((s) => {
                            const isDone = s.status === "done";
                            const isRunning = s.status === "running";
                            const liClass = `flex items-center gap-2 px-2 py-1.5 rounded-lg border ${isRunning ? "border-[#d6b36a] bg-[#fdf6e3]" : isDone ? "bg-[#f2f2f2]" : "border-transparent bg-transparent"}`;
                            const dotClass = `h-2 w-2 rounded-full shrink-0 ${isDone ? "bg-[#181818]" : isRunning ? "bg-[#d6b36a]" : "bg-[#e5e5e5]"}`;
                            const labelClass = `text-xs font-medium ${isDone ? "text-[#181818]" : isRunning ? "text-[#92400e]" : "text-[#888]"}`;
                            return (
                              <li key={s.id} className={liClass}>
                                <span className={dotClass} />
                                <span className={labelClass}>{s.label}</span>
                                {isDone && <ChevronRight className="w-3 h-3 ml-auto text-[#ccc]" />}
                              </li>
                            );
                          })}
                        </ol>
                        <CommandCard commands={project.commands} />
                      </div>
                    </div>
                  </article>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Settings panel */}
        {settingsOpen && (
          <div className="absolute inset-0 z-50 bg-[#fafafa] flex flex-col">
            <div className="h-16 border-b border-[#e5e5e5] flex items-center justify-between px-6">
              <button onClick={() => setSettingsOpen(false)} className="text-[#666] hover:text-[#181818]">
                Back
              </button>
              <span className="text-sm font-semibold">Settings</span>
              <div className="w-8" />
            </div>
            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#666]">Document type</p>
                <SelectField
                  label="Type"
                  value={documentType}
                  onChange={(v) => setDocumentType(v as DocumentType)}
                  options={DOCUMENT_TYPES.map((d) => ({ value: d.value, label: d.label }))}
                />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#666]">Citation style</p>
                <SelectField
                  label="Style"
                  value={citationStyle}
                  onChange={(v) => setCitationStyle(v as CitationStyle)}
                  options={CITATION_STYLES}
                />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#666]">Target pages</p>
                <SelectField
                  label="Pages"
                  value={targetPages}
                  onChange={setTargetPages}
                  options={PAGE_OPTIONS.map((n) => ({ value: String(n), label: `${n}+ pages` }))}
                />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#666]">Author</p>
                <input
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Author name"
                  className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[#181818] outline-none"
                />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#666]">Institution</p>
                <input
                  value={institution}
                  onChange={(e) => setInstitution(e.target.value)}
                  placeholder="Institution / university"
                  className="w-full rounded-lg border border-[#e5e5e5] bg-white px-3 py-2 text-sm focus:ring-2 focus:ring-[#181818] outline-none"
                />
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#666]">Mode</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMode("write")}
                    className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                      mode === "write" ? "bg-[#181818] text-white" : "bg-white border border-[#e5e5e5] text-[#666] hover:bg-[#f2f2f2]"
                    }`}
                  >
                    Write
                  </button>
                  <button
                    onClick={() => setMode("research")}
                    className={`rounded-lg py-2 text-sm font-medium transition-colors ${
                      mode === "research" ? "bg-[#181818] text-white" : "bg-white border border-[#e5e5e5] text-[#666] hover:bg-[#f2f2f2]"
                    }`}
                  >
                    Journals
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Composer */}
        <footer className="h-auto p-4 md:p-6 border-t border-[#e5e5e5] bg-white shrink-0 z-10">
          <div className="mx-auto max-w-3xl w-full">
            <div className="flex items-end gap-3">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={1}
                onInput={(e) => {
                  const el = e.target as HTMLTextAreaElement;
                  el.style.height = "auto";
                  el.style.height = `${el.scrollHeight}px`;
                }}
                placeholder="Message Quill…"
                className="flex-1 resize-none rounded-xl border border-[#e5e5e5] bg-[#fafafa] px-4 py-3 text-sm text-[#181818] outline-none focus:ring-2 focus:ring-[#181818] min-h-[48px] max-h-[160px]"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
              <button
                disabled={busy || !prompt.trim()}
                onClick={submit}
                className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${
                  busy || !prompt.trim()
                    ? "bg-[#e5e5e5] text-[#999]"
                    : "bg-[#181818] text-white hover:bg-[#333]"
                }`}
                aria-label="Send"
              >
                {busy ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Send className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>
        </footer>
      </main>
    </div>
  );
}

function TypingText({ text, chars }: { text: string; chars: number }) {
  const visible = text.slice(0, chars);
  const done = chars >= text.length;
  return (
    <div className="relative">
      {visible}
      {!done && (
        <span className="animate-pulse inline-block w-1 h-[1em] bg-[#181818] ml-0.5" />
      )}
    </div>
  );
}

function EmptyState({ onPick }: { onPick: (topic: string) => void }) {
  const samples = [
    "The role of large language models in academic research integrity",
    "Renewable microgrids for rural electrification in sub-Saharan Africa",
    "Antimicrobial resistance surveillance using wastewater epidemiology",
    "Digital public infrastructure and financial inclusion in emerging markets",
  ];
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-12">
      <div className="w-16 h-16 rounded-full bg-[#f2f2f2] flex items-center justify-center mb-6">
        <Sparkles className="w-8 h-8 text-[#181818]" />
      </div>
      <h1 className="text-2xl font-semibold text-[#181818] mb-2">Quill</h1>
      <p className="text-[#666] mb-8 max-w-md px-4">
        Write 20–150 page theses, projects, and literature reviews with live journal harvest, consistent structure, and PDF/DOCX export.
      </p>
      <div className="space-y-3 w-full max-w-md px-4">
        {samples.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-[#e5e5e5] bg-white text-left text-sm text-[#181818] hover:bg-[#f2f2f2] transition-colors"
          >
            <span className="flex items-center gap-2 text-[#666]">
              <BookMarked className="w-4 h-4" /> {s}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
