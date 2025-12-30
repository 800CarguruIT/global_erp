import type { ToolDefinition } from "./types.js";
import { dialerPlaceCallTool } from "./tools/dialer.js";

export type { ToolDefinition } from "./types.js";

// ToolDefinition is non-generic; keep execute input loose for compatibility.
export const tools: ToolDefinition[] = [dialerPlaceCallTool as unknown as ToolDefinition];

export { dialerPlaceCallTool };
