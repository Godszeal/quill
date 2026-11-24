import type { Project } from "../types";
import type { Paragraph } from "docx";
import { frontMatter } from "../writer";

async function loadDocx() {
  return await import("docx");
}

export async function buildDocx(project: Project) {
  const docx = await loadDocx();
  const {
    AlignmentType,
    BorderStyle,
    Document,
    Footer,
    Header,
    HeadingLevel,
    Packer,
    PageNumber,
    Paragraph,
    TextRun,
  } = docx;
  const meta = frontMatter(project);
  const children: Paragraph[] = [];

  children.push(
    new Paragraph({ spacing: { after: 200 }, children: [new TextRun({ text: "QUILL RESEARCH STUDIO", bold: true, size: 20, color: "64748B" })] }),
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { after: 200 },
      children: [new TextRun({ text: meta.title, bold: true })],
    }),
    new Paragraph({
      spacing: { after: 400 },
      children: [new TextRun({ text: meta.subtitle, italics: true, size: 24, color: "475569" })],
    }),
    new Paragraph({ children: [new TextRun({ text: meta.author, size: 24 })] }),
    new Paragraph({ children: [new TextRun({ text: meta.institution, size: 22 })] }),
    new Paragraph({ spacing: { after: 400 }, children: [new TextRun({ text: String(meta.year), size: 22 })] }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Abstract")] }),
    new Paragraph({ spacing: { after: 240 }, children: [new TextRun({ text: meta.abstract, size: 22 })] }),
    new Paragraph({
      spacing: { after: 400 },
      children: [new TextRun({ text: `Keywords: ${meta.keywords.join(", ")}`, italics: true, size: 20 })],
    }),
    new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("Table of contents")] })
  );

  project.chapters.forEach((ch) => {
    children.push(
      new Paragraph({
        spacing: { after: 80 },
        children: [new TextRun({ text: `Chapter ${ch.number}.  ${ch.title}`, size: 22 })],
      })
    );
  });

  project.chapters.forEach((ch) => {
    ch.blocks.forEach((block) => {
      const heading = block.level === 1 ? HeadingLevel.HEADING_1 : block.level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3;
      children.push(new Paragraph({ heading, spacing: { before: 240, after: 120 }, children: [new TextRun({ text: block.heading })] }));
      block.paragraphs.forEach((p) => {
        children.push(
          new Paragraph({
            spacing: { after: 200, line: 276 },
            alignment: AlignmentType.JUSTIFIED,
            children: [new TextRun({ text: p, size: 22, font: "Times New Roman" })],
          })
        );
      });
    });
  });

  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, children: [new TextRun("References")] }));
  project.bibliography.forEach((entry) => {
    children.push(
      new Paragraph({
        spacing: { after: 160 },
        indent: { left: 360, hanging: 360 },
        children: [new TextRun({ text: entry, size: 20, font: "Times New Roman" })],
      })
    );
  });

  const document = new Document({
    creator: "Quill",
    title: project.topic,
    description: meta.abstract,
    styles: {
      default: {
        document: {
          run: { font: "Times New Roman", size: 22 },
        },
      },
    },
    sections: [
      {
        properties: {
          page: {
            margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 },
            borders: {
              pageBorderTop: { style: BorderStyle.NONE, size: 0, color: "FFFFFF" },
            },
          },
        },
        headers: {
          default: new Header({
            children: [
              new Paragraph({
                alignment: AlignmentType.RIGHT,
                children: [new TextRun({ text: project.topic.slice(0, 70), italics: true, size: 16, color: "64748B" })],
              }),
            ],
          }),
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: "Quill  ·  ", size: 16, color: "64748B" }),
                  new TextRun({ children: [PageNumber.CURRENT], size: 16, color: "64748B" }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  return Packer.toBuffer(document);
}
