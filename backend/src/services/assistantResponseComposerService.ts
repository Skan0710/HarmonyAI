import dotenv from 'dotenv';
import { ToolExecutionResult } from '../tools/toolTypes.js';

dotenv.config();

export interface ComposeAnswerParams {
  prompt: string;
  intentType: 'tool_call' | 'clarification' | 'unfulfillable';
  toolName?: string;
  toolResult?: ToolExecutionResult;
  explanation?: string;
}

interface GroundingSong {
  title: string;
  artist: string;
  genre?: string;
}

/**
 * Extracts a small, compact list of real songs from a tool's result payload, regardless of
 * which shape that tool returns them in (songs[], recommendations[], tracks[], etc.).
 */
const extractGroundingSongs = (data: any): GroundingSong[] => {
  if (!data) return [];

  const rawList: any[] =
    (Array.isArray(data.songs) && data.songs) ||
    (Array.isArray(data.recommendations) && data.recommendations) ||
    (Array.isArray(data.tracks) && data.tracks) ||
    (Array.isArray(data) && data) ||
    [];

  return rawList
    .slice(0, 12)
    .map((entry: any) => {
      const song = entry?.song || entry;
      if (!song || !song.title) return null;
      const artist =
        typeof song.artist === 'object' && song.artist?.name ? song.artist.name : String(song.artist || 'Unknown Artist');
      const genre =
        typeof song.genre === 'object' && song.genre?.name ? song.genre.name : song.genre ? String(song.genre) : undefined;
      return { title: String(song.title), artist, genre };
    })
    .filter(Boolean) as GroundingSong[];
};

/**
 * Extracts a compact taste-profile summary (top genres/artists/moods) when the tool result
 * represents user preference data rather than a song list.
 */
const extractPreferenceSummary = (data: any): Record<string, any> | null => {
  if (!data || (!Array.isArray(data.topGenres) && !Array.isArray(data.topArtists))) return null;

  return {
    topGenres: (data.topGenres || []).slice(0, 5).map((g: any) => g.name || g.genreId).filter(Boolean),
    topArtists: (data.topArtists || []).slice(0, 5).map((a: any) => a.name || a.artistId).filter(Boolean),
    preferredMoods: data.preferredMoods,
    preferredLanguages: data.preferredLanguages,
  };
};

/**
 * Builds a deterministic, non-LLM natural-language answer from the tool's grounding data.
 * Used when no LLM provider is configured or the LLM call fails — still a real answer to what
 * was asked, not a generic "successfully executed" placeholder.
 */
const composeFallbackAnswer = (params: ComposeAnswerParams): string => {
  const { intentType, toolResult, explanation } = params;

  if (intentType !== 'tool_call' || !toolResult) {
    return explanation || 'I can help you discover songs, build playlists, and explore your taste in music — what would you like to do?';
  }

  if (!toolResult.success) {
    return toolResult.error || 'I ran into a problem completing that — please try rephrasing your request.';
  }

  const preferenceSummary = extractPreferenceSummary(toolResult.data);
  if (preferenceSummary) {
    const parts: string[] = [];
    if (preferenceSummary.topGenres.length > 0) {
      parts.push(`your top genres are ${preferenceSummary.topGenres.join(', ')}`);
    }
    if (preferenceSummary.topArtists.length > 0) {
      parts.push(`your most-played artists include ${preferenceSummary.topArtists.join(', ')}`);
    }
    if (parts.length === 0) {
      return "I don't have enough listening history yet to build a taste profile for you — try playing a few more songs first.";
    }
    return `Based on your listening history, ${parts.join(', and ')}.`;
  }

  const songs = extractGroundingSongs(toolResult.data);
  if (songs.length > 0) {
    const listed = songs
      .slice(0, 5)
      .map((s) => `"${s.title}" by ${s.artist}`)
      .join(', ');
    const more = songs.length > 5 ? `, plus ${songs.length - 5} more` : '';
    return `${toolResult.message ? `${toolResult.message}. ` : ''}Here's what I found: ${listed}${more}.`;
  }

  return toolResult.message || 'Done.';
};

/**
 * Generates the assistant's actual reply to the user by grounding an LLM call in the real
 * tool-execution data (song titles, genres, taste profile, action outcome), so the response
 * directly answers what was asked instead of a generic "tool executed" confirmation.
 * Falls back to a deterministic, data-grounded summary if no LLM provider is configured or
 * the call fails, so the user still gets a real answer rather than a canned placeholder.
 */
export class AssistantResponseComposerService {
  static async composeAnswer(params: ComposeAnswerParams): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    const modelName = process.env.LLM_MODEL || 'gemini-2.5-flash';

    const fallback = composeFallbackAnswer(params);
    if (!apiKey) return fallback;

    const { prompt, intentType, toolResult, explanation } = params;

    const songs = intentType === 'tool_call' ? extractGroundingSongs(toolResult?.data) : [];
    const preferences = intentType === 'tool_call' ? extractPreferenceSummary(toolResult?.data) : null;

    const groundingData = {
      toolSucceeded: toolResult?.success ?? null,
      toolMessage: toolResult?.message || toolResult?.error || null,
      matchedSongs: songs,
      tasteProfile: preferences,
      unfulfillableReason: intentType !== 'tool_call' ? explanation : null,
    };

    const systemInstruction = `You are HarmonyAI's music assistant, chatting directly with a user.
Answer the user's message below in a natural, conversational, and DIRECT way — actually answer what they asked.
Ground every factual claim (song titles, artist names, genres, counts) ONLY in the JSON data provided. Never invent
songs, artists, or facts that are not present in that data.
If the data shows no matching songs or an error, say so plainly and suggest one concrete next step.
Keep the reply to 1-4 sentences, warm and specific — no filler like "Successfully executed" or "I have processed your request".

Grounding data (the only source of truth for facts):
${JSON.stringify(groundingData)}`;

    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: systemInstruction }, { text: `User message: "${prompt}"` }],
              },
            ],
          }),
        }
      );

      if (!response.ok) return fallback;

      const data: any = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      return text || fallback;
    } catch {
      return fallback;
    }
  }
}
