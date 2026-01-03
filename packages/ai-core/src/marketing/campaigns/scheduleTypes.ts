export type CampaignScheduleRow = {
  id: string;
  companyId: string | null;
  campaignId: string;
  nodeId: string;
  nodeKey: string;
  runAt: string;
  status: string;
  easycronJobId: string | null;
  easycronPayload: Record<string, unknown> | null;
  lastRunAt: string | null;
  error: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CreateCampaignScheduleInput = {
  companyId?: string | null;
  campaignId: string;
  nodeId: string;
  nodeKey: string;
  runAt: Date;
  status?: string;
};

export type UpdateCampaignScheduleJobInput = {
  easycronJobId?: string | null;
  easycronPayload?: Record<string, unknown> | null;
  status?: string;
  error?: string | null;
};
