import { NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { getSql } from "@repo/ai-core/db";
import { DOCUMENTATION_STRUCTURE } from "@repo/ui/docs/docsStructure";

export const runtime = "nodejs";

type DbDoc = {
  slug: string;
  title: string;
  section: string;
  relative_path: string;
  updated_at: string;
  content: string;
  version_label: string | null;
};

type OrderedDoc = DbDoc & {
  orderChapter: string;
};

type RenderLine = {
  text: string;
  kind: "h1" | "h2" | "h3" | "body" | "list" | "code";
};

type TocRow = {
  label: string;
  pageIndex: number;
  level: 0 | 1;
};

const PAGE = {
  width: 595.28,
  height: 841.89,
  marginX: 42,
  contentTop: 788,
  contentBottom: 54,
};

function toPdfSafeText(value: string, preserveWhitespace = false) {
  const normalized = (value || "").normalize("NFKD");
  let ascii = "";
  for (let i = 0; i < normalized.length; i += 1) {
    const code = normalized.charCodeAt(i);
    if (code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 126)) {
      ascii += normalized[i];
    }
  }
  if (preserveWhitespace) return ascii;
  return ascii.replace(/\s+/g, " ").trim();
}

function normalizeInline(text: string) {
  const cleaned = text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1")
    .replace(/~~([^~]+)~~/g, "$1");
  return toPdfSafeText(cleaned);
}

function parseMarkdownToLines(content: string): RenderLine[] {
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  const output: RenderLine[] = [];
  let inCode = false;

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (trimmed.startsWith("```")) {
      inCode = !inCode;
      continue;
    }

    if (inCode) {
      output.push({ text: toPdfSafeText(raw, true), kind: "code" });
      continue;
    }

    if (!trimmed) {
      output.push({ text: "", kind: "body" });
      continue;
    }

    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = heading[1].length;
      output.push({
        text: normalizeInline(heading[2]),
        kind: level <= 1 ? "h1" : level === 2 ? "h2" : "h3",
      });
      continue;
    }

    const list = trimmed.match(/^([-*+]|\d+\.)\s+(.*)$/);
    if (list) {
      output.push({ text: `- ${normalizeInline(list[2])}`, kind: "list" });
      continue;
    }

    if (trimmed.includes("|")) {
      const tableLike = trimmed
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => normalizeInline(cell))
        .filter(Boolean)
        .join(" | ");
      if (tableLike.replace(/[-:| ]/g, "")) {
        output.push({ text: tableLike, kind: "code" });
      }
      continue;
    }

    output.push({ text: normalizeInline(trimmed), kind: "body" });
  }

  return output;
}

function wrapText(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const safe = toPdfSafeText(text, true);
  if (!safe) return [""];
  const words = safe.split(/\s+/).filter(Boolean);
  if (!words.length) return [""];

  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i += 1) {
    const next = `${current} ${words[i]}`;
    if (font.widthOfTextAtSize(next, size) <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

function metrics(kind: RenderLine["kind"]) {
  if (kind === "h1") return { size: 20, gap: 8 };
  if (kind === "h2") return { size: 16, gap: 7 };
  if (kind === "h3") return { size: 13, gap: 6 };
  if (kind === "code") return { size: 9, gap: 4 };
  return { size: 10.5, gap: 4 };
}

function drawWrapped(params: {
  page: PDFPage;
  text: string;
  font: PDFFont;
  size: number;
  gap: number;
  y: number;
  color: ReturnType<typeof rgb>;
}) {
  const { page, text, font, size, gap, y, color } = params;
  const maxWidth = PAGE.width - PAGE.marginX * 2;
  const lines = wrapText(text, font, size, maxWidth);
  let cursor = y;
  for (const line of lines) {
    page.drawText(toPdfSafeText(line, true), {
      x: PAGE.marginX,
      y: cursor,
      size,
      font,
      color,
    });
    cursor -= size + gap;
  }
  return { y: cursor, lineCount: lines.length };
}

function sectionTitle(key: string) {
  const chapter = DOCUMENTATION_STRUCTURE.find((item) => item.key === key);
  return chapter?.title?.replace(/\.$/, "") ?? key;
}

function orderDocs(rows: DbDoc[]): OrderedDoc[] {
  const chapterOrder = new Map<string, number>();
  const sessionOrder = new Map<string, number>();
  const slugChapter = new Map<string, string>();

  DOCUMENTATION_STRUCTURE.forEach((chapter, chapterIdx) => {
    chapterOrder.set(chapter.key, chapterIdx);
    chapter.sessions.forEach((session, sessionIdx) => {
      sessionOrder.set(session.slug, sessionIdx);
      slugChapter.set(session.slug, chapter.key);
    });
  });

  const mapped: OrderedDoc[] = rows.map((row) => ({
    ...row,
    orderChapter: slugChapter.get(row.slug) ?? row.section ?? "zzz",
  }));

  mapped.sort((a, b) => {
    const aChapter = chapterOrder.get(a.orderChapter) ?? 999;
    const bChapter = chapterOrder.get(b.orderChapter) ?? 999;
    if (aChapter !== bChapter) return aChapter - bChapter;

    const aSession = sessionOrder.get(a.slug) ?? 999;
    const bSession = sessionOrder.get(b.slug) ?? 999;
    if (aSession !== bSession) return aSession - bSession;

    return a.title.localeCompare(b.title);
  });

  return mapped;
}

async function getDocsFromDb() {
  const sql = getSql();
  const [exists] = await sql<{ exists: boolean }[]>`
    SELECT to_regclass('public.docs_pages') IS NOT NULL AS exists
  `;
  if (!exists?.exists) return [] as DbDoc[];

  try {
    return await sql<DbDoc[]>`
      SELECT
        p.slug,
        COALESCE(cv.title, lv.title, p.title) AS title,
        COALESCE(cv.section, lv.section, p.section) AS section,
        p.relative_path,
        p.updated_at,
        COALESCE(cv.content, lv.content, p.content) AS content,
        COALESCE(cv.version_label, lv.version_label) AS version_label
      FROM docs_pages p
      LEFT JOIN docs_versions cv ON cv.id = p.current_version_id
      LEFT JOIN LATERAL (
        SELECT v.title, v.section, v.content, v.version_label
        FROM docs_versions v
        WHERE v.page_id = p.id
        ORDER BY v.is_published DESC, v.version_no DESC, v.created_at DESC
        LIMIT 1
      ) lv ON TRUE
      WHERE p.is_deleted = FALSE
    `;
  } catch {
    return await sql<DbDoc[]>`
      SELECT
        p.slug,
        p.title,
        p.section,
        p.relative_path,
        p.updated_at,
        p.content,
        NULL::text AS version_label
      FROM docs_pages p
      WHERE p.is_deleted = FALSE
    `;
  }
}

function buildTocRows(docs: OrderedDoc[], startPageBySlug: Map<string, number>) {
  const rows: TocRow[] = [];
  const addedSlugs = new Set<string>();

  for (const chapter of DOCUMENTATION_STRUCTURE) {
    const chapterDocs = docs.filter((doc) => doc.orderChapter === chapter.key);
    if (!chapterDocs.length) continue;
    const firstPage = startPageBySlug.get(chapterDocs[0].slug) ?? 0;
    rows.push({
      label: sectionTitle(chapter.key),
      pageIndex: firstPage,
      level: 0,
    });
    for (const doc of chapterDocs) {
      rows.push({
        label: doc.title,
        pageIndex: startPageBySlug.get(doc.slug) ?? firstPage,
        level: 1,
      });
      addedSlugs.add(doc.slug);
    }
  }

  const remaining = docs.filter((doc) => !addedSlugs.has(doc.slug));
  if (remaining.length) {
    rows.push({ label: "Other", pageIndex: startPageBySlug.get(remaining[0].slug) ?? 0, level: 0 });
    for (const doc of remaining) {
      rows.push({ label: doc.title, pageIndex: startPageBySlug.get(doc.slug) ?? 0, level: 1 });
    }
  }

  return rows;
}

function estimateTocPages(rows: TocRow[]) {
  let pages = 1;
  let y = PAGE.contentTop - 34;
  for (const row of rows) {
    const rowHeight = row.level === 0 ? 18 : 14;
    if (y - rowHeight < PAGE.contentBottom) {
      pages += 1;
      y = PAGE.contentTop - 16;
    }
    y -= rowHeight;
  }
  return pages;
}

function parseVersion(value: string | null) {
  if (!value) return null;
  const parts = value.split(".").map((p) => Number(p));
  if (parts.some((n) => !Number.isFinite(n))) return null;
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0] as const;
}

function compareVersionTuple(a: readonly [number, number, number], b: readonly [number, number, number]) {
  if (a[0] !== b[0]) return a[0] - b[0];
  if (a[1] !== b[1]) return a[1] - b[1];
  return a[2] - b[2];
}

function resolveExportVersion(docs: OrderedDoc[]) {
  let winner: { label: string; tuple: readonly [number, number, number] } | null = null;
  for (const doc of docs) {
    const tuple = parseVersion(doc.version_label);
    if (!tuple || !doc.version_label) continue;
    if (!winner || compareVersionTuple(tuple, winner.tuple) > 0) {
      winner = { label: doc.version_label, tuple };
    }
  }
  return winner?.label ?? "1.0.0";
}

export async function GET() {
  try {
    const rows = await getDocsFromDb();
    const docs = orderDocs(rows);
    const exportVersion = resolveExportVersion(docs);

    const pdf = await PDFDocument.create();
    const regular = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const mono = await pdf.embedFont(StandardFonts.Courier);

    let page = pdf.addPage([PAGE.width, PAGE.height]);
    let y = PAGE.contentTop;

    page.drawText("Global ERP Documentation", {
      x: PAGE.marginX,
      y,
      size: 20,
      font: bold,
      color: rgb(0, 0, 0),
    });
    y -= 28;
    page.drawText(toPdfSafeText(`Generated: ${new Date().toLocaleString()}`), {
      x: PAGE.marginX,
      y,
      size: 10,
      font: regular,
      color: rgb(0.35, 0.35, 0.35),
    });
    y -= 16;
    page.drawText(`Export Version: v${toPdfSafeText(exportVersion)}`, {
      x: PAGE.marginX,
      y,
      size: 10,
      font: regular,
      color: rgb(0.35, 0.35, 0.35),
    });
    y -= 16;
    page.drawText(`Documents: ${docs.length}`, {
      x: PAGE.marginX,
      y,
      size: 10,
      font: regular,
      color: rgb(0.35, 0.35, 0.35),
    });

    page = pdf.addPage([PAGE.width, PAGE.height]);
    y = PAGE.contentTop;

    let currentChapter = "";
    const startPageBySlug = new Map<string, number>();

    for (const doc of docs) {
      const chapter = doc.orderChapter;
      const forceCompanyBreak =
        currentChapter !== "" && currentChapter === "global" && chapter === "company";
      if (forceCompanyBreak) {
        page = pdf.addPage([PAGE.width, PAGE.height]);
        y = PAGE.contentTop;
      }

      if (chapter !== currentChapter) {
        if (y < PAGE.contentBottom + 90) {
          page = pdf.addPage([PAGE.width, PAGE.height]);
          y = PAGE.contentTop;
        }
        const chapterLabel = sectionTitle(chapter).toUpperCase();
        const chapterDraw = drawWrapped({
          page,
          text: chapterLabel,
          font: bold,
          size: 11,
          gap: 6,
          y,
          color: rgb(0.1, 0.3, 0.6),
        });
        y = chapterDraw.y - 4;
        currentChapter = chapter;
      }

      if (y < PAGE.contentBottom + 80) {
        page = pdf.addPage([PAGE.width, PAGE.height]);
        y = PAGE.contentTop;
      }

      startPageBySlug.set(doc.slug, pdf.getPageCount() - 1);

      const titleDraw = drawWrapped({
        page,
        text: toPdfSafeText(doc.title),
        font: bold,
        size: 14,
        gap: 5,
        y,
        color: rgb(0, 0, 0),
      });
      y = titleDraw.y;

      const metaDraw = drawWrapped({
        page,
        text: toPdfSafeText(
          `${doc.relative_path} | Updated ${new Date(doc.updated_at).toLocaleString()}${
            doc.version_label ? ` | Version v${doc.version_label}` : ""
          }`
        ),
        font: regular,
        size: 8.5,
        gap: 4,
        y,
        color: rgb(0.4, 0.4, 0.4),
      });
      y = metaDraw.y - 6;

      const lines = parseMarkdownToLines(doc.content || "");
      for (const line of lines) {
        const spec = metrics(line.kind);
        const font = line.kind === "h1" || line.kind === "h2" || line.kind === "h3" ? bold : line.kind === "code" ? mono : regular;
        const wrapped = wrapText(line.text || " ", font, spec.size, PAGE.width - PAGE.marginX * 2);
        const needed = wrapped.length * (spec.size + spec.gap);
        if (y - needed < PAGE.contentBottom) {
          page = pdf.addPage([PAGE.width, PAGE.height]);
          y = PAGE.contentTop;
        }
        const drawn = drawWrapped({
          page,
          text: line.text,
          font,
          size: spec.size,
          gap: spec.gap,
          y,
          color: line.kind === "code" ? rgb(0.2, 0.2, 0.2) : rgb(0.08, 0.08, 0.08),
        });
        y = drawn.y;
      }
      y -= 10;
    }

    const tocRows = buildTocRows(docs, startPageBySlug);
    const tocPages = estimateTocPages(tocRows);
    for (let i = 0; i < tocPages; i += 1) {
      pdf.insertPage(1 + i, [PAGE.width, PAGE.height]);
    }

    let tocPageIdx = 0;
    let tocPage = pdf.getPage(1 + tocPageIdx);
    let tocY = PAGE.contentTop;
    const tocTitle = drawWrapped({
      page: tocPage,
      text: tocPageIdx === 0 ? "Table of Contents" : "Table of Contents (Cont.)",
      font: bold,
      size: 16,
      gap: 6,
      y: tocY,
      color: rgb(0, 0, 0),
    });
    tocY = tocTitle.y - 8;

    for (const row of tocRows) {
      const rowHeight = row.level === 0 ? 18 : 14;
      if (tocY - rowHeight < PAGE.contentBottom) {
        tocPageIdx += 1;
        tocPage = pdf.getPage(1 + tocPageIdx);
        tocY = PAGE.contentTop;
        const contTitle = drawWrapped({
          page: tocPage,
          text: "Table of Contents (Cont.)",
          font: bold,
          size: 14,
          gap: 5,
          y: tocY,
          color: rgb(0, 0, 0),
        });
        tocY = contTitle.y - 6;
      }

      const label = toPdfSafeText(row.label);
      const displayPage = row.pageIndex + tocPages + 1;
      const leftX = PAGE.marginX + (row.level === 0 ? 0 : 12);
      const rightX = PAGE.width - PAGE.marginX;
      const size = row.level === 0 ? 10.5 : 9.5;
      const font = row.level === 0 ? bold : regular;
      const textWidth = font.widthOfTextAtSize(label, size);
      const pageNo = String(displayPage);
      const pageWidth = regular.widthOfTextAtSize(pageNo, 9.5);
      const dotStart = leftX + textWidth + 8;
      const dotEnd = rightX - pageWidth - 8;
      const dotCharWidth = regular.widthOfTextAtSize(".", 9.5);
      const dotCount = Math.max(0, Math.floor((dotEnd - dotStart) / dotCharWidth));
      const dots = dotCount > 0 ? ".".repeat(dotCount) : "";

      tocPage.drawText(label, {
        x: leftX,
        y: tocY,
        size,
        font,
        color: rgb(0.1, 0.1, 0.1),
      });
      if (dots) {
        tocPage.drawText(dots, {
          x: dotStart,
          y: tocY,
          size: 9.5,
          font: regular,
          color: rgb(0.6, 0.6, 0.6),
        });
      }
      tocPage.drawText(pageNo, {
        x: rightX - pageWidth,
        y: tocY,
        size: 9.5,
        font: regular,
        color: rgb(0.1, 0.1, 0.1),
      });
      tocY -= rowHeight;
    }

    const pages = pdf.getPages();
    const total = pages.length;
    for (let i = 0; i < total; i += 1) {
      const p = pages[i];
      p.drawLine({
        start: { x: PAGE.marginX, y: PAGE.height - 32 },
        end: { x: PAGE.width - PAGE.marginX, y: PAGE.height - 32 },
        thickness: 0.6,
        color: rgb(0.8, 0.8, 0.8),
      });
      p.drawLine({
        start: { x: PAGE.marginX, y: 34 },
        end: { x: PAGE.width - PAGE.marginX, y: 34 },
        thickness: 0.6,
        color: rgb(0.8, 0.8, 0.8),
      });
      p.drawText("Global ERP Documentation", {
        x: PAGE.marginX,
        y: PAGE.height - 24,
        size: 8.5,
        font: regular,
        color: rgb(0.45, 0.45, 0.45),
      });
      const label = `${i + 1} / ${total}`;
      const width = regular.widthOfTextAtSize(label, 8.5);
      p.drawText(label, {
        x: PAGE.width - PAGE.marginX - width,
        y: 22,
        size: 8.5,
        font: regular,
        color: rgb(0.45, 0.45, 0.45),
      });
    }

    const bytes = await pdf.save();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="global-erp-docs-v${exportVersion}-${new Date().toISOString().slice(0, 10)}.pdf"`,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to export PDF.",
      },
      { status: 500 }
    );
  }
}
