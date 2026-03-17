// packages/ai-tools/src/tools/reports.ts
import type { ToolDefinition } from "../types.js";

export const reportsGenerateNarrativeTool: ToolDefinition = {
  name: "reports.generateNarrative",
  description: "Transform raw KPI data into a written executive summary report with trends and recommendations.",
  inputSchema: {
    type: "object",
    required: ["companyId", "reportType"],
    properties: {
      companyId: { type: "string" },
      reportType: { type: "string", enum: ["daily", "weekly", "monthly", "quarterly"] },
      language: { type: "string" },
    },
  },
  async execute(input: any, context: any) {
    return context.core.reports.generateNarrative(input);
  },
};

// packages/ai-tools/src/tools/copilot.ts

export const copilotSearchTool: ToolDefinition = {
  name: "copilot.search",
  description: "Natural language search across all ERP modules — 'show me overdue invoices in Branch A' or 'which technician completed the most jobs'.",
  inputSchema: {
    type: "object",
    required: ["companyId", "query"],
    properties: {
      companyId: { type: "string" },
      query: { type: "string", description: "Natural language search query" },
      scope: { type: "string", enum: ["global", "company", "branch"] },
    },
  },
  async execute(input: any, context: any) {
    return context.core.copilot.search(input);
  },
};

export const copilotExplainTool: ToolDefinition = {
  name: "copilot.explain",
  description: "Explain what a KPI means, why it changed, and what actions to take — contextual help for any metric.",
  inputSchema: {
    type: "object",
    required: ["kpiKey", "currentValue"],
    properties: {
      kpiKey: { type: "string" },
      currentValue: { type: "number" },
      previousValue: { type: "number" },
      context: { type: "string", description: "Page or module context" },
      language: { type: "string" },
    },
  },
  async execute(input: any, context: any) {
    return context.core.copilot.explain(input);
  },
};
