import OpenAI from "openai";

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
      apiKey
    });
  }

  return singleton;
}
