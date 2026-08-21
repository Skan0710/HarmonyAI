export interface ToolParameterSchema {
  type: string;
  description?: string;
  properties?: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
    items?: { type: string };
  }>;
  required?: string[];
}

export interface AssistantToolContext {
  userId?: string;
  sessionId?: string;
  userRole?: string;
}

export interface ToolExecutionResult<T = any> {
  success: boolean;
  toolName: string;
  data?: T;
  message?: string;
  error?: string;
}

export interface AssistantTool<TInput = any, TOutput = any> {
  name: string;
  description: string;
  parameters: ToolParameterSchema;
  validate(input: unknown): { valid: boolean; error?: string; data?: TInput };
  execute(input: TInput, context: AssistantToolContext): Promise<ToolExecutionResult<TOutput>>;
}
