"use client";

import React, { useState } from "react";
import { Card } from "./Card";
import { useTheme } from "../theme";
import { useI18n, SUPPORTED_LANGUAGES } from "../i18n";

export function AiTranslate() {
  const { theme } = useTheme();
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [targetLang, setTargetLang] = useState("ar");
  const [translated, setTranslated] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

async function handleTranslate() {
  if (!text.trim()) return;
  setLoading(true);
  setError(null);
  setTranslated("");

  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, targetLang }),
    });

    if (!res.ok) {
      // Try to read the error message from the API response
      let message = t("translator.errorGeneric");

      try {
        const data = await res.json();
        if (data && typeof data.error === "string") {
          message = data.error;
        }
      } catch {
        // ignore JSON parse error, keep generic message
      }

      setError(message);
      return;
    }

    const data = await res.json();
    setTranslated(data.translation ?? "");
  } catch (err: unknown) {
    console.error(err);
    setError(t("translator.errorGeneric"));
  } finally {
    setLoading(false);
  }
}

  const inputBase = `rounded-2xl px-3 py-2 text-sm outline-none ${theme.inputBg} ${theme.inputBorder} ${theme.inputText} ${theme.inputPlaceholder}`;

  return (
    <Card title={t("translator.title")} className="space-y-4">
      <p className={`text-xs sm:text-sm opacity-80 ${theme.mutedText}`}>
        {t("translator.description")}
      </p>

      <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="flex-1">
          <label className="text-xs uppercase tracking-wide opacity-60">
            {t("translator.targetLabel")}
          </label>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value)}
            className={`mt-1 w-full rounded-xl text-sm outline-none ${theme.inputBg} ${theme.inputBorder} ${theme.inputText}`}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.label}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={handleTranslate}
          disabled={loading || !text.trim()}
          className={`mt-1 sm:mt-6 inline-flex items-center justify-center rounded-xl px-4 py-2 text-sm font-semibold bg-gradient-to-r ${theme.accent} disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {loading ? t("translator.buttonLoading") : t("translator.buttonIdle")}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Input */}
        <div className="flex flex-col gap-2">
          <label className="text-xs uppercase tracking-wide opacity-60">
            {t("translator.originalLabel")}
          </label>
          <textarea
            rows={6}
            className={`${inputBase} resize-none`}
            placeholder={t("translator.placeholder")}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
        </div>

        {/* Output */}
        <div className="flex flex-col gap-2">
          <label className="text-xs uppercase tracking-wide opacity-60">
            {t("translator.translationLabel")}
          </label>
          <div
            className={`min-h-[150px] rounded-2xl px-3 py-2 text-sm ${theme.surfaceSubtle} ${theme.inputBorder} ${theme.inputText}`}
          >
            {error && (
              <div className="text-xs text-red-400 mb-1">{error}</div>
            )}
            {translated ? (
              <p className="whitespace-pre-wrap">{translated}</p>
            ) : (
              <p className="opacity-60 text-xs">{t("translator.emptyState")}</p>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
