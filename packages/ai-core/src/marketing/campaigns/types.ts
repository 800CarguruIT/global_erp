export type CampaignBuilderScope = "global" | "company";

export type CampaignBuilderGraphRow = {
  id: string;
  scope: CampaignBuilderScope;
  company_id: string | null;
  campaign_id: string | null;
  graph: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type UpsertCampaignBuilderGraphInput = {
  scope: CampaignBuilderScope;
  companyId?: string | null;
  campaignId?: string | null;
  graph: Record<string, unknown>;
};
