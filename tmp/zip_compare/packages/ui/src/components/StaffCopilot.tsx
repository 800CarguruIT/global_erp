"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTheme } from "../theme";

// ── Types ──────────────────────────────────────────

interface CopilotMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
}

interface CopilotProps {
  companyId: string;
  currentPage?: string;
  branchId?: string;
  lang?: string;
  onNavigate?: (href: string) => void;
}

// ── Quick Actions ──────────────────────────────────

const QUICK_ACTIONS = [
  { label: "Summarize today", prompt: "Give me a quick summary of today's activity — leads, calls, jobs, any alerts." },
  { label: "What needs attention?", prompt: "What are the most urgent things I should look at right now?" },
  { label: "Revenue update", prompt: "How is revenue trending this month compared to last month?" },
  { label: "Stale leads", prompt: "Are there any leads that have been sitting too long without follow-up?" },
  { label: "Inventory alerts", prompt: "Are there any inventory items that are low or out of stock?" },
  { label: "Workshop status", prompt: "What's the current workshop status? Bay utilization, active jobs, bottlenecks?" },
];

// ── Component ──────────────────────────────────────

export function StaffCopilot({ companyId, currentPage, branchId, lang = "en", onNavigate }: CopilotProps) {
  const { theme } = useTheme();
  const isLight = theme.id === "light";
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    if (open && inputRef.current) {
      inputRef.current.focus();
    }
  }, [open]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || loading) return;

      const userMsg: CopilotMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text.trim(),
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setLoading(true);

      try {
        const params = new URLSearchParams({
          page: currentPage ?? "company-dashboard",
          lang,
        });
        if (branchId) params.set("branchId", branchId);

        const insightsRes = await fetch(`/api/company/${companyId}/ai/insights?${params}`, { cache: "no-store" });
        const insightsData = insightsRes.ok ? await insightsRes.json() : null;

        const res = await fetch(`/api/company/${companyId}/ai/copilot`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text.trim(),
            context: {
              page: currentPage,
              branchId,
              insights: insightsData?.insights?.slice(0, 4) ?? [],
              kpis: insightsData?.kpis?.slice(0, 6) ?? [],
            },
            history: messages.slice(-8).map((m) => ({ role: m.role, content: m.content })),
            lang,
          }),
        });

        const data = res.ok ? await res.json() : null;

        const assistantMsg: CopilotMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: data?.reply ?? "Sorry, I couldn't process that right now. Please try again.",
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            content: "Connection error. Please check your network and try again.",
            timestamp: Date.now(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [companyId, currentPage, branchId, lang, loading, messages]
  );

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-110 ${
          isLight
            ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-violet-500/30"
            : "bg-gradient-to-br from-violet-600 to-fuchsia-500 text-white shadow-violet-500/40"
        }`}
        title="Open AI Copilot"
      >
        <svg width="24" height="24" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
        </svg>
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 w-[380px] sm:w-[420px] max-h-[600px] rounded-2xl shadow-2xl flex flex-col overflow-hidden ${
        isLight
          ? "bg-white border border-gray-200"
          : "bg-slate-900/95 backdrop-blur-xl border border-white/10"
      }`}
    >
      {/* Header */}
      <div
        className={`flex items-center justify-between px-4 py-3 border-b ${
          isLight ? "border-gray-200 bg-gray-50" : "border-white/10 bg-slate-800/50"
        }`}
      >
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-sm font-semibold">AI Copilot</span>
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-violet-500/20 text-violet-300 font-medium">
            BETA
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMessages([])}
            className="p-1.5 text-xs text-muted-foreground hover:text-foreground transition rounded"
            title="Clear chat"
          >
            ⟳
          </button>
          <button
            onClick={() => setOpen(false)}
            className="p-1.5 text-xs text-muted-foreground hover:text-foreground transition rounded"
          >
            ✕
          </button>
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[200px] max-h-[400px]">
        {messages.length === 0 && (
          <div className="space-y-3">
            <div className="text-center space-y-1 py-4">
              <div className="text-sm font-medium">How can I help?</div>
              <div className="text-xs text-muted-foreground">
                Ask about your business data, get insights, or navigate the system.
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_ACTIONS.map((action) => (
                <button
                  key={action.label}
                  onClick={() => sendMessage(action.prompt)}
                  className={`text-left text-xs p-2.5 rounded-xl border transition hover:scale-[1.02] ${
                    isLight
                      ? "border-gray-200 bg-gray-50 hover:bg-gray-100"
                      : "border-white/10 bg-white/5 hover:bg-white/10"
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? isLight
                    ? "bg-violet-500 text-white rounded-br-md"
                    : "bg-violet-600 text-white rounded-br-md"
                  : isLight
                    ? "bg-gray-100 text-gray-900 rounded-bl-md"
                    : "bg-white/10 rounded-bl-md"
              }`}
            >
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div
              className={`rounded-2xl rounded-bl-md px-4 py-3 ${
                isLight ? "bg-gray-100" : "bg-white/10"
              }`}
            >
              <div className="flex gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div
        className={`px-3 py-3 border-t ${
          isLight ? "border-gray-200 bg-white" : "border-white/10 bg-slate-800/50"
        }`}
      >
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                sendMessage(input);
              }
            }}
            placeholder="Ask anything about your business..."
            disabled={loading}
            className={`flex-1 rounded-xl px-3.5 py-2.5 text-sm outline-none transition ${
              isLight
                ? "bg-gray-100 text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-violet-500/30"
                : "bg-white/10 text-white placeholder:text-white/40 focus:ring-2 focus:ring-violet-500/30"
            } disabled:opacity-50`}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || loading}
            className={`rounded-xl px-4 py-2.5 text-sm font-medium transition ${
              isLight
                ? "bg-violet-500 text-white hover:bg-violet-600 disabled:bg-gray-200 disabled:text-gray-400"
                : "bg-violet-600 text-white hover:bg-violet-500 disabled:bg-white/5 disabled:text-white/20"
            }`}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
