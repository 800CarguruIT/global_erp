export type DialerToolInput = {
  integrationId: string;
  to: string;
  from?: string;
  callerId?: string;
  metadata?: unknown;
};

export type ToolExecuteContext = {
  core: {
    dialer: {
      placeCallViaTool: (input: DialerToolInput) => Promise<unknown>;
    };
  };
};

export type ToolDefinition<Input = unknown, Result = unknown> = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  execute: (input: Input, context: ToolExecuteContext) => Promise<Result>;
};
