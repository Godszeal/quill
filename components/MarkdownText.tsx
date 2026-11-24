"use client";

export function MarkdownText({ text }: { text: string }) {
  const blocks = parseBlocks(text);
  return (
    <div className="space-y-4 text-[#181818] leading-7 text-[14px]">
      {blocks.map((block, i) => (
        <div key={i} className={block.className}>
          {block.type === "code" ? (
            <pre className="relative overflow-hidden rounded-xl border border-[#e5e5e5] bg-[#f2f2f2] p-4 text-xs font-mono text-[#181818] leading-5">
              <code>{block.content}</code>
            </pre>
          ) : block.type === "heading" ? (
            <h3 className={block.level === 1 ? "text-xl font-bold mb-2" : "text-lg font-semibold mb-2"} dangerouslySetInnerHTML={{ __html: block.content }} />
          ) : (
            <p className="" dangerouslySetInnerHTML={{ __html: block.content }} />
          )}
        </div>
      ))}
    </div>
  );
}

function parseBlocks(text: string): Array<{ type: string; content: string; className: string; level?: number }> {
  const blocks: Array<{ type: string; content: string; className: string; level?: number }> = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ type: "code", content: codeLines.join("\n"), className: "" });
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = inlineMarkdown(headingMatch[2]);
      blocks.push({ type: "heading", content, className: "", level });
      i++;
      continue;
    }

    if (line.match(/^[-*+]\s+/) || line.match(/^\d+\.\s+/)) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].match(/^[-*+]\s+/) || lines[i].match(/^\d+\.\s+/))) {
        const itemContent = lines[i].replace(/^[-*+]\s+/, "").replace(/^\d+\.\s+/, "");
        listItems.push(`<li>${inlineMarkdown(itemContent)}</li>`);
        i++;
      }
      blocks.push({ type: "list", content: `<ul class="list-disc list-inside my-2">${listItems.join("")}</ul>`, className: "" });
      continue;
    }

    if (line.trim()) {
      const paraLines: string[] = [];
      while (i < lines.length && lines[i].trim() && !lines[i].startsWith("```") && !lines[i].match(/^#{1,3}\s/)) {
        if (lines[i].match(/^[-*+]\s+/) || lines[i].match(/^\d+\.\s+/)) break;
        paraLines.push(lines[i]);
        i++;
      }
      const content = inlineMarkdown(paraLines.join(" "));
      blocks.push({ type: "paragraph", content, className: "" });
      continue;
    }

    i++;
  }

  if (blocks.length === 0) {
    blocks.push({ type: "paragraph", content: inlineMarkdown(text), className: "" });
  }

  return blocks;
}

function inlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code class=\"rounded bg-[#f2f2f2] px-1 py-0.5 font-mono text-[12px]\">$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-[#2563eb] underline underline-offset-4" target="_blank" rel="noreferrer">$1</a>');
}
