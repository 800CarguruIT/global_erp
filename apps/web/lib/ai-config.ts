import { getCompanyAiProviderConfig } from "@repo/ai-core/ai/providerConfig";

/**
 * Resolve OpenAI API key and base URL for a company.
 * Priority: company DB config > environment variable.
 */
export async function resolveOpenAiConfig(companyId: string): Promise<{
  apiKey: string | null;
  baseUrl: string | null;
  model: string;
}> {
  let apiKey: string | null = null;
  let baseUrl: string | null = null;

  // 1. Try company-level config from DB
  try {
    const config = await getCompanyAiProviderConfig(companyId);
    if (config?.isActive && config.apiKey) {
      apiKey = config.apiKey;
      baseUrl = config.baseUrl ?? null;
    }
  } catch {
    // DB lookup failed, fall through to env
  }

  // 2. Fallback to environment variable
  if (!apiKey) {
    apiKey = process.env.OPENAI_API_KEY ?? null;
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  return { apiKey, baseUrl, model };
}
