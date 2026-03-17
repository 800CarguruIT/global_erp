import OpenAI from "openai";
import { getCompanyAiProviderConfig } from "./providerConfig";

let singleton: OpenAI | null = null;

/**
 * Get a singleton OpenAI client for server-side usage.
 * IMPORTANT: only import this from server code (API routes, server actions),
 * not from client components.
 */
export function getOpenAIClient(): OpenAI {
  if (!singleton) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not set");
    }

    singleton = new OpenAI({
      apiKey,
    });
  }

  return singleton;
}

export async function getOpenAIClientForCompany(
  companyId?: string | null
): Promise<{ client: OpenAI | null; source: "company" | "global" | null }> {
  const normalizedCompanyId = String(companyId ?? "").trim();

  if (normalizedCompanyId) {
    const config = await getCompanyAiProviderConfig(normalizedCompanyId).catch(
      () => null
    );
    const companyKey = String(config?.apiKey ?? "").trim();
    if (config?.isActive && companyKey) {
      const baseURL = String(config.baseUrl ?? "").trim() || undefined;
      const client = new OpenAI({
        apiKey: companyKey,
        ...(baseURL ? { baseURL } : {}),
      });
      return { client, source: "company" };
    }
  }

  const envKey = process.env.OPENAI_API_KEY;
  if (!envKey) {
    return { client: null, source: null };
  }

  return { client: getOpenAIClient(), source: "global" };
}
