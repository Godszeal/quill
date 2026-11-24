"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import {
  BookMarked,
  Loader2,
  Menu,
  Plus,
  Search,
  Send,
  Sparkles,
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
  const [sidebar, setSidebar] = useState(false);
  const [documentType, setDocumentType] = useState<DocumentType>("undergraduate");
  const [citationStyle, setCitationStyle] = useState<CitationStyle>("apa");
  const [targetPages, setTargetPages] = useState("40");
  const [authorName, setAuthorName] = useState("");
  const [institution, setInstitution] = useState("");
  const [mode, setMode] = useState<"write" | "research">("write");
  const scroller = useRef<HTMLDivElement>(null);

  const loadChats = async () => {
    const res = await fetch("/api/chats");
    const data = await res.json();
    setChats(data.chats || []);
    return (data.chats || []) as Chat[];
  };

  const openChat = async (id: string) => {
    setChatId(id);
    setSidebar(false);
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
    setSidebar(false);
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
            if (evt.message) setMessages((m) => [...m, evt.message]);
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
    <div className="flex h-[100dvh] overflow-hidden">
      {sidebar ? (
        <button className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setSidebar(false)} aria-label="Close sidebar" />
      ) : null}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[86vw] max-w-80 flex-col border-r border-white/10 bg-[#08111d] p-4 transition-transform lg:static lg:w-72 lg:max-w-none lg:translate-x-0 ${
          sidebar ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between">
          <div>
            <p className="font-serif text-xl tracking-tight text-white">Quill</p>
            <p className="text-[11px] uppercase tracking-[0.18em] text-gold">Research writing agent</p>
          </div>
          <button className="rounded-lg p-1 text-slate-400 lg:hidden" onClick={() => setSidebar(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <button
          onClick={newChat}
          className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl bg-gold px-3 py-2.5 text-sm font-medium text-ink hover:brightness-110"
        >
          <Plus className="h-4 w-4" /> New chat
        </button>
        <div className="mt-5 flex-1 space-y-1 overflow-y-auto pr-1">
          {chats.map((c) => (
            <button
              key={c.id}
              onClick={() => openChat(c.id)}
              className={`w-full rounded-xl px-3 py-2.5 text-left text-sm transition ${
                c.id === chatId ? "bg-white/10 text-white" : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
              }`}
            >
              <span className="line-clamp-2">{c.title}</span>
            </button>
          ))}
        </div>
        <p className="pt-3 text-[11px] leading-5 text-slate-500">MongoDB persistence · OpenAlex + Crossref harvest · PDF/DOCX export</p>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 border-b border-white/10 px-3 py-3 sm:px-5">
          <button className="rounded-lg p-2 text-slate-300 lg:hidden" onClick={() => setSidebar(true)} aria-label="Open chats">
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium text-white">{project?.topic || "Start a manuscript"}</p>
            <p className="truncate text-xs text-slate-400">
              {busy ? "Writing in progress" : project?.status === "complete" ? `${project.pageEstimate} pages ready` : "Consistent long-form research agent"}
            </p>
          </div>
          {project ? (
            <div className="hidden rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300 sm:block">
              {project.wordCount.toLocaleString()} words
            </div>
          ) : null}
        </header>

        <div ref={scroller} className="flex-1 overflow-y-auto px-3 py-5 sm:px-6">
          <div className="mx-auto w-full max-w-3xl space-y-5">
            {!messages.length ? (
              <Welcome onPick={(t) => submit(undefined, t)} />
            ) : (
              messages.map((m) => (
                <article key={m.id} className={`rise ${m.role === "user" ? "ml-auto max-w-[92%] sm:max-w-[80%]" : "max-w-[96%]"}`}>
                  {m.role === "user" ? (
                    <div className="rounded-2xl rounded-br-md bg-gold px-4 py-3 text-sm leading-6 text-ink">{m.content}</div>
                  ) : (
                    <div className="rounded-2xl rounded-bl-md border border-white/10 bg-white/[0.04] px-4 py-3">
                      {m.kind !== "plan" ? <RichText text={m.content} /> : null}
                      {extraFor(m)}
                    </div>
                  )}
                </article>
              ))
            )}
            {project && busy ? (
              <div className="rise rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                <p className="text-sm text-slate-300">Running the writing pipeline…</p>
                <ol className="mt-3 grid gap-2 sm:grid-cols-2">
                  {project.steps.map((s) => (
                    <li key={s.id} className="flex items-center gap-2 text-xs text-slate-400">
                      <span
                        className={`h-2 w-2 rounded-full ${
                          s.status === "done" ? "bg-mint" : s.status === "running" ? "bg-gold" : "bg-white/20"
                        }`}
                      />
                      {s.label}
                    </li>
                  ))}
                </ol>
                <CommandCard commands={project.commands} />
              </div>
            ) : null}
          </div>
        </div>

        <form onSubmit={submit} className="border-t border-white/10 bg-[#08111d]/80 p-3 sm:p-4">
          <div className="mx-auto max-w-3xl">
            <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              <SelectField
                label="Document"
                value={documentType}
                onChange={(v) => setDocumentType(v as DocumentType)}
                options={DOCUMENT_TYPES.map((d) => ({ value: d.value, label: d.label }))}
              />
              <SelectField
                label="Citation"
                value={citationStyle}
                onChange={(v) => setCitationStyle(v as CitationStyle)}
                options={CITATION_STYLES}
              />
              <SelectField
                label="Pages"
                value={targetPages}
                onChange={setTargetPages}
                options={PAGE_OPTIONS.map((n) => ({ value: String(n), label: `${n}+ pages` }))}
              />
              <label className="block min-w-0">
                <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">Mode</span>
                <div className="grid grid-cols-2 rounded-xl border border-white/10 bg-white/5 p-1">
                  <button
                    type="button"
                    onClick={() => setMode("write")}
                    className={`rounded-lg py-1.5 text-xs ${mode === "write" ? "bg-gold text-ink" : "text-slate-300"}`}
                  >
                    Write
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("research")}
                    className={`rounded-lg py-1.5 text-xs ${mode === "research" ? "bg-gold text-ink" : "text-slate-300"}`}
                  >
                    Journals
                  </button>
                </div>
              </label>
            </div>
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <input
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Author name"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none placeholder:text-slate-500 focus:border-gold/50"
              />
              <input
                value={institution}
                onChange={(e) => setInstitution(e.target.value)}
                placeholder="Institution / university"
                className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none placeholder:text-slate-500 focus:border-gold/50"
              />
            </div>
            <div className="flex items-end gap-2 rounded-2xl border border-white/10 bg-white/5 p-2">
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={2}
                placeholder="Topic, e.g. Climate-smart agriculture and smallholder livelihoods in West Africa"
                className="max-h-40 min-h-[52px] flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-slate-500"
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit();
                  }
                }}
              />
              <button
                disabled={busy || !prompt.trim()}
                className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gold text-ink disabled:opacity-40"
                aria-label="Send"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : mode === "research" ? <Search className="h-5 w-5" /> : <Send className="h-5 w-5" />}
              </button>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}

function Welcome({ onPick }: { onPick: (topic: string) => void }) {
  const samples = [
    "The role of large language models in academic research integrity",
    "Renewable microgrids for rural electrification in sub-Saharan Africa",
    "Antimicrobial resistance surveillance using wastewater epidemiology",
    "Digital public infrastructure and financial inclusion in emerging markets",
  ];
  return (
    <div className="rise rounded-3xl border border-white/10 bg-white/[0.04] p-5 sm:p-8">
      <div className="inline-flex items-center gap-2 rounded-full border border-gold/30 bg-gold/10 px-3 py-1 text-xs text-gold">
        <Sparkles className="h-3.5 w-3.5" /> 100+ page consistent manuscripts
      </div>
      <h1 className="mt-4 font-serif text-3xl leading-tight text-white sm:text-4xl">Write the project. Cite the latest journals. Export the file.</h1>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
        Quill harvests OpenAlex and Crossref, locks a stable outline, writes chapter by chapter, and delivers PDF plus DOCX. New chats keep each manuscript separate.
      </p>
      <div className="mt-6 grid gap-2 sm:grid-cols-2">
        {samples.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left text-sm leading-6 text-slate-200 hover:border-gold/40"
          >
            <BookMarked className="mb-2 h-4 w-4 text-gold" />
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
