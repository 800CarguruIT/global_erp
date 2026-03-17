// packages/ai-tools/src/tools/inventory.ts
import type { ToolDefinition } from "../types.js";

export const inventoryForecastDemandTool: ToolDefinition = {
  name: "inventory.forecastDemand",
  description: "Predict parts demand for the next 30 days based on historical consumption, seasonal patterns, and current job pipeline.",
  inputSchema: {
    type: "object",
    required: ["companyId"],
    properties: {
      companyId: { type: "string" },
      productIds: { type: "array", items: { type: "string" }, description: "Specific products to forecast (optional)" },
    },
  },
  async execute(input: any, context: any) {
    return context.core.inventory.forecastDemand(input);
  },
};

export const inventorySuggestReorderTool: ToolDefinition = {
  name: "inventory.suggestReorder",
  description: "Generate suggested purchase orders for items at or below reorder point, selecting best vendor by price history.",
  inputSchema: {
    type: "object",
    required: ["companyId"],
    properties: {
      companyId: { type: "string" },
      urgencyLevel: { type: "string", enum: ["critical", "normal", "all"] },
    },
  },
  async execute(input: any, context: any) {
    return context.core.inventory.suggestReorder(input);
  },
};

export const inventoryDetectDeadStockTool: ToolDefinition = {
  name: "inventory.detectDeadStock",
  description: "Identify inventory items with no movement in the last 90 days and calculate holding cost.",
  inputSchema: {
    type: "object",
    required: ["companyId"],
    properties: {
      companyId: { type: "string" },
      thresholdDays: { type: "number", description: "Days without movement (default 90)" },
    },
  },
  async execute(input: any, context: any) {
    return context.core.inventory.detectDeadStock(input);
  },
};
