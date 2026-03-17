import fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import path from "node:path";
import { getSql } from "@repo/ai-core/db";

const DOCS_ROOT_CANDIDATES = [
    path.resolve(process.cwd(), "docs"),
    path.resolve(process.cwd(), "../docs"),
    path.resolve(process.cwd(), "../../docs"),
    path.resolve(process.cwd(), "global", "docs"),
    path.resolve(process.cwd(), "../global", "docs"),
    path.resolve(process.cwd(), "../../global", "docs"),
];

export function resolveDocsRoot(): string | null {
    for (const candidate of DOCS_ROOT_CANDIDATES) {
        try {
            if (fs.existsSync(candidate) && fs.statSync(candidate).isDirectory()) {
                return candidate;
            }
        } catch {
            continue;
        }
    }
    return null;
}

export interface DocSummary {
    slug: string;
    title: string;
    excerpt: string;
    updatedAt: string;
    relativePath: string;
    section: string;
}

export interface DocDetail extends DocSummary {
    content: string;
    currentVersionId?: string;
    currentVersionLabel?: string;
    currentVersionNo?: number;
}

export async function listDocs(): Promise<DocSummary[]> {
    const fromDb = await listDocsFromDb();
    if (fromDb) {
        return fromDb;
    }

    const root = resolveDocsRoot();
    if (!root) {
        return [];
    }

    const markdownFiles = await collectMarkdownFiles(root, "");
    const summaries = await Promise.all(markdownFiles.map((relativePath) => buildDocEntry(root, relativePath)));

    return summaries
        .filter((entry): entry is DocSummary => Boolean(entry))
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getDocBySlug(slug: string): Promise<DocDetail | null> {
    const fromDb = await getDocBySlugFromDb(slug);
    if (fromDb) {
        return fromDb;
    }

    const root = resolveDocsRoot();
    if (!root) {
        return null;
    }

    const markdownFiles = await collectMarkdownFiles(root, "");
    for (const relativePath of markdownFiles) {
        if (makeDocSlug(relativePath) === slug) {
            return buildDocEntry(root, relativePath, true);
        }
    }

    return null;
}

async function listDocsFromDb(): Promise<DocSummary[] | null> {
    try {
        const sql = getSql();
        const [tableCheck] = await sql<{ exists: boolean }[]>`
            SELECT to_regclass('public.docs_pages') IS NOT NULL AS exists
        `;
        if (!tableCheck?.exists) {
            return null;
        }

        const rows = await sql<{
            slug: string;
            title: string | null;
            section: string | null;
            excerpt: string | null;
            content: string | null;
            updated_at: string;
            relative_path: string;
            fallback_title: string;
            fallback_section: string;
            fallback_excerpt: string | null;
            fallback_content: string;
        }[]>`
            SELECT
              p.slug,
              v.title,
              v.section,
              v.excerpt,
              v.content,
              p.updated_at,
              p.relative_path,
              p.title AS fallback_title,
              p.section AS fallback_section,
              p.excerpt AS fallback_excerpt,
              p.content AS fallback_content
            FROM docs_pages p
            LEFT JOIN docs_versions v ON v.id = p.current_version_id
            WHERE is_deleted = FALSE
            ORDER BY p.updated_at DESC
        `;

        return rows.map((row) => ({
            slug: row.slug,
            title: row.title ?? row.fallback_title,
            section: (row.section ?? row.fallback_section) || "root",
            excerpt: row.excerpt ?? row.fallback_excerpt ?? extractExcerpt(row.content ?? row.fallback_content),
            updatedAt: new Date(row.updated_at).toISOString(),
            relativePath: row.relative_path,
        }));
    } catch {
        return null;
    }
}

async function getDocBySlugFromDb(slug: string): Promise<DocDetail | null> {
    try {
        const sql = getSql();
        const [tableCheck] = await sql<{ exists: boolean }[]>`
            SELECT to_regclass('public.docs_pages') IS NOT NULL AS exists
        `;
        if (!tableCheck?.exists) {
            return null;
        }

        const [row] = await sql<{
            slug: string;
            title: string | null;
            section: string | null;
            excerpt: string | null;
            content: string | null;
            updated_at: string;
            relative_path: string;
            current_version_id: string | null;
            version_label: string | null;
            version_no: number | null;
            fallback_title: string;
            fallback_section: string;
            fallback_excerpt: string | null;
            fallback_content: string;
        }[]>`
            SELECT
              p.slug,
              v.title,
              v.section,
              v.excerpt,
              v.content,
              p.updated_at,
              p.relative_path,
              p.current_version_id,
              v.version_label,
              v.version_no,
              p.title AS fallback_title,
              p.section AS fallback_section,
              p.excerpt AS fallback_excerpt,
              p.content AS fallback_content
            FROM docs_pages p
            LEFT JOIN docs_versions v ON v.id = p.current_version_id
            WHERE p.slug = ${slug} AND p.is_deleted = FALSE
            LIMIT 1
        `;

        if (!row) {
            return null;
        }

        return {
            slug: row.slug,
            title: row.title ?? row.fallback_title,
            section: (row.section ?? row.fallback_section) || "root",
            excerpt: row.excerpt ?? row.fallback_excerpt ?? extractExcerpt(row.content ?? row.fallback_content),
            updatedAt: new Date(row.updated_at).toISOString(),
            relativePath: row.relative_path,
            content: row.content ?? row.fallback_content,
            currentVersionId: row.current_version_id ?? undefined,
            currentVersionLabel: row.version_label ?? undefined,
            currentVersionNo: row.version_no ?? undefined,
        };
    } catch {
        return null;
    }
}

async function buildDocEntry(root: string, relativePath: string): Promise<DocSummary>;
async function buildDocEntry(root: string, relativePath: string, includeContent: true): Promise<DocDetail>;
async function buildDocEntry(
    root: string,
    relativePath: string,
    includeContent = false
): Promise<DocSummary | DocDetail> {
    const filePath = path.join(root, relativePath);
    const { content, stats } = await readDocFile(filePath);
    const baseName = path.parse(relativePath).name;
    const normalizedPath = relativePath.replace(/\\/g, "/");
    const section = normalizedPath.includes("/") ? normalizedPath.split("/")[0] || "root" : "root";

    const summary: DocSummary = {
        slug: makeDocSlug(relativePath),
        title: extractTitle(content, toTitleCase(baseName)),
        excerpt: extractExcerpt(content),
        updatedAt: stats.mtime.toISOString(),
        relativePath: normalizedPath,
        section,
    };

    if (includeContent) {
        return { ...summary, content };
    }

    return summary;
}

async function readDocFile(filePath: string) {
    const [content, stats] = await Promise.all([
        fsPromises.readFile(filePath, "utf-8"),
        fsPromises.stat(filePath),
    ]);

    return { content, stats };
}

async function collectMarkdownFiles(root: string, relativeDir: string): Promise<string[]> {
    const currentDir = path.join(root, relativeDir);
    const dirents = await fsPromises.readdir(currentDir, { withFileTypes: true });
    const results: string[] = [];

    for (const entry of dirents) {
        const nextRelative = relativeDir ? path.join(relativeDir, entry.name) : entry.name;
        if (entry.isDirectory()) {
            const nested = await collectMarkdownFiles(root, nextRelative);
            results.push(...nested);
            continue;
        }

        if (!entry.isFile() || !entry.name.toLowerCase().endsWith(".md")) {
            continue;
        }
        results.push(nextRelative);
    }

    return results;
}

export function makeDocSlug(relativePath: string): string {
    const normalized = relativePath.replace(/\\/g, "/").replace(/\.md$/i, "");
    const slug = normalized
        .split("/")
        .filter(Boolean)
        .map((segment) => slugify(segment))
        .join("--");
    return slug || "doc";
}

export function slugify(value: string): string {
    return value
        .toLowerCase()
        .replace(/[\s_]+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/^-+|-+$/g, "");
}

function toTitleCase(value: string): string {
    const words = value
        .replace(/[-_]+/g, " ")
        .split(/\s+/)
        .filter(Boolean);

    if (words.length === 0) {
        return value;
    }

    return words
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function extractTitle(content: string, fallback: string): string {
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith("#")) {
            return trimmed.replace(/^#+\s*/, "").trim() || fallback;
        }
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

        if (trimmed.startsWith("#")) {
            continue;
        }

        buffer.push(trimmed);
    }

    if (buffer.length) {
        paragraphs.push(buffer.join(" ").trim());
    }

    const candidate = paragraphs.find((line) => line.length > 0) ?? "";
    if (candidate.length === 0) {
        return "";
    }

    const max = 220;
    if (candidate.length <= max) {
        return candidate;
    }

    return `${candidate.slice(0, max).trim()}...`;
}
