import dotenv from 'dotenv';
dotenv.config();

export interface ParsedPlaylistConcept {
  title: string;
  description: string;
  targetMood?: string;
  targetGenres?: string[];
  desiredTempoBpm?: number;
  desiredEnergy?: number;
  desiredValence?: number;
  searchKeywords: string[];
  suggestedTrackCount: number;
}

export interface ILLMPlaylistInterpreter {
  name: string;
  interpretPrompt(userPrompt: string): Promise<ParsedPlaylistConcept>;
}

/**
 * Fallback & local development LLM interpreter extracting structured playlist concepts
 * using natural-language pattern matching and heuristic rules.
 */
export class RuleBasedFallbackLLMInterpreter implements ILLMPlaylistInterpreter {
  name = 'rule_based_fallback';

  async interpretPrompt(userPrompt: string): Promise<ParsedPlaylistConcept> {
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

    return {
      title,
      description: `AI-curated mix matching "${userPrompt.trim()}"`,
      targetMood,
      targetGenres: genres.length > 0 ? genres : ['Music'],
      desiredTempoBpm: bpm,
      desiredEnergy: energy,
      desiredValence: valence,
      searchKeywords: keywords.length > 0 ? keywords : [cleanPrompt],
      suggestedTrackCount: 12,
    };
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

  async interpretPrompt(userPrompt: string): Promise<ParsedPlaylistConcept> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }

    const systemPrompt = `You are a professional music curator. Interpret the user's natural-language playlist request into a valid JSON object matching this schema strictly without markdown or extra text:
{
  "title": "Creative Playlist Title",
  "description": "Engaging description",
  "targetMood": "Chill|Energetic|Melancholic|Upbeat|Focus",
  "targetGenres": ["Genre1", "Genre2"],
  "desiredTempoBpm": 120,
  "desiredEnergy": 0.5,
  "desiredValence": 0.5,
  "searchKeywords": ["keyword1", "keyword2"],
  "suggestedTrackCount": 10
}`;

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
      const parsed = JSON.parse(cleanJson);

      if (!parsed || typeof parsed !== 'object' || !parsed.title) {
        throw new Error('Invalid JSON structure returned by Gemini API');
      }

      return {
        title: String(parsed.title || 'AI Playlist').trim(),
        description: String(parsed.description || `Mix for "${userPrompt}"`).trim(),
        targetMood: parsed.targetMood ? String(parsed.targetMood) : undefined,
        targetGenres: Array.isArray(parsed.targetGenres) ? parsed.targetGenres.map(String) : undefined,
        desiredTempoBpm: typeof parsed.desiredTempoBpm === 'number' ? parsed.desiredTempoBpm : 120,
        desiredEnergy: typeof parsed.desiredEnergy === 'number' ? parsed.desiredEnergy : 0.5,
        desiredValence: typeof parsed.desiredValence === 'number' ? parsed.desiredValence : 0.5,
        searchKeywords: Array.isArray(parsed.searchKeywords) ? parsed.searchKeywords.map(String) : [userPrompt],
        suggestedTrackCount: typeof parsed.suggestedTrackCount === 'number' ? parsed.suggestedTrackCount : 10,
      };
    } catch (err: any) {
      throw new Error(`LLM playlist interpretation failed: ${err.message}`);
    }
  }
}

export class AIPlaylistGenerationService {
  private static activeInterpreter: ILLMPlaylistInterpreter;

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
   * Interprets a natural-language playlist request prompt into a structured playlist concept.
   * Catches API errors and invalid responses safely, falling back to rule-based interpretation.
   * Does NOT create playlists or modify the database yet.
   */
  static async interpretPlaylistPrompt(userPrompt: string): Promise<ParsedPlaylistConcept> {
    if (!userPrompt || !userPrompt.trim()) {
      throw new Error('User prompt is required for AI playlist interpretation');
    }

    try {
      const interpreter = this.getInterpreter();
      return await interpreter.interpretPrompt(userPrompt.trim());
    } catch (error: any) {
      console.warn(`[AIPlaylistGenerationService Warning]: LLM interpretation failed. Falling back to rule-based interpreter. Error: ${error.message}`);
      const fallback = new RuleBasedFallbackLLMInterpreter();
      return await fallback.interpretPrompt(userPrompt.trim());
    }
  }
}
