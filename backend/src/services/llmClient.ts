import dotenv from 'dotenv';
dotenv.config();

/**
 * Shared Groq chat-completion client.
 *
 * Groq's API is OpenAI-compatible, so every LLM call site in this codebase
 * (tool selection, context extraction, playlist interpretation) goes through
 * this single helper instead of duplicating the fetch/parsing logic per file.
 *
 * Groq has no hosted embeddings endpoint — see embeddingService.ts, which
 * uses a local deterministic provider instead.
 */

const GROQ_CHAT_COMPLETIONS_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.1-8b-instant';

export function hasGroqKey(): boolean {
  return Boolean(process.env.GROQ_API_KEY);
}

export function getGroqModel(): string {
  return process.env.LLM_MODEL || DEFAULT_MODEL;
}

/**
 * Sends a system + user message pair to Groq and returns the raw text completion.
 * Throws if GROQ_API_KEY is not configured or the request fails — callers are
 * expected to catch and fall back to a rule-based/local implementation.
 */
export async function generateGroqCompletion(
  systemPrompt: string,
  userPrompt: string,
  options: { temperature?: number } = {}
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY environment variable is not configured');
  }

  const response = await fetch(GROQ_CHAT_COMPLETIONS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getGroqModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: options.temperature ?? 0.3,
    }),
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(
      `Groq API request failed (${response.status}): ${errData?.error?.message || response.statusText}`
    );
  }

  const data: any = await response.json();
  return data?.choices?.[0]?.message?.content || '';
}

/** Extracts the first {...} JSON object found in a raw LLM text response. */
export function extractJsonObject(rawText: string): any | null {
  const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    return null;
  }
}
