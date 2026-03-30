import { getSql } from "../../db";
import { getConfig } from "../configRepository";
import { getAdvisorScores } from "../advisorRepository";
import * as repo from "./repository";
import type { LeadDistributionConfig, SimulationResult, SimulationStep } from "../types";

function getAcceptWindow(tier: number, config: LeadDistributionConfig): number {
  if (tier === 1) return config.tier1_accept_window_min;
  if (tier === 2) return config.tier2_accept_window_min;
  return config.tier3_accept_window_min;
}

function getTierForScore(score: number, eliteMin: number): number {
  if (score >= eliteMin) return 1;
  if (score >= eliteMin * 0.6) return 2;
  return 3;
}

export async function routeLead(companyId: string, leadId: string, pipelineValue: number = 0) {
  const config = await getConfig(companyId);
  const advisors = await getAdvisorScores(companyId);
  if (!advisors.length) return null;

  const sql = getSql();
  const lockedAdvisors = await sql<{offered_to_user_id: string}[]>`
    SELECT DISTINCT offered_to_user_id FROM pis_lead_queue
    WHERE company_id = ${companyId} AND status IN ('offered','accepted','locked')
      AND offered_to_user_id IS NOT NULL
  `;
  const lockedSet = new Set(lockedAdvisors.map(r => r.offered_to_user_id));
  const available = advisors.filter(a => !lockedSet.has(a.advisorUserId));
  if (!available.length) return null;

  const best = available[0];
  const tier = getTierForScore(best.compositeScore, config.tier_boundaries.elite_min_score);
  const windowMin = getAcceptWindow(tier, config.lead_distribution);

  const queueId = await repo.createQueueEntry(companyId, leadId, pipelineValue);
  const now = new Date();
  await repo.updateQueueEntry(queueId, {
    status: "offered",
    offered_to_user_id: best.advisorUserId,
    offered_at: now.toISOString(),
    current_tier: tier,
  });
  await repo.addHistory(companyId, queueId, leadId, best.advisorUserId, "offered", tier);

  return { queueId, offeredTo: best.advisorUserId, offeredToName: best.advisorName, tier, acceptWindowMin: windowMin };
}

export async function acceptLead(companyId: string, queueId: string, advisorUserId: string) {
  const config = await getConfig(companyId);
  const lockDuration = config.lead_distribution.lock_duration_min;
  const now = new Date();
  const lockedUntil = new Date(now.getTime() + lockDuration * 60 * 1000);

  const sql = getSql();
  const queue = await sql<{lead_id: string; current_tier: number}[]>`
    SELECT lead_id, current_tier FROM pis_lead_queue WHERE id = ${queueId}
  `;
  const leadId = queue[0]?.lead_id ?? "";

  await repo.updateQueueEntry(queueId, {
    status: "locked",
    accepted_at: now.toISOString(),
    locked_until: lockedUntil.toISOString(),
  });
  await repo.addHistory(companyId, queueId, leadId, advisorUserId, "accepted", queue[0]?.current_tier ?? 1);

  return { queueId, lockedUntil: lockedUntil.toISOString() };
}

export async function cascadeLead(companyId: string, queueId: string) {
  const sql = getSql();
  const config = await getConfig(companyId);
  const ld = config.lead_distribution;

  const queue = await sql<any[]>`SELECT * FROM pis_lead_queue WHERE id = ${queueId}`;
  const q = queue[0];
  if (!q) throw new Error("Queue entry not found");

  const newCascade = q.cascade_count + 1;
  await repo.addHistory(companyId, queueId, q.lead_id, q.offered_to_user_id, "timeout", q.current_tier, ld.no_call_penalty_points);

  if (newCascade >= ld.max_cascade_attempts) {
    await repo.updateQueueEntry(queueId, { status: "manual", cascade_count: newCascade });
    await repo.addHistory(companyId, queueId, q.lead_id, null, "manual_escalation", null);
    return { queueId, newOfferedTo: null, newTier: q.current_tier, penaltyApplied: ld.no_call_penalty_points, escalatedToManual: true };
  }

  const advisors = await getAdvisorScores(companyId);
  const lockedAdvisors = await sql<{offered_to_user_id: string}[]>`
    SELECT DISTINCT offered_to_user_id FROM pis_lead_queue
    WHERE company_id = ${companyId} AND status IN ('offered','accepted','locked')
      AND offered_to_user_id IS NOT NULL AND id != ${queueId}
  `;
  const lockedSet = new Set([...lockedAdvisors.map(r => r.offered_to_user_id), q.offered_to_user_id]);
  const available = advisors.filter(a => !lockedSet.has(a.advisorUserId));

  if (!available.length) {
    await repo.updateQueueEntry(queueId, { status: "manual", cascade_count: newCascade });
    await repo.addHistory(companyId, queueId, q.lead_id, null, "manual_escalation", null);
    return { queueId, newOfferedTo: null, newTier: q.current_tier, penaltyApplied: ld.no_call_penalty_points, escalatedToManual: true };
  }

  const next = available[0];
  const newTier = getTierForScore(next.compositeScore, config.tier_boundaries.elite_min_score);
  await repo.updateQueueEntry(queueId, {
    status: "offered", offered_to_user_id: next.advisorUserId, offered_at: new Date().toISOString(), cascade_count: newCascade, current_tier: newTier,
  });
  await repo.addHistory(companyId, queueId, q.lead_id, next.advisorUserId, "offered", newTier);

  return { queueId, newOfferedTo: next.advisorUserId, newTier, penaltyApplied: ld.no_call_penalty_points, escalatedToManual: false };
}

export async function releaseLead(companyId: string, queueId: string): Promise<void> {
  const sql = getSql();
  const config = await getConfig(companyId);
  const queue = await sql<any[]>`SELECT * FROM pis_lead_queue WHERE id = ${queueId}`;
  const q = queue[0];
  if (!q) return;
  await repo.updateQueueEntry(queueId, { status: "released", released_at: new Date().toISOString() });
  await repo.addHistory(companyId, queueId, q.lead_id, q.offered_to_user_id, "released", q.current_tier, config.lead_distribution.no_call_penalty_points);
}

export async function checkExpiredOffers(companyId: string): Promise<string[]> {
  const sql = getSql();
  const config = await getConfig(companyId);
  const ld = config.lead_distribution;
  const expired = await sql<{id: string; current_tier: number; offered_at: string}[]>`
    SELECT id, current_tier, offered_at FROM pis_lead_queue
    WHERE company_id = ${companyId} AND status = 'offered' AND offered_at IS NOT NULL
  `;
  const cascaded: string[] = [];
  for (const e of expired) {
    const window = getAcceptWindow(e.current_tier, ld);
    const expiry = new Date(new Date(e.offered_at).getTime() + window * 60 * 1000);
    if (new Date() > expiry) {
      await cascadeLead(companyId, e.id);
      cascaded.push(e.id);
    }
  }
  return cascaded;
}

export async function simulateDistribution(companyId: string, leadCount: number = 60): Promise<SimulationResult> {
  const config = await getConfig(companyId);
  const advisors = await getAdvisorScores(companyId);
  const ld = config.lead_distribution;
  const tiers = config.tier_boundaries;

  if (!advisors.length) {
    return { totalLeads: 0, accepted: 0, cascaded: 0, timedOut: 0, manualQueue: 0, totalPipelineValue: 0, steps: [], advisorStats: [] };
  }

  const stats = new Map<string, { name: string; tier: "ELITE" | "STANDARD"; offered: number; accepted: number; timedOut: number; penalties: number }>();
  for (const a of advisors) {
    stats.set(a.advisorUserId, { name: a.advisorName, tier: a.tier, offered: 0, accepted: 0, timedOut: 0, penalties: 0 });
  }

  const steps: SimulationStep[] = [];
  let accepted = 0, cascaded = 0, manualQueue = 0;
  // Calculate avg pipeline value from real invoice data
  const sql2 = getSql();
  const [avgRow] = await sql2<{avg_value: number}[]>`
    SELECT COALESCE(AVG(grand_total) FILTER (WHERE grand_total > 0), 5000)::numeric as avg_value
    FROM invoices WHERE company_id = ${companyId}
  `;
  const pipelinePerLead = Math.round(Number(avgRow?.avg_value ?? 5000));
  const busyUntil = new Map<string, number>();

  for (let lead = 1; lead <= leadCount; lead++) {
    let assigned = false;
    let cascadeAttempt = 0;
    const available = advisors.filter(a => !busyUntil.has(a.advisorUserId) || busyUntil.get(a.advisorUserId)! < lead);

    for (const adv of available) {
      if (cascadeAttempt >= ld.max_cascade_attempts) break;
      cascadeAttempt++;
      const tier = getTierForScore(adv.compositeScore, tiers.elite_min_score);
      const s = stats.get(adv.advisorUserId)!;
      s.offered++;

      const acceptChance = tier === 1 ? 0.85 : tier === 2 ? 0.65 : 0.4;
      if (Math.random() < acceptChance) {
        steps.push({ stepNumber: steps.length + 1, leadNumber: lead, action: "accept", advisorName: adv.advisorName, advisorTier: adv.tier, advisorScore: adv.compositeScore, cascadeAttempt, pipelineValue: pipelinePerLead, outcome: `Accepted by ${adv.advisorName} (Tier ${tier})` });
        s.accepted++;
        accepted++;
        busyUntil.set(adv.advisorUserId, lead + 3);
        assigned = true;
        break;
      } else {
        steps.push({ stepNumber: steps.length + 1, leadNumber: lead, action: "cascade", advisorName: adv.advisorName, advisorTier: adv.tier, advisorScore: adv.compositeScore, cascadeAttempt, pipelineValue: pipelinePerLead, outcome: `Timeout → cascade (attempt ${cascadeAttempt})` });
        s.timedOut++;
        s.penalties += ld.no_call_penalty_points;
        cascaded++;
      }
    }

    if (!assigned) {
      steps.push({ stepNumber: steps.length + 1, leadNumber: lead, action: "manual", advisorName: null, advisorTier: null, advisorScore: null, cascadeAttempt, pipelineValue: pipelinePerLead, outcome: "Escalated to manual queue" });
      manualQueue++;
    }
  }

  return {
    totalLeads: leadCount, accepted, cascaded, timedOut: cascaded, manualQueue,
    totalPipelineValue: accepted * pipelinePerLead,
    steps,
    advisorStats: Array.from(stats.values()).map(s => ({
      name: s.name, tier: s.tier, leadsOffered: s.offered, leadsAccepted: s.accepted, leadsTimedOut: s.timedOut, penalties: s.penalties,
    })),
  };
}