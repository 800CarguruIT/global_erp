"use client";

import { MainPageShell } from "@repo/ui/main-pages/MainPageShell";
import { Tree, NodeRendererProps, TreeApi } from "react-arborist";
import { useEffect, useMemo, useRef, useState } from "react";

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
  const treeRef = useRef<TreeApi<TreeNode> | null>(null);
  const [selectedMake, setSelectedMake] = useState<string>("");
  const [selectedModel, setSelectedModel] = useState<string>("");
  const [selectedYear, setSelectedYear] = useState<string>("");

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

  const handleExpandAll = () => treeRef.current?.openAll();
  const handleCollapseAll = () => treeRef.current?.closeAll();

  const makeOptions = useMemo(
    () => tree.map((make) => ({ id: make.id, label: make.name })),
    [tree]
  );

  const modelOptions = useMemo(() => {
    const targetMakes = selectedMake ? tree.filter((make) => make.id === selectedMake) : tree;
    const result = new Map<string, string>();
    targetMakes.forEach((make) => {
      make.models.forEach((model) => {
        if (!result.has(model.id)) {
          result.set(model.id, model.name);
        }
      });
    });
    return Array.from(result.entries()).map(([id, label]) => ({ id, label }));
  }, [tree, selectedMake]);

  const yearOptions = useMemo(() => {
    const targetMakes = selectedMake ? tree.filter((make) => make.id === selectedMake) : tree;
    const targetModels = selectedModel
      ? targetMakes.flatMap((make) => make.models.filter((model) => model.id === selectedModel))
      : targetMakes.flatMap((make) => make.models);
    const yearSet = new Set<number>();
    targetModels.forEach((model) => model.years.forEach((year) => year.year !== null && yearSet.add(year.year)));
    return Array.from(yearSet).sort((a, b) => a - b).map((year) => ({ id: String(year), label: String(year) }));
  }, [tree, selectedMake, selectedModel]);

  const filteredTree = useMemo(() => {
    const normalizedYear = selectedYear ? Number(selectedYear) : null;
    return tree
      .filter((make) => !selectedMake || make.id === selectedMake)
      .map((make) => {
        const models = make.models
          .filter((model) => !selectedModel || model.id === selectedModel)
          .map((model) => ({
            ...model,
            years: model.years.filter((year) => {
              if (!normalizedYear) return true;
              return year.year === normalizedYear;
            }),
          }))
          .filter((model) => model.years.length > 0);

        return { ...make, models };
      })
      .filter((make) => !selectedMake || make.models.length > 0);
  }, [tree, selectedMake, selectedModel, selectedYear]);

  const treeData = useMemo(() => makeTreeNodes(filteredTree), [filteredTree]);
  const rowHeight = 36;
  const height = Math.max(treeData.length * rowHeight + 60, 250);

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
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleExpandAll}
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-white"
          >
            Expand all
          </button>
          <button
            type="button"
            onClick={handleCollapseAll}
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-white"
          >
            Collapse all
          </button>
          <button
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
            className="text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:text-white"
          >
            Refresh
          </button>
        </div>
      }
      contentClassName="rounded-none border-none bg-transparent p-0 shadow-none"
    >
      <div className="space-y-3">
        {loading && <p className="text-sm text-muted-foreground">Loading catalog...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 shadow-[0_30px_80px_rgba(2,6,23,0.8)]">
          <div className="mb-4 flex flex-wrap items-center gap-3">
            <label className="text-xs uppercase tracking-wide text-white/70">Filter</label>
            <select
              value={selectedMake}
              onChange={(event) => {
                setSelectedMake(event.target.value);
                setSelectedModel("");
                setSelectedYear("");
              }}
              className="rounded-full border border-white/20 bg-black/20 px-3 py-1 text-sm text-white outline-none backdrop-blur transition hover:border-white/40"
            >
              <option value="">All makes</option>
              {makeOptions.map((make) => (
                <option key={make.id} value={make.id}>
                  {make.label}
                </option>
              ))}
            </select>
            <select
              value={selectedModel}
              onChange={(event) => {
                setSelectedModel(event.target.value);
                setSelectedYear("");
              }}
              className="rounded-full border border-white/20 bg-black/20 px-3 py-1 text-sm text-white outline-none backdrop-blur transition hover:border-white/40"
            >
              <option value="">All models</option>
              {modelOptions.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.label}
                </option>
              ))}
            </select>
            <select
              value={selectedYear}
              onChange={(event) => setSelectedYear(event.target.value)}
              className="rounded-full border border-white/20 bg-black/20 px-3 py-1 text-sm text-white outline-none backdrop-blur transition hover:border-white/40"
            >
              <option value="">All years</option>
              {yearOptions.map((year) => (
                <option key={year.id} value={year.id}>
                  {year.label}
                </option>
              ))}
            </select>
          </div>
          {!loading && !error && treeData.length === 0 && (
            <div className="px-4 py-3 text-sm text-white/80">No products configured yet.</div>
          )}
          {!loading && !error && treeData.length > 0 && (
            <div className="w-full text-white">
              <Tree<TreeNode>
                ref={treeRef}
                data={treeData}
                rowHeight={rowHeight}
                indent={24}
                width="100%"
                height={height}
                openByDefault={false}
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
      </div>
    </MainPageShell>
  );
}
