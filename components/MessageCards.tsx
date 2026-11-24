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
    <div className="mt-4 overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
      <div className="px-4 py-3 border-b border-[#e5e5e5]">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-[#666]">Sources</p>
      </div>
      {sources.slice(0, 10).map((s, i) => (
        <article key={s.id} className="border-b border-[#f0f0f0] px-4 py-3 last:border-b-0">
          <div className="flex items-start gap-3">
            <span className="mt-1 w-6 h-6 shrink-0 rounded-full bg-[#f2f2f2] flex items-center justify-center text-[10px] font-bold text-[#181818]">
              {i + 1}
            </span>
            <div className="min-w-0">
              <p className="font-medium leading-snug text-[#181818]">{s.title}</p>
              <p className="mt-1 text-[11px] text-[#666]">
                {s.authors.slice(0, 3).join(", ")}
                {s.authors.length > 3 ? " et al." : ""} · {s.year}
                {s.venue ? ` · ${s.venue}` : ""}
              </p>
              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-[10px]">
                <span className="rounded-full bg-[#f2f2f2] px-2 py-0.5 text-[#666]">{s.citedBy} cites</span>
                <span className="rounded-full bg-[#f2f2f2] px-2 py-0.5 uppercase tracking-wide text-[#666]">{s.origin}</span>
                {s.isOa ? <span className="rounded-full bg-[#f2f2f2] px-2 py-0.5 text-[#666]">Open access</span> : null}
                {s.url ? (
                  <a href={s.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[#2563eb] hover:underline">
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

export function OutlineCard({ outline }: { outline: OutlineSection[] }) {
  if (!outline?.length) return null;
  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
      <div className="px-4 py-3 border-b border-[#e5e5e5]">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-[#666]">Outline</p>
      </div>
      <ol className="divide-y divide-[#f0f0f0]">
        {outline.map((s) => (
          <li key={s.id} className="px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-[#666]">Chapter {s.number}</p>
                <p className="mt-0.5 font-medium text-[#181818]">{s.title}</p>
                <p className="mt-1 text-sm text-[#666] leading-relaxed">{s.summary}</p>
              </div>
              <span className="inline-flex items-center rounded-full border border-[#e5e5e5] px-2 py-1 text-[10px] font-medium text-[#666]">
                {s.targetPages} pp
              </span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function ProgressCard({ meta }: { meta: Record<string, unknown> }) {
  const done = Number(meta.done || 0);
  const total = Number(meta.total || 1);
  const pct = Math.round((done / total) * 100);
  return (
    <div className="mt-4 rounded-xl border border-[#e5e5e5] bg-white p-4">
      <div className="flex items-center justify-between text-sm">
        <span className="text-[#666]">
          Chapter {String((meta.chapter as { number?: string })?.number || done)} of {total}
        </span>
        <span className="font-medium text-[#181818]">{pct}%</span>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#f0f0f0]">
        <div className="h-full rounded-full bg-[#181818]" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-2 text-xs text-[#666]">
        {(meta.wordCount as number)?.toLocaleString?.() || 0} words · ~{String(meta.pageEstimate || 0)} pages
      </p>
    </div>
  );
}

export function FilesCard({ files }: { files: ProjectFile[] }) {
  if (!files?.length) return null;
  return (
    <div className="mt-4 grid gap-3 sm:grid-cols-2">
      {files.map((file) => {
        const href = `/api/files/${file.id}?name=${encodeURIComponent(file.name)}`;
        return (
          <div key={file.id} className="overflow-hidden rounded-xl border border-[#e5e5e5] bg-white">
            <div className="px-4 py-3 border-b border-[#e5e5e5] flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg border border-[#e5e5e5] flex items-center justify-center text-[#181818]">
                {file.format === "pdf" ? <FileText className="w-5 h-5" /> : <BookOpen className="w-5 h-5" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm text-[#181818] truncate">{file.name}</p>
                <p className="text-[11px] text-[#666]">
                  {file.format.toUpperCase()} · ~{file.pages} pages · {(file.size / 1024).toFixed(0)} KB
                </p>
              </div>
            </div>
            <div className="flex border-t border-[#e5e5e5]">
              <a href={`${href}&inline=1`} target="_blank" rel="noreferrer" className="flex-1 py-3 text-center text-sm text-[#666] hover:bg-[#f2f2f2]">
                Preview
              </a>
              <a href={href} className="flex-1 flex items-center justify-center gap-1.5 py-3 text-sm text-[#181818] hover:bg-[#f2f2f2]">
                <Download className="w-4 h-4" /> Download
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
    <div className="mt-4 overflow-hidden rounded-xl border border-[#e5e5e5] bg-[#fafafa]">
      <div className="px-4 py-3 border-b border-[#e5e5e5] flex items-center gap-2">
        <Terminal className="w-4 h-4 text-[#666]" />
        <p className="text-[10px] uppercase tracking-wider font-semibold text-[#666]">Pipeline</p>
      </div>
      <div className="p-4 space-y-3">
        {last.map((c) => (
          <div key={c.id}>
            <p className="flex items-start gap-1.5 text-xs font-mono text-[#666]">
              <span className="text-[#181818]">$</span> {c.command}
            </p>
            <p className="mt-1 whitespace-pre-wrap text-[11px] text-[#666]">{c.output}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function PlanCard({ content }: { content: string }) {
  return (
    <div className="mt-4 rounded-xl border border-[#e5e5e5] bg-white p-4">
      <div className="flex items-start gap-3">
        <CheckCircle2 className="mt-0.5 w-4 h-4 text-[#2563eb]" />
        <p className="text-sm leading-relaxed text-[#181818]">{content}</p>
      </div>
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
