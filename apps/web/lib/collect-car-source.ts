export type CollectCarSourceType = "recovery" | "walkin" | "unknown";

export type CollectCarSource = {
  sourceType: CollectCarSourceType;
  sourceMedia: Record<string, string>;
};

function normalizeFileId(value: unknown): string | null {
  const out = String(value ?? "").trim();
  return out || null;
}

export function normalizeMediaMap(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object") return {};
  const row = value as Record<string, unknown>;
  const keys = ["video", "front", "rear", "right", "left", "cluster"] as const;
  const out: Record<string, string> = {};
  for (const key of keys) {
    const id = normalizeFileId(row[key]);
    if (id) out[key] = id;
  }
  return out;
}

function firstRow<T = Record<string, unknown>>(rows: unknown): T | null {
  const list = ((rows as any)?.rows ?? rows) as T[] | null | undefined;
  return list?.[0] ?? null;
}

function resolveWalkinMedia(leadRow: Record<string, unknown>, rsaRow: Record<string, unknown> | null) {
  const rawWr = leadRow.workflow_required;
  const workflowRequired = (
    Array.isArray(rawWr)
      ? (typeof rawWr[0] === "object" && rawWr[0] !== null ? rawWr[0] : {})
      : (rawWr ?? {})
  ) as Record<string, unknown>;
  return normalizeMediaMap({
    // Prefer explicit check-in capture, then legacy inspection media, then RSA fallback.
    video:
      leadRow.carin_video ??
      workflowRequired.checkinVideo360 ??
      workflowRequired.inspectionVideo360 ??
      rsaRow?.video_360_file_id ??
      null,
    front:
      workflowRequired.checkinPhotoFront ??
      workflowRequired.inspectionPhotoFront ??
      rsaRow?.photo_front_file_id ??
      null,
    rear:
      workflowRequired.checkinPhotoRear ??
      workflowRequired.inspectionPhotoRear ??
      rsaRow?.photo_rear_file_id ??
      null,
    right:
      workflowRequired.checkinPhotoRight ??
      workflowRequired.inspectionPhotoRight ??
      rsaRow?.photo_right_file_id ??
      null,
    left:
      workflowRequired.checkinPhotoLeft ??
      workflowRequired.inspectionPhotoLeft ??
      rsaRow?.photo_left_file_id ??
      null,
    cluster:
      workflowRequired.checkinClusterImage ??
      workflowRequired.inspectionClusterImage ??
      rsaRow?.cluster_image_file_id ??
      null,
  });
}

export async function resolveCollectCarSource(
  sql: any,
  companyId: string,
  leadId: string | null | undefined,
): Promise<CollectCarSource> {
  if (!leadId) return { sourceType: "unknown", sourceMedia: {} };

  const leadRows = await sql<any[]>`
    SELECT
      lead_type,
      workshop_visit_mode,
      pickup_from,
      dropoff_to,
      carin_video,
      workflow_required
    FROM leads
    WHERE company_id = ${companyId}
      AND id = ${leadId}
    LIMIT 1
  `;
  const leadRow = firstRow<Record<string, unknown>>(leadRows);
  if (!leadRow) return { sourceType: "unknown", sourceMedia: {} };

  const rsaRows = await sql<any[]>`
    SELECT
      photo_front_file_id,
      photo_rear_file_id,
      photo_right_file_id,
      photo_left_file_id,
      cluster_image_file_id,
      video_360_file_id
    FROM rsa_inspections
    WHERE company_id = ${companyId}
      AND lead_id = ${leadId}
    ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    LIMIT 1
  `;
  const rsaRow = firstRow<Record<string, unknown>>(rsaRows);

  const isRecovery =
    String(leadRow.lead_type ?? "").toLowerCase() === "recovery" ||
    String(leadRow.workshop_visit_mode ?? "").toLowerCase() === "recovery" ||
    Boolean(String(leadRow.pickup_from ?? "").trim()) ||
    Boolean(String(leadRow.dropoff_to ?? "").trim());

  if (isRecovery) {
    const recoveryRows = await sql<any[]>`
      SELECT
        pickup_video,
        pickup_front_image,
        pickup_rear_image,
        pickup_right_image,
        pickup_left_image,
        pickup_cluster_image
      FROM recovery_requests
      WHERE lead_id = ${leadId}
        AND type = 'pickup'
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const recoveryRow = firstRow<Record<string, unknown>>(recoveryRows);
    const media = normalizeMediaMap({
      video: recoveryRow?.pickup_video ?? null,
      front: recoveryRow?.pickup_front_image ?? null,
      rear: recoveryRow?.pickup_rear_image ?? null,
      right: recoveryRow?.pickup_right_image ?? null,
      left: recoveryRow?.pickup_left_image ?? null,
      cluster: recoveryRow?.pickup_cluster_image ?? null,
    });
    return {
      sourceType: "recovery",
      sourceMedia: Object.keys(media).length ? media : resolveWalkinMedia(leadRow, rsaRow),
    };
  }

  return {
    sourceType: "walkin",
    sourceMedia: resolveWalkinMedia(leadRow, rsaRow),
  };
}
