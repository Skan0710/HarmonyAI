import dotenv from 'dotenv';
import {
  ContextPreference,
  ContextMood,
  ContextActivity,
  ContextTimeOfDay,
  ContextInstrumentalPreference,
  validateAndSanitizeContextPreference,
} from '../schemas/contextPreferenceSchema.js';
import {
  ContextAwareRecommendationService,
  ContextualRecommendationResult,
} from './contextAwareRecommendationService.js';
import { ISong } from '../models/Song.js';

dotenv.config();

export interface ExtractedContextResponse {
  userPrompt: string;
  extractedContext: ContextPreference;
  recommendationResult: ContextualRecommendationResult;
  songs: ISong[];
}

export class ContextualAssistantService {
  /**
   * Deterministically extracts structured context parameters (mood, activity, timeOfDay, energyLevel)
   * from natural-language requests using rule-based pattern matching (used for local fallback or when GEMINI_API_KEY is unconfigured).
   */
  static extractContextRuleBased(prompt: string): Partial<ContextPreference> {
    const clean = prompt.trim().toLowerCase();

    let mood: ContextMood | undefined = undefined;
    let activity: ContextActivity | undefined = undefined;
    let timeOfDay: ContextTimeOfDay | undefined = undefined;
    let energyLevel: number | undefined = undefined;
    let instrumentalPreference: ContextInstrumentalPreference | undefined = undefined;

    // Mood extraction
    if (clean.includes('calm') || clean.includes('peaceful')) {
      mood = ContextMood.Calm;
    } else if (clean.includes('chill') || clean.includes('relax') || clean.includes('mellow')) {
      mood = ContextMood.Chill;
    } else if (
      clean.includes('energetic') ||
      clean.includes('upbeat') ||
      clean.includes('hyped') ||
      clean.includes('energy') ||
      clean.includes('high energy')
    ) {
      mood = ContextMood.Energetic;
    } else if (clean.includes('focus') || clean.includes('concentrate')) {
      mood = ContextMood.Focus;
    } else if (clean.includes('sad') || clean.includes('melancholy')) {
      mood = ContextMood.Melancholic;
    } else if (clean.includes('romantic') || clean.includes('love')) {
      mood = ContextMood.Romantic;
    }

    // Activity extraction
    if (clean.includes('study') || clean.includes('studying')) {
      activity = ContextActivity.Study;
    } else if (clean.includes('workout') || clean.includes('gym') || clean.includes('running')) {
      activity = ContextActivity.Workout;
    } else if (clean.includes('coding') || clean.includes('work') || clean.includes('programming')) {
      activity = ContextActivity.Coding;
    } else if (clean.includes('sleeping') || clean.includes('sleep') || clean.includes('bedtime')) {
      activity = ContextActivity.Sleeping;
    } else if (clean.includes('commute') || clean.includes('travel') || clean.includes('drive')) {
      activity = ContextActivity.Commute;
    }

    // Heuristic mood fallback if activity was found but mood was omitted
    if (!mood && activity === ContextActivity.Workout) {
      mood = ContextMood.Energetic;
    }

    // Time of day extraction
    if (clean.includes('late-night') || clean.includes('late night')) {
      timeOfDay = ContextTimeOfDay.LateNight;
    } else if (clean.includes('night') || clean.includes('evening')) {
      timeOfDay = ContextTimeOfDay.Night;
    } else if (clean.includes('morning')) {
      timeOfDay = ContextTimeOfDay.Morning;
    } else if (clean.includes('afternoon')) {
      timeOfDay = ContextTimeOfDay.Afternoon;
    }

    // Instrumental / vocal preference
    if (clean.includes('no vocals') || clean.includes('instrumental') || clean.includes('ambient')) {
      instrumentalPreference = ContextInstrumentalPreference.InstrumentalOnly;
    }

    // Energy level estimation
    if (clean.includes('high energy') || clean.includes('energy') || clean.includes('fast')) {
      energyLevel = 0.85;
    } else if (clean.includes('low energy') || clean.includes('soft') || clean.includes('quiet')) {
      energyLevel = 0.25;
    }

    return {
      mood,
      activity,
      timeOfDay,
      energyLevel,
      instrumentalPreference,
    };
  }

  /**
   * Extracts structured context preferences from a natural-language request using Gemini LLM if configured,
   * falling back safely to rule-based pattern matching.
   * DOES NOT GENERATE SONG NAMES; ONLY STRUCTURED CONTEXT PREFERENCES.
   */
  static async extractContextFromPrompt(userPrompt: string): Promise<ContextPreference> {
    const prompt = (userPrompt || '').trim().slice(0, 500); // 500 max length to prevent token abuse
    const apiKey = process.env.GEMINI_API_KEY;
    const modelName = process.env.LLM_MODEL || 'gemini-1.5-flash';

    if (!apiKey) {
      const fallbackExtracted = this.extractContextRuleBased(prompt);
      return validateAndSanitizeContextPreference(fallbackExtracted);
    }

    try {
      const systemInstruction = `You are a music context extraction engine.
Analyze the user request and output JSON strictly matching this schema:
{
  "mood": "Chill" | "Calm" | "Energetic" | "Melancholic" | "Upbeat" | "Focus" | "Relaxed" | "Party" | "Romantic" | null,
  "activity": "Workout" | "Study" | "Commute" | "Relaxing" | "Party" | "Sleeping" | "Coding" | "Cooking" | null,
  "timeOfDay": "Morning" | "Afternoon" | "Evening" | "Night" | "LateNight" | null,
  "energyLevel": float between 0.0 and 1.0 or null,
  "preferredDurationMinutes": integer or null,
  "language": string or null,
  "instrumentalPreference": "Any" | "VocalOnly" | "InstrumentalOnly" | "MostlyInstrumental" | null
}
IMPORTANT: DO NOT invent song titles, artist names, or song lists. Only output structured JSON.`;

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
                  { text: `User Request: "${prompt}"` },
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
          return validateAndSanitizeContextPreference(parsed);
        }
      }
    } catch (err: any) {
      console.warn(
        `[ContextualAssistantService Warning] LLM extraction failed: ${err.message}. Falling back to rule-based parser.`
      );
    }

    const fallbackExtracted = this.extractContextRuleBased(prompt);
    return validateAndSanitizeContextPreference(fallbackExtracted);
  }

  /**
   * Main entrypoint for natural-language contextual assistant requests:
   * 1. Extracts structured context from prompt.
   * 2. Passes structured context to ContextAwareRecommendationService.
   * 3. Returns real catalog songs with metadata.
   */
  static async processAssistantRequest(params: {
    userPrompt: string;
    userId?: string;
    limit?: number;
  }): Promise<ExtractedContextResponse> {
    const { userPrompt, userId, limit = 10 } = params;

    // 1. Extract structured context (no fake song names generated!)
    const extractedContext = await this.extractContextFromPrompt(userPrompt);

    // 2. Query contextual recommendation service
    const recommendationResult = await ContextAwareRecommendationService.getContextualRecommendations({
      userId,
      mood: extractedContext.mood,
      activity: extractedContext.activity,
      energyLevel: extractedContext.energyLevel,
      durationMinutes: extractedContext.preferredDurationMinutes,
      limit,
    });

    // 3. Extract real catalog songs
    const songs = recommendationResult.data.map((item) => item.song);

    return {
      userPrompt,
      extractedContext,
      recommendationResult,
      songs,
    };
  }
}
