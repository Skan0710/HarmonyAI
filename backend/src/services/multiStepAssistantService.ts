import dotenv from 'dotenv';
import { ToolRegistry } from '../tools/toolRegistry.js';
import { AssistantToolContext, ToolExecutionResult } from '../tools/toolTypes.js';
import { AssistantIntentService, ToolCallIntent } from './assistantIntentService.js';

dotenv.config();

export interface StepExecutionRecord {
  stepNumber: number;
  toolName: string;
  input: Record<string, any>;
  result: ToolExecutionResult;
  success: boolean;
  message?: string;
}

export interface MultiStepExecutionResult {
  userPrompt: string;
  isMultiStep: boolean;
  status: 'completed' | 'partial_failure' | 'failed';
  totalSteps: number;
  stepsExecuted: StepExecutionRecord[];
  finalData?: any;
  responseMessage: string;
}

export interface MultiStepConfig {
  maxStepsPerRequest: number; // default: 5 (prevents infinite execution loops)
}

export const DEFAULT_MULTISTEP_CONFIG: MultiStepConfig = {
  maxStepsPerRequest: 5,
};

let currentMultiStepConfig: MultiStepConfig = { ...DEFAULT_MULTISTEP_CONFIG };

export const getMultiStepConfig = (): MultiStepConfig => {
  return { ...currentMultiStepConfig };
};

export const updateMultiStepConfig = (config: Partial<MultiStepConfig>): MultiStepConfig => {
  currentMultiStepConfig = { ...currentMultiStepConfig, ...config };
  return { ...currentMultiStepConfig };
};

export const resetMultiStepConfig = (): MultiStepConfig => {
  currentMultiStepConfig = { ...DEFAULT_MULTISTEP_CONFIG };
  return { ...currentMultiStepConfig };
};

export class MultiStepAssistantService {
  /**
   * Identifies if a user prompt implies a multi-step composite action.
   * e.g., "Create a playlist for late night coding and add 15 suitable songs"
   */
  static isCompositeMultiStepRequest(prompt: string): boolean {
    const clean = prompt.trim().toLowerCase();

    // Pattern 1: Create playlist with generated recommendations / vibes / suitable songs
    if (
      (clean.includes('create') || clean.includes('make') || clean.includes('generate')) &&
      clean.includes('playlist') &&
      (clean.includes('study') ||
        clean.includes('coding') ||
        clean.includes('workout') ||
        clean.includes('chill') ||
        clean.includes('focus') ||
        clean.includes('recommend') ||
        clean.includes('add') ||
        clean.includes('late night') ||
        clean.includes('suitable songs') ||
        clean.includes('tracks'))
    ) {
      return true;
    }

    // Pattern 2: Search/recommend and queue
    if (
      (clean.includes('find') || clean.includes('search') || clean.includes('recommend')) &&
      (clean.includes('queue') || clean.includes('play next') || clean.includes('add to queue'))
    ) {
      return true;
    }

    // Pattern 3: Compound connectors like "and then", "and add to", "and queue"
    if (clean.includes(' and add ') || clean.includes(' and then ') || clean.includes(' and queue ')) {
      return true;
    }

    return false;
  }

  /**
   * Plans the sequential tool execution steps for composite actions.
   */
  static planMultiStepActions(
    prompt: string,
    context: AssistantToolContext
  ): { toolName: string; input: Record<string, any>; stepDescription: string }[] {
    const clean = prompt.trim().toLowerCase();
    const plan: { toolName: string; input: Record<string, any>; stepDescription: string }[] = [];

    // Extract desired song count limit if specified (e.g. "add 15 suitable songs", "10 tracks")
    const countMatch = clean.match(/(\d+)\s+(?:suitable\s+)?(?:songs|tracks|items)/i);
    const requestedCount = countMatch ? parseInt(countMatch[1], 10) : 10;
    const safeLimit = Math.max(1, Math.min(30, requestedCount));

    // Scenario A: Create Playlist with Curated Recommendations (Recommend -> Create -> Add)
    if (
      (clean.includes('create') || clean.includes('make') || clean.includes('generate')) &&
      clean.includes('playlist')
    ) {
      let mood: string | undefined;
      let activity: string | undefined;
      let playlistName = 'My Curated Playlist';

      if (clean.includes('late night coding') || clean.includes('coding')) {
        activity = 'Coding';
        playlistName = 'Late Night Coding';
      } else if (clean.includes('study') || clean.includes('focus')) {
        activity = 'Study';
        playlistName = 'Study Focus Session';
      } else if (clean.includes('workout') || clean.includes('gym')) {
        activity = 'Workout';
        playlistName = 'High Energy Workout';
      } else if (clean.includes('chill') || clean.includes('relax')) {
        mood = 'Chill';
        playlistName = 'Chill Vibes';
      } else {
        const match = prompt.match(/(?:for|called|named|titled)\s+["']?([^"'\n\r,]+?)["']?(?:\s+and|$)/i);
        if (match && match[1]) {
          playlistName = match[1].trim();
        }
      }

      // Step 1: Generate Recommendations / Discover Songs
      plan.push({
        toolName: 'get_recommendations',
        input: {
          strategy: mood || activity ? 'contextual' : 'hybrid',
          mood,
          activity,
          limit: safeLimit,
        },
        stepDescription: `Generate ${safeLimit} ${activity || mood || 'personalized'} recommendations`,
      });

      // Step 2: Create Playlist with the discovered songs
      plan.push({
        toolName: 'create_playlist',
        input: {
          name: playlistName,
          description: `AI-curated playlist for ${activity || mood || 'daily listening'} (${safeLimit} tracks)`,
          songIds: [], // Populated dynamically from Step 1 output
        },
        stepDescription: `Create playlist "${playlistName}" and add songs`,
      });

      return plan;
    }

    // Scenario B: Search / Recommend and Queue (Discover -> Queue)
    if (clean.includes('queue') || clean.includes('play next')) {
      const position = clean.includes('next') ? 'next' : 'end';

      if (clean.includes('vibe') || clean.includes('late night') || clean.includes('feel') || clean.includes('lofi') || clean.includes('chill') || clean.includes('beats')) {
        plan.push({
          toolName: 'semantic_search',
          input: { prompt, limit: safeLimit },
          stepDescription: `Search music matching vibe "${prompt}"`,
        });
      } else {
        plan.push({
          toolName: 'music_search',
          input: { query: prompt.replace(/and\s+(?:queue|play next).*/i, '').trim(), limit: safeLimit },
          stepDescription: 'Search catalog tracks',
        });
      }

      plan.push({
        toolName: 'add_to_queue',
        input: { position, songIds: [] }, // Populated dynamically from Step 1 output
        stepDescription: `Queue tracks (${position === 'next' ? 'play next' : 'queue end'})`,
      });

      return plan;
    }

    // Default single-step fallback
    const singleIntent = AssistantIntentService.selectIntentRuleBased(prompt, context);
    if (singleIntent.type === 'tool_call' && singleIntent.toolName) {
      plan.push({
        toolName: singleIntent.toolName,
        input: singleIntent.input || {},
        stepDescription: singleIntent.explanation,
      });
    }

    return plan;
  }

  /**
   * Executes a multi-step assistant action workflow safely with loop prevention and step validation.
   */
  static async executeMultiStepAction(
    prompt: string,
    context: AssistantToolContext,
    customConfig?: Partial<MultiStepConfig>
  ): Promise<MultiStepExecutionResult> {
    const config = { ...getMultiStepConfig(), ...customConfig };
    const isMulti = this.isCompositeMultiStepRequest(prompt);
    const plan = this.planMultiStepActions(prompt, context);

    if (plan.length === 0) {
      return {
        userPrompt: prompt,
        isMultiStep: false,
        status: 'failed',
        totalSteps: 0,
        stepsExecuted: [],
        responseMessage: 'Could not determine an actionable plan for this request.',
      };
    }

    const stepsExecuted: StepExecutionRecord[] = [];
    let intermediateSongIds: string[] = [];
    let lastSuccessfulData: any = null;

    const maxSteps = Math.min(plan.length, config.maxStepsPerRequest);

    for (let i = 0; i < maxSteps; i++) {
      const step = plan[i];
      const stepNumber = i + 1;

      // Dynamic parameter chaining from prior step output
      const stepInput = { ...step.input };
      if (step.toolName === 'create_playlist' && intermediateSongIds.length > 0) {
        stepInput.songIds = intermediateSongIds;
      } else if (step.toolName === 'add_to_queue' && intermediateSongIds.length > 0) {
        stepInput.songIds = intermediateSongIds;
      } else if (step.toolName === 'add_to_playlist' && intermediateSongIds.length > 0) {
        stepInput.songIds = intermediateSongIds;
      }

      // Execute Step with Validation
      const result = await ToolRegistry.executeTool(step.toolName, stepInput, context);

      const record: StepExecutionRecord = {
        stepNumber,
        toolName: step.toolName,
        input: stepInput,
        result,
        success: result.success,
        message: result.message || result.error,
      };

      stepsExecuted.push(record);

      // Halt execution immediately on step failure
      if (!result.success) {
        return {
          userPrompt: prompt,
          isMultiStep: isMulti,
          status: stepsExecuted.length > 1 ? 'partial_failure' : 'failed',
          totalSteps: stepsExecuted.length,
          stepsExecuted,
          responseMessage: `Step ${stepNumber} (${step.toolName}) failed: ${result.error || 'Unknown error'}. Execution halted safely.`,
        };
      }

      lastSuccessfulData = result.data;

      // Extract song IDs for chaining to subsequent steps
      if (result.data) {
        if (Array.isArray(result.data.recommendations)) {
          intermediateSongIds = result.data.recommendations
            .map((r: any) => r.song?._id?.toString() || r._id?.toString())
            .filter(Boolean);
        } else if (Array.isArray(result.data.songs)) {
          intermediateSongIds = result.data.songs
            .map((s: any) => s._id?.toString() || s.toString())
            .filter(Boolean);
        } else if (Array.isArray(result.data)) {
          intermediateSongIds = result.data
            .map((item: any) => item.song?._id?.toString() || item._id?.toString())
            .filter(Boolean);
        }
      }
    }

    return {
      userPrompt: prompt,
      isMultiStep: isMulti,
      status: 'completed',
      totalSteps: stepsExecuted.length,
      stepsExecuted,
      finalData: lastSuccessfulData,
      responseMessage: `Successfully completed ${stepsExecuted.length} step action for: "${prompt}"`,
    };
  }
}
