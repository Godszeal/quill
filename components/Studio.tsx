"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BookMarked,
  ChevronRight,
  ChevronDown,
  EllipsisVertical,
  Loader2,
  LogOut,
  Menu,
  Moon,
  Plus,
  Send,
  Sparkles,
  Sun,
  Trash2,
  X,
  Check,
} from "lucide-react";
import { CITATION_STYLES, DOCUMENT_TYPES, PAGE_OPTIONS } from "@/lib/types";
import type { Chat, ChatMessage, CitationStyle, DocumentType, Project } from "@/lib/types";
import { SelectField } from "./SelectField";
import { MarkdownText } from "./MarkdownText";
import { CommandCard, extraFor } from "./MessageCards";
import { Toast } from "./Toast";
import { ConfirmModal } from "./ConfirmModal";

type SlimProject = Pick<
  Project,
  | "id"
  | "status"
  | "steps"
  | "commands"
  | "outline"
  | "files"
  | "tasks"
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
  const [fileType, setFileType] = useState<"pdf" | "docx" | "both">("both");
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [theme, setTheme] = useState<"light" | "dark" | "system">("system");
  const [typingMessageId, setTypingMessageId] = useState<string | null>(null);
  const [typingChars, setTypingChars] = useState(0);
  const [thinkingOpen, setThinkingOpen] = useState<Record<string, boolean>>({});
  const [pollVotes, setPollVotes] = useState<Record<string, string>>({});
  const [taskCompleted, setTaskCompleted] = useState<Record<string, boolean>>({});
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const abortController = useRef<AbortController | null>(null);
  const [toasts, setToasts] = useState<Array<{ id: string; message: string; type: "info" | "success" | "error" }>>([]);
  const [modal, setModal] = useState<{ type: "confirm" | null; title: string; content: string; onConfirm: () => void; onCancel: () => void } | null>(null);
  const [stopping, setStopping] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const router = useRouter();

  const resolvedTheme = (() => {
    if (typeof window === "undefined") return "light";
    if (theme === "system") {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return theme;
  })();

  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    const root = document.documentElement;
    if (isDark) {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  }, [isDark]);

  useEffect(() => {
    const saved = localStorage.getItem("quill_theme");
    if (saved === "light" || saved === "dark" || saved === "system") {
      setTheme(saved);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSignout = async () => {
    await fetch("/api/auth/signout", { method: "POST" });
    router.replace("/auth/signin");
  };

  const showToast = (message: string, type: "info" | "success" | "error" = "info") => {
    const id = Math.random().toString(36).slice(2);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => dismissToast(id), 5000);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const openConfirm = (title: string, content: string, onConfirm: () => void, onCancel: () => void) => {
    setModal({ type: "confirm", title, content, onConfirm, onCancel });
  };

  const closeModal = () => {
    setModal(null);
  };

  const stopChat = async () => {
    if (abortController.current) {
      abortController.current.abort();
    }
    try {
      if (chatId) {
        await fetch(`/api/chats/${chatId}/stop`, { method: "POST" });
      }
    } catch {
      // ignore
    }
    setStopping(false);
    setBusy(false);
    showToast("Stopped", "info");
  };

  const resumeStream = async (id: string) => {
    if (abortController.current) abortController.current.abort();
    const ac = new AbortController();
    abortController.current = ac;
    setBusy(true);
    setStopping(false);
    try {
      const res = await fetch(`/api/chats/${id}/resume`, {
        method: "POST",
        signal: ac.signal,
      });
      const ctype = res.headers.get("content-type") || "";
      if (ctype.includes("ndjson") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          if (ac.signal.aborted) {
            reader.cancel();
            break;
          }
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
      }
      await loadChats();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        showToast("Stopped", "info");
      } else {
        showToast(err instanceof Error ? err.message : "Request failed", "error");
      }
    } finally {
      setBusy(false);
      setStopping(false);
      abortController.current = null;
      await openChat(id);
    }
  };

  const toggleThinking = (messageId: string) => {
    setThinkingOpen((prev) => ({ ...prev, [messageId]: !prev[messageId] }));
  };

  const votePoll = (pollId: string, optionId: string) => {
    setPollVotes((prev) => ({ ...prev, [pollId]: optionId }));
    showToast("Vote recorded", "success");
  };

  const toggleTask = (taskId: string) => {
    setTaskCompleted((prev) => ({ ...prev, [taskId]: !prev[taskId] }));
    showToast("Task updated", "info");
  };

  const loadChats = async () => {
    const res = await fetch("/api/chats");
    const data = await res.json();
    setChats(data.chats || []);
    return (data.chats || []) as Chat[];
  };

  const openChat = async (id: string) => {
    setChatId(id);
    setRenamingId(null);
    if (typeof window !== "undefined" && window.innerWidth < 768) setSidebar(false);
    const res = await fetch(`/api/chats/${id}`);
    const data = await res.json();
    setMessages(data.messages || []);
    setProject(data.project || null);
    return data;
  };

  const newChat = async () => {
    if (abortController.current) abortController.current.abort();
    const res = await fetch("/api/chats", { method: "POST" });
    const data = await res.json();
    await loadChats();
    setMessages([]);
    setProject(null);
    setChatId(data.chat.id);
    setRenamingId(null);
    if (typeof window !== "undefined" && window.innerWidth < 768) setSidebar(false);
    setSettingsOpen(false);
    setBusy(false);
    setStopping(false);
  };

  const deleteChat = async (id: string) => {
    setPendingDeleteId(id);
    openConfirm(
      "Delete chat",
      "This chat and all its messages will be permanently deleted.",
      async () => {
        if (!pendingDeleteId) return;
        await fetch(`/api/chats/${pendingDeleteId}`, { method: "DELETE" });
        const updatedChats = await loadChats();
        if (chatId === pendingDeleteId) {
          const list = updatedChats.filter((c) => c.id !== pendingDeleteId);
          if (list[0]) await openChat(list[0].id);
          else await newChat();
        }
        setPendingDeleteId(null);
        closeModal();
        showToast("Chat deleted", "success");
      },
      () => {
        setPendingDeleteId(null);
        closeModal();
      },
    );
  };

  const renameChat = async (id: string, title: string) => {
    await fetch(`/api/chats/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
    await loadChats();
    setRenamingId(null);
  };

  useEffect(() => {
    (async () => {
      const list = await loadChats();
      if (list[0]) {
        const data = await openChat(list[0].id);
        const proj = data.project;
        if (!busy && proj && proj.status && proj.status !== "complete" && proj.status !== "error" && proj.status !== "draft") {
          await resumeStream(list[0].id);
        }
      } else {
        await newChat();
      }
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
    const char = msg.content[typingChars];
    const baseDelay = char.match(/[.,!?;:]/) ? 80 : char === "\n" ? 120 : 25;
    const jitter = Math.floor(Math.random() * 40);
    typingTimer.current = setTimeout(() => setTypingChars((c) => Math.min(c + 1, target)), baseDelay + jitter);
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [typingMessageId, typingChars, messages]);

  useEffect(() => {
    return () => {
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, []);

  const submit = async (event?: React.FormEvent, preset?: string) => {
    event?.preventDefault();
    const text = (preset || prompt).trim();
    if (!text) return;
    if (abortController.current) abortController.current.abort();
    const ac = new AbortController();
    abortController.current = ac;
    let id = chatId;
    if (!id) {
      const res = await fetch("/api/chats", { method: "POST" });
      const data = await res.json();
      id = data.chat.id;
      setChatId(id);
    }
    setPrompt("");
    setBusy(true);
    setStopping(false);
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
        signal: ac.signal,
      });
      const ctype = res.headers.get("content-type") || "";
      if (ctype.includes("ndjson") && res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        while (true) {
          if (ac.signal.aborted) {
            reader.cancel();
            break;
          }
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
        const data = await openChat(id!);
        const msgs = (data && data.messages) || [];
        const last = msgs[msgs.length - 1];
        if (last && last.role === "assistant" && last.kind === "text") {
          setTypingMessageId(last.id);
          setTypingChars(0);
        }
      }
      await loadChats();
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        showToast("Stopped", "info");
      } else {
        showToast(err instanceof Error ? err.message : "Request failed", "error");
      }
    } finally {
      setBusy(false);
      setStopping(false);
      abortController.current = null;
      if (id) await openChat(id);
    }
  };

  const bg = isDark ? "#0a0a0a" : "#fafafa";
  const cardBg = isDark ? "#161616" : "#ffffff";
  const borderColor = isDark ? "#2a2a2a" : "#e5e5e5";
  const textPrimary = isDark ? "#ffffff" : "#181818";
  const textSecondary = isDark ? "#a1a1aa" : "#666666";
  const hoverBg = isDark ? "#262626" : "#f2f2f2";
  const inputBg = isDark ? "#1f1f1f" : "#fafafa";
  const sidebarBg = isDark ? "#111111" : "#ffffff";
  const activeBg = isDark ? "#262626" : "#f2f2f2";

  return (
    <>
      <div className="flex h-[100dvh] min-h-screen" style={{ backgroundColor: bg, color: textPrimary }}>
        <aside
          className="hidden lg:flex flex-col w-72 border-r z-20 transition-all duration-300"
          style={{
            backgroundColor: sidebar ? sidebarBg : "transparent",
            borderColor,
            color: textPrimary,
            transform: sidebar ? "translateX(0)" : "translateX(-100%)",
          }}
        >
          <div className="h-16 flex items-center justify-between px-4 border-b shrink-0" style={{ borderColor }}>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: textPrimary }}>
                <span className="text-[10px] font-bold" style={{ color: isDark ? "#000000" : "#ffffff" }}>
                  Q
                </span>
              </div>
              <span className="text-sm font-semibold tracking-tight" style={{ color: textPrimary }}>
                Quill
              </span>
            </div>
            <button
              onClick={() => {
                const next = theme === "light" ? "dark" : theme === "dark" ? "system" : "light";
                setTheme(next);
                localStorage.setItem("quill_theme", next);
              }}
              className="p-2 rounded-full transition-colors"
              aria-label="Toggle theme"
              style={{
                backgroundColor: hoverBg,
                color: textPrimary,
              }}
            >
              {theme === "dark" ? (
                <Sun className="w-5 h-5" />
              ) : (
                <Moon className="w-5 h-5" />
              )}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="flex items-center justify-between px-2">
              <button
                onClick={newChat}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-sm font-medium transition-colors"
                style={{
                  backgroundColor: hoverBg,
                  color: textPrimary,
                  border: `1px solid ${borderColor}`,
                }}
              >
                <Plus className="w-4 h-4" style={{ color: textPrimary }} /> New chat
              </button>
            </div>
            <div className="space-y-1">
              {chats.map((c) => {
                const isRenaming = renamingId === c.id;
                if (isRenaming) {
                  return (
                    <div key={c.id} className="relative">
                      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[#3b82f6]">
                        <input
                          autoFocus
                          defaultValue={c.title}
                          className="flex-1 text-sm font-medium border-none outline-none bg-transparent"
                          value={renameTitle}
                          onChange={(e) => setRenameTitle(e.target.value)}
                          onBlur={() => renameChat(c.id, renameTitle || c.title)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") renameChat(c.id, renameTitle || c.title);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          style={{ color: textPrimary }}
                        />
                        <button
                          onClick={() => setRenamingId(null)}
                          className="p-1 transition-colors"
                          style={{ color: textSecondary }}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div key={c.id} className="relative">
                    <button
                      onClick={() => openChat(c.id)}
                      onDoubleClick={() => {
                        setRenamingId(c.id);
                        setRenameTitle(c.title);
                      }}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        deleteChat(c.id);
                      }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                        c.id === chatId
                          ? `bg-[#3b82f6] text-white`
                          : `bg-transparent hover:bg-[${hoverBg}]`
                      }`}
                      style={{
                        color: c.id === chatId ? "white" : textPrimary,
                      }}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium" style={{ color: textPrimary }}>
                          {c.title}
                        </p>
                        <p className="truncate text-[10px] mt-0.5" style={{ color: textSecondary }}>
                          {new Date(c.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenamingId(c.id);
                            setRenameTitle(c.title);
                          }}
                          className="p-1 transition-colors"
                          style={{ color: textSecondary }}
                          aria-label="Rename"
                        >
                          <span className="w-3 h-3" style={{ color: textSecondary }}>
                            <i className="fa fa-pencil" aria-hidden="true" />
                          </span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteChat(c.id);
                          }}
                          className="p-1 transition-colors"
                          style={{ color: textSecondary }}
                          aria-label="Delete"
                        >
                          <Trash2 className="w-3 h-3" style={{ color: textSecondary }} />
                        </button>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>

        {sidebar && typeof window !== "undefined" && window.innerWidth < 768 && (
          <div
            className="lg:hidden fixed inset-0 z-30"
            style={{ backgroundColor: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)" }}
            onClick={() => setSidebar(false)}
          />
        )}
        {sidebar && typeof window !== "undefined" && window.innerWidth < 768 && (
          <aside className="lg:hidden fixed left-0 top-0 z-40 w-[85vw] max-w-md h-full shadow-xl transform transition-transform duration-300 flex flex-col" style={{ backgroundColor: sidebarBg }}>
            <div className="h-12 flex items-center justify-between px-4 border-b shrink-0" style={{ borderColor }}>
              <span className="font-semibold text-sm" style={{ color: textPrimary }}>
                Chats
              </span>
              <button onClick={() => setSidebar(false)} className="transition-colors" style={{ color: textSecondary }}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <button
                onClick={newChat}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-sm font-medium transition-colors"
                style={{
                  backgroundColor: hoverBg,
                  color: textPrimary,
                  border: `1px solid ${borderColor}`,
                }}
              >
                <Plus className="w-4 h-4" style={{ color: textPrimary }} /> New chat
              </button>
              <div className="space-y-1">
                {chats.map((c) => {
                  const isRenaming = renamingId === c.id;
                  if (isRenaming) {
                    return (
                      <div key={c.id} className="relative">
                        <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[#3b82f6]">
                          <input
                            autoFocus
                            defaultValue={c.title}
                            className="flex-1 text-sm font-medium border-none outline-none bg-transparent"
                            value={renameTitle}
                            onChange={(e) => setRenameTitle(e.target.value)}
                            onBlur={() => renameChat(c.id, renameTitle || c.title)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") renameChat(c.id, renameTitle || c.title);
                              if (e.key === "Escape") setRenamingId(null);
                            }}
                            style={{ color: textPrimary }}
                          />
                          <button
                            onClick={() => setRenamingId(null)}
                            className="p-1 transition-colors"
                            style={{ color: textSecondary }}
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    );
                  }
                  return (
                    <div key={c.id} className="relative group">
                      <button
                        onClick={() => {
                          openChat(c.id);
                          setSidebar(false);
                        }}
                        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                          c.id === chatId ? `bg-[#3b82f6] text-white` : `bg-transparent hover:bg-[${hoverBg}]`
                        }`}
                        style={{
                          color: c.id === chatId ? "white" : textPrimary,
                        }}
                      >
                        <p className="truncate text-sm font-medium" style={{ color: textPrimary }}>
                          {c.title}
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setRenamingId(c.id);
                              setRenameTitle(c.title);
                            }}
                            className="p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10 rounded-lg"
                            style={{ color: textSecondary }}
                            aria-label="Rename"
                          >
                            <span className="w-3 h-3" style={{ color: textSecondary }}>
                              <i className="fa fa-pencil" aria-hidden="true" />
                            </span>
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              deleteChat(c.id);
                            }}
                            className="p-1 transition-colors hover:bg-black/10 dark:hover:bg-white/10 rounded-lg"
                            style={{ color: textSecondary }}
                            aria-label="Delete"
                          >
                            <Trash2 className="w-3 h-3" style={{ color: textSecondary }} />
                          </button>
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        )}

        <main className="flex-1 flex flex-col relative min-w-0 h-full" style={{ backgroundColor: bg }}>
          <header className="h-16 border-b flex items-center justify-between px-4 sm:px-6 shrink-0 z-20 sticky top-0" style={{ borderColor, backgroundColor: cardBg }}>
            <div className="flex items-center gap-3 flex-1 min-w-0">
              <button className="lg:hidden p-2 mr-2 transition-colors" onClick={() => setSidebar(!sidebar)} style={{ color: textSecondary }}>
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex flex-col min-w-0">
                <p className="text-sm font-semibold truncate" style={{ color: textPrimary }}>
                  {project?.topic || "Start a new manuscript"}
                </p>
                <p className="text-[11px] truncate" style={{ color: textSecondary }}>
                  {busy ? "Writing in progress…" : project?.status === "complete" ? `${project.pageEstimate} pages ready` : "Long-form research writing agent"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                onClick={() => setSettingsOpen(!settingsOpen)}
                className="p-2 rounded-full transition-colors"
                aria-label="Settings"
                style={{
                  backgroundColor: hoverBg,
                  color: textPrimary,
                }}
              >
                <EllipsisVertical className="w-5 h-5" style={{ color: textPrimary }} />
              </button>
              <button
                onClick={handleSignout}
                className="p-2 rounded-full transition-colors hover:bg-[#ef4444] hover:text-white"
                aria-label="Sign out"
                style={{ color: textPrimary }}
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </header>

          <div ref={scroller} className="flex-1 overflow-y-auto p-4 sm:p-6 md:p-8" style={{ scrollBehavior: "smooth", paddingBottom: "110px" }}>
            <div className="mx-auto max-w-3xl w-full">
              {!messages.length && !busy ? (
                <EmptyState isDark={isDark} onPick={(t) => submit(undefined, t)} />
              ) : (
                <div className="space-y-6">
                  {messages.map((m) => (
                    <article key={m.id} className="flex gap-3 sm:gap-4">
                      {m.role === "user" ? (
                        <>
                          <div className="hidden sm:block w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: borderColor }}>
                            <span className="text-[9px]" style={{ color: textSecondary }}>
                              U
                            </span>
                          </div>
                          <div className="ml-auto max-w-[90%] sm:max-w-[85%]">
                            <div className="rounded-2xl rounded-bl-none p-3 sm:p-4 text-sm sm:text-base leading-relaxed whitespace-pre-wrap break-words" style={{ backgroundColor: "#3b82f6", color: "#ffffff" }}>
                              {m.content}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 sm:w-8 sm:h-8" style={{ backgroundColor: textPrimary }}>
                            <span className="text-[9px] sm:text-[10px] font-bold" style={{ color: isDark ? "#000000" : "#ffffff" }}>
                              Q
                            </span>
                          </div>
                          <div className="max-w-[92%] sm:max-w-[90%]">
                            {m.kind === "suggestion" && m.meta && (
                              <div className="rounded-2xl rounded-br-none border p-3 sm:p-4" style={{ borderColor, backgroundColor: cardBg }}>
                                <div className="mb-3">
                                  <span className="text-xs font-medium" style={{ color: textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    Quill suggests
                                  </span>
                                  <div className="mt-2 text-sm leading-relaxed" style={{ color: textPrimary }}>
                                    “{m.content}”
                                  </div>
                                </div>
                                <div className="flex gap-2 sm:gap-3 flex-wrap">
                                  {(m.meta as any).answers?.slice(0, 4).map((ans: string, i: number) => (
                                    <button
                                      key={i}
                                      onClick={() => {
                                        setPollVotes((prev) => ({ ...prev, [m.id]: ans }));
                                        setTaskCompleted((prev) => {
                                          const next = { ...prev };
                                          (project?.tasks || []).forEach((t) => { next[t.id] = true; });
                                          return next;
                                        });
                                        showToast(`Selected: ${ans} — all tasks marked complete`, "success");
                                      }}
                                      className={`px-3 py-1.5 rounded-full text-xs sm:text-sm border transition-colors ${
                                        pollVotes[m.id] === ans
                                          ? "bg-[#3b82f6] text-white border-[#3b82f6]"
                                          : `border-${isDark ? "gray-600" : "gray-300"} text-${isDark ? "gray-300" : "gray-700"} hover:bg-${isDark ? "gray-800" : "gray-100"}`
                                      }` as string}
                                      style={{ borderColor: isDark ? "#4a4a4a" : "#d1d5db" }}
                                    >
                                      {ans}
                                    </button>
                                  ))}
                                </div>
                                <div className="mt-3 pt-3 border-t" style={{ borderColor: isDark ? "#2a2a2a" : "#e5e5e5" }}>
                                  <label className="block text-xs font-medium mb-1" style={{ color: textSecondary }}>
                                    Or type your own answer:
                                  </label>
                                  <input
                                    className="w-full px-3 py-2 rounded-lg border bg-transparent focus:ring-2 focus-ring-[#3b82f6] outline-none text-sm"
                                    style={{ borderColor, color: textPrimary }}
                                    placeholder="Your answer..."
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") {
                                        const val = (e.target as HTMLInputElement).value.trim();
                                        if (val) {
                                          setPollVotes((prev) => ({ ...prev, [m.id]: val }));
                                          setTaskCompleted((prev) => {
                                            const next = { ...prev };
                                            (project?.tasks || []).forEach((t) => { next[t.id] = true; });
                                            return next;
                                          });
                                          showToast(`Answer recorded: ${val} — all tasks marked complete`, "success");
                                        }
                                      }
                                    }}
                                  />
                                  <button
                                    onClick={() => toggleThinking(m.id)}
                                    className="text-xs sm:text-sm flex items-center gap-1 transition-colors"
                                    style={{ color: "#3b82f6" }}
                                  >
                                    {thinkingOpen[m.id] ? "Hide thinking" : "Show thinking"}
                                    <span className={`w-3 h-3 ${thinkingOpen[m.id] ? "rotate-180" : ""}`} style={{ transition: "transform 0.2s" }}>
                                      <ChevronDown className="w-3 h-3" style={{ color: "#3b82f6" }} />
                                    </span>
                                  </button>
                                  {thinkingOpen[m.id] && (
                                    <div className="mt-2 pt-2 text-sm leading-relaxed" style={{ color: textSecondary, fontStyle: "italic" }}>
                                      Consider how this question shapes your manuscript’s argument and structure.
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {m.kind === "poll" && m.meta && (
                              <div className="rounded-2xl rounded-br-none border p-3 sm:p-4" style={{ borderColor, backgroundColor: cardBg }}>
                                <div className="mb-3">
                                  <span className="text-xs font-medium" style={{ color: textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    Poll
                                  </span>
                                  <div className="mt-2 text-sm font-medium" style={{ color: textPrimary }}>
                                    {m.content}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  {(m.meta as any).poll?.options.map((opt: any) => {
                                    const voted = pollVotes[m.id] === opt.id;
                                    const total = (m.meta as any).poll?.options?.reduce((s: number, o: any) => s + o.votes, 0) || 1;
                                    const pct = Math.round(((opt.votes + (voted ? 1 : 0)) / Math.max(total, 1)) * 100);
                                    return (
                                      <div key={opt.id} className="flex items-center justify-between gap-3">
                                        <button
                                          onClick={() => votePoll(m.id, opt.id)}
                                          disabled={!!pollVotes[m.id]}
                                          className={`flex-1 px-3 py-2 rounded-lg border text-left transition-colors ${
                                            voted
                                              ? "bg-[#3b82f6] text-white border-[#3b82f6]"
                                              : `border-${isDark ? "gray-600" : "gray-300"} text-${isDark ? "gray-300" : "gray-700"} hover:bg-${isDark ? "gray-800" : "gray-100"}`
                                          }` as string}
                                          style={{ borderColor: isDark ? "#4a4a4a" : "#d1d5db" }}
                                        >
                                          {opt.text}
                                        </button>
                                        <span className="text-[10px] sm:text-xs" style={{ color: textSecondary }}>
                                          {opt.votes} vote{opt.votes !== 1 ? "s" : ""} ({pct}%)
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                                {pollVotes[m.id] && (
                                  <div className="mt-3 pt-3 border-t" style={{ borderColor: isDark ? "#2a2a2a" : "#e5e5e5" }}>
                                    <span className="text-xs sm:text-sm" style={{ color: textSecondary }}>
                                      You voted. Thanks for shaping the manuscript direction.
                                    </span>
                                  </div>
                                )}
                              </div>
                            )}
                            {m.kind === "task" && m.meta && (
                              <div className="rounded-2xl rounded-br-none border p-3 sm:p-4" style={{ borderColor, backgroundColor: cardBg }}>
                                <div className="mb-3">
                                  <span className="text-xs font-medium" style={{ color: textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    Tasks
                                  </span>
                                  <div className="mt-2 text-sm font-medium" style={{ color: textPrimary }}>
                                    {m.content}
                                  </div>
                                </div>
                                <div className="space-y-2">
                                  {(m.meta as any).tasks?.map((t: any, i: number) => {
                                    const done = taskCompleted[t.id];
                                    return (
                                      <div key={t.id} className="flex items-center gap-3">
                                        <button
                                          onClick={() => toggleTask(t.id)}
                                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-colors ${
                                            done ? "bg-[#10b981] border-[#10b981]" : `border-${isDark ? "gray-600" : "gray-300"}`
                                          }`}
                                          style={{ borderColor: isDark ? "#4a4a4a" : "#d1d5db" }}
                                        >
                                          {done && (
                                            <span className="w-2.5 h-2.5 text-white">
                                              <Check className="w-2.5 h-2.5" />
                                            </span>
                                          )}
                                        </button>
                                        <span
                                          className={`text-sm sm:text-base leading-relaxed transition-colors ${
                                            done ? "line-through text-gray-500 dark:text-gray-400" : `text-${isDark ? "gray-300" : "gray-700"}`
                                          }`}
                                        >
                                          {t.title}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                                <div className="mt-3 pt-3 border-t" style={{ borderColor: isDark ? "#2a2a2a" : "#e5e5e5" }}>
                                  <button
                                    onClick={() => toggleThinking(m.id)}
                                    className="text-xs sm:text-sm flex items-center gap-1 transition-colors"
                                    style={{ color: "#3b82f6" }}
                                  >
                                    {thinkingOpen[m.id] ? "Hide details" : "Show details"}
                                    <span className={`w-3 h-3 ${thinkingOpen[m.id] ? "rotate-180" : ""}`} style={{ transition: "transform 0.2s" }}>
                                      <ChevronDown className="w-3 h-3" style={{ color: "#3b82f6" }} />
                                    </span>
                                  </button>
                                  {thinkingOpen[m.id] && (
                                    <div className="mt-2 pt-2 text-sm leading-relaxed" style={{ color: textSecondary, fontStyle: "italic" }}>
                                      Check off tasks as you complete them. Quill will remember your progress.
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {m.kind === "write" && m.meta && (
                              <div className="rounded-2xl rounded-br-none border p-3 sm:p-4" style={{ borderColor, backgroundColor: cardBg }}>
                                <div className="mb-3">
                                  <span className="text-xs font-medium" style={{ color: textSecondary, textTransform: "uppercase", letterSpacing: "0.05em" }}>
                                    Manuscript complete
                                  </span>
                                  <div className="mt-2 text-sm leading-relaxed" style={{ color: textPrimary }}>
                                    {m.content}
                                  </div>
                                </div>
                                <div className="mt-3 pt-3 border-t" style={{ borderColor: isDark ? "#2a2a2a" : "#e5e5e5" }}>
                                  <button
                                    onClick={() => toggleThinking(m.id)}
                                    className="text-xs sm:text-sm flex items-center gap-1 transition-colors"
                                    style={{ color: "#3b82f6" }}
                                  >
                                    {thinkingOpen[m.id] ? "Hide thinking" : "Show thinking"}
                                    <span className={`w-3 h-3 ${thinkingOpen[m.id] ? "rotate-180" : ""}`} style={{ transition: "transform 0.2s" }}>
                                      <ChevronDown className="w-3 h-3" style={{ color: "#3b82f6" }} />
                                    </span>
                                  </button>
                                  {thinkingOpen[m.id] && (
                                    <div className="mt-2 pt-2 text-sm leading-relaxed" style={{ color: textSecondary, fontStyle: "italic" }}>
                                      {(m.meta as any).thinking || "No thinking trace available."}
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                            {m.kind !== "suggestion" && m.kind !== "poll" && m.kind !== "task" && m.kind !== "plan" && m.kind !== "write" ? (
                              <div className="rounded-2xl rounded-br-none border p-3 sm:p-4" style={{ borderColor, backgroundColor: cardBg }}>
                                <div className="flex items-center justify-between mb-2">
                                  <MarkdownText text={typingMessageId === m.id ? m.content.slice(0, typingChars) : m.content} isDark={isDark} />
                                  {!typingMessageId || typingMessageId !== m.id || typingChars >= m.content.length ? null : (
                                    <span className="blink inline-block w-1 h-[1.1em] ml-1" style={{ backgroundColor: textPrimary, verticalAlign: "middle" }} />
                                  )}
                                </div>
                                <button
                                  onClick={() => toggleThinking(m.id)}
                                  className="text-xs sm:text-sm mt-2 flex items-center gap-1 transition-colors"
                                  style={{ color: "#3b82f6" }}
                                >
                                  {thinkingOpen[m.id] ? "Collapse thinking" : "Show thinking"}
                                  <span className={`w-3 h-3 ${thinkingOpen[m.id] ? "rotate-180" : ""}`} style={{ transition: "transform 0.2s" }}>
                                    <ChevronDown className="w-3 h-3" style={{ color: "#3b82f6" }} />
                                  </span>
                                </button>
                                {thinkingOpen[m.id] && (
                                  <div className="mt-2 pt-2 border-t" style={{ borderColor: isDark ? "#2a2a2a" : "#e5e5e5" }}>
                                    <div className="text-sm leading-relaxed" style={{ color: textSecondary, fontStyle: "italic" }}>
                                      {m.content}
                                    </div>
                                  </div>
                                )}
                              </div>
                            ) : null}
                            {extraFor(m, isDark)}
                          </div>
                        </>
                      )}
                    </article>
                    ))}
                    {typingMessageId && typingChars < (messages.find((m) => m.id === typingMessageId)?.content.length || 0) && (
                      <article className="flex gap-3 sm:gap-4">
                        <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 sm:w-8 sm:h-8" style={{ backgroundColor: textPrimary }}>
                          <span className="text-[9px] sm:text-[10px] font-bold" style={{ color: isDark ? "#000000" : "#ffffff" }}>
                            Q
                          </span>
                        </div>
                        <div className="max-w-[92%] sm:max-w-[90%]">
                          <div className="rounded-2xl rounded-br-none border p-3 sm:p-4" style={{ borderColor, backgroundColor: cardBg }}>
                            <div className="flex items-center gap-2">
                              <span className="text-xs sm:text-sm font-medium" style={{ color: textSecondary }}>
                                Quill is typing…
                              </span>
                              <span className="flex gap-1">
                                <span className="w-1 h-1 rounded-full bg-[#666666] animate-bounce" style={{ animationDelay: "0ms" }} />
                                <span className="w-1 h-1 rounded-full bg-[#666666] animate-bounce" style={{ animationDelay: "150ms" }} />
                                <span className="w-1 h-1 rounded-full bg-[#666666] animate-bounce" style={{ animationDelay: "300ms" }} />
                              </span>
                            </div>
                          </div>
                        </div>
                      </article>
                    )}
                    {project && busy ? (
                    <article className="flex gap-3 sm:gap-4">
                      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 sm:w-8 sm:h-8" style={{ backgroundColor: textPrimary }}>
                        <span className="text-[9px] sm:text-[10px] font-bold" style={{ color: isDark ? "#000000" : "#ffffff" }}>
                          Q
                        </span>
                      </div>
                      <div className="max-w-[92%] sm:max-w-[90%]">
                        <div className="rounded-2xl rounded-br-none border p-3 sm:p-4" style={{ borderColor, backgroundColor: cardBg }}>
                          <div className="flex items-center gap-2 mb-3">
                            <Loader2 className="w-3 h-3 animate-spin" style={{ color: textPrimary }} />
                            <span className="text-xs sm:text-sm font-medium" style={{ color: textPrimary }}>
                              {project.steps.find((s) => s.status === "running")?.label || "Writing in progress…"}
                            </span>
                          </div>
                          <div className="w-full rounded-full h-1.5 mb-3" style={{ backgroundColor: borderColor }}>
                            <div
                              className="h-1.5 rounded-full transition-all duration-500"
                              style={{
                                backgroundColor: textPrimary,
                                width: `${Math.round(((project.steps.filter((s) => s.status === "done").length) / Math.max(project.steps.length, 1)) * 100)}%`,
                              }}
                            />
                          </div>
                          <ol className="grid gap-2 sm:grid-cols-2 text-[10px] sm:text-xs">
                            {project.steps.map((s) => {
                              const isDone = s.status === "done";
                              const isRunning = s.status === "running";
                              return (
                                <li
                                  key={s.id}
                                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg border transition-colors"
                                  style={{
                                    backgroundColor: isDone ? hoverBg : "transparent",
                                    borderColor: isRunning ? "#d6b36a" : "transparent",
                                  }}
                                >
                                  <span
                                    className="h-2 w-2 rounded-full shrink-0"
                                    style={{
                                      backgroundColor: isDone ? "#181818" : isRunning ? "#d6b36a" : "#2a2a2a",
                                    }}
                                  />
                                  <span
                                    className="text-xs font-medium"
                                    style={{
                                      color: isDone ? textPrimary : isRunning ? "#92400e" : textSecondary,
                                    }}
                                  >
                                    {s.label}
                                  </span>
                                  {isDone && (
                                    <ChevronRight className="w-3 h-3 ml-auto" style={{ color: borderColor }} />
                                  )}
                                </li>
                              );
                            })}
                          </ol>
                          <CommandCard commands={project.commands} isDark={isDark} />
                        </div>
                      </div>
                    </article>
                  ) : null}
                </div>
              )}
            </div>
          </div>

          <footer className="h-auto p-4 sm:p-6 border-t shrink-0 z-20 sticky bottom-0" style={{ borderColor, backgroundColor: cardBg }}>
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
                  placeholder={busy ? "Writing in progress…" : "Message Quill…"}
                  className="flex-1 resize-none rounded-xl border px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-[#3b82f6] min-h-[48px] max-h-[160px]"
                  style={{
                    backgroundColor: inputBg,
                    borderColor,
                    color: textPrimary,
                    opacity: busy ? 0.5 : 1,
                  }}
                  disabled={busy}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      submit();
                    }
                  }}
                />
                {busy ? (
                  <button
                    onClick={stopChat}
                    disabled={stopping}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      backgroundColor: stopping ? "#2a2a2a" : "#b91c1c",
                      color: stopping ? "#888888" : "white",
                    }}
                    aria-label="Stop"
                  >
                    {stopping ? (
                      <Loader2 className="w-5 h-5 animate-spin" style={{ color: "white" }} />
                    ) : (
                      <i className="fa fa-stop" aria-hidden="true" />
                    )}
                  </button>
                ) : (
                  <button
                    disabled={!prompt.trim()}
                    onClick={submit}
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center shrink-0 transition-colors"
                    style={{
                      backgroundColor: !prompt.trim() ? "#2a2a2a" : "#181818",
                      color: !prompt.trim() ? "#888888" : "white",
                    }}
                    aria-label="Send"
                  >
                    <Send className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </footer>

          {/* Toasts */}
          <div className="pointer-events-none">
            {toasts.map((t) => (
              <Toast key={t.id} message={t.message} type={t.type} onDismiss={() => dismissToast(t.id)} />
            ))}
          </div>

          {/* Confirm Modal */}
          {modal && (
            <ConfirmModal
              open={true}
              title={modal.title}
              content={modal.content}
              confirmLabel="Delete"
              cancelLabel="Cancel"
              onConfirm={modal.onConfirm}
              onCancel={modal.onCancel}
              isDark={isDark}
            />
          )}

          {/* Settings Panel */}
          {settingsOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={() => setSettingsOpen(false)}>
              <div className="bg-[cardBg] border border-[borderColor] rounded-2xl p-6 sm:p-8 w-full sm:max-w-md mx-4 max-h-[90vh] overflow-y-auto" style={{ backgroundColor: cardBg, borderColor }}>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold" style={{ color: textPrimary }}>
                    Settings
                  </h2>
                  <button
                    onClick={() => setSettingsOpen(false)}
                    className="p-2 rounded-full hover:bg-[#2a2a2a] dark:hover:bg-gray-800 transition-colors"
                    style={{ color: textPrimary }}
                    aria-label="Close settings"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div className="space-y-5">
                  <div>
                    <SelectField
                      label="Document type"
                      value={documentType}
                      onChange={(v) => setDocumentType(v as DocumentType)}
                      options={DOCUMENT_TYPES.map((d) => ({ value: d.value, label: d.label }))}
                      isDark={isDark}
                    />
                  </div>
                  <div>
                    <SelectField
                      label="Citation style"
                      value={citationStyle}
                      onChange={(v) => setCitationStyle(v as CitationStyle)}
                      options={CITATION_STYLES.map((c) => ({ value: c.value, label: c.label }))}
                      isDark={isDark}
                    />
                  </div>
                  <div>
                    <SelectField
                      label="Target pages"
                      value={targetPages}
                      onChange={(v) => setTargetPages(v)}
                      options={PAGE_OPTIONS.map((p) => ({ value: String(p), label: `${p} pages` }))}
                      isDark={isDark}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: textSecondary }}>
                      Export file type
                    </label>
                    <div className="flex gap-2">
                      {(["pdf", "docx", "both"] as const).map((ft) => (
                        <button
                          key={ft}
                          onClick={() => setFileType(ft)}
                          className={`flex-1 py-2 rounded-lg border text-sm transition-colors ${
                            fileType === ft
                              ? "bg-[#3b82f6] text-white border-[#3b82f6]"
                              : `border-${isDark ? "gray-600" : "gray-300"} text-${isDark ? "gray-300" : "gray-700"} hover:bg-${isDark ? "gray-800" : "gray-100"}`
                          }`}
                          style={{ borderColor: isDark ? "#4a4a4a" : "#d1d5db" }}
                        >
                          {ft.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: textSecondary }}>
                      Author name
                    </label>
                    <input
                      value={authorName}
                      onChange={(e) => setAuthorName(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border bg-transparent focus:ring-2 focus-ring-[#3b82f6] outline-none"
                      style={{ borderColor, color: textPrimary }}
                      placeholder="Author"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-2" style={{ color: textSecondary }}>
                      Institution
                    </label>
                    <input
                      value={institution}
                      onChange={(e) => setInstitution(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border bg-transparent focus:ring-2 focus-ring-[#3b82f6] outline-none"
                      style={{ borderColor, color: textPrimary }}
                      placeholder="Institution"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

function EmptyState({ isDark, onPick }: { isDark: boolean; onPick: (topic: string) => void }) {
  const samples = [
    "The role of large language models in academic research integrity",
    "Renewable microgrids for rural electrification in sub-Saharan Africa",
    "Antimicrobial resistance surveillance using wastewater epidemiology",
    "Digital public infrastructure and financial inclusion in emerging markets",
  ];
  const cardBg = isDark ? "#161616" : "#ffffff";
  const textPrimary = isDark ? "#ffffff" : "#181818";
  const textSecondary = isDark ? "#a1a1aa" : "#666666";
  const borderColor = isDark ? "#2a2a2a" : "#e5e5e5";
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-6 sm:p-12">
      <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 sm:mb-6" style={{ backgroundColor: borderColor }}>
        <Sparkles className="w-8 h-8 sm:w-10 sm:h-10" style={{ color: textPrimary }} />
      </div>
      <h1 className="text-2xl sm:text-3xl font-semibold mb-2" style={{ color: textPrimary }}>
        Quill
      </h1>
      <p className="mb-6 sm:mb-8 max-w-md sm:max-w-lg px-4 sm:px-0" style={{ color: textSecondary }}>
        Write 20–150 page theses, projects, and literature reviews with live journal harvest, consistent structure, and PDF/DOCX export.
      </p>
      <div className="space-y-3 w-full max-w-md sm:max-w-lg px-4 sm:px-0">
        {samples.map((s) => (
          <button
            key={s}
            onClick={() => onPick(s)}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-xl text-left text-sm transition-colors"
            style={{
              backgroundColor: cardBg,
              border: `1px solid ${borderColor}`,
              color: textPrimary,
            }}
          >
            <span className="flex items-center gap-2" style={{ color: textSecondary }}>
              <BookMarked className="w-4 h-4" /> {s}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
