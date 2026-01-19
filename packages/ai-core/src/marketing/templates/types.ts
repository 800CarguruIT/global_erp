export type MarketingTemplateType = "whatsapp" | "email";

export type MarketingTemplateRow = {
  id: string;
  company_id: string;
  type: MarketingTemplateType;
  provider_key: string;
  name: string;
  status: string;
  content: Record<string, unknown>;
  provider_status: string | null;
  provider_template_id: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
};

export type CreateMarketingTemplateInput = {
  companyId: string;
  type: MarketingTemplateType;
  providerKey: string;
  name: string;
  status?: string | null;
  content?: Record<string, unknown>;
  providerStatus?: string | null;
  providerTemplateId?: string | null;
};

export type UpdateMarketingTemplateInput = {
  companyId: string;
  id: string;
  providerKey?: string | null;
  name?: string | null;
  status?: string | null;
  content?: Record<string, unknown> | null;
  providerStatus?: string | null;
  providerTemplateId?: string | null;
  publishedAt?: Date | string | null;
};
