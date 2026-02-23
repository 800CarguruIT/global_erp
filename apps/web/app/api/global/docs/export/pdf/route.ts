import { NextResponse } from "next/server";
import { chromium } from "playwright";
import { getDocBySlug, listDocs } from "../../../../../../lib/docs";

export const runtime = "nodejs";

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type MarkdownBlock =
  | { type: "heading"; level: number; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] }
  | { type: "code"; language: string; content: string };

function parseMarkdown(text: string): MarkdownBlock[] {
  const normalized = text.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const blocks: MarkdownBlock[] = [];
  let paragraphBuffer: string[] = [];
  let listBuffer: { ordered: boolean; items: string[] } | null = null;
  let codeBuffer: { language: string; lines: string[] } | null = null;

  const flushParagraph = () => {
    if (paragraphBuffer.length === 0) return;
    blocks.push({ type: "paragraph", text: paragraphBuffer.join(" ").trim() });
    paragraphBuffer = [];
  };

  const flushList = () => {
    if (!listBuffer) return;
    blocks.push({ type: "list", ordered: listBuffer.ordered, items: listBuffer.items });
    listBuffer = null;
  };

  const flushCode = () => {
    if (!codeBuffer) return;
    blocks.push({ type: "code", language: codeBuffer.language, content: codeBuffer.lines.join("\n") });
    codeBuffer = null;
  };

  for (let i = 0; i < lines.length; i += 1) {
    const raw = lines[i];
    const trimmed = raw.trim();

    const fenceMatch = trimmed.match(/^```(.*)$/);
    if (fenceMatch) {
      flushParagraph();
      flushList();
      if (codeBuffer) {
        flushCode();
      } else {
        codeBuffer = {
          language: (fenceMatch[1] || "").trim().toLowerCase(),
          lines: [],
        };
      }
      continue;
    }

    if (codeBuffer) {
      codeBuffer.lines.push(raw);
      continue;
    }

    if (trimmed === "") {
      flushParagraph();
      flushList();
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.*)/);
    if (headingMatch) {
      flushParagraph();
      flushList();
      blocks.push({ type: "heading", level: headingMatch[1].length, text: headingMatch[2].trim() });
      continue;
    }

    const nextLine = lines[i + 1]?.trim() ?? "";
    const separatorMatch = nextLine.match(/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/);
    const isTableHeader = trimmed.includes("|") && Boolean(separatorMatch);
    if (isTableHeader) {
      flushParagraph();
      flushList();

      const parseTableLine = (line: string) =>
        line
          .trim()
          .replace(/^\|/, "")
          .replace(/\|$/, "")
          .split("|")
          .map((cell) => cell.trim());

      const headers = parseTableLine(trimmed);
      const rows: string[][] = [];

      let cursor = i + 2;
      while (cursor < lines.length) {
        const candidate = lines[cursor].trim();
        if (!candidate || !candidate.includes("|")) break;
        rows.push(parseTableLine(candidate));
        cursor += 1;
      }

      blocks.push({ type: "table", headers, rows });
      i = cursor - 1;
      continue;
    }

    const listMatch = trimmed.match(/^(?:([-*+])|(\d+\.))\s+(.*)/);
    if (listMatch) {
      flushParagraph();
      const isOrdered = Boolean(listMatch[2]);
      const entryText = listMatch[3].trim();

      if (!listBuffer || listBuffer.ordered !== isOrdered) {
        flushList();
        listBuffer = { ordered: isOrdered, items: [] };
      }

      listBuffer.items.push(entryText);
      continue;
    }

    paragraphBuffer.push(trimmed);
  }

  flushParagraph();
  flushList();
  flushCode();
  return blocks;
}

function renderInline(text: string) {
  const tokens: string[] = [];
  const withCodeTokens = text.replace(/`([^`]+)`/g, (_m, p1) => {
    const token = `@@CODE_${tokens.length}@@`;
    tokens.push(`<code>${escapeHtml(p1)}</code>`);
    return token;
  });

  const escaped = escapeHtml(withCodeTokens);
  const withStrong = escaped.replace(/\*\*([^*]+)\*\*/g, (_m, p1) => `<strong>${p1}</strong>`);

  return withStrong.replace(/@@CODE_(\d+)@@/g, (_m, idx) => tokens[Number(idx)] ?? "");
}

function renderMarkdownHtml(text: string) {
  const blocks = parseMarkdown(text || "");
  return blocks
    .map((block) => {
      if (block.type === "heading") {
        const tag = block.level === 1 ? "h1" : block.level === 2 ? "h2" : block.level === 3 ? "h3" : "h4";
        return `<${tag}>${renderInline(block.text)}</${tag}>`;
      }

      if (block.type === "paragraph") {
        return `<p>${renderInline(block.text)}</p>`;
      }

      if (block.type === "list") {
        const tag = block.ordered ? "ol" : "ul";
        return `<${tag}>${block.items.map((item) => `<li>${renderInline(item)}</li>`).join("")}</${tag}>`;
      }

      if (block.type === "code") {
        return `<pre><code>${escapeHtml(block.content)}</code></pre>`;
      }

      if (block.type === "table") {
        const head = `<thead><tr>${block.headers.map((h) => `<th>${renderInline(h)}</th>`).join("")}</tr></thead>`;
        const body = `<tbody>${block.rows
          .map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`)
          .join("")}</tbody>`;
        return `<div class="table-wrap"><table>${head}${body}</table></div>`;
      }

      return "";
    })
    .join("");
}

function buildDocsHtml(payload: {
  generatedAt: string;
  docs: Array<{
    title: string;
    section: string;
    relativePath: string;
    updatedAt: string;
    content: string;
  }>;
}) {
  const sections = Array.from(new Set(payload.docs.map((doc) => doc.section)));
  const toc = sections
    .map((section) => {
      const docs = payload.docs.filter((doc) => doc.section === section);
      const title = section === "root" ? "Overview" : section;
      const links = docs
        .map(
          (doc, idx) =>
            `<li><a href="#doc-${escapeHtml(section)}-${idx}">${escapeHtml(doc.title)}</a></li>`
        )
        .join("");
      return `<div class="toc-group"><h3>${escapeHtml(title)}</h3><ul>${links}</ul></div>`;
    })
    .join("");

  const docsHtml = sections
    .map((section) => {
      const title = section === "root" ? "Overview" : section;
      const docs = payload.docs.filter((doc) => doc.section === section);
      return `
        <section class="section-block">
          <h2>${escapeHtml(title)}</h2>
          ${docs
            .map(
              (doc, idx) => `
            <article id="doc-${escapeHtml(section)}-${idx}" class="doc-card">
              <header>
                <h3>${escapeHtml(doc.title)}</h3>
                <p class="meta">${escapeHtml(doc.relativePath)} | Updated ${escapeHtml(
                new Date(doc.updatedAt).toLocaleString()
              )}</p>
              </header>
              <div class="doc-content">${renderMarkdownHtml(doc.content)}</div>
            </article>
          `
            )
            .join("")}
        </section>
      `;
    })
    .join("");

  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Global ERP Documentation Export</title>
    <style>
      @page { size: A4; margin: 12mm; }
      body { font-family: "Segoe UI", Arial, sans-serif; color: #e2e8f0; line-height: 1.55; background: #06243a; }
      h1 { margin: 0 0 6px; font-size: 22px; color: #f8fafc; }
      h2 { margin: 20px 0 8px; font-size: 14px; text-transform: uppercase; letter-spacing: .08em; color: #7dd3fc; }
      h3 { margin: 0 0 4px; font-size: 14px; color: #f1f5f9; }
      .meta { margin: 0; color: #93c5fd; font-size: 10px; }
      .header { padding: 12px; border: 1px solid #0ea5e9; border-radius: 12px; background: #031426; }
      .toc { margin-top: 12px; padding: 12px; border: 1px solid #164e63; border-radius: 12px; background: #04192d; }
      .toc-group h3 { margin-top: 8px; font-size: 12px; color: #bae6fd; }
      .toc ul { margin: 4px 0 0 16px; padding: 0; }
      .toc li { margin: 2px 0; font-size: 11px; }
      .toc a { color: #7dd3fc; text-decoration: none; }
      .doc-card { border: 1px solid #164e63; border-radius: 12px; padding: 12px; margin: 10px 0; page-break-inside: avoid; background: #041528; }
      .doc-content p { margin: 10px 0; font-size: 11px; color: #e2e8f0; }
      .doc-content h1 { font-size: 24px; margin: 16px 0 8px; }
      .doc-content h2 { font-size: 20px; margin: 14px 0 6px; text-transform: none; letter-spacing: 0; color: #f1f5f9; }
      .doc-content h3 { font-size: 17px; margin: 12px 0 6px; }
      .doc-content h4 { font-size: 14px; margin: 10px 0 4px; color: #e2e8f0; }
      .doc-content ul, .doc-content ol { margin: 8px 0 8px 18px; padding: 0; }
      .doc-content li { margin: 4px 0; font-size: 11px; }
      .doc-content code { padding: 1px 4px; border-radius: 4px; background: #0f172a; color: #93c5fd; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
      .doc-content pre { margin: 8px 0 0; white-space: pre-wrap; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 10px; color: #e2e8f0; background: #020617; border: 1px solid #1e293b; border-radius: 8px; padding: 10px; }
      .table-wrap { overflow: hidden; border: 1px solid #1e3a5f; border-radius: 8px; margin-top: 8px; }
      .doc-content table { width: 100%; border-collapse: collapse; font-size: 10px; }
      .doc-content th { text-align: left; color: #bae6fd; background: #0b2942; border-bottom: 1px solid #1e3a5f; padding: 6px; }
      .doc-content td { color: #dbeafe; border-bottom: 1px solid #1e3a5f; padding: 6px; vertical-align: top; }
      .section-block { page-break-inside: avoid; }
    </style>
  </head>
  <body>
    <div class="header">
      <h1>Global ERP Documentation</h1>
      <p class="meta">Generated at ${escapeHtml(payload.generatedAt)} | Total docs: ${payload.docs.length}</p>
    </div>
    <div class="toc">
      <h2>Table of Contents</h2>
      ${toc}
    </div>
    ${docsHtml}
  </body>
</html>`;
}

export async function GET() {
  const summaries = await listDocs();
  const details = await Promise.all(
    summaries.map(async (summary) => {
      const detail = await getDocBySlug(summary.slug);
      return {
        title: summary.title,
        section: summary.section,
        relativePath: summary.relativePath,
        updatedAt: summary.updatedAt,
        content: detail?.content ?? "",
      };
    })
  );

  const html = buildDocsHtml({
    generatedAt: new Date().toISOString(),
    docs: details,
  });

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "networkidle" });
    const pdf = await page.pdf({ format: "A4", printBackground: true });
    await page.close();
    return new NextResponse(pdf, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="global-erp-docs-${new Date().toISOString().slice(0, 10)}.pdf"`,
      },
    });
  } finally {
    await browser.close();
  }
}
