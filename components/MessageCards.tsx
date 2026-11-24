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

export function SourcesCard({ sources }: { sources: SourcePaper[] }) {
  if (!sources?.length) return null;
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-border">
      {sources.slice(0, 10).map((s, i) => (
        <article key={s.id} className="border-b border-border bg-paper px-3 py-3 last:border-b-0 sm:px-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-gray-100 text-[11px] font-semibold text-ink">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="font-medium leading-snug text-ink">{s.title}</p>
              <p className="mt-1 text-xs text-slate-500">
                {s.authors.slice(0, 3).join(", ")}
                {s.authors.length > 3 ? " et al." : ""} · {s.year}
                {s.venue ? ` · ${s.venue}` : ""}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-slate-600">{s.citedBy} cites</span>
                <span className="rounded-full bg-gray-100 px-2 py-0.5 uppercase tracking-wide text-slate-600">{s.origin}</span>
                {s.isOa ? <span className="rounded-full bg-gray-100 px-2 py-0.5 text-slate-600">Open access</span> : null}
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-slate-700 hover:text-ink">
                    Open <ExternalLink className="h-3 w-3" />
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

export function OutlineCard({ outline }: { outline: OutlineSection[] }) {
  if (!outline?.length) return null;
  return (
    <ol className="mt-3 space-y-2">
      {outline.map((s) => (
        <li key={s.id} className="rounded-2xl border border-border bg-paper p-3 sm:p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Chapter {s.number}</p>
              <p className="mt-1 font-medium text-ink">{s.title}</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">{s.summary}</p>
            </div>
            <span className="shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-slate-600">{s.targetPages} pp</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

export function ProgressCard({ meta }: { meta: Record<string, unknown> }) {
  const done = Number(meta.done || 0);
  const total = Number(meta.total || 1);
  const pct = Math.round((done / total) * 100);
  return (
    <div className="mt-3 rounded-2xl border border-border bg-paper p-3 sm:p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-500">
          Chapter {String((meta.chapter as { number?: string })?.number || done)} of {total}
        </span>
        <span className="text-ink">{pct}%</span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-gray-200">
        <div className="h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {(meta.wordCount as number)?.toLocaleString?.() || 0} words · ~{String(meta.pageEstimate || 0)} pages so far
      </p>
    </div>
  );
}

export function FilesCard({ files }: { files: ProjectFile[] }) {
  if (!files?.length) return null;
  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-2">
      {files.map((file) => {
        const href = `/api/files/${file.id}?name=${encodeURIComponent(file.name)}`;
        return (
          <div key={file.id} className="overflow-hidden rounded-2xl border border-border bg-paper">
            <div className="flex items-center gap-3 p-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl border border-border bg-paper text-ink">
                {file.format === "pdf" ? <FileText className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{file.name}</p>
                <p className="text-xs text-slate-500">
                  {file.format.toUpperCase()} · ~{file.pages} pages · {(file.size / 1024).toFixed(0)} KB
                </p>
              </div>
            </div>
            {file.format === "pdf" ? (
              <iframe title={file.name} src={`${href}&inline=1`} className="h-56 w-full border-t border-border bg-paper" />
            ) : (
              <div className="border-t border-border px-3 py-6 text-center text-sm text-slate-500">
                Word manuscript ready for download
              </div>
            )}
            <div className="flex border-t border-border">
              <a href={`${href}&inline=1`} target="_blank" rel="noreferrer" className="flex-1 py-2.5 text-center text-sm text-slate-600 hover:bg-gray-50">
                Preview
              </a>
              <a href={href} className="flex flex-1 items-center justify-center gap-1.5 py-2.5 text-sm text-ink hover:bg-gray-50">
                <Download className="h-4 w-4" /> Download
              </a>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CommandCard({ commands }: { commands: CommandEvent[] }) {
  if (!commands?.length) return null;
  const last = commands.slice(-4);
  return (
    <div className="mt-3 overflow-hidden rounded-2xl border border-border bg-gray-50 font-mono text-[12px] text-ink">
      <div className="flex items-center gap-2 border-b border-border px-3 py-2 text-slate-600">
        <Terminal className="h-3.5 w-3.5" />
        pipeline
      </div>
      <div className="space-y-2 p-3">
        {last.map((c) => (
          <div key={c.id}>
            <p>
              <span className="text-ink">$</span> {c.command}
            </p>
            <p className="whitespace-pre-wrap text-slate-500/80">{c.output}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlanCard({ content }: { content: string }) {
  return (
    <div className="mt-3 flex items-start gap-2 rounded-2xl border border-border bg-gray-50 p-3 text-sm leading-6 text-slate-700">
      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-ink" />
      <p>{content}</p>
    </div>
  );
}

export function extraFor(message: ChatMessage) {
  const meta = message.meta || {};
  if (message.kind === "sources") return <SourcesCard sources={(meta.sources as SourcePaper[]) || []} />;
  if (message.kind === "outline") return <OutlineCard outline={(meta.outline as OutlineSection[]) || []} />;
  if (message.kind === "progress") return <ProgressCard meta={meta} />;
  if (message.kind === "file") return <FilesCard files={(meta.files as ProjectFile[]) || []} />;
  if (message.kind === "plan") return <PlanCard content={message.content} />;
  return null;
}
