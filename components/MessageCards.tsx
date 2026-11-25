"use client";

import {
  BookOpen,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  Terminal,
} from "lucide-react";
import type { ChatMessage, CommandEvent, OutlineSection, ProjectFile, SourcePaper } from "@/lib/types";

function darkColors(isDark: boolean) {
  return {
    cardBg: isDark ? "#161616" : "#ffffff",
    borderColor: isDark ? "#2a2a2a" : "#e5e5e5",
    textPrimary: isDark ? "#ffffff" : "#181818",
    textSecondary: isDark ? "#a1a1aa" : "#666666",
    hoverBg: isDark ? "#262626" : "#f2f2f2",
  };
}

export function SourcesCard({ sources, isDark }: { sources: SourcePaper[]; isDark?: boolean }) {
  if (!sources?.length) return null;
  const c = darkColors(Boolean(isDark));
  return (
    <div className="mt-4 overflow-hidden rounded-xl border" style={{ borderColor: c.borderColor, backgroundColor: c.cardBg }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: c.borderColor }}>
        <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: c.textSecondary }}>Sources</p>
      </div>
      {sources.slice(0, 10).map((s, i) => (
        <article key={s.id} className="border-b px-4 py-3 last:border-b-0" style={{ borderColor: c.borderColor }}>
          <div className="flex items-start gap-3">
            <span className="mt-1 w-6 h-6 shrink-0 rounded-full flex items-center justify-center text-[10px] font-bold" style={{ backgroundColor: c.hoverBg, color: c.textPrimary }}>
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="font-medium leading-snug" style={{ color: c.textPrimary }}>{s.title}</p>
              <p className="mt-1 text-[11px]" style={{ color: c.textSecondary }}>
                {s.authors.slice(0, 3).join(", ")}
                {s.authors.length > 3 ? " et al." : ""} · {s.year}
                {s.venue ? ` · ${s.venue}` : ""}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[10px]">
                <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: c.hoverBg, color: c.textSecondary }}>{s.citedBy} cites</span>
                <span className="rounded-full px-2 py-0.5 uppercase tracking-wide" style={{ backgroundColor: c.hoverBg, color: c.textSecondary }}>{s.origin}</span>
                {s.isOa ? <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: c.hoverBg, color: c.textSecondary }}>Open access</span> : null}
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#3b82f6] hover:underline">
                    Open <ExternalLink className="w-3 h-3" />
                  </a>
                ) : null}
              </div>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

export function OutlineCard({ outline, isDark }: { outline: OutlineSection[]; isDark?: boolean }) {
  if (!outline?.length) return null;
  const c = darkColors(Boolean(isDark));
  return (
    <div className="mt-4 overflow-hidden rounded-xl border" style={{ borderColor: c.borderColor, backgroundColor: c.cardBg }}>
      <div className="px-4 py-3 border-b" style={{ borderColor: c.borderColor }}>
        <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: c.textSecondary }}>Outline</p>
      </div>
      <ol className="divide-y">
        {outline.map((s) => (
          <li key={s.id} className="px-4 py-3" style={{ borderColor: c.borderColor }}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: c.textSecondary }}>Chapter {s.number}</p>
                <p className="mt-0.5 font-medium" style={{ color: c.textPrimary }}>{s.title}</p>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: c.textSecondary }}>{s.summary}</p>
              </div>
              <span className="inline-flex items-center rounded-full border px-2 py-1 text-[10px] font-medium" style={{ borderColor: c.borderColor, color: c.textSecondary }}>
                {s.targetPages} pp
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ProgressCard({ meta, isDark }: { meta: Record<string, unknown>; isDark?: boolean }) {
  const done = Number(meta.done || 0);
  const total = Number(meta.total || 1);
  const pct = Math.round((done / total) * 100);
  const c = darkColors(Boolean(isDark));
  return (
    <div className="mt-4 rounded-xl border p-4" style={{ borderColor: c.borderColor, backgroundColor: c.cardBg }}>
      <div className="flex items-center justify-between text-sm">
        <span className="" style={{ color: c.textSecondary }}>
          Chapter {String((meta.chapter as { number?: string })?.number || done)} of {total}
        </span>
        <span className="font-medium" style={{ color: c.textPrimary }}>{pct}%</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full" style={{ backgroundColor: c.hoverBg }}>
        <div className="h-full rounded-full" style={{ backgroundColor: c.textPrimary, width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs" style={{ color: c.textSecondary }}>
        {(meta.wordCount as number)?.toLocaleString?.() || 0} words · ~{String(meta.pageEstimate || 0)} pages
      </p>
    </div>
  );
}

export function FilesCard({ files, isDark }: { files: ProjectFile[]; isDark?: boolean }) {
  if (!files?.length) return null;
  const c = darkColors(Boolean(isDark));
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {files.map((file) => {
        const href = `/api/files/${file.id}?name=${encodeURIComponent(file.name)}`;
        return (
          <div key={file.id} className="overflow-hidden rounded-xl border" style={{ borderColor: c.borderColor, backgroundColor: c.cardBg }}>
            <div className="px-4 py-3 border-b flex items-center gap-3" style={{ borderColor: c.borderColor }}>
              <div className="w-10 h-10 rounded-lg border flex items-center justify-center text-xs font-medium" style={{ borderColor: c.borderColor, color: c.textPrimary }}>
                {file.format === "pdf" ? <FileText className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate" style={{ color: c.textPrimary }}>{file.name}</p>
                <p className="text-[11px]" style={{ color: c.textSecondary }}>
                  {file.format.toUpperCase()} · ~{file.pages} pages · {(file.size / 1024).toFixed(0)} KB
                </p>
              </div>
            </div>
            <div className="flex border-t" style={{ borderColor: c.borderColor }}>
              <a href={`${href}&inline=1`} target="_blank" rel="noreferrer" className="flex-1 py-3 text-center text-sm" style={{ color: c.textSecondary }}>
                Preview
              </a>
              <a href={href} className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm" style={{ color: c.textPrimary }}>
                <Download className="w-4 h-4" /> Download
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CommandCard({ commands, isDark }: { commands: CommandEvent[]; isDark?: boolean }) {
  if (!commands?.length) return null;
  const last = commands.slice(-4);
  const c = darkColors(Boolean(isDark));
  return (
    <div className="mt-4 overflow-hidden rounded-xl border" style={{ borderColor: c.borderColor, backgroundColor: c.cardBg }}>
      <div className="px-4 py-3 border-b flex items-center gap-2" style={{ borderColor: c.borderColor }}>
        <Terminal className="w-4 h-4" style={{ color: c.textSecondary }} />
        <p className="text-[10px] uppercase tracking-wider font-semibold" style={{ color: c.textSecondary }}>Pipeline</p>
      </div>
      <div className="p-4 space-y-3">
        {last.map((cmd) => (
          <div key={cmd.id}>
            <p className="flex items-start gap-1.5 text-xs font-mono" style={{ color: c.textSecondary }}>
              <span style={{ color: c.textPrimary }}>$</span> {cmd.command}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[11px]" style={{ color: c.textSecondary }}>{cmd.output}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlanCard({ content, isDark }: { content: string; isDark?: boolean }) {
  const c = darkColors(Boolean(isDark));
  return (
    <div className="mt-4 rounded-xl border p-4" style={{ borderColor: c.borderColor, backgroundColor: c.cardBg }}>
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 w-4 h-4 text-[#3b82f6]" />
        <p className="text-sm leading-relaxed" style={{ color: c.textPrimary }}>{content}</p>
      </div>
    </div>
  );
}

export function extraFor(message: ChatMessage, isDark?: boolean) {
  const meta = message.meta || {};
  if (message.kind === "sources") return <SourcesCard sources={(meta.sources as SourcePaper[]) || []} isDark={isDark} />;
  if (message.kind === "outline") return <OutlineCard outline={(meta.outline as OutlineSection[]) || []} isDark={isDark} />;
  if (message.kind === "progress") return <ProgressCard meta={meta} isDark={isDark} />;
  if (message.kind === "file") return <FilesCard files={(meta.files as ProjectFile[]) || []} isDark={isDark} />;
  if (message.kind === "plan") return <PlanCard content={message.content} isDark={isDark} />;
  return null;
}
