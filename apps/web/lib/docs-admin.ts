import { randomUUID } from "node:crypto";
import { getSql } from "@repo/ai-core/db";
import { getDocBySlug, slugify } from "./docs";

export type DocActionType = "create" | "edit" | "delete" | "draft" | "publish" | "revert";

export type DocActionLog = {
  id: string;
  action: DocActionType;
  slug: string;
  title: string;
  relativePath: string;
  createdAt: string;
  details?: string;
  versionId?: string;
};

export type DocVersionChangeType = "major" | "minor" | "patch";

export type DocVersionSummary = {
  id: string;
  versionNo: number;
  versionLabel: string;
  changeType: DocVersionChangeType;
  title: string;
  section: string;
  changelog?: string;
  createdBy: string;
  createdAt: string;
  publishedAt?: string;
  isPublished: boolean;
  isCurrent: boolean;
};

type DbDocRow = {
  id: string;
  slug: string;
  title: string;
  section: string;
  excerpt: string | null;
  content: string;
  relative_path: string;
  updated_at: string;
  current_version_id: string | null;
};

type DbVersionRow = {
  id: string;
  page_id: string;
  version_no: number;
  version_label: string;
  change_type: DocVersionChangeType;
  title: string;
  section: string;
  excerpt: string | null;
  content: string;
  changelog: string | null;
  created_by: string;
  is_published: boolean;
  created_at: string;
  published_at: string | null;
};

function normalizeSection(section?: string): string {
  const normalized = slugify(section ?? "");
  return normalized || "root";
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

function buildRelativePath(section: string, title: string): string {
  const base = slugify(title) || "new-doc";
  return section === "root" ? `${base}.md` : `${section}/${base}.md`;
}

function bumpVersionLabel(previousLabel: string | null, changeType: DocVersionChangeType): string {
  if (!previousLabel) return "1.0.0";
  const [majRaw, minRaw, patchRaw] = previousLabel.split(".").map((part) => Number(part));
  let major = Number.isFinite(majRaw) ? majRaw : 1;
  let minor = Number.isFinite(minRaw) ? minRaw : 0;
  let patch = Number.isFinite(patchRaw) ? patchRaw : 0;
  if (changeType === "major") {
    major += 1;
    minor = 0;
    patch = 0;
  } else if (changeType === "minor") {
    minor += 1;
    patch = 0;
  } else {
    patch += 1;
  }
  return `${major}.${minor}.${patch}`;
}

async function docsTableReady(): Promise<boolean> {
  try {
    const sql = getSql();
    const [check] = await sql<{ exists: boolean }[]>`
      SELECT to_regclass('public.docs_pages') IS NOT NULL AS exists
    `;
    return Boolean(check?.exists);
  } catch {
    return false;
  }
}

async function docsVersionsReady(): Promise<boolean> {
  try {
    const sql = getSql();
    const [check] = await sql<{ exists: boolean }[]>`
      SELECT to_regclass('public.docs_versions') IS NOT NULL AS exists
    `;
    return Boolean(check?.exists);
  } catch {
    return false;
  }
}

async function nextUniqueSlug(base: string, excludeId?: string): Promise<string> {
  const sql = getSql();
  let candidate = base || "doc";
  let i = 2;
  while (true) {
    const rows = await sql<{ id: string }[]>`
      SELECT id FROM docs_pages
      WHERE slug = ${candidate}
        AND is_deleted = FALSE
        ${excludeId ? sql`AND id <> ${excludeId}` : sql``}
      LIMIT 1
    `;
    if (!rows[0]) return candidate;
    candidate = `${base}-${i}`;
    i += 1;
  }
}

async function nextUniqueRelativePath(base: string, excludeId?: string): Promise<string> {
  const sql = getSql();
  const ext = ".md";
  const withoutExt = base.replace(/\.md$/i, "");
  let candidate = `${withoutExt}${ext}`;
  let i = 2;
  while (true) {
    const rows = await sql<{ id: string }[]>`
      SELECT id FROM docs_pages
      WHERE relative_path = ${candidate}
        AND is_deleted = FALSE
        ${excludeId ? sql`AND id <> ${excludeId}` : sql``}
      LIMIT 1
    `;
    if (!rows[0]) return candidate;
    candidate = `${withoutExt}-${i}${ext}`;
    i += 1;
  }
}

async function writeActionLog(entry: Omit<DocActionLog, "id" | "createdAt">): Promise<void> {
  const sql = getSql();
  try {
    await sql`
      INSERT INTO docs_action_logs (id, action, slug, title, relative_path, details, actor, version_id, actor_id)
      VALUES (
        ${randomUUID()},
        ${entry.action},
        ${entry.slug},
        ${entry.title},
        ${entry.relativePath},
        ${entry.details ?? null},
        ${"system"},
        ${entry.versionId ?? null},
        ${"system"}
      )
    `;
  } catch {
    // Backward compatibility before docs versioning migration is applied.
    await sql`
      INSERT INTO docs_action_logs (id, action, slug, title, relative_path, details, actor)
      VALUES (
        ${randomUUID()},
        ${entry.action === "draft" || entry.action === "publish" || entry.action === "revert" ? "edit" : entry.action},
        ${entry.slug},
        ${entry.title},
        ${entry.relativePath},
        ${entry.details ?? null},
        ${"system"}
      )
    `;
  }
}

async function getDocRowBySlug(slug: string): Promise<DbDocRow | null> {
  const sql = getSql();
  const [existing] = await sql<DbDocRow[]>`
    SELECT id, slug, title, section, excerpt, content, relative_path, updated_at, current_version_id
    FROM docs_pages
    WHERE slug = ${slug} AND is_deleted = FALSE
    LIMIT 1
  `;
  return existing ?? null;
}

async function getLatestVersionByPageId(pageId: string): Promise<DbVersionRow | null> {
  const sql = getSql();
  const [row] = await sql<DbVersionRow[]>`
    SELECT id, page_id, version_no, version_label, change_type, title, section, excerpt, content, changelog,
           created_by, is_published, created_at, published_at
    FROM docs_versions
    WHERE page_id = ${pageId}
    ORDER BY version_no DESC
    LIMIT 1
  `;
  return row ?? null;
}

async function getVersionById(pageId: string, versionId: string): Promise<DbVersionRow | null> {
  const sql = getSql();
  const [row] = await sql<DbVersionRow[]>`
    SELECT id, page_id, version_no, version_label, change_type, title, section, excerpt, content, changelog,
           created_by, is_published, created_at, published_at
    FROM docs_versions
    WHERE page_id = ${pageId}
      AND id = ${versionId}
    LIMIT 1
  `;
  return row ?? null;
}

async function createVersion(page: DbDocRow, input: {
  title?: string;
  section?: string;
  content?: string;
  changelog?: string;
  changeType?: DocVersionChangeType;
  publish?: boolean;
}): Promise<{ version: DbVersionRow; nextSlug: string; nextRelativePath: string }> {
  const sql = getSql();
  const latest = await getLatestVersionByPageId(page.id);
  const title = input.title?.trim() || page.title;
  const section = normalizeSection(input.section ?? page.section);
  const content = input.content ?? page.content;
  const excerpt = extractExcerpt(content) || null;
  const changeType = input.changeType ?? "patch";
  const nextVersionNo = (latest?.version_no ?? 0) + 1;
  const nextVersionLabel = latest ? bumpVersionLabel(latest.version_label, changeType) : "1.0.0";
  const shouldPublish = Boolean(input.publish);

  const titleChanged = title !== page.title;
  const sectionChanged = section !== page.section;

  const nextSlug = page.slug;
  let nextRelativePath = page.relative_path;
  if (shouldPublish && (titleChanged || sectionChanged)) {
    nextRelativePath = await nextUniqueRelativePath(buildRelativePath(section, title), page.id);
  }

  const versionId = randomUUID();
  await sql`
    INSERT INTO docs_versions (
      id,
      page_id,
      version_no,
      version_label,
      change_type,
      title,
      section,
      excerpt,
      content,
      changelog,
      created_by,
      is_published,
      published_at
    ) VALUES (
      ${versionId},
      ${page.id},
      ${nextVersionNo},
      ${nextVersionLabel},
      ${changeType},
      ${title},
      ${section},
      ${excerpt},
      ${content},
      ${input.changelog ?? null},
      ${"system"},
      ${shouldPublish},
      ${shouldPublish ? sql`now()` : null}
    )
  `;

  const [version] = await sql<DbVersionRow[]>`
    SELECT id, page_id, version_no, version_label, change_type, title, section, excerpt, content, changelog,
           created_by, is_published, created_at, published_at
    FROM docs_versions
    WHERE id = ${versionId}
    LIMIT 1
  `;
  if (!version) throw new Error("version_create_failed");

  if (shouldPublish) {
    await sql`
      UPDATE docs_versions
      SET is_published = FALSE
      WHERE page_id = ${page.id}
        AND id <> ${version.id}
        AND is_published = TRUE
    `;

    await sql`
      UPDATE docs_pages
      SET slug = ${nextSlug},
          title = ${title},
          section = ${section},
          excerpt = ${excerpt},
          content = ${content},
          relative_path = ${nextRelativePath},
          current_version_id = ${version.id},
          status = ${"published"},
          updated_at = now()
      WHERE id = ${page.id}
    `;

    await sql`
      UPDATE docs_versions
      SET is_published = TRUE,
          published_at = now()
      WHERE id = ${version.id}
    `;
  } else {
    await sql`
      UPDATE docs_pages
      SET status = ${"draft"},
          updated_at = now()
      WHERE id = ${page.id}
    `;
  }

  return { version, nextSlug, nextRelativePath };
}

export async function readActionLogs(limit = 100): Promise<DocActionLog[]> {
  if (!(await docsTableReady())) return [];
  const sql = getSql();
  const rows = await sql<{
    id: string;
    action: DocActionType;
    slug: string;
    title: string;
    relative_path: string;
    details: string | null;
    created_at: string;
    version_id: string | null;
  }[]>`
    SELECT id, action, slug, title, relative_path, details, created_at, version_id
    FROM docs_action_logs
    ORDER BY created_at DESC
    LIMIT ${Math.max(1, Math.min(limit, 500))}
  `;

  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    slug: row.slug,
    title: row.title,
    relativePath: row.relative_path,
    details: row.details ?? undefined,
    createdAt: new Date(row.created_at).toISOString(),
    versionId: row.version_id ?? undefined,
  }));
}

export async function listDocVersions(
  slug: string,
  limit = 50
): Promise<{ ok: true; versions: DocVersionSummary[] } | { ok: false; error: string }> {
  if (!(await docsTableReady()) || !(await docsVersionsReady())) return { ok: false, error: "docs_versions_unavailable" };
  const page = await getDocRowBySlug(slug);
  if (!page) return { ok: false, error: "doc_not_found" };
  const sql = getSql();
  const rows = await sql<DbVersionRow[]>`
    SELECT id, page_id, version_no, version_label, change_type, title, section, excerpt, content, changelog,
           created_by, is_published, created_at, published_at
    FROM docs_versions
    WHERE page_id = ${page.id}
    ORDER BY version_no DESC
    LIMIT ${Math.max(1, Math.min(limit, 200))}
  `;
  return {
    ok: true,
    versions: rows.map((row) => ({
      id: row.id,
      versionNo: row.version_no,
      versionLabel: row.version_label,
      changeType: row.change_type,
      title: row.title,
      section: row.section,
      changelog: row.changelog ?? undefined,
      createdBy: row.created_by,
      createdAt: new Date(row.created_at).toISOString(),
      publishedAt: row.published_at ? new Date(row.published_at).toISOString() : undefined,
      isPublished: Boolean(row.is_published),
      isCurrent: page.current_version_id === row.id,
    })),
  };
}

export async function createDoc(input: {
  title: string;
  section?: string;
  content?: string;
}): Promise<{ ok: true; doc: Awaited<ReturnType<typeof getDocBySlug>> } | { ok: false; error: string }> {
  if (!(await docsTableReady())) return { ok: false, error: "docs_table_unavailable" };
  const title = input.title.trim();
  if (!title) return { ok: false, error: "title_required" };

  const section = normalizeSection(input.section);
  const content = input.content?.trim() ? input.content : `# ${title}\n\n## Overview\n\n`;
  const baseSlug = slugify(title) || "doc";
  const slug = await nextUniqueSlug(baseSlug);
  const relativePath = await nextUniqueRelativePath(buildRelativePath(section, title));
  const excerpt = extractExcerpt(content);

  const sql = getSql();
  const pageId = randomUUID();
  await sql`
    INSERT INTO docs_pages (id, slug, title, section, excerpt, content, relative_path, status)
    VALUES (${pageId}, ${slug}, ${title}, ${section}, ${excerpt || null}, ${content}, ${relativePath}, ${"published"})
  `;

  if (await docsVersionsReady()) {
    const versionId = randomUUID();
    await sql`
      INSERT INTO docs_versions (
        id, page_id, version_no, version_label, change_type,
        title, section, excerpt, content, changelog, created_by, is_published, published_at
      ) VALUES (
        ${versionId}, ${pageId}, 1, ${"1.0.0"}, ${"major"},
        ${title}, ${section}, ${excerpt || null}, ${content}, ${"Initial document"}, ${"system"}, TRUE, now()
      )
    `;
    await sql`
      UPDATE docs_pages
      SET current_version_id = ${versionId}
      WHERE id = ${pageId}
    `;
    await writeActionLog({
      action: "create",
      slug,
      title,
      relativePath,
      details: "Document created (v1.0.0)",
      versionId,
    });
  } else {
    await writeActionLog({
      action: "create",
      slug,
      title,
      relativePath,
      details: "Document created",
    });
  }

  const detail = await getDocBySlug(slug);
  if (!detail) return { ok: false, error: "create_failed" };
  return { ok: true, doc: detail };
}

export async function createDocVersionBySlug(
  slug: string,
  input: {
    title?: string;
    section?: string;
    content?: string;
    changelog?: string;
    changeType?: DocVersionChangeType;
    publish?: boolean;
  }
): Promise<{ ok: true; doc: Awaited<ReturnType<typeof getDocBySlug>>; version: DocVersionSummary } | { ok: false; error: string }> {
  if (!(await docsTableReady()) || !(await docsVersionsReady())) return { ok: false, error: "docs_versions_unavailable" };
  const page = await getDocRowBySlug(slug);
  if (!page) return { ok: false, error: "doc_not_found" };
  if (input.title !== undefined && !input.title.trim()) return { ok: false, error: "title_required" };

  const { version, nextSlug, nextRelativePath } = await createVersion(page, input);
  const action: DocActionType = input.publish ? "publish" : "draft";
  await writeActionLog({
    action,
    slug: input.publish ? nextSlug : page.slug,
    title: version.title,
    relativePath: input.publish ? nextRelativePath : page.relative_path,
    details: input.publish ? `Published ${version.version_label}` : `Draft ${version.version_label}`,
    versionId: version.id,
  });

  const doc = await getDocBySlug(input.publish ? nextSlug : page.slug);
  if (!doc) return { ok: false, error: "version_create_failed" };
  return {
    ok: true,
    doc,
    version: {
      id: version.id,
      versionNo: version.version_no,
      versionLabel: version.version_label,
      changeType: version.change_type,
      title: version.title,
      section: version.section,
      changelog: version.changelog ?? undefined,
      createdBy: version.created_by,
      createdAt: new Date(version.created_at).toISOString(),
      publishedAt: version.published_at ? new Date(version.published_at).toISOString() : undefined,
      isPublished: Boolean(version.is_published),
      isCurrent: input.publish,
    },
  };
}

export async function publishDocVersionBySlug(
  slug: string,
  versionId: string
): Promise<{ ok: true; doc: Awaited<ReturnType<typeof getDocBySlug>> } | { ok: false; error: string }> {
  if (!(await docsTableReady()) || !(await docsVersionsReady())) return { ok: false, error: "docs_versions_unavailable" };
  const page = await getDocRowBySlug(slug);
  if (!page) return { ok: false, error: "doc_not_found" };
  const version = await getVersionById(page.id, versionId);
  if (!version) return { ok: false, error: "version_not_found" };

  const nextSlug = page.slug;
  const nextRelativePath =
    version.title !== page.title || version.section !== page.section
      ? await nextUniqueRelativePath(buildRelativePath(version.section, version.title), page.id)
      : page.relative_path;

  const sql = getSql();
  await sql.begin(async (trx) => {
    await trx`
      UPDATE docs_versions
      SET is_published = FALSE
      WHERE page_id = ${page.id}
        AND is_published = TRUE
    `;
    await trx`
      UPDATE docs_versions
      SET is_published = TRUE,
          published_at = now()
      WHERE id = ${version.id}
    `;
    await trx`
      UPDATE docs_pages
      SET slug = ${nextSlug},
          title = ${version.title},
          section = ${version.section},
          excerpt = ${version.excerpt},
          content = ${version.content},
          relative_path = ${nextRelativePath},
          current_version_id = ${version.id},
          status = ${"published"},
          updated_at = now()
      WHERE id = ${page.id}
    `;
  });

  await writeActionLog({
    action: "publish",
    slug: nextSlug,
    title: version.title,
    relativePath: nextRelativePath,
    details: `Published ${version.version_label}`,
    versionId: version.id,
  });

  const doc = await getDocBySlug(nextSlug);
  if (!doc) return { ok: false, error: "publish_failed" };
  return { ok: true, doc };
}

export async function revertDocVersionBySlug(
  slug: string,
  versionId: string
): Promise<{ ok: true; doc: Awaited<ReturnType<typeof getDocBySlug>> } | { ok: false; error: string }> {
  if (!(await docsTableReady()) || !(await docsVersionsReady())) return { ok: false, error: "docs_versions_unavailable" };
  const page = await getDocRowBySlug(slug);
  if (!page) return { ok: false, error: "doc_not_found" };
  const target = await getVersionById(page.id, versionId);
  if (!target) return { ok: false, error: "version_not_found" };

  const created = await createDocVersionBySlug(slug, {
    title: target.title,
    section: target.section,
    content: target.content,
    changeType: "patch",
    changelog: `Reverted to ${target.version_label}`,
    publish: true,
  });
  if (!created.ok) return created;

  await writeActionLog({
    action: "revert",
    slug: created.doc?.slug ?? slug,
    title: target.title,
    relativePath: created.doc?.relativePath ?? page.relative_path,
    details: `Reverted to ${target.version_label}`,
    versionId: created.version.id,
  });

  return { ok: true, doc: created.doc };
}

export async function updateDocBySlug(
  slug: string,
  input: {
    title?: string;
    section?: string;
    content?: string;
    changeType?: DocVersionChangeType;
    changelog?: string;
  }
): Promise<{ ok: true; doc: Awaited<ReturnType<typeof getDocBySlug>> } | { ok: false; error: string }> {
  const created = await createDocVersionBySlug(slug, {
    ...input,
    publish: true,
  });
  if (!created.ok) return created;
  return { ok: true, doc: created.doc };
}

export async function deleteDocBySlug(
  slug: string
): Promise<{ ok: true; deleted: { slug: string; title: string; relativePath: string } } | { ok: false; error: string }> {
  if (!(await docsTableReady())) return { ok: false, error: "docs_table_unavailable" };
  const page = await getDocRowBySlug(slug);
  if (!page) return { ok: false, error: "doc_not_found" };
  const sql = getSql();

  await sql`
    UPDATE docs_pages
    SET is_deleted = TRUE, status = ${"archived"}, updated_at = now()
    WHERE id = ${page.id}
  `;

  await writeActionLog({
    action: "delete",
    slug: page.slug,
    title: page.title,
    relativePath: page.relative_path,
    details: "Document deleted",
    versionId: page.current_version_id ?? undefined,
  });

  return {
    ok: true,
    deleted: {
      slug: page.slug,
      title: page.title,
      relativePath: page.relative_path,
    },
  };
}
