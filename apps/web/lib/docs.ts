import fs from "node:fs";
import { promises as fsPromises } from "node:fs";
import path from "node:path";

const DOCS_ROOT_CANDIDATES = [
    path.resolve(process.cwd(), "global", "docs"),
    path.resolve(process.cwd(), "../global", "docs"),
    path.resolve(process.cwd(), "../../global", "docs"),
    path.resolve(process.cwd(), "docs"),
    path.resolve(process.cwd(), "../docs"),
    path.resolve(process.cwd(), "../../docs"),
];

function resolveDocsRoot(): string | null {
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
}

export async function listDocs(): Promise<DocSummary[]> {
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

function makeDocSlug(relativePath: string): string {
    const normalized = relativePath.replace(/\\/g, "/").replace(/\.md$/i, "");
    const slug = normalized
        .split("/")
        .filter(Boolean)
        .map((segment) => slugify(segment))
        .join("--");
    return slug || "doc";
}

function slugify(value: string): string {
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
