import type { Chapter, Project } from "../types";
import { frontMatter } from "../writer";

export async function buildPdf(project: Project) {
  const { PDFDocument, rgb, StandardFonts } = (await import("pdf-lib")) as any;
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.TimesRoman);
  const boldFont = await pdfDoc.embedFont(StandardFonts.TimesRomanBold);
  const italicFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const meta = frontMatter(project);
  const margin = 72;

  const newPage = () => pdfDoc.addPage([595, 842]);

  type DrawCtx = { page: any; y: number; width: number; height: number };

  const makeCtx = (page: any): DrawCtx => {
    const { width, height } = page.getSize();
    return { page, y: height - margin, width, height };
  };

  const drawText = (ctx: DrawCtx, text: string, opts: { x?: number; size?: number; font?: any; color?: any; lineHeight?: number } = {}) => {
    const { x = margin, size = 11, font: f = font, color = rgb(0.1, 0.1, 0.1), lineHeight = 1.2 } = opts;
    const lines = text.split("\n");
    let cy = ctx.y;
    for (const line of lines) {
      ctx.page.drawText(line, { x, y: cy, size, font: f, color });
      cy -= size * lineHeight;
    }
    ctx.y = cy;
  };

  const moveDown = (ctx: DrawCtx, amount: number) => {
    ctx.y -= amount;
  };

  const heading = (ctx: DrawCtx, text: string, size = 16) => {
    drawText(ctx, text, { x: margin, size, font: boldFont, color: rgb(0.06, 0.07, 0.13) });
    moveDown(ctx, size * 1.5);
  };

  // Title page
  const p1 = newPage();
  const c1 = makeCtx(p1);
  const { width: w1, height: h1 } = p1.getSize();
  p1.drawRectangle({ x: 0, y: 0, width: w1, height: h1, color: rgb(0.04, 0.07, 0.12) });
  drawText(c1, "QUILL RESEARCH STUDIO", { x: margin, size: 12, font: boldFont, color: rgb(0.8, 0.9, 1) });
  moveDown(c1, 30);
  drawText(c1, meta.title, { x: margin, size: 34, font: boldFont, color: rgb(1, 1, 1) });
  moveDown(c1, 12);
  drawText(c1, meta.subtitle, { x: margin, size: 16, font: italicFont, color: rgb(0.7, 0.8, 0.9) });
  moveDown(c1, 40);
  drawText(c1, meta.author, { x: margin, size: 14, font: font, color: rgb(1, 1, 1) });
  drawText(c1, meta.institution, { x: margin, size: 14, font: font, color: rgb(1, 1, 1) });
  drawText(c1, String(meta.year), { x: margin, size: 14, font: font, color: rgb(1, 1, 1) });

  // Abstract + TOC page
  const p2 = newPage();
  const c2 = makeCtx(p2);
  heading(c2, "Abstract", 16);
  drawText(c2, meta.abstract, { x: margin, size: 11, lineHeight: 1.4, color: rgb(0.15, 0.15, 0.15) });
  moveDown(c2, 12);
  heading(c2, "Keywords", 12);
  drawText(c2, meta.keywords.join(" · "), { x: margin, size: 11, color: rgb(0.15, 0.15, 0.15) });
  moveDown(c2, 24);
  heading(c2, "Table of contents", 16);
  project.chapters.forEach((ch) => {
    drawText(c2, `Chapter ${ch.number}.  ${ch.title}`, { x: margin, size: 12, color: rgb(0.15, 0.15, 0.15) });
    moveDown(c2, 10);
  });
  moveDown(c2, 12);
  heading(c2, "References", 16);
  moveDown(c2, 24);

  // Chapters
  project.chapters.forEach((ch, idx) => {
    const np = newPage();
    const cn = makeCtx(np);
    heading(cn, `Chapter ${ch.number}. ${ch.title}`, 16);
    moveDown(cn, 12);
    ch.blocks.forEach((block) => {
      const bsize = block.level === 1 ? 16 : block.level === 2 ? 13 : 11.5;
      heading(cn, block.heading, bsize);
      moveDown(cn, 8);
      block.paragraphs.forEach((p) => {
        drawText(cn, p, { x: margin, size: 11, lineHeight: 1.4, color: rgb(0.15, 0.15, 0.15) });
        moveDown(cn, 12);
      });
    });
    if (idx !== project.chapters.length - 1) {
      newPage();
    }
  });

  // References page
  const rp = newPage();
  const cr = makeCtx(rp);
  heading(cr, "References", 16);
  moveDown(cr, 24);
  project.bibliography.forEach((entry) => {
    drawText(cr, entry, { x: margin + 18, size: 10.5, color: rgb(0.15, 0.15, 0.15) });
    moveDown(cr, 8);
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}
