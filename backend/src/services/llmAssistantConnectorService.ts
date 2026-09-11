import dotenv from 'dotenv';
import { ToolRegistry, ToolDefinitionDTO } from '../tools/toolRegistry.js';
import { AssistantToolContext, ToolExecutionResult } from '../tools/toolTypes.js';
import { ToolCallIntent, AssistantIntentService } from './assistantIntentService.js';
import { hasGroqKey, generateGroqCompletion, extractJsonObject } from './llmClient.js';

dotenv.config();

export interface LLMToolCallPayload {
  type: 'tool_call' | 'unfulfillable';
  toolName?: string;
  input?: Record<string, any>;
  explanation: string;
}

export interface ILLMToolSelectorProvider {
  name: string;
  selectTool(
    prompt: string,
    toolDefinitions: ToolDefinitionDTO[],
    minimalContext: { userId?: string }
  ): Promise<LLMToolCallPayload | null>;
}

/**
 * Groq-based Structured Tool Selector
 */
export class GroqToolSelectorProvider implements ILLMToolSelectorProvider {
  name = 'groq';

  async selectTool(
    prompt: string,
    toolDefinitions: ToolDefinitionDTO[],
    minimalContext: { userId?: string }
  ): Promise<LLMToolCallPayload | null> {
    if (!hasGroqKey()) return null;

    const toolSchemasJson = JSON.stringify(toolDefinitions, null, 2);
    const systemInstruction = `You are the HarmonyAI Music Assistant Tool Selector.
Analyze the user request and select the single most appropriate tool from the available tools list:
${toolSchemasJson}

CRITICAL RULES:
1. DO NOT INVENT song titles, artists, album names, or playlists.
2. Select an available tool and provide structured JSON input matching that tool's parameters.
3. If the request is not related to music discovery, playback, playlists, or music recommendations, respond with type "unfulfillable".
4. Output JSON strictly matching this schema:
{
  "type": "tool_call" | "unfulfillable",
  "toolName": string or null,
  "input": object or null,
  "explanation": string
}`;

    let rawText: string;
    try {
      rawText = await generateGroqCompletion(
        systemInstruction,
        `User Context: userId=${minimalContext.userId || 'anonymous'}\nUser Request: "${prompt}"`
      );
    } catch {
      return null;
    }

    const parsed = extractJsonObject(rawText);
    if (!parsed) return null;

    return {
      type: parsed.type === 'tool_call' ? 'tool_call' : 'unfulfillable',
      toolName: parsed.toolName || undefined,
      input: parsed.input || {},
      explanation: parsed.explanation || '',
    };
  }
}

/**
 * Deterministic Rule-Based Tool Selector Provider (Provider-independent offline fallback)
 */
export class DeterministicToolSelectorProvider implements ILLMToolSelectorProvider {
  name = 'deterministic_fallback';

  async selectTool(
    prompt: string,
    _toolDefinitions: ToolDefinitionDTO[],
    minimalContext: { userId?: string }
  ): Promise<LLMToolCallPayload | null> {
    const intent = AssistantIntentService.selectIntentRuleBased(prompt, {
      userId: minimalContext.userId,
    });

    return {
      type: intent.type === 'tool_call' ? 'tool_call' : 'unfulfillable',
      toolName: intent.toolName,
      input: intent.input,
      explanation: intent.explanation,
    };
  }
}

/**
 * Provider-Independent LLM Assistant Connector Service
 */
export class LLMAssistantConnectorService {
  private static providers: ILLMToolSelectorProvider[] = [
    new GroqToolSelectorProvider(),
    new DeterministicToolSelectorProvider(),
  ];

  /**
   * Evaluates user prompt, performs structured tool selection via LLM provider,
   * validates parameters, and executes the selected tool safely.
   */
  static async processUserRequest(
    prompt: string,
    context: AssistantToolContext
  ): Promise<{
    userPrompt: string;
    intent: ToolCallIntent;
    toolExecutionResult?: ToolExecutionResult;
    responseMessage: string;
    data?: any;
  }> {
    const trimmedPrompt = (prompt || '').trim().slice(0, 500);

    if (!trimmedPrompt) {
      return {
        userPrompt: prompt,
        intent: {
          type: 'unfulfillable',
          explanation: 'Please provide a music request, search query, or command.',
        },
        responseMessage: 'Please provide a music request, search query, or command.',
      };
    }

    const toolDefinitions = ToolRegistry.getToolDefinitions();
    const minimalContext = { userId: context.userId };

    let selectedPayload: LLMToolCallPayload | null = null;

    // Try providers in order (active LLM provider -> deterministic fallback)
    for (const provider of this.providers) {
      try {
        selectedPayload = await provider.selectTool(trimmedPrompt, toolDefinitions, minimalContext);
        if (selectedPayload) break;
      } catch {
        // Fall back to next provider on network/parsing error
      }
    }

    if (!selectedPayload || selectedPayload.type === 'unfulfillable' || !selectedPayload.toolName) {
      const explanation =
        selectedPayload?.explanation ||
        'I can only assist with discovering songs, exploring music vibes, generating recommendations, managing playlists, and controlling your queue.';

      return {
        userPrompt: prompt,
        intent: {
          type: 'unfulfillable',
          explanation,
        },
        responseMessage: explanation,
      };
    }

    // Verify tool is registered in ToolRegistry
    const tool = ToolRegistry.getTool(selectedPayload.toolName);
    if (!tool) {
      return {
        userPrompt: prompt,
        intent: {
          type: 'unfulfillable',
          explanation: `The requested tool "${selectedPayload.toolName}" is not available.`,
        },
        responseMessage: `The requested tool "${selectedPayload.toolName}" is not available.`,
      };
    }

    // Validate and execute tool
    const executionResult = await ToolRegistry.executeTool(
      selectedPayload.toolName,
      selectedPayload.input || {},
      context
    );

    const intent: ToolCallIntent = {
      type: 'tool_call',
      toolName: selectedPayload.toolName,
      input: selectedPayload.input,
      explanation: selectedPayload.explanation,
    };

    if (!executionResult.success) {
      return {
        userPrompt: prompt,
        intent,
        toolExecutionResult: executionResult,
        responseMessage: executionResult.error || 'Failed to execute the requested tool.',
      };
    }

    return {
      userPrompt: prompt,
      intent,
      toolExecutionResult: executionResult,
      responseMessage: executionResult.message || `Successfully executed ${selectedPayload.toolName}`,
      data: executionResult.data,
    };
  }
}
