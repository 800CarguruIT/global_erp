import * as repo from "./repository";
import type { RccFilter, AiSignal, AiEngineStatus } from "./types";

/**
 * Generates AI-powered revenue intelligence signals by analysing
 * pipeline funnel data, source performance, and leakage patterns.
 *
 * This is a rule-based signal generator that can later be upgraded
 * to call the Intelligence orchestrator (E1/E3/E5) for AI-powered analysis.
 */
export async function generateAiSignals(filter: RccFilter): Promise<AiSignal[]> {
  const [pipeline, sources, leakage] = await Promise.all([
    repo.getPipelineFunnel(filter),
    repo.getLeadSourcePerformance(filter),
    repo.getLeakageByStage(filter),
  ]);

  const signals: AiSignal[] = [];
  let signalId = 1;

  // ── Revenue Leak Detection ─────────────────
  // Detect large drop-offs in the pipeline
  for (const leak of leakage) {
    if (leak.aedLost > 50000) {
      signals.push({
        id: `sig-${signalId++}`,
        severity: leak.aedLost > 200000 ? "CRITICAL" : "HIGH",
        category: "Revenue Leak",
        title: `${leak.leadsLost} leads died at ${leak.fromStage} → ${leak.toStage}`,
        description: `Cause: ${leak.cause}. Revenue at risk: AED ${leak.aedLost.toLocaleString()}/month.`,
        impactAed: leak.aedLost,
        confidencePct: 92,
        suggestedFix: leak.suggestedFix,
        engineKey: "revenue_leak_detection",
      });
    }
  }

  // ── Source ROI Optimizer ────────────────────
  // Find sources with negative ROI (RPL < CPA)
  for (const src of sources) {
    if (src.cpa > 0 && src.rpl < src.cpa) {
      signals.push({
        id: `sig-${signalId++}`,
        severity: "HIGH",
        category: "Source ROI",
        title: `${formatSourceName(src.source)} ROI negative — kill or fix`,
        description: `${src.leads} leads, ${src.converted} conversions, AED ${src.revenue.toLocaleString()} revenue vs AED ${(src.cpa * src.converted).toLocaleString()} cost. CPA: AED ${src.cpa}. RPL: AED ${src.rpl}. Only source where RPL < CPA.`,
        impactAed: Math.round(src.cpa * src.converted - src.revenue),
        confidencePct: 88,
        suggestedFix: `Pause spend or redirect budget to higher-ROI sources`,
        engineKey: "source_roi_optimizer",
      });
    }
  }

  // ── Channel Shift Engine ───────────────────
  // Compare top 2 sources by conversion rate
  const sortedByConv = [...sources].filter(s => s.leads >= 50).sort((a, b) => {
    const aConv = a.leads === 0 ? 0 : a.converted / a.leads;
    const bConv = b.leads === 0 ? 0 : b.converted / b.leads;
    return bConv - aConv;
  });
  if (sortedByConv.length >= 2) {
    const best = sortedByConv[0];
    const worst = sortedByConv[sortedByConv.length - 1];
    const bestConv = best.leads === 0 ? 0 : best.converted / best.leads;
    const worstConv = worst.leads === 0 ? 0 : worst.converted / worst.leads;
    if (bestConv > 0 && worstConv > 0 && bestConv / worstConv >= 1.5) {
      const ratio = (bestConv / worstConv).toFixed(1);
      signals.push({
        id: `sig-${signalId++}`,
        severity: "HIGH",
        category: "Channel Shift",
        title: `${formatSourceName(best.source)} conversion ${ratio}x higher than ${formatSourceName(worst.source)}`,
        description: `${formatSourceName(best.source)}: ${(bestConv * 100).toFixed(1)}% lead-to-sale. ${formatSourceName(worst.source)}: ${(worstConv * 100).toFixed(1)}%.`,
        impactAed: Math.round((bestConv - worstConv) * worst.leads * (best.rpl || 100)),
        confidencePct: 85,
        engineKey: "channel_shift_engine",
      });
    }
  }

  // ── Booking Drop Analyzer ──────────────────
  const qualifiedStage = pipeline.find(s => s.label === "Qualified");
  const bookedStage = pipeline.find(s => s.label === "Booked");
  if (qualifiedStage && bookedStage && qualifiedStage.count > 0) {
    const dropPct = ((qualifiedStage.count - bookedStage.count) / qualifiedStage.count) * 100;
    if (dropPct > 20) {
      const lost = qualifiedStage.count - bookedStage.count;
      signals.push({
        id: `sig-${signalId++}`,
        severity: dropPct > 40 ? "HIGH" : "MED",
        category: "Booking Drop",
        title: `${lost} qualified leads never booked — biggest single leak`,
        description: `Qualified → Booked conversion: ${(100 - dropPct).toFixed(1)}%. Leads going cold after qualification.`,
        impactAed: Math.round(lost * (sources[0]?.rpl ?? 200)),
        confidencePct: 87,
        suggestedFix: "Same-day booking incentive",
        engineKey: "booking_drop_analyzer",
      });
    }
  }

  // ── Upsell Intelligence ────────────────────
  const showedStage = pipeline.find(s => s.label === "Showed Up");
  const invoicedStage = pipeline.find(s => s.label === "Invoiced");
  if (showedStage && invoicedStage && showedStage.count > 0) {
    const drop = showedStage.count - invoicedStage.count;
    if (drop > 10) {
      signals.push({
        id: `sig-${signalId++}`,
        severity: "MED",
        category: "Upsell Gap",
        title: `${drop} showed customers left without full invoice`,
        description: `Show → Invoice drop: ${((drop / showedStage.count) * 100).toFixed(1)}%. These are customers physically present who walked away without buying everything they could.`,
        impactAed: Math.round(drop * 900), // avg upsell value estimate
        confidencePct: 81,
        suggestedFix: "Upsell checklist at car-in",
        engineKey: "upsell_intelligence",
      });
    }
  }

  // ── Referral Growth Engine ─────────────────
  const referralSrc = sources.find(s => s.source === "referral");
  const totalLeads = sources.reduce((s, src) => s + src.leads, 0);
  if (referralSrc && totalLeads > 0 && referralSrc.leads / totalLeads < 0.05) {
    const referralConv = referralSrc.leads === 0 ? 0 : referralSrc.converted / referralSrc.leads;
    signals.push({
      id: `sig-${signalId++}`,
      severity: "MED",
      category: "Referral Engine",
      title: `Referral is ${referralSrc.rpl > 0 ? Math.round(referralSrc.rpl / (sources[0]?.rpl || 1)) + "x" : "highly"} profitable but only ${((referralSrc.leads / totalLeads) * 100).toFixed(1)}% of leads`,
      description: `RPL: AED ${referralSrc.rpl}. Conversion: ${(referralConv * 100).toFixed(1)}%. But only ${referralSrc.leads} leads out of ${totalLeads}. Massively under-invested.`,
      impactAed: Math.round(referralSrc.rpl * referralSrc.leads * 2), // 2x growth potential
      confidencePct: 90,
      suggestedFix: "Launch referral program with AED 50 credit incentive",
      engineKey: "referral_growth_engine",
    });
  }

  // Sort by impact descending
  return signals.sort((a, b) => b.impactAed - a.impactAed);
}

// ── Engine Status ────────────────────────────

export async function getEngineStatuses(_filter: RccFilter): Promise<AiEngineStatus[]> {
  // All engines are active in rule-based mode.
  // When connected to Intelligence orchestrator, check real engine health.
  return [
    { key: "revenue_leak_detection", name: "Revenue Leak Detection", isActive: true, signalCount: 0, topAction: "Speed-to-Lead SLA" },
    { key: "source_roi_optimizer", name: "Source ROI Optimizer", isActive: true, signalCount: 0, topAction: "Kill social spend" },
    { key: "channel_shift_engine", name: "Channel Shift Engine", isActive: true, signalCount: 0, topAction: "WhatsApp priority" },
    { key: "booking_drop_analyzer", name: "Booking Drop Analyzer", isActive: true, signalCount: 0, topAction: "Same-day booking" },
    { key: "upsell_intelligence", name: "Upsell Intelligence", isActive: true, signalCount: 0, topAction: "Car-in checklist" },
    { key: "referral_growth_engine", name: "Referral Growth Engine", isActive: true, signalCount: 0, topAction: "Launch program" },
    { key: "anomaly_detection", name: "Anomaly Detection", isActive: true, signalCount: 0, topAction: "No anomalies" },
  ];
}

function formatSourceName(source: string): string {
  const map: Record<string, string> = {
    call: "Calls", whatsapp: "WhatsApp", website: "Website", ads: "Ads",
    walk_in: "Walk-In", referral: "Referral", other: "Other",
    mobile_app: "Mobile App", social_media: "Social Media",
    inbound_call: "Inbound Calls", outbound_call: "Outbound Calls",
  };
  return map[source] ?? source.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}
