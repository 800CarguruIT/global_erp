import Anthropic from "@anthropic-ai/sdk";
import { getCompanyAiProviderConfig } from "./providerConfig";

let singleton: Anthropic | null = null;

/**
 * Get a singleton Anthropic client for server-side usage.
 * IMPORTANT: only import this from server code (API routes, server actions),
 * not from client components.
 */
export function getAnthropicClient(): Anthropic {
  if (!singleton) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error("ANTHROPIC_API_KEY is not set");
    }
    singleton = new Anthropic({ apiKey });
  }
  return singleton;
}

export async function getAnthropicClientForCompany(
  companyId?: string | null
): Promise<{ client: Anthropic | null; source: "company" | "global" | null }> {
  const normalizedCompanyId = String(companyId ?? "").trim();

  if (normalizedCompanyId) {
    const config = await getCompanyAiProviderConfig(normalizedCompanyId, "anthropic").catch(() => null);
    if (config?.isActive) {
      const companyKey = String(config.apiKey ?? "").trim();
      if (companyKey) {
        return { client: new Anthropic({ apiKey: companyKey }), source: "company" };
      }
    }
  }

  const envKey = process.env.ANTHROPIC_API_KEY;
  if (!envKey) {
    return { client: null, source: null };
  }

  return { client: getAnthropicClient(), source: "global" };
}
