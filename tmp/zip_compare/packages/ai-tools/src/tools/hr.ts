// packages/ai-tools/src/tools/hr.ts
import type { ToolDefinition } from "../types.js";

export const hrWorkloadAnalysisTool: ToolDefinition = {
  name: "hr.analyzeWorkload",
  description: "Analyze technician and staff workload distribution across branches, flag imbalances and overtime risk.",
  inputSchema: {
    type: "object",
    required: ["companyId"],
    properties: {
      companyId: { type: "string" },
      branchId: { type: "string" },
    },
  },
  async execute(input: any, context: any) {
    return context.core.hr.analyzeWorkload(input);
  },
};
