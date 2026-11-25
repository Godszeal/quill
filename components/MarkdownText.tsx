"use client";

import { Highlight, themes } from "prism-react-renderer";
import Prism from "prismjs";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-python";
import "prismjs/components/prism-javascript";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-json";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-css";
import "prismjs/components/prism-markup";
import "prismjs/components/prism-java";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-go";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-yaml";
import "prismjs/components/prism-docker";

export function MarkdownText({ text, isDark }: { text: string; isDark?: boolean }) {
  const blocks = parseBlocks(text, isDark ?? false);
  const ink = isDark ? "#e5e5e5" : "#181818";
  const codeBg = isDark ? "#2a2a2a" : "#f2f2f2";
  const codeInk = isDark ? "#ffffff" : "#181818";
  const linkColor = isDark ? "#60a5fa" : "#2563eb";
  return (
    <div className="space-y-4 leading-7 text-[14px]" style={{ color: ink }}>
      {blocks.map((block, i) => (
        <div key={i} className={block.className}>
          {block.type === "code" ? (
            <div className="relative overflow-hidden rounded-xl border p-0 mb-4" style={{ borderColor: codeBg }}>
              <Highlight
                prism={Prism}
                theme={isDark ? themes.dracula : themes.oneLight}
                language={block.language || "text"}
                code={block.content}
              >
                {({ className, style, tokens, getLineProps, getTokenProps }) => (
                  <pre className={className} style={{ ...style, padding: "1rem", fontSize: "12px", lineHeight: 1.5, margin: 0 }}>
                    {tokens.map((line, i) => (
                      <div key={i} {...getLineProps({ line, key: i })}>
                        {line.map((token, key) => (
                          <span key={key} {...getTokenProps({ token, key })} />
                        ))}
                      </div>
                    ))}
                  </pre>
                )}
              </Highlight>
            </div>
          ) : block.type === "heading" ? (
            <h3 className={block.level === 1 ? "text-xl font-bold mb-2" : "text-lg font-semibold mb-2"} dangerouslySetInnerHTML={{ __html: block.content }} style={{ color: ink }} />
          ) : (
            <p className="" dangerouslySetInnerHTML={{ __html: block.content }} style={{ color: ink }} />
          )}
        </div>
      ))}
    </div>
  );
}

function parseBlocks(text: string, isDark: boolean): Array<{ type: string; content: string; className: string; level?: number; language?: string }> {
  const blocks: Array<{ type: string; content: string; className: string; level?: number; language?: string }> = [];
  const lines = text.split("\n");
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("```")) {
      const fence = line.trim();
      const language = fence.replace(/^```+/i, "").trim() || "text";
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ type: "code", content: codeLines.join("\n"), className: "", language });
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = inlineMarkdown(headingMatch[2], isDark);
      blocks.push({ type: "heading", content, className: "", level });
      i++;
      continue;
    }

    if (line.match(/^[-*+]\s+/) || line.match(/^\d+\.\s+/)) {
      const listItems: string[] = [];
      while (i < lines.length && (lines[i].match(/^[-*+]\s+/) || lines[i].match(/^\d+\.\s+/))) {
        const itemContent = lines[i].replace(/^[-*+]\s+/, "").replace(/^\d+\.\s+/, "");
        listItems.push(`<li>${inlineMarkdown(itemContent, isDark)}</li>`);
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
      const content = inlineMarkdown(paraLines.join(" "), isDark);
      blocks.push({ type: "paragraph", content, className: "" });
      continue;
    }

    i++;
  }

  if (blocks.length === 0) {
    blocks.push({ type: "paragraph", content: inlineMarkdown(text, isDark), className: "" });
  }

  return blocks;
}

function inlineMarkdown(text: string, isDark: boolean = false): string {
  const ink = isDark ? "#e5e5e5" : "#181818";
  const inlineCodeBg = isDark ? "#3a3a3a" : "#f2f2f2";
  const linkColor = isDark ? "#60a5fa" : "#2563eb";
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, `<code style="background:${inlineCodeBg};color:${ink}" class="rounded px-1 py-0.5 font-mono text-[12px]">$1</code>`)
    .replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      `<a href="$2" style="color:${linkColor}" class="underline underline-offset-4" target="_blank" rel="noreferrer">$1</a>`,
    );
}
