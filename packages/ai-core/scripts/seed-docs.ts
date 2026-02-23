/* eslint-disable no-console */
import fsSync from "fs";
import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { getSql } from "../src/db";

type SeedDoc = {
  title: string;
  section: string;
  slug: string;
  excerpt: string;
  content: string;
  relativePath: string;
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-+|-+$/g, "");
}

function makeDocSlug(relativePath: string): string {
  return relativePath
    .replace(/\\/g, "/")
    .replace(/\.md$/i, "")
    .split("/")
    .filter(Boolean)
    .map((segment) => slugify(segment))
    .join("--");
}

function extractTitle(content: string, fallback: string): string {
  const lines = content.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith("#")) return trimmed.replace(/^#+\s*/, "").trim() || fallback;
  }
  return fallback;
}

function extractExcerpt(content: string): string {
  const lines = content.split(/\r?\n/);
  const paragraphs: string[] = [];
  let buffer: string[] = [];

  for (const raw of lines) {
    const trimmed = raw.trim();
    if (!trimmed) {
      if (buffer.length) {
        paragraphs.push(buffer.join(" ").trim());
        buffer = [];
      }
      continue;
    }
    if (trimmed.startsWith("#")) continue;
    buffer.push(trimmed);
  }

  if (buffer.length) paragraphs.push(buffer.join(" ").trim());
  const candidate = paragraphs.find((line) => line.length > 0) ?? "";
  if (!candidate) return "";
  return candidate.length > 220 ? `${candidate.slice(0, 220).trim()}...` : candidate;
}

function toTitleCase(value: string): string {
  return value
    .replace(/[-_]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

async function collectMarkdownFiles(root: string, relativeDir = ""): Promise<string[]> {
  const currentDir = path.join(root, relativeDir);
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const nextRelative = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
    if (entry.isDirectory()) {
      const nested = await collectMarkdownFiles(root, nextRelative);
      files.push(...nested);
      continue;
    }
    if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(nextRelative);
    }
  }
  return files;
}

async function loadEnvFromRoot() {
  if (process.env.DATABASE_URL) return;
  const envPath = path.resolve(__dirname, "..", "..", "..", ".env");
  try {
    const contents = await fs.readFile(envPath, "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const idx = trimmed.indexOf("=");
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    // ignore
  }
}

function resolveDocsRoot(): string {
  const candidates = [
    path.resolve(process.cwd(), "docs"),
    path.resolve(process.cwd(), "global", "docs"),
    path.resolve(process.cwd(), "..", "docs"),
    path.resolve(process.cwd(), "..", "global", "docs"),
  ];
  for (const candidate of candidates) {
    try {
      if (fsSync.existsSync(candidate)) return candidate;
    } catch {
      continue;
    }
  }
  throw new Error("Docs root not found. Expected docs/ or global/docs/");
}

async function buildSeedDocs(root: string): Promise<SeedDoc[]> {
  const markdownFiles = await collectMarkdownFiles(root, "");
  const docs: SeedDoc[] = [];

  for (const relativePath of markdownFiles) {
    const normalized = relativePath.replace(/\\/g, "/");
    const filePath = path.join(root, relativePath);
    const content = await fs.readFile(filePath, "utf8");
    const baseName = path.parse(normalized).name;
    const title = extractTitle(content, toTitleCase(baseName));
    const section = normalized.includes("/") ? normalized.split("/")[0] || "root" : "root";
    docs.push({
      title,
      section,
      slug: makeDocSlug(normalized),
      excerpt: extractExcerpt(content),
      content,
      relativePath: normalized,
    });
  }

  return docs;
}

async function main() {
  await loadEnvFromRoot();
  const sql = getSql();
  const docsRoot = resolveDocsRoot();
  const docs = await buildSeedDocs(docsRoot);
  const [versionsCheck] = await sql<{ exists: boolean }[]>`
    SELECT to_regclass('public.docs_versions') IS NOT NULL AS exists
  `;
  const versionsEnabled = Boolean(versionsCheck?.exists);

  if (!docs.length) {
    console.log("No markdown docs found; skipping docs seed.");
    return;
  }

  for (const doc of docs) {
    const pageId = randomUUID();
    const rows = await sql<{ id: string; title: string; section: string; content: string; excerpt: string | null }[]>`
      INSERT INTO docs_pages (
        id, slug, title, section, excerpt, content, relative_path, source, is_deleted
      )
      VALUES (
        ${pageId},
        ${doc.slug},
        ${doc.title},
        ${doc.section},
        ${doc.excerpt || null},
        ${doc.content},
        ${doc.relativePath},
        ${"seed"},
        ${false}
      )
      ON CONFLICT (slug) DO UPDATE SET
        title = EXCLUDED.title,
        section = EXCLUDED.section,
        excerpt = EXCLUDED.excerpt,
        content = EXCLUDED.content,
        relative_path = EXCLUDED.relative_path,
        source = EXCLUDED.source,
        is_deleted = FALSE,
        updated_at = now()
      RETURNING id, title, section, content, excerpt
    `;
    const page = rows[0];
    if (!versionsEnabled || !page) {
      continue;
    }

    const [currentVersion] = await sql<{
      id: string;
      version_no: number;
      version_label: string;
      content: string;
      title: string;
      section: string;
      excerpt: string | null;
    }[]>`
      SELECT id, version_no, version_label, content, title, section, excerpt
      FROM docs_versions
      WHERE page_id = ${page.id}
      ORDER BY version_no DESC
      LIMIT 1
    `;

    if (!currentVersion) {
      const versionId = randomUUID();
      await sql`
        INSERT INTO docs_versions (
          id, page_id, version_no, version_label, change_type,
          title, section, excerpt, content, changelog, created_by, is_published, published_at
        ) VALUES (
          ${versionId}, ${page.id}, 1, ${"1.0.0"}, ${"major"},
          ${doc.title}, ${doc.section}, ${doc.excerpt || null}, ${doc.content},
          ${"Seed baseline"}, ${"seed"}, TRUE, now()
        )
      `;
      await sql`
        UPDATE docs_pages
        SET current_version_id = ${versionId}
        WHERE id = ${page.id}
      `;
      continue;
    }

    const changed =
      currentVersion.content !== doc.content ||
      currentVersion.title !== doc.title ||
      currentVersion.section !== doc.section ||
      (currentVersion.excerpt ?? null) !== (doc.excerpt || null);

    if (!changed) {
      await sql`
        UPDATE docs_pages
        SET current_version_id = ${currentVersion.id}
        WHERE id = ${page.id}
      `;
      continue;
    }

    const [majRaw, minRaw, patchRaw] = String(currentVersion.version_label || "1.0.0")
      .split(".")
      .map((item) => Number(item));
    const major = Number.isFinite(majRaw) ? majRaw : 1;
    const minor = Number.isFinite(minRaw) ? minRaw : 0;
    const patch = Number.isFinite(patchRaw) ? patchRaw + 1 : 1;
    const nextLabel = `${major}.${minor}.${patch}`;
    const nextVersionNo = Number(currentVersion.version_no || 0) + 1;
    const newVersionId = randomUUID();

    await sql`
      UPDATE docs_versions
      SET is_published = FALSE
      WHERE page_id = ${page.id}
        AND is_published = TRUE
    `;
    await sql`
      INSERT INTO docs_versions (
        id, page_id, version_no, version_label, change_type,
        title, section, excerpt, content, changelog, created_by, is_published, published_at
      ) VALUES (
        ${newVersionId}, ${page.id}, ${nextVersionNo}, ${nextLabel}, ${"patch"},
        ${doc.title}, ${doc.section}, ${doc.excerpt || null}, ${doc.content},
        ${"Seed sync"}, ${"seed"}, TRUE, now()
      )
    `;
    await sql`
      UPDATE docs_pages
      SET current_version_id = ${newVersionId}
      WHERE id = ${page.id}
    `;
  }

  console.log(`Seeded ${docs.length} docs into docs_pages.`);
}

main()
  .catch((error) => {
    console.error("Docs seed failed:", error);
    process.exit(1);
  })
  .finally(() => {
    process.exit(0);
  });
