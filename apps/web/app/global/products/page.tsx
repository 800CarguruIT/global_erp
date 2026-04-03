"use client";

import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@repo/ui";

type CategoryNode = {
  id: number;
  name: string;
  parentId: number | null;
  level: number;
  children: CategoryNode[];
};

export default function GlobalProductsPage() {
  return (
    <AppLayout>
      <GlobalProductsContent />
    </AppLayout>
  );
}

function GlobalProductsContent() {
  const [tree, setTree] = useState<CategoryNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/global/categories", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to load categories");
        const json = await res.json();
        if (!active) return;
        setTree(Array.isArray(json?.data) ? json.data : []);
      } catch (err: unknown) {
        if (!active) return;
        const message = err instanceof Error ? err.message : "Failed to load categories";
        setError(message);
        setTree([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const total = useMemo(() => countNodes(tree), [tree]);
  const filteredTree = useMemo(() => filterTree(tree, query), [tree, query]);
  const visibleTotal = useMemo(() => countNodes(filteredTree), [filteredTree]);

  return (
    <div className="space-y-6 py-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <p className="text-sm text-muted-foreground">Global categories hierarchy from the imported catalog</p>
      </div>

      <div className="rounded-2xl bg-gradient-to-r from-cyan-500/15 via-blue-500/10 to-transparent shadow-xl shadow-cyan-900/20">
        <div className="flex flex-wrap items-center gap-2 p-4">
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground/90">
            {loading ? "Loading..." : `${total} total`}
          </span>
          <span className="rounded-full bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
            {query.trim() ? `${visibleTotal} visible` : "All visible"}
          </span>
        </div>
        {error && <div className="text-sm text-destructive">{error}</div>}
      </div>

      <div className="rounded-2xl bg-gradient-to-b from-[#0b1e3f]/55 to-[#08122a]/55 p-4 shadow-2xl shadow-blue-950/40">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories..."
            className="min-w-[220px] flex-1 rounded-xl bg-muted px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-cyan-400/50"
          />
          <button
            type="button"
            onClick={() => setExpanded(expandAll(filteredTree))}
            className="rounded-xl bg-muted px-3 py-2 text-xs font-semibold text-foreground/90 transition hover:bg-muted/80"
          >
            Expand All
          </button>
          <button
            type="button"
            onClick={() => setExpanded({})}
            className="rounded-xl bg-muted px-3 py-2 text-xs font-semibold text-foreground/90 transition hover:bg-muted/80"
          >
            Collapse All
          </button>
        </div>

        {loading ? (
          <div className="text-sm text-muted-foreground">Loading tree...</div>
        ) : filteredTree.length === 0 ? (
          <div className="text-sm text-muted-foreground">No categories found.</div>
        ) : (
          <div className="space-y-2">
            {filteredTree.map((node) => (
              <CategoryTreeNode
                key={node.id}
                node={node}
                expanded={expanded}
                setExpanded={setExpanded}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CategoryTreeNode({
  node,
  expanded,
  setExpanded,
}: {
  node: CategoryNode;
  expanded: Record<number, boolean>;
  setExpanded: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
}) {
  const hasChildren = node.children.length > 0;
  const isOpen = expanded[node.id] ?? node.level <= 1;

  if (!hasChildren) {
    return (
      <div className="rounded-xl bg-card/50 px-3 py-2 shadow-lg shadow-blue-950/20">
        <div className="text-sm font-medium text-foreground/90">{node.name}</div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-card/50 px-3 py-2 shadow-lg shadow-blue-950/20">
      <button
        type="button"
        onClick={() => setExpanded((prev) => ({ ...prev, [node.id]: !isOpen }))}
        className="flex w-full items-center gap-2 text-left"
      >
        <span className="text-xs text-cyan-300/90">{isOpen ? "▼" : "▶"}</span>
        <span className="text-sm font-semibold text-foreground/95">{node.name}</span>
        <span className="ml-auto rounded-full bg-muted px-2 py-0.5 text-[10px] text-foreground/80">
          {node.children.length}
        </span>
      </button>
      {isOpen && (
        <div className="mt-2 space-y-2 pl-4">
          {node.children.map((child) => (
            <CategoryTreeNode
              key={child.id}
              node={child}
              expanded={expanded}
              setExpanded={setExpanded}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function countNodes(nodes: CategoryNode[]): number {
  return nodes.reduce((acc, node) => acc + 1 + countNodes(node.children), 0);
}

function filterTree(nodes: CategoryNode[], query: string): CategoryNode[] {
  const q = query.trim().toLowerCase();
  if (!q) return nodes;

  const walk = (node: CategoryNode): CategoryNode | null => {
    const children = node.children.map(walk).filter((v): v is CategoryNode => v !== null);
    const matched = node.name.toLowerCase().includes(q);
    if (!matched && children.length === 0) return null;
    return { ...node, children };
  };

  return nodes.map(walk).filter((v): v is CategoryNode => v !== null);
}

function expandAll(nodes: CategoryNode[]): Record<number, boolean> {
  const map: Record<number, boolean> = {};
  const walk = (list: CategoryNode[]) => {
    for (const node of list) {
      if (node.children.length > 0) {
        map[node.id] = true;
        walk(node.children);
      }
    }
  };
  walk(nodes);
  return map;
}
