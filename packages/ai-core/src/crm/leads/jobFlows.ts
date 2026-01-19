import type { LeadType, LeadStage } from "./types";

export type LeadStageConfig = {
  id: LeadStage | string;
  label: string;
  description?: string;
};

export const RSA_STAGES: LeadStageConfig[] = [
  { id: "open", label: "Open", description: "Lead created for RSA." },
  { id: "assigned", label: "Assigned", description: "Accepted by an RSA technician." },
  { id: "enroute", label: "Enroute", description: "Technician on the way." },
  { id: "inprocess", label: "In process", description: "Technician at location working." },
  { id: "completed", label: "Completed", description: "RSA service completed." },
  { id: "closed", label: "Closed", description: "Job invoiced and closed." },
  { id: "lost", label: "Lost", description: "Lead was lost / cancelled." },
];

export const RECOVERY_STAGES: LeadStageConfig[] = [
  { id: "open", label: "Open", description: "Lead created for recovery / towing." },
  { id: "assigned", label: "Assigned", description: "Accepted by a recovery truck." },
  { id: "enroute", label: "Enroute", description: "Truck on the way." },
  { id: "inprocess", label: "In process", description: "Pickup/dropoff in progress." },
  { id: "completed", label: "Completed", description: "Recovery service completed." },
  { id: "closed", label: "Closed", description: "Job invoiced and closed." },
  { id: "lost", label: "Lost", description: "Lead was lost / cancelled." },
];

export const WORKSHOP_STAGES: LeadStageConfig[] = [
  { id: "open", label: "Open" },
  { id: "checkin", label: "Checked-in" },
  { id: "inspection", label: "Inspection" },
  { id: "estimate", label: "Estimate" },
  { id: "approval", label: "Approval" },
  { id: "parts", label: "Parts" },
  { id: "workorder", label: "Work Order" },
  { id: "qc", label: "Quality Check" },
  { id: "completed", label: "Completed" },
  { id: "closed", label: "Closed" },
  { id: "lost", label: "Lost" },
];

export function getStagesForType(type: LeadType): LeadStageConfig[] {
  switch (type) {
    case "rsa":
      return RSA_STAGES;
    case "recovery":
      return RECOVERY_STAGES;
    case "workshop":
      return WORKSHOP_STAGES;
    default:
      return [];
  }
}

export function formatStageLabel(type: LeadType, stage: string | null): string {
  if (!stage) return "Unknown";
  const list = getStagesForType(type);
  const found = list.find((s) => s.id === stage);
  if (found) return found.label;
  return stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}
