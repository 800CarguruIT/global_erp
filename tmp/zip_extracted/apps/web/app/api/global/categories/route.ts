import { NextResponse, NextRequest } from "next/server";
import { getSql } from "@repo/ai-core";

import { requireAuth } from "@/lib/auth/requireAuth";

type CategoryRow = {
  id: number;
  name: string;
  parent_id: number | null;
  level: number;
  status: boolean | null;
};

type CategoryNode = {
  id: number;
  name: string;
  parentId: number | null;
  level: number;
  children: CategoryNode[];
};

function buildTree(rows: CategoryRow[]): CategoryNode[] {
  const byId = new Map<number, CategoryNode>();
  const roots: CategoryNode[] = [];

  for (const row of rows) {
    byId.set(row.id, {
      id: row.id,
      name: row.name,
      parentId: row.parent_id,
      level: row.level,
      children: [],
    });
  }

  for (const node of byId.values()) {
    if (!node.parentId) {
      roots.push(node);
      continue;
    }
    const parent = byId.get(node.parentId);
    if (!parent) {
      roots.push(node);
      continue;
    }
    parent.children.push(node);
  }

  const sortNodes = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name));
    nodes.forEach((node) => sortNodes(node.children));
  };
  sortNodes(roots);

  return roots;
}

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth.error) return auth.error;

  try {
    const sql = getSql();
    const rows = await sql<CategoryRow[]>`
      SELECT id, name, parent_id, level, status
      FROM categories
      WHERE COALESCE(status, true) = true
      ORDER BY level ASC, id ASC
    `;

    return NextResponse.json({
      data: buildTree(rows ?? []),
      count: rows?.length ?? 0,
    });
  } catch (error) {
    console.error("GET /api/global/categories error", error);
    return NextResponse.json({ data: [], count: 0, error: "failed_to_load_categories" }, { status: 200 });
  }
}

