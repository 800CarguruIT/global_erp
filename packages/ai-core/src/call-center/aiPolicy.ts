import { getSql } from "../db";

export type CallAiDecision = "disabled" | "allow_ai" | "block" | "escalate" | "no_company";
export type CallAiMode = "dry_run" | "live";

export type CompanyCallAiPolicy = {
  companyId: string;
  enabled: boolean;
  mode: CallAiMode;
  timezone: string;
  businessHours: {
    enabled: boolean;
    start: string;
    end: string;
    days: number[];
  };
  restrictions: {
    blockUnknownNumbers: boolean;
    blockedPrefixes: string[];
    allowedPrefixes: string[];
  };
  guidance: {
    welcomeMessage: string;
    systemPrompt: string;
    escalationKeywords: string[];
    automationEnabled: boolean;
    simulationMode: boolean;
  };
  updatedByUserId: string | null;
  updatedAt: string;
};

type PolicyRow = {
  company_id: string;
  enabled: boolean;
  mode: string;
  timezone: string;
  business_hours: Record<string, unknown>;
  restrictions: Record<string, unknown>;
  guidance: Record<string, unknown>;
  updated_by_user_id: string | null;
  updated_at: string;
};

type EvaluateInput = {
  companyId: string | null | undefined;
  providerKey: string;
  providerCallId: string;
  fromNumber?: string | null;
  toNumber?: string | null;
  rawPayload?: unknown;
};

export type EvaluatedCallAiDecision = {
  decision: CallAiDecision;
  reason: string;
  mode: CallAiMode;
  matchedRule: string | null;
  details: Record<string, unknown>;
  policy: CompanyCallAiPolicy | null;
};

function toStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((v) => String(v ?? "").trim())
    .filter(Boolean);
}

function toNumberArray(input: unknown): number[] {
  if (!Array.isArray(input)) return [];
  return input
    .map((v) => Number(v))
    .filter((v) => Number.isFinite(v));
}

function cleanPrefix(prefix: string): string {
  return prefix.trim().replace(/[^\d+]/g, "");
}

function normalizePhone(value?: string | null): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const hasPlus = raw.startsWith("+");
  const digits = raw.replace(/\D+/g, "");
  if (!digits) return null;
  return hasPlus ? `+${digits}` : digits;
}

function isUnknownCaller(value?: string | null): boolean {
  const normalized = normalizePhone(value);
  if (!normalized) return true;
  const digits = normalized.replace(/\D+/g, "");
  return digits.length < 7;
}

function phoneMatchesAnyPrefix(phone: string | null, prefixes: string[]): boolean {
  if (!phone) return false;
  const normalizedPhone = phone.startsWith("+") ? phone : `+${phone}`;
  for (const raw of prefixes) {
    const p = cleanPrefix(raw);
    if (!p) continue;
    if (normalizedPhone.startsWith(p) || normalizedPhone.startsWith(`+${p}`)) return true;
  }
  return false;
}

function localWeekdayAndTime(now: Date, timezone: string): { weekday: number; hhmm: string } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const weekdayText = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  const dayMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return { weekday: dayMap[weekdayText] ?? 1, hhmm: `${hour}:${minute}` };
}

function parsePolicy(row: PolicyRow): CompanyCallAiPolicy {
  const bh = row.business_hours ?? {};
  const rs = row.restrictions ?? {};
  const gd = row.guidance ?? {};
  return {
    companyId: row.company_id,
    enabled: Boolean(row.enabled),
    mode: row.mode === "live" ? "live" : "dry_run",
    timezone: String(row.timezone || "Asia/Dubai"),
    businessHours: {
      enabled: Boolean(bh.enabled),
      start: String(bh.start ?? "09:00"),
      end: String(bh.end ?? "18:00"),
      days: toNumberArray(bh.days).length ? toNumberArray(bh.days) : [1, 2, 3, 4, 5],
    },
    restrictions: {
      blockUnknownNumbers: Boolean(rs.blockUnknownNumbers),
      blockedPrefixes: toStringArray(rs.blockedPrefixes),
      allowedPrefixes: toStringArray(rs.allowedPrefixes),
    },
    guidance: {
      welcomeMessage: String(gd.welcomeMessage ?? ""),
      systemPrompt: String(gd.systemPrompt ?? ""),
      escalationKeywords: toStringArray(gd.escalationKeywords),
      automationEnabled: Boolean(gd.automationEnabled),
      simulationMode: gd.simulationMode === undefined ? true : Boolean(gd.simulationMode),
    },
    updatedByUserId: row.updated_by_user_id,
    updatedAt: row.updated_at,
  };
}

export async function getCompanyCallAiPolicy(
  companyId: string
): Promise<CompanyCallAiPolicy | null> {
  const sql = getSql();
  const rows = await sql<PolicyRow[]>`
    SELECT
      company_id,
      enabled,
      mode,
      timezone,
      business_hours,
      restrictions,
      guidance,
      updated_by_user_id,
      updated_at
    FROM company_call_ai_policy
    WHERE company_id = ${companyId}
    LIMIT 1
  `;
  const row = rows[0];
  return row ? parsePolicy(row) : null;
}

export async function upsertCompanyCallAiPolicy(input: {
  companyId: string;
  enabled?: boolean;
  mode?: CallAiMode;
  timezone?: string;
  businessHours?: Record<string, unknown>;
  restrictions?: Record<string, unknown>;
  guidance?: Record<string, unknown>;
  updatedByUserId?: string | null;
}): Promise<CompanyCallAiPolicy | null> {
  const sql = getSql();
  await sql`
    INSERT INTO company_call_ai_policy (
      company_id,
      enabled,
      mode,
      timezone,
      business_hours,
      restrictions,
      guidance,
      updated_by_user_id
    ) VALUES (
      ${input.companyId},
      ${input.enabled ?? false},
      ${input.mode ?? "dry_run"},
      ${String(input.timezone ?? "Asia/Dubai")},
      ${(
        input.businessHours ?? { enabled: false, start: "09:00", end: "18:00", days: [1, 2, 3, 4, 5] }
      ) as any}::jsonb,
      ${(
        input.restrictions ?? { blockUnknownNumbers: false, blockedPrefixes: [], allowedPrefixes: [] }
      ) as any}::jsonb,
      ${(
        input.guidance ?? {
          welcomeMessage: "",
          systemPrompt: "",
          escalationKeywords: [],
          automationEnabled: false,
          simulationMode: true,
        }
      ) as any}::jsonb,
      ${input.updatedByUserId ?? null}
    )
    ON CONFLICT (company_id) DO UPDATE
    SET
      enabled = EXCLUDED.enabled,
      mode = EXCLUDED.mode,
      timezone = EXCLUDED.timezone,
      business_hours = EXCLUDED.business_hours,
      restrictions = EXCLUDED.restrictions,
      guidance = EXCLUDED.guidance,
      updated_by_user_id = EXCLUDED.updated_by_user_id,
      updated_at = now()
  `;
  return getCompanyCallAiPolicy(input.companyId);
}

export async function evaluateInboundCallAiPolicy(
  input: EvaluateInput
): Promise<EvaluatedCallAiDecision> {
  const companyId = String(input.companyId ?? "").trim();
  if (!companyId) {
    return {
      decision: "no_company",
      reason: "No company scope on inbound call",
      mode: "dry_run",
      matchedRule: null,
      details: {},
      policy: null,
    };
  }

  const policy = await getCompanyCallAiPolicy(companyId);
  if (!policy || !policy.enabled) {
    return {
      decision: "disabled",
      reason: "Company call AI policy disabled",
      mode: policy?.mode ?? "dry_run",
      matchedRule: "policy.disabled",
      details: {},
      policy: policy ?? null,
    };
  }

  const now = new Date();
  const normalizedFrom = normalizePhone(input.fromNumber);

  if (policy.businessHours.enabled) {
    const local = localWeekdayAndTime(now, policy.timezone);
    const inDay = policy.businessHours.days.includes(local.weekday);
    const inTime = local.hhmm >= policy.businessHours.start && local.hhmm <= policy.businessHours.end;
    if (!inDay || !inTime) {
      return {
        decision: "block",
        reason: "Outside configured business hours",
        mode: policy.mode,
        matchedRule: "business_hours.block",
        details: {
          weekday: local.weekday,
          hhmm: local.hhmm,
          allowedDays: policy.businessHours.days,
          start: policy.businessHours.start,
          end: policy.businessHours.end,
        },
        policy,
      };
    }
  }

  if (policy.restrictions.blockUnknownNumbers && isUnknownCaller(normalizedFrom)) {
    return {
      decision: "block",
      reason: "Unknown caller blocked by policy",
      mode: policy.mode,
      matchedRule: "restrictions.block_unknown",
      details: {},
      policy,
    };
  }

  if (
    policy.restrictions.blockedPrefixes.length > 0 &&
    phoneMatchesAnyPrefix(normalizedFrom, policy.restrictions.blockedPrefixes)
  ) {
    return {
      decision: "block",
      reason: "Caller matched blocked prefix",
      mode: policy.mode,
      matchedRule: "restrictions.blocked_prefix",
      details: {
        blockedPrefixes: policy.restrictions.blockedPrefixes,
      },
      policy,
    };
  }

  if (
    policy.restrictions.allowedPrefixes.length > 0 &&
    !phoneMatchesAnyPrefix(normalizedFrom, policy.restrictions.allowedPrefixes)
  ) {
    return {
      decision: "escalate",
      reason: "Caller outside allowed prefixes",
      mode: policy.mode,
      matchedRule: "restrictions.allowed_prefix",
      details: {
        allowedPrefixes: policy.restrictions.allowedPrefixes,
      },
      policy,
    };
  }

  return {
    decision: "allow_ai",
    reason: "Matched policy for AI handling",
    mode: policy.mode,
    matchedRule: "default.allow_ai",
    details: {},
    policy,
  };
}

export async function logCallAiPolicyDecision(input: {
  companyId?: string | null;
  providerKey: string;
  providerCallId: string;
  fromNumber?: string | null;
  toNumber?: string | null;
  decision: CallAiDecision;
  reason: string;
  mode?: CallAiMode;
  matchedRule?: string | null;
  details?: Record<string, unknown>;
}) {
  const sql = getSql();
  await sql`
    INSERT INTO call_ai_policy_decisions (
      company_id,
      provider_key,
      provider_call_id,
      from_number,
      to_number,
      decision,
      reason,
      mode,
      matched_rule,
      details
    ) VALUES (
      ${input.companyId ?? null},
      ${input.providerKey},
      ${input.providerCallId},
      ${input.fromNumber ?? null},
      ${input.toNumber ?? null},
      ${input.decision},
      ${input.reason},
      ${input.mode ?? "dry_run"},
      ${input.matchedRule ?? null},
      ${(input.details ?? {}) as any}::jsonb
    )
  `;
}
