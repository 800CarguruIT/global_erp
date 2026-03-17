"use client";

import React from "react";
import { UserRiskBadge } from "./UserRiskBadge";

type Props = {
  user: { id: string; email: string; name?: string | null };
  risk?:
    | {
        risk_level?: "low" | "medium" | "high" | string | null;
        overall_risk_score?: number | null;
        last_evaluated_at?: string;
        total_active_sessions?: number;
        high_privilege_role_count?: number;
        has_global_admin_role?: boolean;
        unusual_location?: boolean;
        last_login_at?: string | null;
        last_login_country?: string | null;
      }
    | null;
};

export function UserMonitoringOverview({ user, risk }: Props) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 sm:p-5 space-y-2">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <div className="text-lg font-semibold">{user.name ?? user.email}</div>
          <div className="text-sm opacity-80">{user.email}</div>
        </div>
        <UserRiskBadge riskLevel={risk?.risk_level as any} score={risk?.overall_risk_score ?? undefined} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
        <Stat label="Score" value={risk?.overall_risk_score != null ? Math.round(risk.overall_risk_score).toString() : "—"} />
        <Stat
          label="Last evaluated"
          value={risk?.last_evaluated_at ? new Date(risk.last_evaluated_at).toLocaleString() : "—"}
        />
        <Stat label="Active sessions" value={risk?.total_active_sessions?.toString() ?? "—"} />
        <Stat label="High-privilege roles" value={risk?.high_privilege_role_count?.toString() ?? "—"} />
        <Stat label="Has global admin" value={risk?.has_global_admin_role ? "Yes" : "No"} />
        <Stat
          label="Last login"
          value={
            risk?.last_login_at
              ? `${new Date(risk.last_login_at).toLocaleString()} ${risk.last_login_country ?? ""}`.trim()
              : "—"
          }
        />
        <Stat label="Unusual location" value={risk?.unusual_location ? "Yes" : "No"} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 bg-white/5 rounded-xl p-3 border border-white/5">
      <span className="text-xs uppercase opacity-70">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  );
}
