export type RecommendationReasonType =
  | 'SIMILAR_TO_LIKED_SONGS'
  | 'SIMILAR_ARTIST'
  | 'PREFERRED_GENRE'
  | 'PREFERRED_MOOD'
  | 'PREFERRED_ENERGY'
  | 'SESSION_PREFERENCE'
  | 'DISCOVERY_OPPORTUNITY'
  | 'NOVELTY'
  | 'COLLABORATIVE_SIMILARITY'
  | 'USER_TASTE_SIMILARITY'
  | 'CONTENT_SIMILARITY'
  | 'POPULARITY';

export type RecommendationExplanationType = RecommendationReasonType;

export interface ExplanationItem {
  type: RecommendationReasonType;
  message: string;
  supportingValue?: number | string | Record<string, any>;
  importanceScore: number; // 0.0 to 1.0
  metadata?: Record<string, any>;
}

export interface RecommendationExplanation {
  songId: string;
  primaryExplanation: string;
  explanations: ExplanationItem[];
  reasons: ExplanationItem[];
  summary: string;
  confidenceScore: number;
}

export interface ExplanationThresholdConfig {
  minTasteAffinityThreshold: number;
  minContentSimilarityThreshold: number;
  minCollaborativeThreshold: number;
  minNoveltyThreshold: number;
  minSessionThreshold: number;
  minGenreAffinityThreshold: number;
  minArtistAffinityThreshold: number;
  minEnergyProximityThreshold: number;
  maxReasonsReturned: number;
  contradictionSuppression: boolean;
}

export const DEFAULT_EXPLANATION_THRESHOLDS: ExplanationThresholdConfig = {
  minTasteAffinityThreshold: 0.50,
  minContentSimilarityThreshold: 0.50,
  minCollaborativeThreshold: 0.50,
  minNoveltyThreshold: 0.50,
  minSessionThreshold: 0.50,
  minGenreAffinityThreshold: 0.40,
  minArtistAffinityThreshold: 0.40,
  minEnergyProximityThreshold: 0.25,
  maxReasonsReturned: 3,
  contradictionSuppression: true,
};

let activeExplanationThresholds: ExplanationThresholdConfig = { ...DEFAULT_EXPLANATION_THRESHOLDS };

export function getExplanationThresholds(): ExplanationThresholdConfig {
  return { ...activeExplanationThresholds };
}

export function updateExplanationThresholds(
  newThresholds: Partial<ExplanationThresholdConfig>
): ExplanationThresholdConfig {
  activeExplanationThresholds = {
    ...activeExplanationThresholds,
    ...newThresholds,
  };
  return { ...activeExplanationThresholds };
}

export function resetExplanationThresholds(): void {
  activeExplanationThresholds = { ...DEFAULT_EXPLANATION_THRESHOLDS };
}

export interface ExplanationSignalInput {
  song: any;
  componentScores?: {
    contentScore?: number;
    collaborativeScore?: number;
    userTasteAffinityScore?: number;
    popularityScore?: number;
    recencyScore?: number;
    noveltyScore?: number;
    sessionScore?: number;
    diversityScore?: number;
    genreScore?: number;
    artistScore?: number;
    [key: string]: any;
  };
  sources?: string[];
  similarityScore?: number;
  seedSong?: any;
  likedSongsSample?: any[];
  tasteProfile?: {
    combinedGenres?: { genreId?: string; name?: string; affinityScore?: number }[];
    combinedArtists?: { artistId?: string; name?: string; affinityScore?: number }[];
    preferredMoods?: string[];
    preferredLanguages?: string[];
    [key: string]: any;
  } | null;
  sessionPreferences?: {
    activeMood?: string;
    targetEnergy?: number;
    targetTempo?: number;
    sessionGenres?: string[];
    [key: string]: any;
  } | null;
  noveltyScore?: number;
  diversityAdjustment?: number;
  matchReason?: string;
  isDiscoveryOpportunity?: boolean;
  similarArtistName?: string;
}

export class RecommendationExplanationService {
  /**
   * Helper: Extracts artist name from song document or string
   */
  public static extractArtistName(artist: any): string {
    if (!artist) return '';
    if (typeof artist === 'string') return artist;
    if (typeof artist === 'object' && artist.name) return artist.name;
    return '';
  }

  /**
   * Helper: Extracts genre name from song document or string
   */
  public static extractGenreName(genre: any): string {
    if (!genre) return '';
    if (typeof genre === 'string') return genre;
    if (typeof genre === 'object' && genre.name) return genre.name;
    return '';
  }

  /**
   * Helper: Formats percentage integer from 0-1 float
   */
  public static toPercent(val: number): number {
    return Math.max(0, Math.min(100, Math.round(val * 100)));
  }

  /**
   * Identifies and extracts the strongest, most meaningful reasons behind a recommendation.
   * Ranks explanation reasons by importance and prevents contradictory claims.
   */
  public static extractStrongestReasons(
    input: ExplanationSignalInput,
    customThresholds?: Partial<ExplanationThresholdConfig>
  ): ExplanationItem[] {
    const thresholds: ExplanationThresholdConfig = {
      ...activeExplanationThresholds,
      ...customThresholds,
    };

    const {
      song,
      componentScores = {},
      sources = [],
      similarityScore,
      seedSong,
      likedSongsSample = [],
      tasteProfile,
      sessionPreferences,
      noveltyScore,
      diversityAdjustment,
      isDiscoveryOpportunity,
      similarArtistName,
    } = input;

    const artistName = this.extractArtistName(song?.artist);
    const genreName = this.extractGenreName(song?.genre);
    const audioFeatures = song?.audioFeatures || {};

    const rawReasons: ExplanationItem[] = [];

    // 1. Similar to Songs the User Liked
    const contentVal =
      similarityScore ??
      componentScores.contentScore ??
      componentScores.contentSimilarity ??
      (sources.includes('content') || sources.includes('seed_similarity') ? 0.85 : 0);

    if (contentVal >= thresholds.minContentSimilarityThreshold) {
      const pct = this.toPercent(contentVal);
      let refSongName = '';
      if (seedSong?.title) {
        refSongName = ` like "${seedSong.title}"`;
      } else if (Array.isArray(likedSongsSample) && likedSongsSample.length > 0 && likedSongsSample[0]?.title) {
        refSongName = ` like "${likedSongsSample[0].title}"`;
      }
      rawReasons.push({
        type: 'SIMILAR_TO_LIKED_SONGS',
        message: `Similar acoustic style and vibe to songs you liked${refSongName} (${pct}% match).`,
        supportingValue: contentVal,
        importanceScore: Number((contentVal * 0.95).toFixed(4)),
        metadata: {
          similarityScore: contentVal,
          referenceSong: seedSong?.title || (likedSongsSample[0]?.title ?? undefined),
        },
      });
    }

    // 2. Similar Artist / Favorite Artist
    let artistAffinity = 0;
    if (artistName && tasteProfile?.combinedArtists && Array.isArray(tasteProfile.combinedArtists)) {
      const matchedArtist = tasteProfile.combinedArtists.find(
        (a) => a.name?.toLowerCase() === artistName.toLowerCase() || a.artistId === String(song?.artist?._id || song?.artist)
      );
      if (matchedArtist && (matchedArtist.affinityScore || 0) >= thresholds.minArtistAffinityThreshold) {
        artistAffinity = matchedArtist.affinityScore || 0.85;
      }
    }

    if (artistAffinity >= thresholds.minArtistAffinityThreshold) {
      const pct = this.toPercent(artistAffinity);
      rawReasons.push({
        type: 'SIMILAR_ARTIST',
        message: `By ${artistName}, an artist in your top listening rotation (${pct}% affinity).`,
        supportingValue: artistName,
        importanceScore: Number((artistAffinity * 0.92).toFixed(4)),
        metadata: { artist: artistName, affinityScore: artistAffinity, isDirectArtist: true },
      });
    } else if (similarArtistName || componentScores.artistScore) {
      const score = componentScores.artistScore || 0.78;
      const ref = similarArtistName ? ` to ${similarArtistName}` : '';
      rawReasons.push({
        type: 'SIMILAR_ARTIST',
        message: `Shares a musical style and production similar${ref}.`,
        supportingValue: similarArtistName || artistName,
        importanceScore: Number((score * 0.85).toFixed(4)),
        metadata: { similarArtist: similarArtistName },
      });
    }

    // 3. Preferred Genre
    let genreAffinity = 0;
    if (genreName && tasteProfile?.combinedGenres && Array.isArray(tasteProfile.combinedGenres)) {
      const matchedGenre = tasteProfile.combinedGenres.find(
        (g) => g.name?.toLowerCase() === genreName.toLowerCase() || g.genreId === String(song?.genre?._id || song?.genre)
      );
      if (matchedGenre && (matchedGenre.affinityScore || 0) >= thresholds.minGenreAffinityThreshold) {
        genreAffinity = matchedGenre.affinityScore || 0.80;
      }
    } else if (genreName && (sources.includes('genre') || componentScores.genreScore)) {
      genreAffinity = componentScores.genreScore || 0.70;
    }

    if (genreAffinity >= thresholds.minGenreAffinityThreshold) {
      const pct = this.toPercent(genreAffinity);
      rawReasons.push({
        type: 'PREFERRED_GENRE',
        message: `Features ${genreName}, one of your preferred genres (${pct}% affinity).`,
        supportingValue: genreName,
        importanceScore: Number((genreAffinity * 0.90).toFixed(4)),
        metadata: { genre: genreName, affinityScore: genreAffinity },
      });
    }

    // 4. Collaborative Similarity
    const collabVal = componentScores.collaborativeScore ?? (sources.includes('collaborative') ? 0.80 : 0);
    if (collabVal >= thresholds.minCollaborativeThreshold) {
      const pct = this.toPercent(collabVal);
      rawReasons.push({
        type: 'COLLABORATIVE_SIMILARITY',
        message: `Highly played and replayed by listeners with similar musical taste (${pct}% match).`,
        supportingValue: collabVal,
        importanceScore: Number((collabVal * 0.86).toFixed(4)),
        metadata: { collaborativeScore: collabVal },
      });
    }

    // 5. Session Preference
    const sessionVal = componentScores.sessionScore ?? (sessionPreferences ? 0.75 : 0);
    if (sessionVal >= thresholds.minSessionThreshold) {
      rawReasons.push({
        type: 'SESSION_PREFERENCE',
        message: `Fits seamlessly into the flow of your active listening session.`,
        supportingValue: sessionVal,
        importanceScore: Number((sessionVal * 0.80).toFixed(4)),
        metadata: { sessionScore: sessionVal },
      });
    }

    // 6. Preferred Mood
    const activeMood = sessionPreferences?.activeMood || (song?.mood ? String(song.mood) : undefined);
    if (activeMood) {
      rawReasons.push({
        type: 'PREFERRED_MOOD',
        message: `Matches your current ${activeMood.toLowerCase()} mood vibe.`,
        supportingValue: activeMood,
        importanceScore: 0.75,
        metadata: { mood: activeMood },
      });
    }

    // 7. Preferred Energy
    if (typeof audioFeatures?.energy === 'number') {
      const energyLevel = audioFeatures.energy >= 0.7 ? 'high-energy' : audioFeatures.energy <= 0.4 ? 'calm' : 'moderate';
      if (sessionPreferences?.targetEnergy !== undefined) {
        const diff = Math.abs(audioFeatures.energy - sessionPreferences.targetEnergy);
        if (diff <= thresholds.minEnergyProximityThreshold) {
          rawReasons.push({
            type: 'PREFERRED_ENERGY',
            message: `Energy pace (${energyLevel}, ${Math.round(audioFeatures.energy * 100)}%) aligns with your preferred session intensity.`,
            supportingValue: audioFeatures.energy,
            importanceScore: 0.72,
            metadata: { energy: audioFeatures.energy, energyLevel },
          });
        }
      }
    }

    // 8. Novelty
    const noveltyVal = noveltyScore ?? componentScores.noveltyScore;
    if (typeof noveltyVal === 'number' && noveltyVal >= thresholds.minNoveltyThreshold) {
      rawReasons.push({
        type: 'NOVELTY',
        message: `A fresh release and novel sound you haven't explored yet.`,
        supportingValue: noveltyVal,
        importanceScore: Number((noveltyVal * 0.78).toFixed(4)),
        metadata: { noveltyScore: noveltyVal },
      });
    }

    // 9. Discovery Opportunity
    const isDiscovery = Boolean(
      isDiscoveryOpportunity ||
      (typeof diversityAdjustment === 'number' && diversityAdjustment > 0.08) ||
      (sources.includes('discovery') && artistAffinity < 0.3)
    );
    if (isDiscovery) {
      rawReasons.push({
        type: 'DISCOVERY_OPPORTUNITY',
        message: genreName
          ? `Curated to expand your musical horizons in ${genreName}.`
          : `Curated discovery to introduce you to new emerging sounds.`,
        supportingValue: genreName,
        importanceScore: 0.74,
        metadata: { genre: genreName },
      });
    }

    // 10. Contradiction Resolution & Filtering
    let filteredReasons = rawReasons;
    if (thresholds.contradictionSuppression) {
      filteredReasons = this.resolveContradictions(rawReasons, {
        artistAffinity,
        genreAffinity,
        audioEnergy: audioFeatures?.energy,
      });
    }

    // Sort reasons descending by importance score
    filteredReasons.sort((a, b) => b.importanceScore - a.importanceScore);

    // Limit to the most meaningful reasons (configured max)
    const finalReasons = filteredReasons.slice(0, Math.max(1, thresholds.maxReasonsReturned));

    // Fallback if no specific threshold was crossed
    if (finalReasons.length === 0) {
      finalReasons.push({
        type: 'USER_TASTE_SIMILARITY',
        message: input.matchReason || 'Matches your general music preferences.',
        importanceScore: 0.50,
      });
    }

    return finalReasons;
  }

  /**
   * Resolves contradictory reasons (e.g. Novelty/Discovery vs Familiar Favorite Artist).
   */
  private static resolveContradictions(
    reasons: ExplanationItem[],
    context: { artistAffinity: number; genreAffinity: number; audioEnergy?: number }
  ): ExplanationItem[] {
    const hasFamiliarArtist = context.artistAffinity >= 0.70;
    const hasDiscovery = reasons.some((r) => r.type === 'DISCOVERY_OPPORTUNITY');
    const hasNovelty = reasons.some((r) => r.type === 'NOVELTY');

    return reasons.filter((r) => {
      // Contradiction 1: If it's a known heavy favorite artist, don't claim it's a "discovery opportunity in unfamiliar territory"
      if (hasFamiliarArtist && r.type === 'DISCOVERY_OPPORTUNITY') {
        return false;
      }
      // Contradiction 2: If it's pure novel discovery with 0 familiarity, don't claim familiar artist affinity
      if (!hasFamiliarArtist && hasDiscovery && hasNovelty && r.type === 'SIMILAR_ARTIST' && r.metadata?.isDirectArtist) {
        return false;
      }
      return true;
    });
  }

  /**
   * Explains why a single song was recommended based on its scores, metadata, and user profile signals.
   * Keeps explanation generation strictly separate from candidate ranking.
   */
  public static explainSong(
    input: ExplanationSignalInput,
    customThresholds?: Partial<ExplanationThresholdConfig>
  ): RecommendationExplanation {
    const songId = String(input.song?._id || input.song?.id || '');
    const reasons = this.extractStrongestReasons(input, customThresholds);

    const primaryExplanation = reasons[0]?.message || 'Recommended for you.';
    const confidenceScore = reasons[0]?.importanceScore || 0.75;

    // Compose concise, natural-language multi-reason summary
    const topPoints = reasons.slice(0, 2).map((e) => e.message);
    const summary = topPoints.join(' ');

    return {
      songId,
      primaryExplanation,
      explanations: reasons,
      reasons,
      summary,
      confidenceScore,
    };
  }

  /**
   * Batch generation of explanations for an array of songs/candidates.
   */
  public static explainBatch(
    items: ExplanationSignalInput[],
    customThresholds?: Partial<ExplanationThresholdConfig>
  ): RecommendationExplanation[] {
    if (!Array.isArray(items)) return [];
    return items.map((item) => this.explainSong(item, customThresholds));
  }
}
