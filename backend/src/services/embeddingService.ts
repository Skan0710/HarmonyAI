import dotenv from 'dotenv';
dotenv.config();

export interface IEmbeddingProvider {
  name: string;
  dimension: number;
  generateEmbedding(text: string): Promise<number[]>;
  generateBatchEmbeddings?(texts: string[]): Promise<number[][]>;
}

/**
 * Deterministic local embedding provider for development, testing, and offline fallback.
 * Generates normalized float vector embeddings based on input text hashing & character trigram distribution.
 */
export class LocalDeterministicEmbeddingProvider implements IEmbeddingProvider {
  name = 'local_deterministic';
  dimension: number;

  constructor(dimension = 128) {
    this.dimension = dimension;
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!text || !text.trim()) {
      return new Array(this.dimension).fill(0);
    }

    const cleanText = text.trim().toLowerCase();
    const vector = new Array(this.dimension).fill(0);

    // Seed vector components using string hash and char trigrams
    for (let i = 0; i < cleanText.length; i++) {
      const charCode = cleanText.charCodeAt(i);
      const idx1 = (charCode + i * 31) % this.dimension;
      const idx2 = (charCode * 17 + i * 13) % this.dimension;

      vector[idx1] += Math.sin(charCode + i);
      vector[idx2] += Math.cos(charCode * 0.5 + i);
    }

    // Magnitude L2 Normalization
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    if (magnitude === 0) {
      return new Array(this.dimension).fill(0);
    }

    return vector.map((val) => Number((val / magnitude).toFixed(6)));
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.generateEmbedding(t)));
  }
}

/**
 * Gemini API Embedding Provider utilizing process.env.GEMINI_API_KEY
 */
export class GeminiEmbeddingProvider implements IEmbeddingProvider {
  name = 'gemini';
  dimension = 768;

  private apiKey: string;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || '';
  }

  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY environment variable is not configured');
    }

    if (!text || !text.trim()) {
      return new Array(this.dimension).fill(0);
    }

    try {
      // Fetch Gemini text embedding endpoint
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${this.apiKey}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: 'models/text-embedding-004',
            content: {
              parts: [{ text: text.trim() }],
            },
          }),
        }
      );

      if (!response.ok) {
        const errorJson = await response.json().catch(() => ({}));
        throw new Error(
          `Gemini API embedding request failed (${response.status}): ${
            errorJson?.error?.message || response.statusText
          }`
        );
      }

      const data = await response.json();
      const values: number[] = data?.embedding?.values || [];

      if (!Array.isArray(values) || values.length === 0) {
        throw new Error('Gemini API returned an empty embedding vector');
      }

      return values;
    } catch (err: any) {
      throw new Error(`Embedding generation error [GeminiProvider]: ${err.message}`);
    }
  }

  async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    return Promise.all(texts.map((t) => this.generateEmbedding(t)));
  }
}

export class EmbeddingService {
  private static activeProvider: IEmbeddingProvider;

  /**
   * Initializes or resolves active embedding provider based on environment variables:
   * EMBEDDING_PROVIDER ('gemini' | 'local_deterministic' | 'mock')
   */
  static getProvider(): IEmbeddingProvider {
    if (this.activeProvider) {
      return this.activeProvider;
    }

    const providerEnv = (process.env.EMBEDDING_PROVIDER || '').toLowerCase();
    const hasGeminiKey = Boolean(process.env.GEMINI_API_KEY);

    if ((providerEnv === 'gemini' || !providerEnv) && hasGeminiKey) {
      this.activeProvider = new GeminiEmbeddingProvider();
    } else {
      const dim = parseInt(process.env.EMBEDDING_DIMENSION || '128', 10);
      this.activeProvider = new LocalDeterministicEmbeddingProvider(isNaN(dim) ? 128 : dim);
    }

    return this.activeProvider;
  }

  /**
   * Allows replacing or setting custom embedding provider at runtime.
   */
  static setProvider(provider: IEmbeddingProvider): void {
    this.activeProvider = provider;
  }

  /**
   * Resets active provider to allow re-initialization from environment configuration.
   */
  static resetProvider(): void {
    this.activeProvider = undefined as any;
  }

  /**
   * Accepts a text representation and returns its vector embedding.
   * Swappable provider implementation with error handling.
   */
  static async generateEmbedding(text: string): Promise<number[]> {
    if (!text || !text.trim()) {
      const provider = this.getProvider();
      return new Array(provider.dimension).fill(0);
    }

    try {
      const provider = this.getProvider();
      return await provider.generateEmbedding(text);
    } catch (error: any) {
      // Fallback gracefully to deterministic provider on API network failures to keep system operational
      console.warn(`[EmbeddingService Warning]: Provider error. Falling back to local deterministic provider. Details: ${error.message}`);
      const fallbackProvider = new LocalDeterministicEmbeddingProvider(128);
      return await fallbackProvider.generateEmbedding(text);
    }
  }

  /**
   * Generates vector embeddings for a batch of text representations.
   */
  static async generateBatchEmbeddings(texts: string[]): Promise<number[][]> {
    if (!Array.isArray(texts) || texts.length === 0) {
      return [];
    }

    try {
      const provider = this.getProvider();
      if (provider.generateBatchEmbeddings) {
        return await provider.generateBatchEmbeddings(texts);
      }
      return await Promise.all(texts.map((t) => provider.generateEmbedding(t)));
    } catch (error: any) {
      console.warn(`[EmbeddingService Warning]: Batch provider error. Falling back to local provider.`);
      const fallbackProvider = new LocalDeterministicEmbeddingProvider(128);
      return await fallbackProvider.generateBatchEmbeddings(texts);
    }
  }
}
