"use client";

import { MainPageShell } from "@repo/ui/main-pages/MainPageShell";
import { Tree, NodeRendererProps } from "react-arborist";
import { useEffect, useMemo, useState } from "react";

type YearNode = {
  id: string;
  year: number | null;
};

type ModelNode = {
  id: string;
  name: string;
  years: YearNode[];
};

type MakeTaxonomy = {
  inventoryTypeName?: string | null;
  categoryName?: string | null;
  subcategoryName?: string | null;
};

type MakeNode = {
  id: string;
  name: string;
  taxonomy: MakeTaxonomy;
  models: ModelNode[];
};

type ProductTreeResponse = MakeNode[];

type TreeNode = {
  id: string;
  label: string;
  kind: "make" | "model" | "year";
  detail?: string;
  children?: TreeNode[];
};

function makeTreeNodes(tree: ProductTreeResponse): TreeNode[] {
  return tree.map((make) => ({
    id: `make-${make.id}`,
    label: make.name,
    kind: "make",
    detail: [
      make.taxonomy.inventoryTypeName,
      make.taxonomy.categoryName,
      make.taxonomy.subcategoryName,
    ]
      .filter(Boolean)
      .join(" • ") || undefined,
    children: make.models.map((model) => ({
      id: `model-${model.id}`,
      label: model.name,
      kind: "model",
      detail: `${model.years.length} year${model.years.length === 1 ? "" : "s"}`,
      children: model.years.map((year) => ({
        id: `year-${year.id}`,
        label: year.year !== null ? `${year.year}` : "Year",
        kind: "year",
      })),
    })),
  }));
}

export default function ProductsMain({ companyId }: { companyId: string }) {
  const [tree, setTree] = useState<ProductTreeResponse>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function loadTree() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/company/${companyId}/inventory/products-tree`, { signal: controller.signal });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const payload = await res.json();
        setTree(Array.isArray(payload?.data) ? payload.data : []);
      } catch (err: any) {
        if (controller.signal.aborted) return;
        console.error("Unable to load product tree", err);
        setError("Unable to load product catalog.");
        setTree([]);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    loadTree();
    return () => controller.abort();
  }, [companyId, refreshKey]);

  const treeData = useMemo(() => makeTreeNodes(tree), [tree]);
  const rowHeight = 36;
  const height = Math.min(720, Math.max(treeData.length * rowHeight + 60, 250));

  return (
    <MainPageShell
      title="Products"
      subtitle="Company inventory catalog (global taxonomy)."
      scopeLabel="Products"
      primaryAction={
        <span className="text-xs text-muted-foreground">
          {loading ? "Loading…" : `${tree.length} make${tree.length === 1 ? "" : "s"}`}
        </span>
      }
      secondaryActions={
        <button
          type="button"
          onClick={() => setRefreshKey((key) => key + 1)}
          className="text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-white"
        >
          Refresh
        </button>
      }
      contentClassName="rounded-none border-none bg-transparent p-0 shadow-none"
    >
      <div className="space-y-3">
        {loading && <p className="text-sm text-muted-foreground">Loading catalog...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {!loading && !error && treeData.length === 0 && (
          <div className="px-4 py-3 text-sm text-white/80">No products configured yet.</div>
        )}
        {!loading && !error && treeData.length > 0 && (
          <div className="w-full overflow-hidden text-white">
            <Tree<TreeNode>
              data={treeData}
              rowHeight={rowHeight}
              indent={24}
              width="100%"
              height={height}
              openByDefault
              initialOpenState={{}}
            >
              {({ node, style }: NodeRendererProps<TreeNode>) => (
                <div style={style} className="flex items-center gap-2 text-sm">
                  {node.isInternal ? (
                    <button
                      type="button"
                      className="text-xs text-white/60"
                      onClick={() => node.isInternal && node.toggle()}
                    >
                      {node.isOpen ? "▾" : "▸"}
                    </button>
                  ) : (
                    <span className="text-[10px] text-white/60">•</span>
                  )}
                  <div className="flex flex-col">
                    <span
                      className={`font-medium ${node.data.kind === "year" ? "text-white" : "text-white/90"}`}
                    >
                      {node.data.label}
                    </span>
                    {node.data.detail && <span className="text-[10px] text-slate-400">{node.data.detail}</span>}
                  </div>
                </div>
              )}
            </Tree>
          </div>
        )}
      </div>
    </MainPageShell>
  );
}
