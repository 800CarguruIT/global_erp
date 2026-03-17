// packages/ai-tools/src/tools/workshop.ts
import type { ToolDefinition } from "../types.js";

export const workshopEstimateTimeTool: ToolDefinition = {
  name: "workshop.estimateJobTime",
  description: "Predict job duration based on inspection findings, vehicle type, and historical completion times.",
  inputSchema: {
    type: "object",
    required: ["companyId", "workOrderId"],
    properties: {
      companyId: { type: "string" },
      workOrderId: { type: "string" },
    },
  },
  async execute(input: any, context: any) {
    return context.core.workshop.estimateJobTime(input);
  },
};

export const workshopDetectAnomalyTool: ToolDefinition = {
  name: "workshop.detectAnomaly",
  description: "Flag unusual pricing, parts usage, or cycle times compared to historical baselines.",
  inputSchema: {
    type: "object",
    required: ["companyId"],
    properties: {
      companyId: { type: "string" },
      branchId: { type: "string" },
      lookbackDays: { type: "number", description: "Days of history to analyze (default 30)" },
    },
  },
  async execute(input: any, context: any) {
    return context.core.workshop.detectAnomalies(input);
  },
};

export const workshopOptimizeBaysTool: ToolDefinition = {
  name: "workshop.optimizeBays",
  description: "Suggest optimal bay assignments based on job type, technician skills, and current occupancy.",
  inputSchema: {
    type: "object",
    required: ["companyId", "branchId"],
    properties: {
      companyId: { type: "string" },
      branchId: { type: "string" },
    },
  },
  async execute(input: any, context: any) {
    return context.core.workshop.optimizeBays(input);
  },
};
