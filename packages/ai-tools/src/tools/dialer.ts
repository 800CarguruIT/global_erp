import type { DialerToolInput, ToolDefinition } from "../types.js";

export const dialerPlaceCallTool: ToolDefinition<DialerToolInput, unknown> = {
  name: "dialer.placeCall",
  description: "Place a call using a specified dialer integration.",
  inputSchema: {
    type: "object",
    required: ["integrationId", "to"],
    properties: {
      integrationId: { type: "string" },
      to: { type: "string" },
      from: { type: "string" },
      callerId: { type: "string" },
      metadata: {},
    },
  },
  async execute(input: DialerToolInput, context: any) {
    return context.core.dialer.placeCallViaTool(input);
  },
};

// AI Example:
// dialer.placeCall({
//   integrationId: "abcd123",
//   to: "+11234567890",
//   callerId: "Support",
//   metadata: { reason: "test-call" },
// });
