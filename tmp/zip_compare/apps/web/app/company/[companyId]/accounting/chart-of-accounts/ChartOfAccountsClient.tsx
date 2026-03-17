"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Tree, NodeRendererProps } from "react-arborist";
import { Card, useTheme } from "@repo/ui";

type Heading = {
  id: string;
  name: string;
  headCode: string;
  financialStmt: string;
};

type HeadingsResponse = {
  data: Heading[];
};

type Subheading = {
  id: string;
  headingId: string;
  name: string;
  subheadCode: string;
};

type SubheadingsResponse = {
  data: Subheading[];
};

type Group = {
  id: string;
  headingId: string;
  subheadingId: string;
  companyId?: string | null;
  name: string;
  groupCode: string;
};

type GroupsResponse = {
  data: Group[];
};

type AccountRow = {
  id: string;
  headingId: string;
  subheadingId: string;
  groupId: string;
  companyId: string;
  accountCode: string;
  accountName: string;
};

type AccountsResponse = {
  data: AccountRow[];
};

type CoaSettingsResponse = {
  data?: {
    allowCustomCoa?: boolean;
  };
};

type TreeNode = {
  id: string;
  name: string;
  kind:
    | "heading"
    | "subheading"
    | "group"
    | "account"
    | "add-group"
    | "add-account"
    | "add-heading"
    | "add-subheading";
  headingId?: string;
  subheadingId?: string;
  groupId?: string;
  accountId?: string;
  children?: TreeNode[];
};

export default function ChartOfAccountsClient({ companyId }: { companyId: string }) {
  const { theme } = useTheme();
  const [view, setView] = useState<"tree" | "table">("tree");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [headings, setHeadings] = useState<Heading[]>([]);
  const [subheadings, setSubheadings] = useState<Subheading[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [allowCustomCoa, setAllowCustomCoa] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [activeHeading, setActiveHeading] = useState<string | null>(null);
  const [newHeadingCode, setNewHeadingCode] = useState("");
  const [newHeadingName, setNewHeadingName] = useState("");
  const [newHeadingStmt, setNewHeadingStmt] = useState("Balance Sheet");
  const [activeSubheading, setActiveSubheading] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState("");
  const [activeHeadingForSub, setActiveHeadingForSub] = useState<string | null>(null);
  const [newSubheadCode, setNewSubheadCode] = useState("");
  const [newSubheadName, setNewSubheadName] = useState("");
  const [activeGroup, setActiveGroup] = useState<string | null>(null);
  const [newAccountName, setNewAccountName] = useState("");

  useEffect(() => {
    let active = true;
    async function loadHeadingsAndSubheadings() {
      setLoading(true);
      setError(null);
      try {
        const [headingsRes, subheadingsRes, groupsRes, accountsRes, settingsRes] = await Promise.all([
          fetch(`/api/accounting/headings?companyId=${companyId}`, { cache: "no-store" }),
          fetch(`/api/accounting/subheadings?companyId=${companyId}`, { cache: "no-store" }),
          fetch(`/api/accounting/groups?companyId=${companyId}`, { cache: "no-store" }),
          fetch(`/api/accounting/accounts?companyId=${companyId}`, { cache: "no-store" }),
          fetch(`/api/accounting/coa-settings?companyId=${companyId}`, { cache: "no-store" }),
        ]);
        if (!headingsRes.ok) throw new Error("Failed to load headings");
        if (!subheadingsRes.ok) throw new Error("Failed to load subheadings");
        if (!groupsRes.ok) throw new Error("Failed to load groups");
        if (!accountsRes.ok) throw new Error("Failed to load accounts");
        const headingsJson = (await headingsRes.json()) as HeadingsResponse;
        const subheadingsJson = (await subheadingsRes.json()) as SubheadingsResponse;
        const groupsJson = (await groupsRes.json()) as GroupsResponse;
        const accountsJson = (await accountsRes.json()) as AccountsResponse;
        const settingsJson = (await settingsRes.json()) as CoaSettingsResponse;
        if (active) {
          setHeadings(headingsJson.data ?? []);
          setSubheadings(subheadingsJson.data ?? []);
          setGroups(groupsJson.data ?? []);
          setAccounts(accountsJson.data ?? []);
          setAllowCustomCoa(Boolean(settingsJson?.data?.allowCustomCoa));
        }
      } catch (err: any) {
        if (active) {
          setHeadings([]);
          setSubheadings([]);
          setGroups([]);
          setAccounts([]);
          setAllowCustomCoa(false);
          setError(err?.message ?? "Failed to load headings");
        }
      } finally {
        if (active) setLoading(false);
      }
    }
    loadHeadingsAndSubheadings();
    return () => {
      active = false;
    };
  }, [companyId]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) {
      return { headings, subheadings, groups, accounts };
    }
    const headingMatches = new Set(
      headings
        .filter((h) => h.name.toLowerCase().includes(term) || h.headCode.toLowerCase().includes(term))
        .map((h) => h.id)
    );
    const groupMatches = new Set(
      groups
        .filter((g) => g.name.toLowerCase().includes(term) || g.groupCode.toLowerCase().includes(term))
        .map((g) => g.id)
    );
    const accountMatches = new Set(
      accounts
        .filter((a) => a.accountName.toLowerCase().includes(term) || a.accountCode.toLowerCase().includes(term))
        .map((a) => a.groupId)
    );
    const filteredSub = subheadings.filter((s) => {
      const nameMatch = s.name.toLowerCase().includes(term);
      const codeMatch = s.subheadCode.toLowerCase().includes(term);
      return (
        nameMatch ||
        codeMatch ||
        headingMatches.has(s.headingId) ||
        Array.from(groupMatches).some((groupId) => groups.find((g) => g.id === groupId)?.subheadingId === s.id) ||
        Array.from(accountMatches).some((groupId) => groups.find((g) => g.id === groupId)?.subheadingId === s.id)
      );
    });
    const includedHeadingIds = new Set(filteredSub.map((s) => s.headingId));
    headingMatches.forEach((id) => includedHeadingIds.add(id));
    const filteredHeadings = headings.filter((h) => includedHeadingIds.has(h.id));
    const filteredGroups = groups.filter(
      (g) => groupMatches.has(g.id) || accountMatches.has(g.id) || filteredSub.some((s) => s.id === g.subheadingId)
    );
    const filteredAccounts = accounts.filter(
      (a) => accountMatches.has(a.groupId) || filteredGroups.some((g) => g.id === a.groupId)
    );
    return { headings: filteredHeadings, subheadings: filteredSub, groups: filteredGroups, accounts: filteredAccounts };
  }, [headings, subheadings, groups, accounts, searchTerm]);

  const highlightClass = useMemo(() => {
    switch (theme.id) {
      case "sunset":
        return "rounded px-1 bg-orange-400/25 text-orange-100";
      case "ocean":
        return "rounded px-1 bg-cyan-400/25 text-cyan-50";
      case "forest":
        return "rounded px-1 bg-emerald-400/25 text-emerald-50";
      case "light":
        return "rounded px-1 bg-sky-200 text-slate-900";
      case "midnight":
      default:
        return "rounded px-1 bg-fuchsia-400/25 text-fuchsia-100";
    }
  }, [theme.id]);

  const highlightMatch = (text: string) => {
    const term = searchTerm.trim();
    if (!term) return <span>{text}</span>;
    const lowerText = text.toLowerCase();
    const lowerTerm = term.toLowerCase();
    const index = lowerText.indexOf(lowerTerm);
    if (index === -1) return <span>{text}</span>;
    return (
      <span>
        {text.slice(0, index)}
        <span className={highlightClass}>{text.slice(index, index + term.length)}</span>
        {text.slice(index + term.length)}
      </span>
    );
  };

  const treeData = useMemo<TreeNode[]>(() => {
    const byHeading = new Map<string, Subheading[]>();
    for (const sh of filtered.subheadings) {
      if (!byHeading.has(sh.headingId)) byHeading.set(sh.headingId, []);
      byHeading.get(sh.headingId)?.push(sh);
    }
    for (const [key, list] of byHeading) {
      list.sort((a, b) => a.subheadCode.localeCompare(b.subheadCode));
      byHeading.set(key, list);
    }
    const bySubheading = new Map<string, Group[]>();
    for (const g of filtered.groups) {
      if (!bySubheading.has(g.subheadingId)) bySubheading.set(g.subheadingId, []);
      bySubheading.get(g.subheadingId)?.push(g);
    }
    for (const [key, list] of bySubheading) {
      list.sort((a, b) => a.groupCode.localeCompare(b.groupCode));
      bySubheading.set(key, list);
    }
    const byGroup = new Map<string, AccountRow[]>();
    for (const a of filtered.accounts) {
      if (!byGroup.has(a.groupId)) byGroup.set(a.groupId, []);
      byGroup.get(a.groupId)?.push(a);
    }
    for (const [key, list] of byGroup) {
      list.sort((a, b) => a.accountCode.localeCompare(b.accountCode));
      byGroup.set(key, list);
    }
    return filtered.headings.map((heading) => ({
      id: `heading-${heading.headCode}`,
      name: heading.name,
      kind: "heading",
      headingId: heading.id,
      children: [
        ...(byHeading.get(heading.id)?.map((sub) => ({
          id: `subheading-${sub.id}`,
          name: `${sub.subheadCode} - ${sub.name}`,
          kind: "subheading",
          headingId: heading.id,
          subheadingId: sub.id,
          children: [
            ...(bySubheading.get(sub.id)?.map((group) => ({
              id: `group-${group.id}`,
              name: `${group.groupCode} - ${group.name}`,
              kind: "group" as const,
              headingId: heading.id,
              subheadingId: sub.id,
              groupId: group.id,
              children: [
                ...(byGroup.get(group.id)?.map((account) => ({
                  id: `account-${account.id}`,
                  name: `${account.accountCode} - ${account.accountName}`,
                  kind: "account" as const,
                  headingId: heading.id,
                  subheadingId: sub.id,
                  groupId: group.id,
                  accountId: account.id,
                  children: [],
                })) ?? []),
                {
                  id: `add-account-${group.id}`,
                  name: "Add account",
                  kind: "add-account",
                  headingId: heading.id,
                  subheadingId: sub.id,
                  groupId: group.id,
                  children: [],
                },
              ],
            })) ?? []),
            {
              id: `add-group-${sub.id}`,
              name: "Add group",
              kind: "add-group",
              headingId: heading.id,
              subheadingId: sub.id,
              children: [],
            },
          ],
        })) ?? []),
        ...(allowCustomCoa
          ? [
              {
                id: `add-subheading-${heading.id}`,
                name: "Add subheading",
                kind: "add-subheading" as const,
                headingId: heading.id,
                children: [],
              },
            ]
          : []),
      ],
    }));
  }, [filtered, allowCustomCoa]);

  const rowHeight = 36;
  const treeHeight =
    Math.max(headings.length + subheadings.length + groups.length + accounts.length, 1) * rowHeight + 8;
  const treeKey = searchTerm ? `search-${searchTerm}` : "default";

  const toggleClass = (active: boolean) =>
    `rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
      active ? "bg-white/15 text-white" : "border border-white/15 text-white/70 hover:border-white/40"
    }`;

  const tableRows = useMemo(
    () =>
      filtered.accounts
        .map((account) => {
          const group = groups.find((g) => g.id === account.groupId);
          const heading = headings.find((h) => h.id === account.headingId);
          const sub = subheadings.find((s) => s.id === account.subheadingId);
          return {
            id: account.id,
            heading: heading?.name ?? "-",
            headingCode: heading?.headCode ?? "-",
            subheadCode: sub?.subheadCode ?? "-",
            subheading: sub?.name ?? "-",
            groupCode: group?.groupCode ?? "-",
            groupName: group?.name ?? "-",
            accountCode: account.accountCode,
            accountName: account.accountName,
            financialStmt: heading?.financialStmt ?? "-",
          };
        })
        .sort((a, b) =>
          `${a.headingCode}${a.subheadCode}${a.groupCode}${a.accountCode}`.localeCompare(
            `${b.headingCode}${b.subheadCode}${b.groupCode}${b.accountCode}`
          )
        ),
    [headings, subheadings, groups, filtered.accounts]
  );

  const nextGroupCode = (subheadingId: string) => {
    const relevant = groups.filter((g) => g.subheadingId === subheadingId);
    const max = relevant.reduce((acc, g) => {
      const num = Number.parseInt(g.groupCode, 10);
      return Number.isFinite(num) ? Math.max(acc, num) : acc;
    }, 0);
    return max ? String(max + 1) : "";
  };

  const handleCreateGroup = async (headingId: string, subheadingId: string) => {
    if (!newGroupName.trim()) {
      setCreateError("Group name is required.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const groupCode = nextGroupCode(subheadingId);
      if (!groupCode) {
        throw new Error("Cannot determine next group code.");
      }
      const res = await fetch("/api/accounting/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          headingId,
          subheadingId,
          companyId,
          groupCode,
          name: newGroupName.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to create group");
      const created: Group = json.data;
      setGroups((prev) => [...prev, created]);
      setNewGroupName("");
      setActiveSubheading(null);
    } catch (err: any) {
      setCreateError(err?.message ?? "Failed to create group");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateHeading = async () => {
    if (!newHeadingName.trim() || !newHeadingCode.trim()) {
      setCreateError("Heading code and name are required.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/accounting/headings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          name: newHeadingName.trim(),
          headCode: newHeadingCode.trim(),
          financialStmt: newHeadingStmt,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to create heading");
      const created: Heading = json.data;
      setHeadings((prev) => [...prev, created]);
      setNewHeadingCode("");
      setNewHeadingName("");
      setActiveHeading(null);
    } catch (err: any) {
      setCreateError(err?.message ?? "Failed to create heading");
    } finally {
      setCreating(false);
    }
  };

  const handleCreateSubheading = async (headingId: string) => {
    if (!newSubheadName.trim() || !newSubheadCode.trim()) {
      setCreateError("Subheading code and name are required.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/accounting/subheadings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId,
          headingId,
          name: newSubheadName.trim(),
          subheadCode: newSubheadCode.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to create subheading");
      const created: Subheading = json.data;
      setSubheadings((prev) => [...prev, created]);
      setNewSubheadCode("");
      setNewSubheadName("");
      setActiveHeadingForSub(null);
    } catch (err: any) {
      setCreateError(err?.message ?? "Failed to create subheading");
    } finally {
      setCreating(false);
    }
  };

  const nextAccountCode = (groupId: string, groupCode: string) => {
    const relevant = accounts.filter((a) => a.groupId === groupId);
    const max = relevant.reduce((acc, a) => {
      const num = Number.parseInt(a.accountCode, 10);
      return Number.isFinite(num) ? Math.max(acc, num) : acc;
    }, 0);
    if (!max) return `${groupCode}01`;
    return String(max + 1);
  };

  const handleCreateAccount = async (groupId: string) => {
    if (!newAccountName.trim()) {
      setCreateError("Account name is required.");
      return;
    }
    const group = groups.find((g) => g.id === groupId);
    if (!group) {
      setCreateError("Group not found.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const accountCode = nextAccountCode(groupId, group.groupCode);
      const res = await fetch("/api/accounting/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          groupId,
          companyId,
          accountCode,
          accountName: newAccountName.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to create account");
      const created: AccountRow = json.data;
      setAccounts((prev) => [...prev, created]);
      setNewAccountName("");
      setActiveGroup(null);
    } catch (err: any) {
      setCreateError(err?.message ?? "Failed to create account");
    } finally {
      setCreating(false);
    }
  };

  const handleMoveAccount = async (accountId: string, targetGroupId: string) => {
    const targetGroup = groups.find((g) => g.id === targetGroupId);
    if (!targetGroup) {
      setCreateError("Target group not found.");
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      const res = await fetch("/api/accounting/accounts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountId,
          targetGroupId,
          companyId,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Failed to move account");
      const nextCode = json?.data?.accountCode;
      setAccounts((prev) =>
        prev.map((a) =>
          a.id === accountId
            ? {
                ...a,
                groupId: targetGroupId,
                headingId: targetGroup.headingId,
                subheadingId: targetGroup.subheadingId,
                accountCode: nextCode ?? a.accountCode,
              }
            : a
        )
      );
    } catch (err: any) {
      setCreateError(err?.message ?? "Failed to move account");
    } finally {
      setCreating(false);
    }
  };

  const handleExportPdf = async () => {
    setExporting(true);
    setError(null);
    try {
      const res = await fetch(`/api/company/${companyId}/accounting/chart-of-accounts/pdf`);
      if (!res.ok) throw new Error("Failed to export PDF");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `chart-of-accounts-${companyId}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err?.message ?? "Failed to export PDF");
    } finally {
      setExporting(false);
    }
  };


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">Default view: Tree</div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs uppercase tracking-wide text-white/70 hover:border-white/40"
            onClick={handleExportPdf}
            disabled={exporting}
          >
            {exporting ? "Exporting..." : "Export PDF"}
          </button>
          <button type="button" className={toggleClass(view === "tree")} onClick={() => setView("tree")}>
            Tree View
          </button>
          <button type="button" className={toggleClass(view === "table")} onClick={() => setView("table")}>
            Table View
          </button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <input
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by account code or name"
          className="w-full max-w-md rounded-full border border-white/15 bg-black/20 px-4 py-2 text-sm outline-none focus:ring-1 focus:ring-white/30"
        />
        {searchTerm ? (
          <button
            type="button"
            className="rounded-full border border-white/15 px-3 py-1.5 text-xs uppercase tracking-wide text-white/70 hover:border-white/40"
            onClick={() => setSearchTerm("")}
          >
            Clear
          </button>
        ) : null}
      </div>
      {error && <div className="text-sm text-destructive">{error}</div>}
      {createError && <div className="text-sm text-destructive">{createError}</div>}

      {loading ? (
        <Card className="p-4 text-sm text-muted-foreground">Loading chart of accounts…</Card>
      ) : headings.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground">No headings yet.</Card>
      ) : view === "tree" ? (
        <Card className="p-3">
          <div>
            <Tree<TreeNode>
              key={treeKey}
              data={[
                ...treeData,
                ...(allowCustomCoa
                  ? [
                      {
                        id: "add-heading-root",
                        name: "Add heading",
                        kind: "add-heading" as const,
                        children: [],
                      },
                    ]
                  : []),
              ]}
              openByDefault={Boolean(searchTerm)}
              initialOpenState={searchTerm ? undefined : {}}
              rowHeight={rowHeight}
              indent={24}
              width="100%"
              height={treeHeight}
              disableDrag={(data) => data?.kind !== "account"}
              disableDrop={({ parentNode, dragNodes }) => {
                if (!parentNode || parentNode?.data?.kind !== "group") return true;
                return dragNodes.some((n) => n?.data?.kind !== "account");
              }}
              onMove={({ dragNodes, parentNode }) => {
                const dragged = dragNodes?.[0];
                if (!dragged || dragged?.data?.kind !== "account") return;
                if (!parentNode || parentNode?.data?.kind !== "group") return;
                const accountId = dragged.data?.accountId;
                const targetGroupId = parentNode.data?.groupId;
                if (!accountId || !targetGroupId) return;
                if (dragged.data.groupId === targetGroupId) return;
                handleMoveAccount(accountId, targetGroupId);
              }}
            >
              {({ node, style, dragHandle }: NodeRendererProps<TreeNode>) => (
                <div style={style} className="flex items-center" ref={node.data.kind === "account" ? dragHandle : null}>
                  <button
                    type="button"
                    className={`mr-2 text-xs ${node.isInternal ? "text-white/60 hover:text-white" : "text-white/30"}`}
                    onClick={() => node.isInternal && node.toggle()}
                    aria-label={node.isOpen ? "Collapse" : "Expand"}
                  >
                    {node.isInternal ? (node.isOpen ? "▾" : "▸") : "•"}
                  </button>
                  {node.data.kind === "add-group" || node.data.kind === "add-account" ? (
                    <button
                      type="button"
                      className="mr-2 rounded-full border border-emerald-400/60 bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-100 hover:border-emerald-300/80 hover:bg-emerald-400/30"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (node.data.kind === "add-group") {
                          setActiveSubheading(node.data.subheadingId ?? null);
                          setNewGroupName("");
                        } else {
                          setActiveGroup(node.data.groupId ?? null);
                          setNewAccountName("");
                        }
                      }}
                      aria-label={node.data.kind === "add-group" ? "Add group" : "Add account"}
                    >
                      +
                    </button>
                  ) : node.data.kind === "add-heading" || node.data.kind === "add-subheading" ? (
                    <button
                      type="button"
                      className="mr-2 rounded-full border border-sky-400/60 bg-sky-500/20 px-2 py-0.5 text-xs font-semibold text-sky-100 hover:border-sky-300/80 hover:bg-sky-400/30"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (node.data.kind === "add-heading") {
                          setActiveHeading("root");
                          setNewHeadingCode("");
                          setNewHeadingName("");
                        } else if (node.data.headingId) {
                          setActiveHeadingForSub(node.data.headingId);
                          setNewSubheadCode("");
                          setNewSubheadName("");
                        }
                      }}
                      aria-label={node.data.kind === "add-heading" ? "Add heading" : "Add subheading"}
                    >
                      +
                    </button>
                  ) : null}
                  <div className="flex-1">
                    <div
                      className={`flex items-center justify-between rounded-lg px-3 py-1 text-base ${
                        node.data.kind === "heading"
                          ? "bg-white/5 text-white font-semibold"
                          : node.data.kind === "subheading"
                          ? "text-white/85"
                          : node.data.kind === "group"
                          ? "text-white/75"
                          : node.data.kind === "account"
                          ? "text-white/80"
                          : "text-white/60"
                      }`}
                      onClick={() => node.isInternal && node.toggle()}
                    >
                      <span className="truncate">
                        {node.data.kind === "add-group" || node.data.kind === "add-account"
                          ? ""
                          : highlightMatch(node.data.name)}
                      </span>
                    </div>
                    {node.data.kind === "add-group" && activeSubheading === node.data.subheadingId ? (
                      <div className="mt-2 flex items-center gap-2 pl-6">
                        <input
                          autoFocus
                          value={newGroupName}
                          onChange={(e) => setNewGroupName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (node.data.headingId && node.data.subheadingId) {
                                handleCreateGroup(node.data.headingId, node.data.subheadingId);
                              }
                            }
                            if (e.key === "Escape") {
                              setActiveSubheading(null);
                              setNewGroupName("");
                            }
                          }}
                          placeholder="Type group name and press Enter"
                          className="w-full max-w-md rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/30"
                        />
                        {creating ? <span className="text-xs text-muted-foreground">Saving...</span> : null}
                      </div>
                    ) : null}
                    {node.data.kind === "add-subheading" && activeHeadingForSub === node.data.headingId ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
                        <input
                          autoFocus
                          value={newSubheadCode}
                          onChange={(e) => setNewSubheadCode(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setActiveHeadingForSub(null);
                              setNewSubheadCode("");
                              setNewSubheadName("");
                            }
                          }}
                          placeholder="Code"
                          className="w-28 rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/30"
                        />
                        <input
                          value={newSubheadName}
                          onChange={(e) => setNewSubheadName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (node.data.headingId) {
                                handleCreateSubheading(node.data.headingId);
                              }
                            }
                            if (e.key === "Escape") {
                              setActiveHeadingForSub(null);
                              setNewSubheadCode("");
                              setNewSubheadName("");
                            }
                          }}
                          placeholder="Subheading name"
                          className="w-full max-w-md rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/30"
                        />
                        {creating ? <span className="text-xs text-muted-foreground">Saving...</span> : null}
                      </div>
                    ) : null}
                    {node.data.kind === "add-heading" && activeHeading === "root" ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 pl-6">
                        <input
                          autoFocus
                          value={newHeadingCode}
                          onChange={(e) => setNewHeadingCode(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Escape") {
                              setActiveHeading(null);
                              setNewHeadingCode("");
                              setNewHeadingName("");
                            }
                          }}
                          placeholder="Code"
                          className="w-24 rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/30"
                        />
                        <input
                          value={newHeadingName}
                          onChange={(e) => setNewHeadingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleCreateHeading();
                            }
                            if (e.key === "Escape") {
                              setActiveHeading(null);
                              setNewHeadingCode("");
                              setNewHeadingName("");
                            }
                          }}
                          placeholder="Heading name"
                          className="w-full max-w-md rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/30"
                        />
                        <select
                          value={newHeadingStmt}
                          onChange={(e) => setNewHeadingStmt(e.target.value)}
                          className="rounded-md border border-white/15 bg-black/30 px-3 py-2 text-sm text-white/90 outline-none focus:ring-1 focus:ring-white/30"
                        >
                          <option value="Balance Sheet">Balance Sheet</option>
                          <option value="Profit & Loss">Profit & Loss</option>
                        </select>
                        {creating ? <span className="text-xs text-muted-foreground">Saving...</span> : null}
                      </div>
                    ) : null}
                    {node.data.kind === "add-account" && activeGroup === node.data.groupId ? (
                      <div className="mt-2 flex items-center gap-2 pl-6">
                        <input
                          autoFocus
                          value={newAccountName}
                          onChange={(e) => setNewAccountName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (node.data.groupId) {
                                handleCreateAccount(node.data.groupId);
                              }
                            }
                            if (e.key === "Escape") {
                              setActiveGroup(null);
                              setNewAccountName("");
                            }
                          }}
                          placeholder="Type account name and press Enter"
                          className="w-full max-w-md rounded-md border border-white/15 bg-black/20 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-white/30"
                        />
                        {creating ? <span className="text-xs text-muted-foreground">Saving...</span> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              )}
            </Tree>
          </div>
        </Card>
      ) : (
        <Card className="p-4">
          {tableRows.length === 0 ? (
            <div className="text-sm text-muted-foreground">No accounts yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-muted-foreground border-b border-white/10">
                    <th className="px-3 py-2">Heading</th>
                    <th className="px-3 py-2">Subheading</th>
                    <th className="px-3 py-2">Group Code</th>
                    <th className="px-3 py-2">Group Name</th>
                    <th className="px-3 py-2">Account Code</th>
                    <th className="px-3 py-2">Account Name</th>
                    <th className="px-3 py-2">Financial Statement</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={row.id} className="border-b border-white/5">
                      <td className="px-3 py-2">{highlightMatch(`${row.headingCode} - ${row.heading}`)}</td>
                      <td className="px-3 py-2">{highlightMatch(`${row.subheadCode} - ${row.subheading}`)}</td>
                      <td className="px-3 py-2">{highlightMatch(row.groupCode)}</td>
                      <td className="px-3 py-2">{highlightMatch(row.groupName)}</td>
                      <td className="px-3 py-2">{highlightMatch(row.accountCode)}</td>
                      <td className="px-3 py-2">{highlightMatch(row.accountName)}</td>
                      <td className="px-3 py-2">{row.financialStmt}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
