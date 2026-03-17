// packages/ai-tools/src/tools/leads.ts
import type { ToolDefinition } from "../types.js";

export const leadsScoreTool: ToolDefinition = {
  name: "leads.score",
  description: "Score and prioritize leads by conversion probability based on source, age, interactions, and vehicle type.",
  inputSchema: {
    type: "object",
    required: ["companyId"],
    properties: {
      companyId: { type: "string", description: "Company ID to score leads for" },
      limit: { type: "number", description: "Max leads to score (default 20)" },
    },
  },
  async execute(input: any, context: any) {
    return context.core.leads.scoreLeads(input);
  },
};

export const leadsSuggestFollowUpTool: ToolDefinition = {
  name: "leads.suggestFollowUp",
  description: "Generate a follow-up message draft for a specific lead based on their history and current stage.",
  inputSchema: {
    type: "object",
    required: ["companyId", "leadId"],
    properties: {
      companyId: { type: "string" },
      leadId: { type: "string" },
      channel: { type: "string", enum: ["sms", "email", "whatsapp", "call"] },
      language: { type: "string", description: "Target language (default: en)" },
    },
  },
  async execute(input: any, context: any) {
    return context.core.leads.suggestFollowUp(input);
  },
};

export const leadsDetectAtRiskTool: ToolDefinition = {
  name: "leads.detectAtRisk",
  description: "Identify leads that are at risk of going cold based on aging and interaction patterns.",
  inputSchema: {
    type: "object",
    required: ["companyId"],
    properties: {
      companyId: { type: "string" },
      thresholdDays: { type: "number", description: "Days without activity to flag (default 5)" },
    },
  },
  async execute(input: any, context: any) {
    return context.core.leads.detectAtRisk(input);
  },
};
