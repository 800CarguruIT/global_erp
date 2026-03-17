// packages/ai-tools/src/tools/accounting.ts
import type { ToolDefinition } from "../types.js";

export const accountingCategorizeTool: ToolDefinition = {
  name: "accounting.categorize",
  description: "Auto-categorize journal entries based on description, amount patterns, and chart of accounts.",
  inputSchema: {
    type: "object",
    required: ["companyId", "entries"],
    properties: {
      companyId: { type: "string" },
      entries: {
        type: "array",
        items: {
          type: "object",
          properties: {
            description: { type: "string" },
            amount: { type: "number" },
            type: { type: "string", enum: ["debit", "credit"] },
          },
        },
      },
    },
  },
  async execute(input: any, context: any) {
    return context.core.accounting.categorize(input);
  },
};

export const accountingDetectAnomalyTool: ToolDefinition = {
  name: "accounting.detectAnomaly",
  description: "Flag suspicious transactions — duplicate amounts, unusual vendors, off-hours entries, or amounts exceeding thresholds.",
  inputSchema: {
    type: "object",
    required: ["companyId"],
    properties: {
      companyId: { type: "string" },
      periodDays: { type: "number", description: "Period to analyze (default 30)" },
    },
  },
  async execute(input: any, context: any) {
    return context.core.accounting.detectAnomaly(input);
  },
};
