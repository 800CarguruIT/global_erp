"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Tree, NodeRendererProps } from "react-arborist";
import { MainPageShell } from "@repo/ui/main-pages/MainPageShell";
import type {
  InventoryType,
  InventoryCategory,
  InventorySubcategory,
  InventoryCarMake,
  InventoryCarModel,
  InventoryModelYear,
} from "@repo/ai-core/workshop/inventory/types";

type Props = { companyId: string };

type TabKey = "types" | "categories" | "subcategories" | "makes" | "models" | "structure";

const TABS: Array<{ id: TabKey; label: string }> = [
  { id: "types", label: "Inventory Types" },
  { id: "categories", label: "Categories" },
  { id: "subcategories", label: "Sub Categories" },
  { id: "makes", label: "Car Make" },
  { id: "models", label: "Car Models/Year" },
  { id: "structure", label: "Structure" },
];

const toggleClass = (active: boolean) =>
  `rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
    active ? "bg-white/15 text-white" : "border border-white/15 text-white/70 hover:border-white/40"
  }`;

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/40";

const selectClass =
  "w-full rounded-2xl border border-white/10 bg-slate-900/60 px-3 py-2 text-sm text-white focus:border-primary focus:ring-2 focus:ring-primary/40";

const badgeClass = (active: boolean) =>
  `inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
    active ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-300"
  }`;

export default function InventorySettingsClient({ companyId }: Props) {
  const [activeTab, setActiveTab] = useState<TabKey>("types");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [types, setTypes] = useState<InventoryType[]>([]);
  const [categories, setCategories] = useState<InventoryCategory[]>([]);
  const [subcategories, setSubcategories] = useState<InventorySubcategory[]>([]);

  const [typeForm, setTypeForm] = useState({ name: "", code: "", description: "" });
  const [typeStatus, setTypeStatus] = useState<string | null>(null);
  const [typeSaving, setTypeSaving] = useState(false);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [typeEditForm, setTypeEditForm] = useState({ name: "", code: "", description: "" });

  const [categoryForm, setCategoryForm] = useState({ inventoryTypeId: "", name: "", code: "", description: "" });
  const [categoryFilterTypeId, setCategoryFilterTypeId] = useState<string>("");
  const [categoryStatus, setCategoryStatus] = useState<string | null>(null);
  const [categorySaving, setCategorySaving] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [categoryEditForm, setCategoryEditForm] = useState({ name: "", code: "", description: "" });

  const [subcategoryForm, setSubcategoryForm] = useState({ categoryId: "", name: "", code: "", description: "" });
  const [subcategoryFilterCategoryId, setSubcategoryFilterCategoryId] = useState<string>("");
  const [subcategoryStatus, setSubcategoryStatus] = useState<string | null>(null);
  const [subcategorySaving, setSubcategorySaving] = useState(false);
  const [editingSubcategoryId, setEditingSubcategoryId] = useState<string | null>(null);
  const [subcategoryEditForm, setSubcategoryEditForm] = useState({ name: "", code: "", description: "" });

  const [makes, setMakes] = useState<InventoryCarMake[]>([]);
  const [models, setModels] = useState<InventoryCarModel[]>([]);
  const [years, setYears] = useState<InventoryModelYear[]>([]);

  const [makeForm, setMakeForm] = useState({ subcategoryId: "", name: "", code: "" });
  const [makeFilterSubcategoryId, setMakeFilterSubcategoryId] = useState<string>("");
  const [makeStatus, setMakeStatus] = useState<string | null>(null);
  const [makeSaving, setMakeSaving] = useState(false);
  const [editingMakeId, setEditingMakeId] = useState<string | null>(null);
  const [makeEditForm, setMakeEditForm] = useState({ name: "", code: "" });
  const [makePage, setMakePage] = useState(1);

  const [modelForm, setModelForm] = useState({ makeId: "", name: "", code: "" });
  const [modelFilterMakeId, setModelFilterMakeId] = useState<string>("");
  const [modelStatus, setModelStatus] = useState<string | null>(null);
  const [modelSaving, setModelSaving] = useState(false);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [modelEditForm, setModelEditForm] = useState({ name: "", code: "" });
  const [modelPage, setModelPage] = useState(1);

  const [yearFilter, setYearFilter] = useState<string>("");

  const [structureView, setStructureView] = useState<"tree" | "table">("tree");

  type TreeNode = {
    id: string;
    name: string;
    kind: "type" | "category" | "subcategory";
    isActive: boolean;
    code?: string;
    children?: TreeNode[];
  };

  useEffect(() => {
    let active = true;
    async function loadAll() {
      setLoading(true);
      setError(null);
      try {
        const [typesRes, categoriesRes, subcategoriesRes, makesRes, modelsRes, yearsRes] = await Promise.all([
          fetch(`/api/company/${companyId}/workshop/inventory/types?includeInactive=true`),
          fetch(`/api/company/${companyId}/workshop/inventory/categories?includeInactive=true`),
          fetch(`/api/company/${companyId}/workshop/inventory/subcategories?includeInactive=true`),
          fetch(`/api/company/${companyId}/workshop/inventory/makes?includeInactive=true`),
          fetch(`/api/company/${companyId}/workshop/inventory/models?includeInactive=true`),
          fetch(`/api/company/${companyId}/workshop/inventory/years?includeInactive=true`),
        ]);
        if (!typesRes.ok || !categoriesRes.ok || !subcategoriesRes.ok || !makesRes.ok || !modelsRes.ok || !yearsRes.ok) {
          throw new Error("Failed to load inventory taxonomy");
        }
        const [typesJson, categoriesJson, subcategoriesJson, makesJson, modelsJson, yearsJson] = await Promise.all([
          typesRes.json(),
          categoriesRes.json(),
          subcategoriesRes.json(),
          makesRes.json(),
          modelsRes.json(),
          yearsRes.json(),
        ]);
        if (!active) return;
        setTypes(typesJson?.data ?? []);
        setCategories(categoriesJson?.data ?? []);
        setSubcategories(subcategoriesJson?.data ?? []);
        setMakes(makesJson?.data ?? []);
        setModels(modelsJson?.data ?? []);
        setYears(yearsJson?.data ?? []);
      } catch (err: any) {
        if (!active) return;
        setError(err?.message ?? "Failed to load inventory taxonomy");
        setTypes([]);
        setCategories([]);
        setSubcategories([]);
        setMakes([]);
        setModels([]);
        setYears([]);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadAll();
    return () => {
      active = false;
    };
  }, [companyId]);

  const reloadAll = async () => {
    setLoading(true);
    setError(null);
    try {
      const [typesRes, categoriesRes, subcategoriesRes, makesRes, modelsRes, yearsRes] = await Promise.all([
        fetch(`/api/company/${companyId}/workshop/inventory/types?includeInactive=true`),
        fetch(`/api/company/${companyId}/workshop/inventory/categories?includeInactive=true`),
        fetch(`/api/company/${companyId}/workshop/inventory/subcategories?includeInactive=true`),
        fetch(`/api/company/${companyId}/workshop/inventory/makes?includeInactive=true`),
        fetch(`/api/company/${companyId}/workshop/inventory/models?includeInactive=true`),
        fetch(`/api/company/${companyId}/workshop/inventory/years?includeInactive=true`),
      ]);
      const [typesJson, categoriesJson, subcategoriesJson, makesJson, modelsJson, yearsJson] = await Promise.all([
        typesRes.json(),
        categoriesRes.json(),
        subcategoriesRes.json(),
        makesRes.json(),
        modelsRes.json(),
        yearsRes.json(),
      ]);
      setTypes(typesJson?.data ?? []);
      setCategories(categoriesJson?.data ?? []);
      setSubcategories(subcategoriesJson?.data ?? []);
      setMakes(makesJson?.data ?? []);
      setModels(modelsJson?.data ?? []);
      setYears(yearsJson?.data ?? []);
    } catch (err: any) {
      setError(err?.message ?? "Failed to load inventory taxonomy");
    } finally {
      setLoading(false);
    }
  };

  const typeLookup = useMemo(() => new Map(types.map((t) => [t.id, t])), [types]);
  const categoryLookup = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const subcategoryLookup = useMemo(() => new Map(subcategories.map((s) => [s.id, s])), [subcategories]);
  const makeLookup = useMemo(() => new Map(makes.map((m) => [m.id, m])), [makes]);

  const filteredCategories = useMemo(() => {
    if (!categoryFilterTypeId) return categories;
    return categories.filter((c) => c.inventoryTypeId === categoryFilterTypeId);
  }, [categories, categoryFilterTypeId]);

  const filteredSubcategories = useMemo(() => {
    if (!subcategoryFilterCategoryId) return subcategories;
    return subcategories.filter((s) => s.categoryId === subcategoryFilterCategoryId);
  }, [subcategories, subcategoryFilterCategoryId]);

  const filteredMakes = useMemo(() => {
    if (!makeFilterSubcategoryId) return makes;
    return makes.filter((m) => m.subcategoryId === makeFilterSubcategoryId);
  }, [makes, makeFilterSubcategoryId]);

  const filteredModels = useMemo(() => {
    let filtered = models;
    if (modelFilterMakeId) {
      filtered = filtered.filter((m) => m.makeId === modelFilterMakeId);
    }
    if (yearFilter) {
      const yearValue = Number.parseInt(yearFilter, 10);
      const modelIds = new Set(years.filter((y) => y.year === yearValue).map((y) => y.modelId));
      filtered = filtered.filter((m) => modelIds.has(m.id));
    }
    return filtered;
  }, [models, modelFilterMakeId, yearFilter, years]);

  useEffect(() => {
    setMakePage(1);
  }, [makeFilterSubcategoryId, makes.length]);

  useEffect(() => {
    setModelPage(1);
  }, [modelFilterMakeId, yearFilter, models.length]);

  const makePageSize = 25;
  const modelPageSize = 25;
  const makePageCount = Math.max(Math.ceil(filteredMakes.length / makePageSize), 1);
  const modelPageCount = Math.max(Math.ceil(filteredModels.length / modelPageSize), 1);
  const pagedMakes = filteredMakes.slice((makePage - 1) * makePageSize, makePage * makePageSize);
  const pagedModels = filteredModels.slice((modelPage - 1) * modelPageSize, modelPage * modelPageSize);

  const yearOptions = useMemo(() => {
    const unique = Array.from(new Set(years.map((y) => y.year)));
    return unique.sort((a, b) => b - a);
  }, [years]);

  const treeData = useMemo(() => {
    const byType = new Map<string, InventoryCategory[]>();
    categories.forEach((c) => {
      if (!byType.has(c.inventoryTypeId)) byType.set(c.inventoryTypeId, []);
      byType.get(c.inventoryTypeId)?.push(c);
    });
    const byCategory = new Map<string, InventorySubcategory[]>();
    subcategories.forEach((s) => {
      if (!byCategory.has(s.categoryId)) byCategory.set(s.categoryId, []);
      byCategory.get(s.categoryId)?.push(s);
    });
    return { byType, byCategory };
  }, [categories, subcategories]);

  const treeNodes = useMemo<TreeNode[]>(() => {
    return types.map((type) => ({
      id: `type-${type.id}`,
      name: type.name,
      kind: "type",
      isActive: type.isActive,
      code: type.code,
      children: (treeData.byType.get(type.id) ?? []).map((category) => ({
        id: `category-${category.id}`,
        name: category.name,
        kind: "category",
        isActive: category.isActive,
        code: category.code,
        children: (treeData.byCategory.get(category.id) ?? []).map((sub) => ({
          id: `subcategory-${sub.id}`,
          name: sub.name,
          kind: "subcategory",
          isActive: sub.isActive,
          code: sub.code,
          children: [],
        })),
      })),
    }));
  }, [types, treeData]);

  const tableRows = useMemo(() => {
    const rows: Array<{
      key: string;
      type?: string;
      category?: string;
      subcategory?: string;
    }> = [];
    types.forEach((type) => {
      const typeCategories = treeData.byType.get(type.id) ?? [];
      if (!typeCategories.length) {
        rows.push({ key: `type-${type.id}`, type: type.name });
        return;
      }
      typeCategories.forEach((category) => {
        const subs = treeData.byCategory.get(category.id) ?? [];
        if (!subs.length) {
          rows.push({ key: `category-${category.id}`, type: type.name, category: category.name });
          return;
        }
        subs.forEach((sub) => {
          rows.push({
            key: `sub-${sub.id}`,
            type: type.name,
            category: category.name,
            subcategory: sub.name,
          });
        });
      });
    });
    return rows;
  }, [types, treeData]);

  const rowHeight = 34;
  const treeNodeCount = types.length + categories.length + subcategories.length;
  const treeHeight = Math.max(treeNodeCount, 1) * rowHeight + 12;

  const startEditType = (row: InventoryType) => {
    setEditingTypeId(row.id);
    setTypeEditForm({ name: row.name, code: row.code, description: row.description ?? "" });
  };

  const saveType = async (typeId: string) => {
    if (!typeEditForm.name.trim() || !typeEditForm.code.trim()) {
      setTypeStatus("Name and code are required.");
      return;
    }
    setTypeSaving(true);
    setTypeStatus(null);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inventory/types/${typeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: typeEditForm.name.trim(),
          code: typeEditForm.code.trim(),
          description: typeEditForm.description.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to update type");
      const updated: InventoryType | null = data?.data ?? null;
      if (updated) {
        setTypes((prev) => prev.map((row) => (row.id === typeId ? updated : row)));
      } else {
        await reloadAll();
      }
      setEditingTypeId(null);
      setTypeStatus("Type updated.");
    } catch (err: any) {
      setTypeStatus(err?.message ?? "Failed to update type.");
    } finally {
      setTypeSaving(false);
    }
  };

  const toggleTypeStatus = async (row: InventoryType) => {
    setTypeSaving(true);
    setTypeStatus(null);
    const next = !row.isActive;
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inventory/types/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to update status");
      const updated: InventoryType | null = data?.data ?? null;
      if (updated) {
        setTypes((prev) => prev.map((item) => (item.id === row.id ? updated : item)));
      } else {
        setTypes((prev) => prev.map((item) => (item.id === row.id ? { ...item, isActive: next } : item)));
      }
    } catch (err: any) {
      setTypeStatus(err?.message ?? "Failed to update status.");
    } finally {
      setTypeSaving(false);
    }
  };

  const deleteType = async (row: InventoryType) => {
    if (!confirm(`Delete inventory type "${row.name}"? This will remove linked categories.`)) return;
    setTypeSaving(true);
    setTypeStatus(null);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inventory/types/${row.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to delete type");
      setTypes((prev) => prev.filter((item) => item.id !== row.id));
      setTypeStatus("Type deleted.");
      await reloadAll();
    } catch (err: any) {
      setTypeStatus(err?.message ?? "Failed to delete type.");
    } finally {
      setTypeSaving(false);
    }
  };

  const createType = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!typeForm.name.trim() || !typeForm.code.trim()) {
      setTypeStatus("Name and code are required.");
      return;
    }
    setTypeSaving(true);
    setTypeStatus(null);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inventory/types`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: typeForm.name.trim(),
          code: typeForm.code.trim(),
          description: typeForm.description.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to create type");
      setTypeForm({ name: "", code: "", description: "" });
      setTypeStatus("Type created.");
      await reloadAll();
    } catch (err: any) {
      setTypeStatus(err?.message ?? "Failed to create type.");
    } finally {
      setTypeSaving(false);
    }
  };

  const startEditCategory = (row: InventoryCategory) => {
    setEditingCategoryId(row.id);
    setCategoryEditForm({ name: row.name, code: row.code, description: row.description ?? "" });
  };

  const saveCategory = async (categoryId: string) => {
    if (!categoryEditForm.name.trim() || !categoryEditForm.code.trim()) {
      setCategoryStatus("Name and code are required.");
      return;
    }
    setCategorySaving(true);
    setCategoryStatus(null);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inventory/categories/${categoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: categoryEditForm.name.trim(),
          code: categoryEditForm.code.trim(),
          description: categoryEditForm.description.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to update category");
      const updated: InventoryCategory | null = data?.data ?? null;
      if (updated) {
        setCategories((prev) => prev.map((row) => (row.id === categoryId ? updated : row)));
      } else {
        await reloadAll();
      }
      setEditingCategoryId(null);
      setCategoryStatus("Category updated.");
    } catch (err: any) {
      setCategoryStatus(err?.message ?? "Failed to update category.");
    } finally {
      setCategorySaving(false);
    }
  };

  const toggleCategoryStatus = async (row: InventoryCategory) => {
    setCategorySaving(true);
    setCategoryStatus(null);
    const next = !row.isActive;
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inventory/categories/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to update status");
      const updated: InventoryCategory | null = data?.data ?? null;
      if (updated) {
        setCategories((prev) => prev.map((item) => (item.id === row.id ? updated : item)));
      } else {
        setCategories((prev) => prev.map((item) => (item.id === row.id ? { ...item, isActive: next } : item)));
      }
    } catch (err: any) {
      setCategoryStatus(err?.message ?? "Failed to update status.");
    } finally {
      setCategorySaving(false);
    }
  };

  const deleteCategory = async (row: InventoryCategory) => {
    if (!confirm(`Delete category "${row.name}"? This will remove linked subcategories.`)) return;
    setCategorySaving(true);
    setCategoryStatus(null);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inventory/categories/${row.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to delete category");
      setCategories((prev) => prev.filter((item) => item.id !== row.id));
      setCategoryStatus("Category deleted.");
      await reloadAll();
    } catch (err: any) {
      setCategoryStatus(err?.message ?? "Failed to delete category.");
    } finally {
      setCategorySaving(false);
    }
  };

  const createCategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!categoryForm.inventoryTypeId || !categoryForm.name.trim() || !categoryForm.code.trim()) {
      setCategoryStatus("Type, name, and code are required.");
      return;
    }
    setCategorySaving(true);
    setCategoryStatus(null);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inventory/categories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inventoryTypeId: categoryForm.inventoryTypeId,
          name: categoryForm.name.trim(),
          code: categoryForm.code.trim(),
          description: categoryForm.description.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to create category");
      setCategoryForm({ inventoryTypeId: "", name: "", code: "", description: "" });
      setCategoryStatus("Category created.");
      await reloadAll();
    } catch (err: any) {
      setCategoryStatus(err?.message ?? "Failed to create category.");
    } finally {
      setCategorySaving(false);
    }
  };

  const startEditSubcategory = (row: InventorySubcategory) => {
    setEditingSubcategoryId(row.id);
    setSubcategoryEditForm({ name: row.name, code: row.code, description: row.description ?? "" });
  };

  const saveSubcategory = async (subcategoryId: string) => {
    if (!subcategoryEditForm.name.trim() || !subcategoryEditForm.code.trim()) {
      setSubcategoryStatus("Name and code are required.");
      return;
    }
    setSubcategorySaving(true);
    setSubcategoryStatus(null);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inventory/subcategories/${subcategoryId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: subcategoryEditForm.name.trim(),
          code: subcategoryEditForm.code.trim(),
          description: subcategoryEditForm.description.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to update subcategory");
      const updated: InventorySubcategory | null = data?.data ?? null;
      if (updated) {
        setSubcategories((prev) => prev.map((row) => (row.id === subcategoryId ? updated : row)));
      } else {
        await reloadAll();
      }
      setEditingSubcategoryId(null);
      setSubcategoryStatus("Subcategory updated.");
    } catch (err: any) {
      setSubcategoryStatus(err?.message ?? "Failed to update subcategory.");
    } finally {
      setSubcategorySaving(false);
    }
  };

  const toggleSubcategoryStatus = async (row: InventorySubcategory) => {
    setSubcategorySaving(true);
    setSubcategoryStatus(null);
    const next = !row.isActive;
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inventory/subcategories/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to update status");
      const updated: InventorySubcategory | null = data?.data ?? null;
      if (updated) {
        setSubcategories((prev) => prev.map((item) => (item.id === row.id ? updated : item)));
      } else {
        setSubcategories((prev) => prev.map((item) => (item.id === row.id ? { ...item, isActive: next } : item)));
      }
    } catch (err: any) {
      setSubcategoryStatus(err?.message ?? "Failed to update status.");
    } finally {
      setSubcategorySaving(false);
    }
  };

  const deleteSubcategory = async (row: InventorySubcategory) => {
    if (!confirm(`Delete subcategory "${row.name}"?`)) return;
    setSubcategorySaving(true);
    setSubcategoryStatus(null);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inventory/subcategories/${row.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to delete subcategory");
      setSubcategories((prev) => prev.filter((item) => item.id !== row.id));
      setSubcategoryStatus("Subcategory deleted.");
      await reloadAll();
    } catch (err: any) {
      setSubcategoryStatus(err?.message ?? "Failed to delete subcategory.");
    } finally {
      setSubcategorySaving(false);
    }
  };

  const createSubcategory = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!subcategoryForm.categoryId || !subcategoryForm.name.trim() || !subcategoryForm.code.trim()) {
      setSubcategoryStatus("Category, name, and code are required.");
      return;
    }
    setSubcategorySaving(true);
    setSubcategoryStatus(null);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inventory/subcategories`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          categoryId: subcategoryForm.categoryId,
          name: subcategoryForm.name.trim(),
          code: subcategoryForm.code.trim(),
          description: subcategoryForm.description.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to create subcategory");
      setSubcategoryForm({ categoryId: "", name: "", code: "", description: "" });
      setSubcategoryStatus("Subcategory created.");
      await reloadAll();
    } catch (err: any) {
      setSubcategoryStatus(err?.message ?? "Failed to create subcategory.");
    } finally {
      setSubcategorySaving(false);
    }
  };

  const startEditMake = (row: InventoryCarMake) => {
    setEditingMakeId(row.id);
    setMakeEditForm({ name: row.name, code: row.code });
  };

  const saveMake = async (makeId: string) => {
    if (!makeEditForm.name.trim() || !makeEditForm.code.trim()) {
      setMakeStatus("Name and code are required.");
      return;
    }
    setMakeSaving(true);
    setMakeStatus(null);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inventory/makes/${makeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: makeEditForm.name.trim(), code: makeEditForm.code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to update make");
      const updated: InventoryCarMake | null = data?.data ?? null;
      if (updated) {
        setMakes((prev) => prev.map((row) => (row.id === makeId ? updated : row)));
      } else {
        await reloadAll();
      }
      setEditingMakeId(null);
      setMakeStatus("Make updated.");
    } catch (err: any) {
      setMakeStatus(err?.message ?? "Failed to update make.");
    } finally {
      setMakeSaving(false);
    }
  };

  const toggleMakeStatus = async (row: InventoryCarMake) => {
    setMakeSaving(true);
    setMakeStatus(null);
    const next = !row.isActive;
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inventory/makes/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to update status");
      const updated: InventoryCarMake | null = data?.data ?? null;
      if (updated) {
        setMakes((prev) => prev.map((item) => (item.id === row.id ? updated : item)));
      } else {
        setMakes((prev) => prev.map((item) => (item.id === row.id ? { ...item, isActive: next } : item)));
      }
    } catch (err: any) {
      setMakeStatus(err?.message ?? "Failed to update status.");
    } finally {
      setMakeSaving(false);
    }
  };

  const deleteMake = async (row: InventoryCarMake) => {
    if (!confirm(`Delete car make "${row.name}"? This will remove linked models.`)) return;
    setMakeSaving(true);
    setMakeStatus(null);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inventory/makes/${row.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to delete make");
      setMakes((prev) => prev.filter((item) => item.id !== row.id));
      setMakeStatus("Make deleted.");
      await reloadAll();
    } catch (err: any) {
      setMakeStatus(err?.message ?? "Failed to delete make.");
    } finally {
      setMakeSaving(false);
    }
  };

  const createMake = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!makeForm.subcategoryId || !makeForm.name.trim() || !makeForm.code.trim()) {
      setMakeStatus("Subcategory, name, and code are required.");
      return;
    }
    setMakeSaving(true);
    setMakeStatus(null);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inventory/makes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subcategoryId: makeForm.subcategoryId,
          name: makeForm.name.trim(),
          code: makeForm.code.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to create make");
      setMakeForm({ subcategoryId: "", name: "", code: "" });
      setMakeStatus("Make created.");
      await reloadAll();
    } catch (err: any) {
      setMakeStatus(err?.message ?? "Failed to create make.");
    } finally {
      setMakeSaving(false);
    }
  };

  const startEditModel = (row: InventoryCarModel) => {
    setEditingModelId(row.id);
    setModelEditForm({ name: row.name, code: row.code });
  };

  const saveModel = async (modelId: string) => {
    if (!modelEditForm.name.trim() || !modelEditForm.code.trim()) {
      setModelStatus("Name and code are required.");
      return;
    }
    setModelSaving(true);
    setModelStatus(null);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inventory/models/${modelId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: modelEditForm.name.trim(), code: modelEditForm.code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to update model");
      const updated: InventoryCarModel | null = data?.data ?? null;
      if (updated) {
        setModels((prev) => prev.map((row) => (row.id === modelId ? updated : row)));
      } else {
        await reloadAll();
      }
      setEditingModelId(null);
      setModelStatus("Model updated.");
    } catch (err: any) {
      setModelStatus(err?.message ?? "Failed to update model.");
    } finally {
      setModelSaving(false);
    }
  };

  const toggleModelStatus = async (row: InventoryCarModel) => {
    setModelSaving(true);
    setModelStatus(null);
    const next = !row.isActive;
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inventory/models/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to update status");
      const updated: InventoryCarModel | null = data?.data ?? null;
      if (updated) {
        setModels((prev) => prev.map((item) => (item.id === row.id ? updated : item)));
      } else {
        setModels((prev) => prev.map((item) => (item.id === row.id ? { ...item, isActive: next } : item)));
      }
    } catch (err: any) {
      setModelStatus(err?.message ?? "Failed to update status.");
    } finally {
      setModelSaving(false);
    }
  };

  const deleteModel = async (row: InventoryCarModel) => {
    if (!confirm(`Delete car model "${row.name}"? This will remove linked years.`)) return;
    setModelSaving(true);
    setModelStatus(null);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inventory/models/${row.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to delete model");
      setModels((prev) => prev.filter((item) => item.id !== row.id));
      setModelStatus("Model deleted.");
      await reloadAll();
    } catch (err: any) {
      setModelStatus(err?.message ?? "Failed to delete model.");
    } finally {
      setModelSaving(false);
    }
  };

  const createModel = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!modelForm.makeId || !modelForm.name.trim() || !modelForm.code.trim()) {
      setModelStatus("Make, name, and code are required.");
      return;
    }
    setModelSaving(true);
    setModelStatus(null);
    try {
      const res = await fetch(`/api/company/${companyId}/workshop/inventory/models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ makeId: modelForm.makeId, name: modelForm.name.trim(), code: modelForm.code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Failed to create model");
      setModelForm({ makeId: "", name: "", code: "" });
      setModelStatus("Model created.");
      await reloadAll();
    } catch (err: any) {
      setModelStatus(err?.message ?? "Failed to create model.");
    } finally {
      setModelSaving(false);
    }
  };


  return (
    <MainPageShell
      title="Inventory Settings"
      subtitle="Manage inventory taxonomy for parts classification."
      scopeLabel={`Company ${companyId}`}
      contentClassName="space-y-6 rounded-2xl border-none bg-slate-950/70 p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={toggleClass(activeTab === tab.id)}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="rounded-2xl bg-slate-950/80 p-4 text-sm text-muted-foreground">Loading taxonomy...</div>
      ) : error ? (
        <div className="rounded-2xl bg-slate-950/80 p-4 text-sm text-destructive">{error}</div>
      ) : null}

      {activeTab === "types" && (
        <section className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
          <article className="rounded-2xl bg-slate-950/80 p-4 shadow-xl">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">Inventory types</h2>
                <p className="text-xs text-muted-foreground">Scoped to company.</p>
              </div>
              <span className="rounded-full bg-muted/50 px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                {types.length} defined
              </span>
            </div>
            {typeStatus && <div className="mt-2 text-[11px] text-muted-foreground">{typeStatus}</div>}
            <div className="mt-4 overflow-x-auto rounded-md bg-card/80">
              <table className="min-w-full text-xs divide-y divide-muted/30">
                <thead className="bg-muted/10 text-[11px] text-muted-foreground">
                  <tr>
                    <th className="py-3 px-3 text-left">Name</th>
                    <th className="py-3 px-3 text-left">Code</th>
                    <th className="py-3 px-3 text-left">Description</th>
                    <th className="py-3 px-3 text-left">Status</th>
                    <th className="py-3 px-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {types.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-3 text-center text-xs text-muted-foreground">
                        No inventory types yet.
                      </td>
                    </tr>
                  ) : (
                    types.map((row) => {
                      const editing = editingTypeId === row.id;
                      return (
                        <tr key={row.id} className="bg-transparent hover:bg-muted/10">
                          <td className="py-2 px-3">
                            {editing ? (
                              <input
                                value={typeEditForm.name}
                                onChange={(e) => setTypeEditForm((prev) => ({ ...prev, name: e.target.value }))}
                                className={inputClass}
                              />
                            ) : (
                              row.name
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {editing ? (
                              <input
                                value={typeEditForm.code}
                                onChange={(e) => setTypeEditForm((prev) => ({ ...prev, code: e.target.value }))}
                                className={inputClass}
                              />
                            ) : (
                              row.code
                            )}
                          </td>
                          <td className="py-2 px-3 text-[11px] text-muted-foreground">
                            {editing ? (
                              <input
                                value={typeEditForm.description}
                                onChange={(e) => setTypeEditForm((prev) => ({ ...prev, description: e.target.value }))}
                                className={inputClass}
                              />
                            ) : (
                              row.description || "-"
                            )}
                          </td>
                          <td className="py-2 px-3 text-[11px]">
                            <span className={badgeClass(row.isActive)}>{row.isActive ? "Active" : "Inactive"}</span>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex flex-wrap gap-2">
                              {editing ? (
                                <>
                                  <button
                                    type="button"
                                    className="rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold text-emerald-100"
                                    disabled={typeSaving}
                                    onClick={() => saveType(row.id)}
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                                    onClick={() => setEditingTypeId(null)}
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                                    onClick={() => startEditType(row)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                                    onClick={() => toggleTypeStatus(row)}
                                    disabled={typeSaving}
                                  >
                                    {row.isActive ? "Deactivate" : "Activate"}
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-full border border-rose-500/40 px-3 py-1 text-[11px] text-rose-200"
                                    onClick={() => deleteType(row)}
                                    disabled={typeSaving}
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-2xl bg-slate-950/80 p-4 shadow-xl">
            <h2 className="text-lg font-semibold">Create inventory type</h2>
            <p className="text-xs text-muted-foreground">
              Types act as the top-level grouping for your inventory taxonomy.
            </p>
            <form className="mt-4 space-y-3 text-sm" onSubmit={createType}>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Name</span>
                <input
                  value={typeForm.name}
                  onChange={(e) => setTypeForm((prev) => ({ ...prev, name: e.target.value }))}
                  className={inputClass}
                  placeholder="Mechanical"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Code</span>
                <input
                  value={typeForm.code}
                  onChange={(e) => setTypeForm((prev) => ({ ...prev, code: e.target.value }))}
                  className={inputClass}
                  placeholder="MECH"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Description</span>
                <input
                  value={typeForm.description}
                  onChange={(e) => setTypeForm((prev) => ({ ...prev, description: e.target.value }))}
                  className={inputClass}
                  placeholder="General mechanical parts"
                />
              </label>
              <button
                type="submit"
                disabled={typeSaving}
                className="w-full rounded-2xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-lg disabled:opacity-50"
              >
                {typeSaving ? "Saving..." : "Add type"}
              </button>
              {typeStatus && <p className="text-[11px] text-muted-foreground">{typeStatus}</p>}
            </form>
          </article>
        </section>
      )}

      {activeTab === "categories" && (
        <section className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
          <article className="rounded-2xl bg-slate-950/80 p-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Categories</h2>
                <p className="text-xs text-muted-foreground">Attach categories to inventory types.</p>
              </div>
              <select
                value={categoryFilterTypeId}
                onChange={(e) => setCategoryFilterTypeId(e.target.value)}
                className="rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs text-white"
              >
                <option value="">All types</option>
                {types.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.name}
                  </option>
                ))}
              </select>
            </div>
            {categoryStatus && <div className="mt-2 text-[11px] text-muted-foreground">{categoryStatus}</div>}
            <div className="mt-4 overflow-x-auto rounded-md bg-card/80">
              <table className="min-w-full text-xs divide-y divide-muted/30">
                <thead className="bg-muted/10 text-[11px] text-muted-foreground">
                  <tr>
                    <th className="py-3 px-3 text-left">Name</th>
                    <th className="py-3 px-3 text-left">Code</th>
                    <th className="py-3 px-3 text-left">Type</th>
                    <th className="py-3 px-3 text-left">Status</th>
                    <th className="py-3 px-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCategories.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-3 text-center text-xs text-muted-foreground">
                        No categories yet.
                      </td>
                    </tr>
                  ) : (
                    filteredCategories.map((row) => {
                      const editing = editingCategoryId === row.id;
                      const parentType = typeLookup.get(row.inventoryTypeId);
                      return (
                        <tr key={row.id} className="bg-transparent hover:bg-muted/10">
                          <td className="py-2 px-3">
                            {editing ? (
                              <input
                                value={categoryEditForm.name}
                                onChange={(e) => setCategoryEditForm((prev) => ({ ...prev, name: e.target.value }))}
                                className={inputClass}
                              />
                            ) : (
                              row.name
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {editing ? (
                              <input
                                value={categoryEditForm.code}
                                onChange={(e) => setCategoryEditForm((prev) => ({ ...prev, code: e.target.value }))}
                                className={inputClass}
                              />
                            ) : (
                              row.code
                            )}
                          </td>
                          <td className="py-2 px-3 text-[11px] text-muted-foreground">
                            {parentType?.name ?? row.inventoryTypeId.slice(0, 8)}
                          </td>
                          <td className="py-2 px-3 text-[11px]">
                            <span className={badgeClass(row.isActive)}>{row.isActive ? "Active" : "Inactive"}</span>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex flex-wrap gap-2">
                              {editing ? (
                                <>
                                  <button
                                    type="button"
                                    className="rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold text-emerald-100"
                                    disabled={categorySaving}
                                    onClick={() => saveCategory(row.id)}
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                                    onClick={() => setEditingCategoryId(null)}
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                                    onClick={() => startEditCategory(row)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                                    onClick={() => toggleCategoryStatus(row)}
                                    disabled={categorySaving}
                                  >
                                    {row.isActive ? "Deactivate" : "Activate"}
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-full border border-rose-500/40 px-3 py-1 text-[11px] text-rose-200"
                                    onClick={() => deleteCategory(row)}
                                    disabled={categorySaving}
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-2xl bg-slate-950/80 p-4 shadow-xl">
            <h2 className="text-lg font-semibold">Create category</h2>
            <p className="text-xs text-muted-foreground">Categories sit under inventory types.</p>
            <form className="mt-4 space-y-3 text-sm" onSubmit={createCategory}>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Inventory Type</span>
                <select
                  value={categoryForm.inventoryTypeId}
                  onChange={(e) => setCategoryForm((prev) => ({ ...prev, inventoryTypeId: e.target.value }))}
                  className={selectClass}
                >
                  <option value="">Select type</option>
                  {types.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Name</span>
                <input
                  value={categoryForm.name}
                  onChange={(e) => setCategoryForm((prev) => ({ ...prev, name: e.target.value }))}
                  className={inputClass}
                  placeholder="Electrical"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Code</span>
                <input
                  value={categoryForm.code}
                  onChange={(e) => setCategoryForm((prev) => ({ ...prev, code: e.target.value }))}
                  className={inputClass}
                  placeholder="ELEC"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Description</span>
                <input
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm((prev) => ({ ...prev, description: e.target.value }))}
                  className={inputClass}
                  placeholder="Electrical components and sensors"
                />
              </label>
              <button
                type="submit"
                disabled={categorySaving}
                className="w-full rounded-2xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-lg disabled:opacity-50"
              >
                {categorySaving ? "Saving..." : "Add category"}
              </button>
              {categoryStatus && <p className="text-[11px] text-muted-foreground">{categoryStatus}</p>}
            </form>
          </article>
        </section>
      )}

      {activeTab === "subcategories" && (
        <section className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
          <article className="rounded-2xl bg-slate-950/80 p-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Sub categories</h2>
                <p className="text-xs text-muted-foreground">Attach sub categories to categories.</p>
              </div>
              <select
                value={subcategoryFilterCategoryId}
                onChange={(e) => setSubcategoryFilterCategoryId(e.target.value)}
                className="rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs text-white"
              >
                <option value="">All categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
            {subcategoryStatus && <div className="mt-2 text-[11px] text-muted-foreground">{subcategoryStatus}</div>}
            <div className="mt-4 overflow-x-auto rounded-md bg-card/80">
              <table className="min-w-full text-xs divide-y divide-muted/30">
                <thead className="bg-muted/10 text-[11px] text-muted-foreground">
                  <tr>
                    <th className="py-3 px-3 text-left">Name</th>
                    <th className="py-3 px-3 text-left">Code</th>
                    <th className="py-3 px-3 text-left">Category</th>
                    <th className="py-3 px-3 text-left">Status</th>
                    <th className="py-3 px-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSubcategories.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-3 text-center text-xs text-muted-foreground">
                        No sub categories yet.
                      </td>
                    </tr>
                  ) : (
                    filteredSubcategories.map((row) => {
                      const editing = editingSubcategoryId === row.id;
                      const parentCategory = categoryLookup.get(row.categoryId);
                      return (
                        <tr key={row.id} className="bg-transparent hover:bg-muted/10">
                          <td className="py-2 px-3">
                            {editing ? (
                              <input
                                value={subcategoryEditForm.name}
                                onChange={(e) =>
                                  setSubcategoryEditForm((prev) => ({ ...prev, name: e.target.value }))
                                }
                                className={inputClass}
                              />
                            ) : (
                              row.name
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {editing ? (
                              <input
                                value={subcategoryEditForm.code}
                                onChange={(e) =>
                                  setSubcategoryEditForm((prev) => ({ ...prev, code: e.target.value }))
                                }
                                className={inputClass}
                              />
                            ) : (
                              row.code
                            )}
                          </td>
                          <td className="py-2 px-3 text-[11px] text-muted-foreground">
                            {parentCategory?.name ?? row.categoryId.slice(0, 8)}
                          </td>
                          <td className="py-2 px-3 text-[11px]">
                            <span className={badgeClass(row.isActive)}>{row.isActive ? "Active" : "Inactive"}</span>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex flex-wrap gap-2">
                              {editing ? (
                                <>
                                  <button
                                    type="button"
                                    className="rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold text-emerald-100"
                                    disabled={subcategorySaving}
                                    onClick={() => saveSubcategory(row.id)}
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                                    onClick={() => setEditingSubcategoryId(null)}
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                                    onClick={() => startEditSubcategory(row)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                                    onClick={() => toggleSubcategoryStatus(row)}
                                    disabled={subcategorySaving}
                                  >
                                    {row.isActive ? "Deactivate" : "Activate"}
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-full border border-rose-500/40 px-3 py-1 text-[11px] text-rose-200"
                                    onClick={() => deleteSubcategory(row)}
                                    disabled={subcategorySaving}
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </article>

          <article className="rounded-2xl bg-slate-950/80 p-4 shadow-xl">
            <h2 className="text-lg font-semibold">Create sub category</h2>
            <p className="text-xs text-muted-foreground">Sub categories sit under categories.</p>
            <form className="mt-4 space-y-3 text-sm" onSubmit={createSubcategory}>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Category</span>
                <select
                  value={subcategoryForm.categoryId}
                  onChange={(e) => setSubcategoryForm((prev) => ({ ...prev, categoryId: e.target.value }))}
                  className={selectClass}
                >
                  <option value="">Select category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Name</span>
                <input
                  value={subcategoryForm.name}
                  onChange={(e) => setSubcategoryForm((prev) => ({ ...prev, name: e.target.value }))}
                  className={inputClass}
                  placeholder="Alternator"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Code</span>
                <input
                  value={subcategoryForm.code}
                  onChange={(e) => setSubcategoryForm((prev) => ({ ...prev, code: e.target.value }))}
                  className={inputClass}
                  placeholder="ALT"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Description</span>
                <input
                  value={subcategoryForm.description}
                  onChange={(e) => setSubcategoryForm((prev) => ({ ...prev, description: e.target.value }))}
                  className={inputClass}
                  placeholder="Charging and alternator components"
                />
              </label>
              <button
                type="submit"
                disabled={subcategorySaving}
                className="w-full rounded-2xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-lg disabled:opacity-50"
              >
                {subcategorySaving ? "Saving..." : "Add sub category"}
              </button>
              {subcategoryStatus && <p className="text-[11px] text-muted-foreground">{subcategoryStatus}</p>}
            </form>
          </article>
        </section>
      )}

      {activeTab === "makes" && (
        <section className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
          <article className="rounded-2xl bg-slate-950/80 p-4 shadow-xl">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-lg font-semibold">Car makes</h2>
                <p className="text-xs text-muted-foreground">Attach makes to sub categories.</p>
              </div>
              <select
                value={makeFilterSubcategoryId}
                onChange={(e) => setMakeFilterSubcategoryId(e.target.value)}
                className="rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs text-white"
              >
                <option value="">All sub categories</option>
                {subcategories.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>
            {makeStatus && <div className="mt-2 text-[11px] text-muted-foreground">{makeStatus}</div>}
            <div className="mt-4 overflow-x-auto rounded-md bg-card/80">
              <table className="min-w-full text-xs divide-y divide-muted/30">
                <thead className="bg-muted/10 text-[11px] text-muted-foreground">
                  <tr>
                    <th className="py-3 px-3 text-left">Name</th>
                    <th className="py-3 px-3 text-left">Code</th>
                    <th className="py-3 px-3 text-left">Sub Category</th>
                    <th className="py-3 px-3 text-left">Status</th>
                    <th className="py-3 px-3 text-left">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMakes.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-3 text-center text-xs text-muted-foreground">
                        No car makes yet.
                      </td>
                    </tr>
                  ) : (
                    pagedMakes.map((row) => {
                      const editing = editingMakeId === row.id;
                      const parentSub = subcategoryLookup.get(row.subcategoryId);
                      return (
                        <tr key={row.id} className="bg-transparent hover:bg-muted/10">
                          <td className="py-2 px-3">
                            {editing ? (
                              <input
                                value={makeEditForm.name}
                                onChange={(e) => setMakeEditForm((prev) => ({ ...prev, name: e.target.value }))}
                                className={inputClass}
                              />
                            ) : (
                              row.name
                            )}
                          </td>
                          <td className="py-2 px-3">
                            {editing ? (
                              <input
                                value={makeEditForm.code}
                                onChange={(e) => setMakeEditForm((prev) => ({ ...prev, code: e.target.value }))}
                                className={inputClass}
                              />
                            ) : (
                              row.code
                            )}
                          </td>
                          <td className="py-2 px-3 text-[11px] text-muted-foreground">
                            {parentSub?.name ?? (row.subcategoryId ? row.subcategoryId.slice(0, 8) : "Global")}
                          </td>
                          <td className="py-2 px-3 text-[11px]">
                            <span className={badgeClass(row.isActive)}>{row.isActive ? "Active" : "Inactive"}</span>
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex flex-wrap gap-2">
                              {editing ? (
                                <>
                                  <button
                                    type="button"
                                    className="rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold text-emerald-100"
                                    disabled={makeSaving}
                                    onClick={() => saveMake(row.id)}
                                  >
                                    Save
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                                    onClick={() => setEditingMakeId(null)}
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    type="button"
                                    className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                                    onClick={() => startEditMake(row)}
                                  >
                                    Edit
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                                    onClick={() => toggleMakeStatus(row)}
                                    disabled={makeSaving}
                                  >
                                    {row.isActive ? "Deactivate" : "Activate"}
                                  </button>
                                  <button
                                    type="button"
                                    className="rounded-full border border-rose-500/40 px-3 py-1 text-[11px] text-rose-200"
                                    onClick={() => deleteMake(row)}
                                    disabled={makeSaving}
                                  >
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            {filteredMakes.length > makePageSize && (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  Page {makePage} of {makePageCount} • {filteredMakes.length} total
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 disabled:opacity-50"
                    disabled={makePage <= 1}
                    onClick={() => setMakePage((prev) => Math.max(prev - 1, 1))}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 disabled:opacity-50"
                    disabled={makePage >= makePageCount}
                    onClick={() => setMakePage((prev) => Math.min(prev + 1, makePageCount))}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </article>

          <article className="rounded-2xl bg-slate-950/80 p-4 shadow-xl">
            <h2 className="text-lg font-semibold">Create car make</h2>
            <p className="text-xs text-muted-foreground">Makes sit under sub categories.</p>
            <form className="mt-4 space-y-3 text-sm" onSubmit={createMake}>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Sub Category</span>
                <select
                  value={makeForm.subcategoryId}
                  onChange={(e) => setMakeForm((prev) => ({ ...prev, subcategoryId: e.target.value }))}
                  className={selectClass}
                >
                  <option value="">Select sub category</option>
                  {subcategories.map((sub) => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Name</span>
                <input
                  value={makeForm.name}
                  onChange={(e) => setMakeForm((prev) => ({ ...prev, name: e.target.value }))}
                  className={inputClass}
                  placeholder="Toyota"
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-muted-foreground">Code</span>
                <input
                  value={makeForm.code}
                  onChange={(e) => setMakeForm((prev) => ({ ...prev, code: e.target.value }))}
                  className={inputClass}
                  placeholder="TOY"
                />
              </label>
              <button
                type="submit"
                disabled={makeSaving}
                className="w-full rounded-2xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-lg disabled:opacity-50"
              >
                {makeSaving ? "Saving..." : "Add make"}
              </button>
              {makeStatus && <p className="text-[11px] text-muted-foreground">{makeStatus}</p>}
            </form>
          </article>
        </section>
      )}

      {activeTab === "models" && (
        <section className="grid gap-4 lg:grid-cols-[1.2fr,1fr]">
          <article className="rounded-2xl bg-slate-950/80 p-4 shadow-xl space-y-6">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold">Car models</h2>
                  <p className="text-xs text-muted-foreground">Attach models to makes.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={modelFilterMakeId}
                    onChange={(e) => setModelFilterMakeId(e.target.value)}
                    className="rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs text-white"
                  >
                    <option value="">All makes</option>
                    {makes.map((make) => (
                      <option key={make.id} value={make.id}>
                        {make.name}
                      </option>
                    ))}
                  </select>
                  <select
                    value={yearFilter}
                    onChange={(e) => setYearFilter(e.target.value)}
                    className="rounded-full border border-white/15 bg-black/20 px-3 py-1.5 text-xs text-white"
                  >
                    <option value="">All years</option>
                    {yearOptions.map((year) => (
                      <option key={year} value={String(year)}>
                        {year}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {modelStatus && <div className="mt-2 text-[11px] text-muted-foreground">{modelStatus}</div>}
              <div className="mt-4 overflow-x-auto rounded-md bg-card/80">
                <table className="min-w-full text-xs divide-y divide-muted/30">
                  <thead className="bg-muted/10 text-[11px] text-muted-foreground">
                    <tr>
                      <th className="py-3 px-3 text-left">Name</th>
                      <th className="py-3 px-3 text-left">Code</th>
                      <th className="py-3 px-3 text-left">Make</th>
                      <th className="py-3 px-3 text-left">Status</th>
                      <th className="py-3 px-3 text-left">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                  {filteredModels.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-3 text-center text-xs text-muted-foreground">
                        No car models yet.
                      </td>
                    </tr>
                  ) : (
                    pagedModels.map((row) => {
                      const editing = editingModelId === row.id;
                      const parentMake = makeLookup.get(row.makeId);
                        return (
                          <tr key={row.id} className="bg-transparent hover:bg-muted/10">
                            <td className="py-2 px-3">
                              {editing ? (
                                <input
                                  value={modelEditForm.name}
                                  onChange={(e) => setModelEditForm((prev) => ({ ...prev, name: e.target.value }))}
                                  className={inputClass}
                                />
                              ) : (
                                row.name
                              )}
                            </td>
                            <td className="py-2 px-3">
                              {editing ? (
                                <input
                                  value={modelEditForm.code}
                                  onChange={(e) => setModelEditForm((prev) => ({ ...prev, code: e.target.value }))}
                                  className={inputClass}
                                />
                              ) : (
                                row.code
                              )}
                            </td>
                            <td className="py-2 px-3 text-[11px] text-muted-foreground">
                              {parentMake?.name ?? row.makeId.slice(0, 8)}
                            </td>
                            <td className="py-2 px-3 text-[11px]">
                              <span className={badgeClass(row.isActive)}>{row.isActive ? "Active" : "Inactive"}</span>
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex flex-wrap gap-2">
                                {editing ? (
                                  <>
                                    <button
                                      type="button"
                                      className="rounded-full bg-emerald-500/20 px-3 py-1 text-[11px] font-semibold text-emerald-100"
                                      disabled={modelSaving}
                                      onClick={() => saveModel(row.id)}
                                    >
                                      Save
                                    </button>
                                    <button
                                      type="button"
                                      className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                                      onClick={() => setEditingModelId(null)}
                                    >
                                      Cancel
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                                      onClick={() => startEditModel(row)}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      type="button"
                                      className="rounded-full border border-white/15 px-3 py-1 text-[11px] text-white/70"
                                      onClick={() => toggleModelStatus(row)}
                                      disabled={modelSaving}
                                    >
                                      {row.isActive ? "Deactivate" : "Activate"}
                                    </button>
                                    <button
                                      type="button"
                                      className="rounded-full border border-rose-500/40 px-3 py-1 text-[11px] text-rose-200"
                                      onClick={() => deleteModel(row)}
                                      disabled={modelSaving}
                                    >
                                      Delete
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
              {filteredModels.length > modelPageSize && (
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    Page {modelPage} of {modelPageCount} • {filteredModels.length} total
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 disabled:opacity-50"
                      disabled={modelPage <= 1}
                      onClick={() => setModelPage((prev) => Math.max(prev - 1, 1))}
                    >
                      Prev
                    </button>
                    <button
                      type="button"
                      className="rounded-full border border-white/15 px-3 py-1 text-xs text-white/70 disabled:opacity-50"
                      disabled={modelPage >= modelPageCount}
                      onClick={() => setModelPage((prev) => Math.min(prev + 1, modelPageCount))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>

          </article>

          <article className="rounded-2xl bg-slate-950/80 p-4 shadow-xl space-y-6">
            <div>
              <h2 className="text-lg font-semibold">Create car model</h2>
              <p className="text-xs text-muted-foreground">Models sit under makes.</p>
              <form className="mt-4 space-y-3 text-sm" onSubmit={createModel}>
                <label className="block">
                  <span className="text-[11px] text-muted-foreground">Make</span>
                  <select
                    value={modelForm.makeId}
                    onChange={(e) => setModelForm((prev) => ({ ...prev, makeId: e.target.value }))}
                    className={selectClass}
                  >
                    <option value="">Select make</option>
                    {makes.map((make) => (
                      <option key={make.id} value={make.id}>
                        {make.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className="text-[11px] text-muted-foreground">Name</span>
                  <input
                    value={modelForm.name}
                    onChange={(e) => setModelForm((prev) => ({ ...prev, name: e.target.value }))}
                    className={inputClass}
                    placeholder="Corolla"
                  />
                </label>
                <label className="block">
                  <span className="text-[11px] text-muted-foreground">Code</span>
                  <input
                    value={modelForm.code}
                    onChange={(e) => setModelForm((prev) => ({ ...prev, code: e.target.value }))}
                    className={inputClass}
                    placeholder="COR"
                  />
                </label>
                <button
                  type="submit"
                  disabled={modelSaving}
                  className="w-full rounded-2xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-lg disabled:opacity-50"
                >
                  {modelSaving ? "Saving..." : "Add model"}
                </button>
                {modelStatus && <p className="text-[11px] text-muted-foreground">{modelStatus}</p>}
              </form>
            </div>

          </article>
        </section>
      )}

      {activeTab === "structure" && (
        <section className="rounded-2xl bg-slate-950/80 p-4 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Inventory structure</h2>
              <p className="text-xs text-muted-foreground">Tree and table views for the active taxonomy levels.</p>
            </div>
            <div className="flex items-center gap-2">
              <button type="button" className={toggleClass(structureView === "tree")} onClick={() => setStructureView("tree")}>
                Tree View
              </button>
              <button type="button" className={toggleClass(structureView === "table")} onClick={() => setStructureView("table")}>
                Table View
              </button>
            </div>
          </div>

          {structureView === "tree" ? (
            <div className="rounded-2xl border border-white/10 bg-black/20 p-2 overflow-visible">
              {treeNodes.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground">No taxonomy items yet.</div>
              ) : (
                <Tree<TreeNode>
                  data={treeNodes}
                  openByDefault
                  rowHeight={rowHeight}
                  indent={22}
                  width="100%"
                  height={treeHeight}
                >
                  {({ node, style }: NodeRendererProps<TreeNode>) => (
                    <div style={style} className="flex items-center gap-2">
                      <button
                        type="button"
                        className={`text-xs ${
                          node.isInternal ? "text-white/60 hover:text-white" : "text-white/30"
                        }`}
                        onClick={() => node.isInternal && node.toggle()}
                        aria-label={node.isOpen ? "Collapse" : "Expand"}
                      >
                        {node.isInternal ? (node.isOpen ? "▾" : "▸") : "•"}
                      </button>
                      <div
                        className={`flex flex-1 items-center justify-between rounded-lg px-3 py-1 ${
                          node.data.kind === "type"
                            ? "bg-white/5 text-white font-semibold"
                            : node.data.kind === "category"
                            ? "text-white/85"
                            : "text-white/75"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="truncate">{node.data.name}</span>
                          {node.data.code ? (
                            <span className="text-[11px] text-muted-foreground">{node.data.code}</span>
                          ) : null}
                        </div>
                        <span className={badgeClass(node.data.isActive)}>
                          {node.data.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>
                    </div>
                  )}
                </Tree>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-md bg-card/80">
              <table className="min-w-full text-xs divide-y divide-muted/30">
                <thead className="bg-muted/10 text-[11px] text-muted-foreground">
                  <tr>
                    <th className="py-3 px-3 text-left">Type</th>
                    <th className="py-3 px-3 text-left">Category</th>
                    <th className="py-3 px-3 text-left">Sub Category</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-3 text-center text-xs text-muted-foreground">
                        No inventory structure yet.
                      </td>
                    </tr>
                  ) : (
                    tableRows.map((row) => (
                      <tr key={row.key} className="bg-transparent hover:bg-muted/10">
                        <td className="py-2 px-3">{row.type ?? "-"}</td>
                        <td className="py-2 px-3">{row.category ?? "-"}</td>
                        <td className="py-2 px-3">{row.subcategory ?? "-"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </MainPageShell>
  );
}
