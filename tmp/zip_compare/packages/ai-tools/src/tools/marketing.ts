// packages/ai-tools/src/tools/marketing.ts
import type { ToolDefinition } from "../types.js";

export const marketingGenerateContentTool: ToolDefinition = {
  name: "marketing.generateContent",
  description: "Generate campaign copy for SMS, email, or WhatsApp based on audience segment and campaign objective.",
  inputSchema: {
    type: "object",
    required: ["companyId", "channel", "objective"],
    properties: {
      companyId: { type: "string" },
      channel: { type: "string", enum: ["sms", "email", "whatsapp"] },
      objective: { type: "string", description: "Campaign goal: promo, retention, reactivation, service-reminder" },
      language: { type: "string" },
      tone: { type: "string", enum: ["formal", "friendly", "urgent"] },
    },
  },
  async execute(input: any, context: any) {
    return context.core.marketing.generateContent(input);
  },
};

export const marketingSegmentAudienceTool: ToolDefinition = {
  name: "marketing.segmentAudience",
  description: "AI-powered customer segmentation based on service history, spend, vehicle type, and engagement.",
  inputSchema: {
    type: "object",
    required: ["companyId"],
    properties: {
      companyId: { type: "string" },
      segmentType: { type: "string", enum: ["rfm", "vehicle-type", "service-history", "spend-tier"] },
    },
  },
  async execute(input: any, context: any) {
    return context.core.marketing.segmentAudience(input);
  },
};
