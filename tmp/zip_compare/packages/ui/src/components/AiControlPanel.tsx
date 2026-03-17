"use client";

import React, { useEffect, useState } from "react";
import { Card } from "./Card";
import { useTheme } from "../theme";

type AiModuleConfig = {
  key: string;
  label: string;
  category: string;
  description?: string | null;
  enabled: boolean;
};

type ApiResponse = {
  masterEnabled: boolean;
  modules: AiModuleConfig[];
};

export function AiControlPanel() {
  const { theme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [masterEnabled, setMasterEnabled] = useState(true);
  const [modules, setModules] = useState<AiModuleConfig[]>([]);
  const [createForm, setCreateForm] = useState({
    key: "",
    label: "",
    category: "custom",
    description: "",
    enabled: true,
  });

  // Load config on mount
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/ai/config");
        if (!res.ok) throw new Error("Failed to load AI config");

        const data: ApiResponse = await res.json();
        if (!cancelled) {
          setMasterEnabled(data.masterEnabled);
          setModules(data.modules || []);
        }
      } catch (err: unknown) {
        console.error(err);
        if (!cancelled) setError("Failed to load AI settings");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    return () => {
      cancelled = true;
    };
  }, []);

  async function persistConfig(nextMaster: boolean, nextModules: AiModuleConfig[]) {
    setSaving(true);
    setError(null);

    try {
      const res = await fetch("/api/ai/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          masterEnabled: nextMaster,
          modules: nextModules.map((m) => ({
            key: m.key,
            enabled: m.enabled,
          })),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to save AI settings");
      }
    } catch (err: unknown) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to save AI settings");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleMaster() {
    const next = !masterEnabled;
    setMasterEnabled(next);
    await persistConfig(next, modules);
  }

  async function handleToggleModule(key: string) {
    const nextModules = modules.map((m) => (m.key === key ? { ...m, enabled: !m.enabled } : m));
    setModules(nextModules);
    await persistConfig(masterEnabled, nextModules);
  }

  async function handleCreateModule(e: React.FormEvent) {
    e.preventDefault();
    if (!createForm.key.trim() || !createForm.label.trim()) {
      setError("Module key and label are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newModules: [
            {
              key: createForm.key.trim(),
              label: createForm.label.trim(),
              category: createForm.category || "custom",
              description: createForm.description || null,
              enabled: createForm.enabled,
            },
          ],
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to add module");
      }
      const newModule: AiModuleConfig = {
        key: createForm.key.trim(),
        label: createForm.label.trim(),
        category: createForm.category || "custom",
        description: createForm.description || "",
        enabled: createForm.enabled,
      };
      setModules((prev) => {
        const exists = prev.some((m) => m.key === newModule.key);
        return exists ? prev.map((m) => (m.key === newModule.key ? newModule : m)) : [newModule, ...prev];
      });
      setCreateForm({ key: "", label: "", category: "custom", description: "", enabled: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to add module");
    } finally {
      setSaving(false);
    }
  }

  const pillBase = "inline-flex items-center px-2 py-0.5 text-[10px] rounded-full border";

  return (
    <Card title="Global AI Control" className="space-y-4">
      <p className={`text-xs sm:text-sm opacity-80 ${theme.mutedText}`}>
        Configure how AI behaves across the entire platform. The master switch disables all AI usage for every company
        and user. Module switches control major AI features.
      </p>

      {error && (
        <div className="text-xs text-red-400 border border-red-400/40 rounded-lg px-3 py-2 bg-red-500/5">{error}</div>
      )}

      <div className={`flex items-center justify-between p-3 rounded-2xl ${theme.surfaceSubtle} ${theme.inputBorder}`}>
        <div>
          <div className="text-sm font-semibold">Master AI Switch</div>
          <p className={`text-xs opacity-70 ${theme.mutedText}`}>
            When turned off, all AI features are disabled globally regardless of company or user settings.
          </p>
        </div>

        <button
          onClick={handleToggleMaster}
          disabled={loading || saving}
          className={`relative inline-flex h-7 w-14 items-center rounded-full transition ${
            masterEnabled ? "bg-emerald-500/80" : "bg-zinc-600/70"
          } disabled:opacity-60 disabled:cursor-not-allowed`}
        >
          <span
            className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
              masterEnabled ? "translate-x-7" : "translate-x-1"
            }`}
          />
          <span className="absolute -top-5 right-0 text-[11px] font-medium">{masterEnabled ? "On" : "Off"}</span>
        </button>
      </div>

      <div className="mt-2 space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide opacity-70">AI Modules</h3>
          {saving && <span className="text-[11px] opacity-70">Saving changes…</span>}
        </div>

        <form
          onSubmit={handleCreateModule}
          className={`grid gap-2 rounded-2xl p-3 ${theme.surfaceSubtle} ${theme.inputBorder} md:grid-cols-5`}
        >
          <div className="md:col-span-1">
            <label className="text-[11px] opacity-70">Key</label>
            <input
              className="mt-1 w-full rounded-md border border-white/10 bg-black/20 px-2 py-1 text-sm"
              value={createForm.key}
              onChange={(e) => setCreateForm({ ...createForm, key: e.target.value })}
              placeholder="voice_ai"
            />
          </div>
          <div className="md:col-span-1">
            <label className="text-[11px] opacity-70">Label</label>
            <input
              className="mt-1 w-full rounded-md border border-white/10 bg-black/20 px-2 py-1 text-sm"
              value={createForm.label}
              onChange={(e) => setCreateForm({ ...createForm, label: e.target.value })}
              placeholder="AI Voice"
            />
          </div>
          <div>
            <label className="text-[11px] opacity-70">Category</label>
            <input
              className="mt-1 w-full rounded-md border border-white/10 bg-black/20 px-2 py-1 text-sm"
              value={createForm.category}
              onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
              placeholder="call-center / automation"
            />
          </div>
          <div className="md:col-span-2">
            <label className="text-[11px] opacity-70">Description</label>
            <input
              className="mt-1 w-full rounded-md border border-white/10 bg-black/20 px-2 py-1 text-sm"
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              placeholder="What this module does"
            />
          </div>
          <div className="md:col-span-5 flex items-center gap-2">
            <label className="text-[11px] opacity-70">Enabled</label>
            <input
              type="checkbox"
              checked={createForm.enabled}
              onChange={(e) => setCreateForm({ ...createForm, enabled: e.target.checked })}
            />
            <button
              type="submit"
              disabled={saving}
              className="ml-auto rounded-full border border-white/20 px-3 py-1 text-sm hover:border-white/40 disabled:opacity-50"
            >
              Add module
            </button>
          </div>
        </form>

        {loading && <p className={`text-xs opacity-70 ${theme.mutedText}`}>Loading AI modules…</p>}

        {!loading && modules.length === 0 && (
          <p className={`text-xs opacity-70 ${theme.mutedText}`}>
            No AI modules registered yet. As you add AI tools, they will appear here.
          </p>
        )}

        {!loading && modules.length > 0 && (
          <div className="space-y-2">
            {modules.map((m) => (
              <div
                key={m.key}
                className={`flex items-center justify-between rounded-2xl px-3 py-2 ${theme.surfaceSubtle} ${theme.inputBorder}`}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{m.label}</span>
                    <span
                      className={`${pillBase} ${
                        m.enabled
                          ? "border-emerald-400/60 text-emerald-300 bg-emerald-500/5"
                          : "border-zinc-500/60 text-zinc-300 bg-zinc-500/5"
                      }`}
                    >
                      {m.enabled ? "Enabled" : "Disabled"}
                    </span>
                    <span className="text-[10px] uppercase opacity-60">{m.key}</span>
                    <span className="text-[10px] opacity-60">{m.category}</span>
                  </div>
                  {m.description && <p className={`text-xs opacity-70 ${theme.mutedText}`}>{m.description}</p>}
                </div>

                <button
                  onClick={() => handleToggleModule(m.key)}
                  disabled={loading || saving || !masterEnabled}
                  className={`relative inline-flex h-6 w-12 items-center rounded-full transition ${
                    m.enabled && masterEnabled ? "bg-emerald-500/80" : "bg-zinc-600/70"
                  } disabled:opacity-60 disabled:cursor-not-allowed`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition ${
                      m.enabled && masterEnabled ? "translate-x-6" : "translate-x-1"
                    }`}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
