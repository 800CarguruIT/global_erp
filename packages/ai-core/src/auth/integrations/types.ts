export type IntegrationApiClientRow = {
  id: string;
  client_id: string;
  client_name: string;
  client_secret_hash: string;
  company_id: string | null;
  scopes: string[] | null;
  is_active: boolean;
  last_used_at: string | null;
  created_at: string;
  updated_at: string;
};

export type IntegrationClientIdentity = {
  clientId: string;
  companyId: string | null;
  scopes: string[];
};
