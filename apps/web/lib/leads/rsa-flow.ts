export type RsaLeadStatus = "pending" | "done" | "lost";
export type RsaLeadStage =
  | "new"
  | "dispatched"
  | "accepted"
  | "enroute"
  | "job_started"
  | "completed"
  | "lost";

export function normalizeRsaStatus(raw: unknown, fallback: RsaLeadStatus = "pending"): RsaLeadStatus {
  const val = String(raw ?? "").trim().toLowerCase();
  if (["done", "closed", "closed_won", "completed"].includes(val)) return "done";
  if (["lost", "cancelled", "canceled"].includes(val)) return "lost";
  if (["pending", "open", "accepted", "car_in", "processing", "in_progress", "inprocess"].includes(val)) {
    return "pending";
  }
  return fallback;
}

export function isRsaFinalStatus(status: string | null | undefined): boolean {
  const normalized = normalizeRsaStatus(status, "pending");
  return normalized === "done" || normalized === "lost";
}

