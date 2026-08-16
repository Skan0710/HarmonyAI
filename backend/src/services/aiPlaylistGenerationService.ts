import dotenv from 'dotenv';
import {
  AIPlaylistPreference,
  validateAndSanitizePlaylistPreference,
} from '../schemas/aiPlaylistPreferenceSchema.js';

dotenv.config();

export { AIPlaylistPreference as ParsedPlaylistConcept };

export interface ILLMPlaylistInterpreter {
  name: string;
  interpretPrompt(userPrompt: string): Promise<AIPlaylistPreference>;
}

/**
 * Fallback & local development LLM interpreter extracting structured playlist concepts
 * using natural-language pattern matching and heuristic rules.
 */
export class RuleBasedFallbackLLMInterpreter implements ILLMPlaylistInterpreter {
  name = 'rule_based_fallback';

  async interpretPrompt(userPrompt: string): Promise<AIPlaylistPreference> {
    const cleanPrompt = (userPrompt || '').trim().toLowerCase();

    let targetMood = 'Chill';
    let energy = 0.5;
    let valence = 0.5;
    let bpm = 120;
    const genres: string[] = [];
    const keywords: string[] = [];

    // Mood & Energy detection
    if (cleanPrompt.includes('workout') || cleanPrompt.includes('gym') || cleanPrompt.includes('energetic') || cleanPrompt.includes('run')) {
      targetMood = 'Energetic';
      energy = 0.85;
      bpm = 140;
      keywords.push('workout', 'energetic', 'high energy');
    } else if (cleanPrompt.includes('chill') || cleanPrompt.includes('relax') || cleanPrompt.includes('sleep') || cleanPrompt.includes('study')) {
      targetMood = 'Chill';
      energy = 0.35;
      bpm = 90;
      keywords.push('chill', 'relax', 'focus');
    } else if (cleanPrompt.includes('sad') || cleanPrompt.includes('melancholic') || cleanPrompt.includes('rainy')) {
      targetMood = 'Melancholic';
      energy = 0.3;
      valence = 0.25;
      bpm = 85;
      keywords.push('sad', 'melancholic');
    } else if (cleanPrompt.includes('party') || cleanPrompt.includes('dance') || cleanPrompt.includes('club')) {
      targetMood = 'Upbeat';
      energy = 0.9;
      valence = 0.85;
      bpm = 128;
      keywords.push('party', 'dance');
    }

    // Genre detection
    if (cleanPrompt.includes('synthwave') || cleanPrompt.includes('retro') || cleanPrompt.includes('80s')) {
      genres.push('Synthwave');
    }
    if (cleanPrompt.includes('rock') || cleanPrompt.includes('metal')) {
      genres.push('Rock');
    }
    if (cleanPrompt.includes('pop') || cleanPrompt.includes('top 40')) {
      genres.push('Pop');
    }
    if (cleanPrompt.includes('jazz') || cleanPrompt.includes('blues')) {
      genres.push('Jazz');
    }

    // Fallback title generation
    const titleWords = userPrompt.trim().split(/\s+/).slice(0, 4).join(' ');
    const title = titleWords
      ? `${titleWords.charAt(0).toUpperCase() + titleWords.slice(1)} Mix`
      : 'Custom AI Playlist';

    const rawConcept = {
      title,
      description: `AI-curated mix matching "${userPrompt.trim()}"`,
      requestedMood: targetMood,
      genres: genres.length > 0 ? genres : ['Music'],
      desiredTempoBpm: bpm,
      energyLevel: energy,
      desiredValence: valence,
      searchKeywords: keywords.length > 0 ? keywords : [cleanPrompt],
      requestedSongCount: 12,
    };

    return validateAndSanitizePlaylistPreference(rawConcept);
  }
}

/**
 * Gemini LLM Playlist Interpreter utilizing process.env.GEMINI_API_KEY and configurable process.env.LLM_MODEL
 */
export class GeminiLLMInterpreter implements ILLMPlaylistInterpreter {
  name = 'gemini';
  private apiKey: string;
  private modelName: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
    this.modelName = process.env.LLM_MODEL || 'gemini-1.5-flash';
  }

  async interpretPrompt(userPrompt: string): Promise<AIPlaylistPreference> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }

    const systemPrompt = `You are a professional music curator. Interpret the user's natural-language playlist request into a valid JSON object matching this schema strictly without generating specific song track names or extra text:
{
  "title": "Creative Playlist Title",
  "description": "Engaging description",
  "requestedMood": "Chill|Energetic|Melancholic|Upbeat|Focus",
  "genres": ["Genre1", "Genre2"],
  "artists": ["Artist1"],
  "language": "English",
  "energyLevel": 0.85,
  "tempoPreference": "fast",
  "acousticPreference": 0.2,
  "instrumentalPreference": 0.1,
  "requestedSongCount": 12,
  "excludedArtists": [],
  "excludedGenres": [],
  "searchKeywords": ["keyword1", "keyword2"]
}
DO NOT include specific song track titles in the output. Extract only playlist preferences and metadata.`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.modelName}:generateContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  { text: `${systemPrompt}\nUser Request: "${userPrompt.trim()}"` },
                ],
              },
            ],
          }),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          `Gemini API request failed (${response.status}): ${
            errData?.error?.message || response.statusText
          }`
        );
      }

      const data = await response.json();
      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Clean Markdown JSON wrapping if present (e.g. ```json ... ```)
      const cleanJson = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      
      let parsed: any;
      try {
        parsed = JSON.parse(cleanJson);
      } catch (parseError: any) {
        throw new Error(`Malformed JSON response from LLM: ${parseError.message}`);
      }

      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid non-object payload returned by Gemini API');
      }

      return validateAndSanitizePlaylistPreference(parsed);
    } catch (err: any) {
      throw new Error(`LLM playlist interpretation failed: ${err.message}`);
    }
  }
}

export class AIPlaylistGenerationService {
  private static activeInterpreter: ILLMPlaylistInterpreter;
  public static readonly MAX_PROMPT_LENGTH = 500;

  /**
   * Resolves active LLM playlist interpreter based on process.env.LLM_PROVIDER and GEMINI_API_KEY
   */
  static getInterpreter(): ILLMPlaylistInterpreter {
    if (this.activeInterpreter) {
      return this.activeInterpreter;
    }

    const providerEnv = (process.env.LLM_PROVIDER || '').toLowerCase();
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);

    if ((providerEnv === 'gemini' || !providerEnv) && hasGeminiKey) {
      this.activeInterpreter = new GeminiLLMInterpreter();
    } else {
      this.activeInterpreter = new RuleBasedFallbackLLMInterpreter();
    }

    return this.activeInterpreter;
  }

  /**
   * Allows replacing or setting custom LLM interpreter at runtime (e.g. OpenAI, Claude, or Test Mock).
   */
  static setInterpreter(interpreter: ILLMPlaylistInterpreter): void {
    this.activeInterpreter = interpreter;
  }

  /**
   * Resets active interpreter to allow re-initialization from environment configuration.
   */
  static resetInterpreter(): void {
    this.activeInterpreter = undefined as any;
  }

  /**
   * Accepts a user's natural-language playlist request text, enforces a maximum prompt length limit (500 chars),
   * requests structured JSON preferences matching AIPlaylistPreference, validates the response, handles malformed AI responses
   * gracefully, and returns ONLY structured playlist preferences without generating song names.
   */
  static async extractPlaylistPreferences(
    userPrompt: string,
    maxPromptLength: number = AIPlaylistGenerationService.MAX_PROMPT_LENGTH
  ): Promise<AIPlaylistPreference> {
    if (!userPrompt || !userPrompt.trim()) {
      throw new Error('Playlist request prompt cannot be empty');
    }

    // Limit prompt length to prevent unnecessarily large prompts
    const sanitizedPrompt = userPrompt.trim().slice(0, maxPromptLength);

    try {
      const interpreter = this.getInterpreter();
      const rawConcept = await interpreter.interpretPrompt(sanitizedPrompt);
      return validateAndSanitizePlaylistPreference(rawConcept);
    } catch (error: any) {
      console.warn(`[AIPlaylistGenerationService Warning]: LLM extraction failed. Falling back gracefully to rule-based interpreter. Details: ${error.message}`);
      const fallback = new RuleBasedFallbackLLMInterpreter();
      const rawFallback = await fallback.interpretPrompt(sanitizedPrompt);
      return validateAndSanitizePlaylistPreference(rawFallback);
    }
  }

  /**
   * Legacy alias for extractPlaylistPreferences.
   */
  static async interpretPlaylistPrompt(userPrompt: string): Promise<AIPlaylistPreference> {
    return this.extractPlaylistPreferences(userPrompt);
  }
}
