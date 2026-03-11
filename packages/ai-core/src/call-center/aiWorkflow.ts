import { createLead, getLeadById, updateLeadPartial } from "../crm/leads/repository";
import type { LeadStatus } from "../crm/leads/types";
import { getSql } from "../db";

export type CallAiInquiryStatus = "new" | "qualified" | "converted" | "dropped";
export type CallAiConversionStatus = "not_converted" | "converted" | "failed";
export type CallAiLeadOutcome = "appointment" | "walkin_service_request" | "lost_lead";
export type CallAiWorkflowStepKey = "inquiry" | "lead_conversion" | "lead_outcome";
export type CallAiWorkflowStepStatus = "simulated" | "executed" | "failed";

export type CallAiWorkflowStep = {
  key: CallAiWorkflowStepKey;
  action: string;
  status: CallAiWorkflowStepStatus;
  payload: Record<string, unknown>;
  error?: string | null;
};

export type CallAiWorkflowResult = {
  enabled: true;
  simulationMode: boolean;
  currentStage: "inquiry" | "lead_conversion" | "lead_outcome";
  inquiryId: string | null;
  leadId: string | null;
  inferredOutcome: CallAiLeadOutcome | null;
  steps: CallAiWorkflowStep[];
};

export type CallAiInquiry = {
  id: string;
  companyId: string;
  providerKey: string;
  providerCallId: string;
  fromNumber: string | null;
  toNumber: string | null;
  inquiryStatus: CallAiInquiryStatus;
  inquirySummary: string | null;
  aiPayload: Record<string, unknown>;
  convertedToLeadId: string | null;
  conversionStatus: CallAiConversionStatus;
  convertedAt: string | null;
  leadOutcome: CallAiLeadOutcome | null;
  outcomeReason: string | null;
  outcomeAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type CreateOrGetInquiryInput = {
  companyId: string;
  providerKey: string;
  providerCallId: string;
  fromNumber?: string | null;
  toNumber?: string | null;
  inquirySummary?: string | null;
  aiPayload?: Record<string, unknown> | null;
};

type ConvertInquiryToLeadInput = {
  inquiryId: string;
  source?: string | null;
  leadType?: "rsa" | "recovery" | "workshop";
  leadStage?: string | null;
};

type SetInquiryOutcomeInput = {
  inquiryId: string;
  leadOutcome: CallAiLeadOutcome;
  outcomeReason?: string | null;
};

type CustomerPhoneMatch = {
  id: string;
  name: string | null;
  phone: string | null;
};

function normalizePhoneDigits(value?: string | null): string {
  return String(value ?? "").replace(/\D+/g, "");
}

function stripLeadingZeros(value: string): string {
  return value.replace(/^0+/, "");
}

function buildPhoneSearchCandidates(rawPhone?: string | null): string[] {
  const digits = normalizePhoneDigits(rawPhone);
  if (!digits) return [];

  const set = new Set<string>();
  const add = (candidate: string) => {
    const normalized = stripLeadingZeros(normalizePhoneDigits(candidate));
    if (normalized) set.add(normalized);
  };

  add(digits);

  // UAE-ish transforms:
  // local 05xxxxxxxx <-> intl 9715xxxxxxxx and raw without leading 0.
  if (digits.startsWith("0") && digits.length >= 9) {
    add(digits.slice(1));
    add(`971${digits.slice(1)}`);
  }
  if (digits.startsWith("971") && digits.length >= 11) {
    const localNoZero = digits.slice(3);
    add(localNoZero);
    add(`0${localNoZero}`);
  }
  if (!digits.startsWith("0") && !digits.startsWith("971") && digits.length >= 8) {
    add(`0${digits}`);
    add(`971${digits}`);
  }

  return Array.from(set);
}

function buildPhoneSuffixCandidates(rawPhone?: string | null): string[] {
  const candidates = buildPhoneSearchCandidates(rawPhone);
  const suffixes = new Set<string>();
  for (const candidate of candidates) {
    const digits = normalizePhoneDigits(candidate);
    if (digits.length >= 9) suffixes.add(digits.slice(-9));
  }
  return Array.from(suffixes);
}

async function findExistingCustomerByPhone(companyId: string, rawPhone?: string | null): Promise<CustomerPhoneMatch | null> {
  const candidates = buildPhoneSearchCandidates(rawPhone);
  const suffixCandidates = buildPhoneSuffixCandidates(rawPhone);
  if (!candidates.length) return null;

  const sql = getSql();
  const rows = await sql<{
    id: string;
    name: string | null;
    phone: string | null;
  }[]>`
    SELECT id, name, phone
    FROM customers
    WHERE company_id = ${companyId}
      AND (
        ltrim(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), '0') = ANY(${candidates}::text[])
        OR ltrim(regexp_replace(COALESCE(phone_alt, ''), '\D', '', 'g'), '0') = ANY(${candidates}::text[])
        OR ltrim(regexp_replace(COALESCE(whatsapp_phone, ''), '\D', '', 'g'), '0') = ANY(${candidates}::text[])
        OR right(ltrim(regexp_replace(COALESCE(phone, ''), '\D', '', 'g'), '0'), 9) = ANY(${suffixCandidates}::text[])
        OR right(ltrim(regexp_replace(COALESCE(phone_alt, ''), '\D', '', 'g'), '0'), 9) = ANY(${suffixCandidates}::text[])
        OR right(ltrim(regexp_replace(COALESCE(whatsapp_phone, ''), '\D', '', 'g'), '0'), 9) = ANY(${suffixCandidates}::text[])
      )
    ORDER BY updated_at DESC
    LIMIT 1
  `;

  const row = rows?.[0];
  if (!row) return null;
  return {
    id: String(row.id),
    name: row.name ? String(row.name) : null,
    phone: row.phone ? String(row.phone) : null,
  };
}

function mapInquiryRow(row: any): CallAiInquiry {
  return {
    id: String(row.id),
    companyId: String(row.company_id),
    providerKey: String(row.provider_key),
    providerCallId: String(row.provider_call_id),
    fromNumber: row.from_number ? String(row.from_number) : null,
    toNumber: row.to_number ? String(row.to_number) : null,
    inquiryStatus: String(row.inquiry_status) as CallAiInquiryStatus,
    inquirySummary: row.inquiry_summary ? String(row.inquiry_summary) : null,
    aiPayload: (row.ai_payload ?? {}) as Record<string, unknown>,
    convertedToLeadId: row.converted_to_lead_id ? String(row.converted_to_lead_id) : null,
    conversionStatus: String(row.conversion_status) as CallAiConversionStatus,
    convertedAt: row.converted_at ? new Date(row.converted_at).toISOString() : null,
    leadOutcome: row.lead_outcome ? (String(row.lead_outcome) as CallAiLeadOutcome) : null,
    outcomeReason: row.outcome_reason ? String(row.outcome_reason) : null,
    outcomeAt: row.outcome_at ? new Date(row.outcome_at).toISOString() : null,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

function inferLeadOutcomeFromAiText(aiReply?: string | null): CallAiLeadOutcome {
  const text = String(aiReply ?? "").trim().toLowerCase();
  if (!text) return "appointment";
  if (text.includes("walk in") || text.includes("walkin")) return "walkin_service_request";
  if (text.includes("appointment") || text.includes("book") || text.includes("schedule")) {
    return "appointment";
  }
  return "appointment";
}

function randomLeadOutcome(): CallAiLeadOutcome {
  const outcomes: CallAiLeadOutcome[] = ["appointment", "walkin_service_request", "lost_lead"];
  const idx = Math.floor(Math.random() * outcomes.length);
  return outcomes[idx] ?? "appointment";
}

function getSimulationScenario(): "default" | "recovery_appointment" {
  const raw = String(process.env.CALL_AI_SIM_SCENARIO ?? "")
    .trim()
    .toLowerCase();
  if (raw === "recovery_appointment") return "recovery_appointment";
  return "default";
}

function leadPatchForOutcome(outcome: CallAiLeadOutcome): {
  leadStatus: LeadStatus;
  leadStage: string;
} {
  switch (outcome) {
    case "lost_lead":
      return { leadStatus: "lost", leadStage: "cancelled" };
    case "walkin_service_request":
      return { leadStatus: "open", leadStage: "processing" };
    case "appointment":
    default:
      return { leadStatus: "accepted", leadStage: "follow_up" };
  }
}

async function ensurePickupRecoveryRequestForLead(args: {
  leadId: string;
  pickupLocation?: string | null;
  dropoffLocation?: string | null;
  remarks?: string | null;
}): Promise<string | null> {
  const sql = getSql();
  const existingRows = await sql<{ id: string }[]>`
    SELECT id
    FROM recovery_requests
    WHERE lead_id = ${args.leadId}
      AND type = 'pickup'
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (existingRows?.[0]?.id) {
    return String(existingRows[0].id);
  }

  const rows = await sql<{ id: string }[]>`
    INSERT INTO recovery_requests (
      lead_id,
      pickup_location,
      dropoff_location,
      type,
      remarks,
      status,
      stage
    )
    VALUES (
      ${args.leadId},
      ${args.pickupLocation ?? null},
      ${args.dropoffLocation ?? null},
      'pickup',
      ${args.remarks ?? null},
      'Pending',
      'New'
    )
    RETURNING id
  `;
  return rows?.[0]?.id ? String(rows[0].id) : null;
}

export async function getInquiryByProviderCall(input: {
  companyId: string;
  providerKey: string;
  providerCallId: string;
}): Promise<CallAiInquiry | null> {
  const sql = getSql();
  const rows = await sql<any[]>`
    SELECT *
    FROM call_ai_inquiries
    WHERE company_id = ${input.companyId}
      AND provider_key = ${input.providerKey}
      AND provider_call_id = ${input.providerCallId}
    LIMIT 1
  `;
  const row = rows[0];
  return row ? mapInquiryRow(row) : null;
}

export async function createOrGetInquiryFromCall(input: CreateOrGetInquiryInput): Promise<CallAiInquiry> {
  const sql = getSql();
  const normalizedFromNumber = normalizePhoneDigits(input.fromNumber ?? null);
  const customerMatch = await findExistingCustomerByPhone(input.companyId, input.fromNumber ?? null);
  const payload = {
    ...(input.aiPayload ?? {}),
    phoneNormalization: {
      raw: input.fromNumber ?? null,
      digits: normalizedFromNumber || null,
      searchCandidates: buildPhoneSearchCandidates(input.fromNumber ?? null),
    },
    customerMatch: customerMatch
      ? {
          exists: true,
          customerId: customerMatch.id,
          customerName: customerMatch.name,
          customerPhone: customerMatch.phone,
          matchedAt: new Date().toISOString(),
        }
      : {
          exists: false,
          matchedAt: new Date().toISOString(),
        },
  } as Record<string, unknown>;

  const rows = await sql<any[]>`
    INSERT INTO call_ai_inquiries (
      company_id,
      provider_key,
      provider_call_id,
      from_number,
      to_number,
      inquiry_status,
      inquiry_summary,
      ai_payload
    ) VALUES (
      ${input.companyId},
      ${input.providerKey},
      ${input.providerCallId},
      ${input.fromNumber ?? null},
      ${input.toNumber ?? null},
      'new',
      ${input.inquirySummary ?? null},
      ${payload as any}::jsonb
    )
    ON CONFLICT (company_id, provider_key, provider_call_id)
    DO UPDATE SET
      from_number = COALESCE(EXCLUDED.from_number, call_ai_inquiries.from_number),
      to_number = COALESCE(EXCLUDED.to_number, call_ai_inquiries.to_number),
      inquiry_summary = COALESCE(EXCLUDED.inquiry_summary, call_ai_inquiries.inquiry_summary),
      ai_payload = call_ai_inquiries.ai_payload || EXCLUDED.ai_payload,
      updated_at = now()
    RETURNING *
  `;
  return mapInquiryRow(rows[0]);
}

export async function convertInquiryToLead(input: ConvertInquiryToLeadInput): Promise<{
  inquiry: CallAiInquiry;
  leadId: string;
}> {
  const sql = getSql();
  const inquiryRows = await sql<any[]>`
    SELECT *
    FROM call_ai_inquiries
    WHERE id = ${input.inquiryId}
    LIMIT 1
  `;
  const inquiryRow = inquiryRows[0];
  if (!inquiryRow) {
    throw new Error("Inquiry not found");
  }
  const inquiry = mapInquiryRow(inquiryRow);
  if (inquiry.convertedToLeadId) {
    return { inquiry, leadId: inquiry.convertedToLeadId };
  }

  try {
    const lead = await createLead({
      companyId: inquiry.companyId,
      leadType: input.leadType ?? "workshop",
      source: input.source ?? "call",
      leadStage: input.leadStage ?? "new",
    });

    const updateRows = await sql<any[]>`
      UPDATE call_ai_inquiries
      SET
        converted_to_lead_id = ${lead.id},
        conversion_status = 'converted',
        inquiry_status = 'converted',
        converted_at = now(),
        updated_at = now()
      WHERE id = ${inquiry.id}
      RETURNING *
    `;
    return { inquiry: mapInquiryRow(updateRows[0]), leadId: lead.id };
  } catch (err: any) {
    await sql`
      UPDATE call_ai_inquiries
      SET
        conversion_status = 'failed',
        updated_at = now()
      WHERE id = ${inquiry.id}
    `;
    throw new Error(err?.message ?? "Failed to convert inquiry to lead");
  }
}

export async function setInquiryLeadOutcome(input: SetInquiryOutcomeInput): Promise<CallAiInquiry> {
  const sql = getSql();
  const inquiryRows = await sql<any[]>`
    SELECT *
    FROM call_ai_inquiries
    WHERE id = ${input.inquiryId}
    LIMIT 1
  `;
  const inquiryRow = inquiryRows[0];
  if (!inquiryRow) {
    throw new Error("Inquiry not found");
  }
  const inquiry = mapInquiryRow(inquiryRow);

  if (inquiry.convertedToLeadId) {
    const patch = leadPatchForOutcome(input.leadOutcome);
    await updateLeadPartial(inquiry.companyId, inquiry.convertedToLeadId, patch);
  }

  const outcomeStatus: CallAiInquiryStatus =
    input.leadOutcome === "lost_lead" ? "dropped" : "converted";
  const rows = await sql<any[]>`
    UPDATE call_ai_inquiries
    SET
      lead_outcome = ${input.leadOutcome},
      outcome_reason = ${input.outcomeReason ?? null},
      outcome_at = now(),
      inquiry_status = ${outcomeStatus},
      updated_at = now()
    WHERE id = ${input.inquiryId}
    RETURNING *
  `;
  return mapInquiryRow(rows[0]);
}

export async function runCallAiWorkflow(input: {
  companyId: string;
  providerKey: string;
  providerCallId: string;
  fromNumber?: string | null;
  toNumber?: string | null;
  aiReply?: string | null;
  simulationMode: boolean;
  leadOutcome?: CallAiLeadOutcome | null;
  inquiryOnly?: boolean;
}): Promise<CallAiWorkflowResult> {
  if (input.simulationMode) {
    const steps: CallAiWorkflowStep[] = [];
    let inquiryId: string | null = null;
    let leadId: string | null = null;
    const scenario = getSimulationScenario();
    const simulatedLeadType: "recovery" | "workshop" =
      scenario === "recovery_appointment" ? "recovery" : "workshop";
    const existing = await getInquiryByProviderCall({
      companyId: input.companyId,
      providerKey: input.providerKey,
      providerCallId: input.providerCallId,
    }).catch(() => null);
    const inferredOutcome =
      input.leadOutcome ??
      existing?.leadOutcome ??
      (scenario === "recovery_appointment" ? "appointment" : randomLeadOutcome()) ??
      inferLeadOutcomeFromAiText(input.aiReply);

    try {
      const inquiry = await createOrGetInquiryFromCall({
        companyId: input.companyId,
        providerKey: input.providerKey,
        providerCallId: input.providerCallId,
        fromNumber: input.fromNumber ?? null,
        toNumber: input.toNumber ?? null,
        inquirySummary: input.aiReply ?? null,
        aiPayload: {
          phase: "phase2",
          source: "webhook",
          simulationMode: true,
          simulatedAt: new Date().toISOString(),
        },
      });
      inquiryId = inquiry.id;
      steps.push({
        key: "inquiry",
        action: "create_inquiry",
        status: "executed",
        payload: {
          providerCallId: input.providerCallId,
          callerNumber: input.fromNumber ?? null,
          targetNumber: input.toNumber ?? null,
          summary: input.aiReply ?? null,
          inquiryId,
          persisted: true,
          simulation: true,
          scenario,
        },
      });
    } catch (err: any) {
      steps.push({
        key: "inquiry",
        action: "create_inquiry",
        status: "failed",
        payload: {},
        error: err?.message ?? "Failed to persist simulation inquiry",
      });
      return {
        enabled: true,
        simulationMode: true,
        currentStage: "inquiry",
        inquiryId,
        leadId,
        inferredOutcome,
        steps,
      };
    }

    if (input.inquiryOnly) {
      return {
        enabled: true,
        simulationMode: true,
        currentStage: "inquiry",
        inquiryId,
        leadId,
        inferredOutcome,
        steps,
      };
    }

    try {
      const converted = await convertInquiryToLead({
        inquiryId: inquiryId!,
        source: "call_ai_simulation",
        leadType: simulatedLeadType,
        leadStage: "new",
      });
      leadId = converted.leadId;
      steps.push({
        key: "lead_conversion",
        action: "convert_inquiry_to_lead",
        status: "executed",
        payload: {
          inquiryId: inquiryId!,
          leadId: converted.leadId,
          simulation: true,
          leadType: simulatedLeadType,
          scenario,
        },
      });
    } catch (err: any) {
      steps.push({
        key: "lead_conversion",
        action: "convert_inquiry_to_lead",
        status: "failed",
        payload: { inquiryId: inquiryId!, simulation: true },
        error: err?.message ?? "Failed to convert simulation inquiry",
      });
      return {
        enabled: true,
        simulationMode: true,
        currentStage: "lead_conversion",
        inquiryId,
        leadId,
        inferredOutcome,
        steps,
      };
    }

  try {
    const outcome = await setInquiryLeadOutcome({
      inquiryId: inquiryId!,
      leadOutcome: inferredOutcome,
      outcomeReason: "Simulation randomized outcome",
    });
    let recoveryRequestId: string | null = null;
    if (leadId && inferredOutcome === "appointment") {
      const lead = await getLeadById(input.companyId, leadId).catch(() => null);
      if (lead?.leadType === "recovery") {
        recoveryRequestId = await ensurePickupRecoveryRequestForLead({
          leadId,
          pickupLocation: lead.pickupFrom ?? input.fromNumber ?? null,
          dropoffLocation: lead.dropoffTo ?? null,
          remarks: "Auto-created from AI simulation workflow (appointment)",
        }).catch(() => null);
      }
    }
    steps.push({
      key: "lead_outcome",
      action: "set_lead_outcome",
      status: "executed",
      payload: {
        inquiryId: inquiryId!,
        leadId,
        leadOutcome: outcome.leadOutcome,
        simulation: true,
        scenario,
        recoveryRequestId,
      },
    });
  } catch (err: any) {
      steps.push({
        key: "lead_outcome",
        action: "set_lead_outcome",
        status: "failed",
        payload: {
          inquiryId: inquiryId!,
          leadId,
          leadOutcome: inferredOutcome,
          simulation: true,
        },
        error: err?.message ?? "Failed to set simulation outcome",
      });
      return {
        enabled: true,
        simulationMode: true,
        currentStage: "lead_outcome",
        inquiryId,
        leadId,
        inferredOutcome,
        steps,
      };
    }

    return {
      enabled: true,
      simulationMode: true,
      currentStage: "lead_outcome",
      inquiryId,
      leadId,
      inferredOutcome,
      steps,
    };
  }

  const steps: CallAiWorkflowStep[] = [];
  let inquiryId: string | null = null;
  let leadId: string | null = null;
  const inferredOutcome = input.leadOutcome ?? inferLeadOutcomeFromAiText(input.aiReply);

  try {
    const inquiry = await createOrGetInquiryFromCall({
      companyId: input.companyId,
      providerKey: input.providerKey,
      providerCallId: input.providerCallId,
      fromNumber: input.fromNumber ?? null,
      toNumber: input.toNumber ?? null,
      inquirySummary: input.aiReply ?? null,
      aiPayload: {
        phase: "phase2",
        source: "webhook",
      },
    });
    inquiryId = inquiry.id;
    steps.push({
      key: "inquiry",
      action: "create_inquiry",
      status: "executed",
      payload: { inquiryId: inquiry.id },
    });
  } catch (err: any) {
    steps.push({
      key: "inquiry",
      action: "create_inquiry",
      status: "failed",
      payload: {},
      error: err?.message ?? "Failed to create inquiry",
    });
    return {
      enabled: true,
      simulationMode: false,
      currentStage: "inquiry",
      inquiryId,
      leadId,
      inferredOutcome,
      steps,
    };
  }

  if (input.inquiryOnly) {
    return {
      enabled: true,
      simulationMode: false,
      currentStage: "inquiry",
      inquiryId,
      leadId,
      inferredOutcome,
      steps,
    };
  }

  try {
    const converted = await convertInquiryToLead({
      inquiryId: inquiryId!,
      source: "call_ai",
      leadType: "workshop",
      leadStage: "new",
    });
    leadId = converted.leadId;
    steps.push({
      key: "lead_conversion",
      action: "convert_inquiry_to_lead",
      status: "executed",
      payload: {
        inquiryId: inquiryId!,
        leadId: converted.leadId,
      },
    });
  } catch (err: any) {
    steps.push({
      key: "lead_conversion",
      action: "convert_inquiry_to_lead",
      status: "failed",
      payload: { inquiryId: inquiryId! },
      error: err?.message ?? "Failed to convert inquiry",
    });
    return {
      enabled: true,
      simulationMode: false,
      currentStage: "lead_conversion",
      inquiryId,
      leadId,
      inferredOutcome,
      steps,
    };
  }

  try {
    const outcome = await setInquiryLeadOutcome({
      inquiryId: inquiryId!,
      leadOutcome: inferredOutcome,
      outcomeReason: "Auto outcome from AI workflow",
    });
    let recoveryRequestId: string | null = null;
    if (leadId && inferredOutcome === "appointment") {
      const lead = await getLeadById(input.companyId, leadId).catch(() => null);
      if (lead?.leadType === "recovery") {
        recoveryRequestId = await ensurePickupRecoveryRequestForLead({
          leadId,
          pickupLocation: lead.pickupFrom ?? input.fromNumber ?? null,
          dropoffLocation: lead.dropoffTo ?? null,
          remarks: "Auto-created from AI workflow (appointment)",
        }).catch(() => null);
      }
    }
    steps.push({
      key: "lead_outcome",
      action: "set_lead_outcome",
      status: "executed",
      payload: {
        inquiryId: inquiryId!,
        leadId,
        leadOutcome: outcome.leadOutcome,
        recoveryRequestId,
      },
    });
  } catch (err: any) {
    steps.push({
      key: "lead_outcome",
      action: "set_lead_outcome",
      status: "failed",
      payload: {
        inquiryId: inquiryId!,
        leadId,
        leadOutcome: inferredOutcome,
      },
      error: err?.message ?? "Failed to set lead outcome",
    });
    return {
      enabled: true,
      simulationMode: false,
      currentStage: "lead_outcome",
      inquiryId,
      leadId,
      inferredOutcome,
      steps,
    };
  }

  return {
    enabled: true,
    simulationMode: false,
    currentStage: "lead_outcome",
    inquiryId,
    leadId,
    inferredOutcome,
    steps,
  };
}
