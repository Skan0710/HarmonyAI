import dotenv from 'dotenv';
import { ToolRegistry } from '../tools/toolRegistry.js';
import { AssistantToolContext, ToolExecutionResult } from '../tools/toolTypes.js';

dotenv.config();

export interface ToolCallIntent {
  type: 'tool_call' | 'clarification' | 'unfulfillable';
  toolName?: string;
  input?: Record<string, any>;
  explanation: string;
}

export interface AssistantResponse {
  userPrompt: string;
  intent: ToolCallIntent;
  toolExecutionResult?: ToolExecutionResult;
  responseMessage: string;
  data?: any;
}

export class AssistantIntentService {
  /**
   * Deterministic rule-based intent and tool selector used for offline testing or fallback.
   * Prevents hallucinating nonexistent tools and maps clear music intent.
   */
  static selectIntentRuleBased(prompt: string, context: AssistantToolContext): ToolCallIntent {
    const clean = prompt.trim().toLowerCase();

    // 1. Unfulfillable non-music or general trivia queries
    const nonMusicPatterns = [
      'weather',
      'capital of',
      'recipe',
      'stock price',
      'president',
      'who won the game',
      'translate to',
      'write python code',
      'how do i bake',
    ];
    if (nonMusicPatterns.some((pattern) => clean.includes(pattern))) {
      return {
        type: 'unfulfillable',
        explanation: 'I am your HarmonyAI Music Assistant. I can only assist with discovering songs, exploring music vibes, generating recommendations, managing playlists, and controlling your queue.',
      };
    }

    // 2. Playlist Creation Intent
    if (clean.includes('create a playlist') || clean.includes('create playlist') || clean.includes('make a playlist') || clean.includes('new playlist')) {
      const match = prompt.match(/(?:called|named|titled)\s+["']?([^"'\n\r]+?)["']?$/i);
      const name = match && match[1]
        ? match[1].trim()
        : 'My AI Playlist';

      return {
        type: 'tool_call',
        toolName: 'create_playlist',
        input: { name },
        explanation: `Creating a new playlist named "${name}".`,
      };
    }

    // 3. Add to Playlist Intent
    if ((clean.includes('add') && clean.includes('to playlist')) || clean.includes('save to playlist')) {
      return {
        type: 'tool_call',
        toolName: 'add_to_playlist',
        input: { playlistId: '', songIds: [] },
        explanation: 'Adding songs to playlist.',
      };
    }

    // 4. Remove from Playlist Intent
    if (clean.includes('remove') && clean.includes('from playlist')) {
      return {
        type: 'tool_call',
        toolName: 'remove_from_playlist',
        input: { playlistId: '', songIds: [] },
        explanation: 'Removing songs from playlist.',
      };
    }

    // 5. Clear Queue Intent
    if ((clean.includes('clear') && clean.includes('queue')) || clean.includes('empty queue')) {
      return {
        type: 'tool_call',
        toolName: 'clear_queue',
        input: { preserveCurrentTrack: true },
        explanation: 'Clearing upcoming playback queue.',
      };
    }

    // 6. Queue Next / Add to Queue Intent
    if (clean.includes('next') || clean.includes('queue') || clean.includes('play next') || clean.includes('add to queue') || clean.includes('queue up')) {
      const position = clean.includes('next') ? 'next' : 'end';
      return {
        type: 'tool_call',
        toolName: 'add_to_queue',
        input: { position, songIds: [] },
        explanation: `Adding songs to playback queue (${position === 'next' ? 'play next' : 'queue end'}).`,
      };
    }

    // 7. User Preference / Taste Profile Retrieval
    if (clean.includes('my preferences') || clean.includes('my taste') || clean.includes('my favorite') || clean.includes('top genres') || clean.includes('top artists')) {
      return {
        type: 'tool_call',
        toolName: 'get_user_preferences',
        input: { timeframe: 'combined' },
        explanation: 'Retrieving your active music taste profile and listening preferences.',
      };
    }

    // 8. Semantic Search Intent (Abstract vibes, moods, acoustic textures)
    const semanticKeywords = ['vibe', 'feeling', 'sounds like', 'atmosphere', 'acoustic', 'late night', 'aesthetic', 'texture'];
    if (semanticKeywords.some((kw) => clean.includes(kw)) || clean.startsWith('find music like') || clean.startsWith('songs that feel')) {
      return {
        type: 'tool_call',
        toolName: 'semantic_search',
        input: { prompt, limit: 10 },
        explanation: `Exploring catalogue for vibe: "${prompt}".`,
      };
    }

    // 9. Recommendation Intent (Personalized, Contextual, or Session)
    if (clean.includes('recommend') || clean.includes('suggest') || clean.includes('for study') || clean.includes('for workout') || clean.includes('chill music')) {
      let mood: string | undefined = undefined;
      let activity: string | undefined = undefined;

      if (clean.includes('workout') || clean.includes('gym')) activity = 'Workout';
      if (clean.includes('study') || clean.includes('focus')) activity = 'Study';
      if (clean.includes('chill') || clean.includes('relax')) mood = 'Chill';
      if (clean.includes('energetic') || clean.includes('upbeat')) mood = 'Energetic';

      return {
        type: 'tool_call',
        toolName: 'get_recommendations',
        input: {
          strategy: mood || activity ? 'contextual' : 'hybrid',
          mood,
          activity,
          limit: 10,
        },
        explanation: `Fetching ${mood || activity ? 'contextual' : 'personalized'} recommendations.`,
      };
    }

    // 10. Default Catalog Keyword Music Search
    return {
      type: 'tool_call',
      toolName: 'music_search',
      input: { query: prompt, limit: 10 },
      explanation: `Searching catalogue for "${prompt}".`,
    };
  }

  /**
   * Evaluates user intent using LLM function calling / structured tool selection with fallback to rule-based analysis.
   */
  static async selectIntent(prompt: string, context: AssistantToolContext): Promise<ToolCallIntent> {
    const trimmedPrompt = (prompt || '').trim().slice(0, 500); // 500 chars limit to prevent token abuse
    if (!trimmedPrompt) {
      return {
        type: 'unfulfillable',
        explanation: 'Please provide a music request, search query, or command.',
      };
    }

    const apiKey = process.env.GEMINI_API_KEY;
    const modelName = process.env.LLM_MODEL || 'gemini-1.5-flash';

    if (!apiKey) {
      return this.selectIntentRuleBased(trimmedPrompt, context);
    }

    try {
      const toolDefinitions = ToolRegistry.getToolDefinitions();
      const toolSchemasJson = JSON.stringify(toolDefinitions);

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

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: systemInstruction },
                  { text: `User Context: userId=${context.userId || 'anonymous'}\nUser Request: "${trimmedPrompt}"` },
                ],
              },
            ],
          }),
        }
      );

      if (response.ok) {
        const data: any = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const jsonMatch = rawText.match(/\{[\s\S]*\}/);

        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          if (parsed.type === 'tool_call' && parsed.toolName) {
            // Verify tool is registered
            if (ToolRegistry.getTool(parsed.toolName)) {
              return {
                type: 'tool_call',
                toolName: parsed.toolName,
                input: parsed.input || {},
                explanation: parsed.explanation || `Selected tool ${parsed.toolName}`,
              };
            }
          } else if (parsed.type === 'unfulfillable') {
            return {
              type: 'unfulfillable',
              explanation: parsed.explanation || 'I can only assist with music search, recommendations, playlists, and playback queue.',
            };
          }
        }
      }

      return this.selectIntentRuleBased(trimmedPrompt, context);
    } catch (err) {
      return this.selectIntentRuleBased(trimmedPrompt, context);
    }
  }

  /**
   * End-to-end assistant request processing:
   * 1. Detects intent & selects tool.
   * 2. Executes tool with input validation safeguards.
   * 3. Handles unfulfillable or invalid requests with clear explanations.
   */
  static async processAssistantRequest(
    prompt: string,
    context: AssistantToolContext
  ): Promise<AssistantResponse> {
    const intent = await this.selectIntent(prompt, context);

    if (intent.type === 'unfulfillable' || !intent.toolName) {
      return {
        userPrompt: prompt,
        intent,
        responseMessage: intent.explanation,
      };
    }

    // Execute Tool with Validation & Safeguards
    const executionResult = await ToolRegistry.executeTool(
      intent.toolName,
      intent.input || {},
      context
    );

    if (!executionResult.success) {
      return {
        userPrompt: prompt,
        intent,
        toolExecutionResult: executionResult,
        responseMessage: executionResult.error || 'Failed to complete the requested action.',
      };
    }

    return {
      userPrompt: prompt,
      intent,
      toolExecutionResult: executionResult,
      responseMessage: executionResult.message || `Successfully executed ${intent.toolName}`,
      data: executionResult.data,
    };
  }
}
