// packages/ai-tools/src/index.ts
import type { ToolDefinition } from "./types.js";

// Dialer
import { dialerPlaceCallTool } from "./tools/dialer.js";

// Leads (3 tools)
import { leadsScoreTool, leadsSuggestFollowUpTool, leadsDetectAtRiskTool } from "./tools/leads.js";

// Workshop (3 tools)
import { workshopEstimateTimeTool, workshopDetectAnomalyTool, workshopOptimizeBaysTool } from "./tools/workshop.js";

// Inventory (3 tools)
import { inventoryForecastDemandTool, inventorySuggestReorderTool, inventoryDetectDeadStockTool } from "./tools/inventory.js";

// Accounting (2 tools)
import { accountingCategorizeTool, accountingDetectAnomalyTool } from "./tools/accounting.js";

// HR (1 tool)
import { hrWorkloadAnalysisTool } from "./tools/hr.js";

// Marketing (2 tools)
import { marketingGenerateContentTool, marketingSegmentAudienceTool } from "./tools/marketing.js";

// Reports + Copilot (3 tools)
import { reportsGenerateNarrativeTool, copilotSearchTool, copilotExplainTool } from "./tools/reports.js";

export type { ToolDefinition } from "./types.js";

export const tools: ToolDefinition[] = [
  dialerPlaceCallTool as unknown as ToolDefinition,
  leadsScoreTool, leadsSuggestFollowUpTool, leadsDetectAtRiskTool,
  workshopEstimateTimeTool, workshopDetectAnomalyTool, workshopOptimizeBaysTool,
  inventoryForecastDemandTool, inventorySuggestReorderTool, inventoryDetectDeadStockTool,
  accountingCategorizeTool, accountingDetectAnomalyTool,
  hrWorkloadAnalysisTool,
  marketingGenerateContentTool, marketingSegmentAudienceTool,
  reportsGenerateNarrativeTool, copilotSearchTool, copilotExplainTool,
];

export { dialerPlaceCallTool };
export { leadsScoreTool, leadsSuggestFollowUpTool, leadsDetectAtRiskTool };
export { workshopEstimateTimeTool, workshopDetectAnomalyTool, workshopOptimizeBaysTool };
export { inventoryForecastDemandTool, inventorySuggestReorderTool, inventoryDetectDeadStockTool };
export { accountingCategorizeTool, accountingDetectAnomalyTool };
export { hrWorkloadAnalysisTool };
export { marketingGenerateContentTool, marketingSegmentAudienceTool };
export { reportsGenerateNarrativeTool, copilotSearchTool, copilotExplainTool };
