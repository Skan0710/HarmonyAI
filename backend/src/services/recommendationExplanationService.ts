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
  importanceScore: number; // strictly bounded to [0.0, 1.0]
  metadata?: Record<string, any>;
}

export interface RecommendationExplanation {
  songId: string;
  primaryExplanation: string;
  explanations: ExplanationItem[];
  reasons: ExplanationItem[];
  summary: string;
  confidenceScore: number; // strictly bounded to [0.0, 1.0]
}

export interface ExplanationThresholdConfig {
  minTasteAffinityThreshold: number;
  minContentSimilarityThreshold: number;
  minCollaborativeThreshold: number;
  minNoveltyThreshold: number;
  minSessionThreshold: number;
  minGenreAffinityThreshold: number;
  minArtistAffinityThreshold: number;
  minMoodMatchThreshold: number;
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
  minMoodMatchThreshold: 0.50,
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
    moodScore?: number;
    [key: string]: any;
  };
  sources?: string[];
  similarityScore?: number;
  seedSong?: any;
  likedSongsSample?: any[];
  tasteProfile?: {
    combinedGenres?: { genreId?: string; name?: string; affinityScore?: number }[];
    combinedArtists?: { artistId?: string; name?: string; affinityScore?: number }[];
    preferredMoods?: (string | { name?: string; label?: string; title?: string })[];
    preferredLanguages?: string[];
    [key: string]: any;
  } | null;
  sessionPreferences?: {
    activeMood?: string | { name?: string; label?: string; title?: string };
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
   * Helper: Clamps and validates any score or numeric signal to a safe, finite [0.0, 1.0] range.
   * Handles non-finite values (NaN, Infinity, -Infinity), null, and out-of-range inputs safely.
   */
  public static clampScore(val: any, defaultVal: number = 0.0): number {
    if (typeof val !== 'number' || !Number.isFinite(val) || Number.isNaN(val)) {
      return Math.max(0.0, Math.min(1.0, defaultVal));
    }
    return Math.max(0.0, Math.min(1.0, val));
  }

  /**
   * Helper: Extracts artist name from song document or string
   */
  public static extractArtistName(artist: any): string {
    if (!artist) return '';
    if (typeof artist === 'string') return artist.trim();
    if (typeof artist === 'object' && artist.name) return String(artist.name).trim();
    return '';
  }

  /**
   * Helper: Extracts genre name from song document or string
   */
  public static extractGenreName(genre: any): string {
    if (!genre) return '';
    if (typeof genre === 'string') return genre.trim();
    if (typeof genre === 'object' && genre.name) return String(genre.name).trim();
    return '';
  }

  /**
   * Helper: Extracts human-readable mood name from string, object, or document
   */
  public static extractMoodName(mood: any): string {
    if (!mood) return '';
    if (typeof mood === 'string') return mood.trim();
    if (typeof mood === 'object') {
      if (mood.name) return String(mood.name).trim();
      if (mood.label) return String(mood.label).trim();
      if (mood.title) return String(mood.title).trim();
    }
    return '';
  }

  /**
   * Helper: Formats percentage integer from 0-1 float
   */
  public static toPercent(val: any): number {
    const clamped = this.clampScore(val);
    return Math.round(clamped * 100);
  }

  /**
   * Identifies and extracts the strongest, most meaningful reasons behind a recommendation.
   * Clamps all input signals to [0.0, 1.0], computes explicit attribute match scores,
   * ranks reasons by importance, and prevents contradictory claims.
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
    const songMood = this.extractMoodName(song?.mood);
    const activeSessionMood = this.extractMoodName(sessionPreferences?.activeMood);
    const audioFeatures = song?.audioFeatures || {};

    const rawReasons: ExplanationItem[] = [];

    // 1. Similar to Songs the User Liked (Content & Acoustic Signature)
    const rawContentVal =
      similarityScore ??
      componentScores.contentScore ??
      componentScores.contentSimilarity ??
      (sources.includes('content') || sources.includes('seed_similarity') ? 0.85 : 0);

    const contentVal = this.clampScore(rawContentVal);

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
        importanceScore: this.clampScore(Number((contentVal * 0.95).toFixed(4))),
        metadata: {
          similarityScore: contentVal,
          referenceSong: seedSong?.title || (likedSongsSample[0]?.title ?? undefined),
        },
      });
    }

    // 2. Similar Artist / Favorite Artist
    let artistAffinity = 0;
    let isDirectArtistMatch = false;

    if (artistName && tasteProfile?.combinedArtists && Array.isArray(tasteProfile.combinedArtists)) {
      const matchedArtist = tasteProfile.combinedArtists.find(
        (a) => a.name?.toLowerCase() === artistName.toLowerCase() || a.artistId === String(song?.artist?._id || song?.artist)
      );
      if (matchedArtist && typeof matchedArtist.affinityScore === 'number') {
        const score = this.clampScore(matchedArtist.affinityScore);
        if (score >= thresholds.minArtistAffinityThreshold) {
          artistAffinity = score;
          isDirectArtistMatch = true;
        }
      }
    }

    if (isDirectArtistMatch && artistAffinity >= thresholds.minArtistAffinityThreshold) {
      const pct = this.toPercent(artistAffinity);
      rawReasons.push({
        type: 'SIMILAR_ARTIST',
        message: `By ${artistName}, an artist in your top listening rotation (${pct}% affinity).`,
        supportingValue: artistName,
        importanceScore: this.clampScore(Number((artistAffinity * 0.92).toFixed(4))),
        metadata: { artist: artistName, affinityScore: artistAffinity, isDirectArtist: true },
      });
    } else if (similarArtistName || typeof componentScores.artistScore === 'number') {
      const score = this.clampScore(componentScores.artistScore ?? 0.78);
      if (score >= thresholds.minArtistAffinityThreshold) {
        const ref = similarArtistName ? ` to ${similarArtistName}` : '';
        rawReasons.push({
          type: 'SIMILAR_ARTIST',
          message: `Shares a musical style and production similar${ref}.`,
          supportingValue: similarArtistName || artistName,
          importanceScore: this.clampScore(Number((score * 0.85).toFixed(4))),
          metadata: { similarArtist: similarArtistName },
        });
      }
    }

    // 3. Preferred Genre (With complete fallback when combinedGenres doesn't match or is below threshold)
    let genreAffinity = 0;
    let isDirectGenreMatch = false;

    if (genreName && tasteProfile?.combinedGenres && Array.isArray(tasteProfile.combinedGenres)) {
      const matchedGenre = tasteProfile.combinedGenres.find(
        (g) => g.name?.toLowerCase() === genreName.toLowerCase() || g.genreId === String(song?.genre?._id || song?.genre)
      );
      if (matchedGenre && typeof matchedGenre.affinityScore === 'number') {
        const score = this.clampScore(matchedGenre.affinityScore);
        if (score >= thresholds.minGenreAffinityThreshold) {
          genreAffinity = score;
          isDirectGenreMatch = true;
        }
      }
    }

    // Fallback if no matching genre met the threshold in combinedGenres
    if (!isDirectGenreMatch && genreName && (sources.includes('genre') || typeof componentScores.genreScore === 'number')) {
      genreAffinity = this.clampScore(componentScores.genreScore ?? 0.70);
    }

    if (genreAffinity >= thresholds.minGenreAffinityThreshold) {
      const pct = this.toPercent(genreAffinity);
      rawReasons.push({
        type: 'PREFERRED_GENRE',
        message: `Features ${genreName}, one of your preferred genres (${pct}% affinity).`,
        supportingValue: genreName,
        importanceScore: this.clampScore(Number((genreAffinity * 0.90).toFixed(4))),
        metadata: { genre: genreName, affinityScore: genreAffinity, isDirectGenreMatch },
      });
    }

    // 4. Collaborative Similarity
    const rawCollab = componentScores.collaborativeScore ?? (sources.includes('collaborative') ? 0.80 : 0);
    const collabVal = this.clampScore(rawCollab);
    if (collabVal >= thresholds.minCollaborativeThreshold) {
      const pct = this.toPercent(collabVal);
      rawReasons.push({
        type: 'COLLABORATIVE_SIMILARITY',
        message: `Highly played and replayed by listeners with similar musical taste (${pct}% match).`,
        supportingValue: collabVal,
        importanceScore: this.clampScore(Number((collabVal * 0.86).toFixed(4))),
        metadata: { collaborativeScore: collabVal },
      });
    }

    // 5. Session Preference (Compute explicit match score from song attributes vs session preferences)
    let sessionVal = typeof componentScores.sessionScore === 'number' && Number.isFinite(componentScores.sessionScore)
      ? this.clampScore(componentScores.sessionScore)
      : 0;

    if (sessionVal === 0 && sessionPreferences) {
      let sessionMatchScore = 0;
      let sessionChecks = 0;

      // Check mood match
      if (activeSessionMood && songMood) {
        sessionChecks++;
        if (songMood.toLowerCase() === activeSessionMood.toLowerCase()) {
          sessionMatchScore += 1.0;
        }
      }

      // Check energy proximity
      if (typeof sessionPreferences.targetEnergy === 'number' && typeof audioFeatures?.energy === 'number') {
        sessionChecks++;
        const targetEnergy = this.clampScore(sessionPreferences.targetEnergy);
        const songEnergy = this.clampScore(audioFeatures.energy);
        const diff = Math.abs(songEnergy - targetEnergy);
        if (diff <= thresholds.minEnergyProximityThreshold) {
          sessionMatchScore += 1.0 - (diff / thresholds.minEnergyProximityThreshold) * 0.4;
        }
      }

      // Check tempo proximity
      if (typeof sessionPreferences.targetTempo === 'number' && typeof audioFeatures?.tempo === 'number' && audioFeatures.tempo > 0) {
        sessionChecks++;
        const diff = Math.abs(audioFeatures.tempo - sessionPreferences.targetTempo);
        if (diff <= 15) {
          sessionMatchScore += 1.0 - (diff / 15) * 0.4;
        }
      }

      // Check session genre match
      if (Array.isArray(sessionPreferences.sessionGenres) && sessionPreferences.sessionGenres.length > 0 && genreName) {
        sessionChecks++;
        if (sessionPreferences.sessionGenres.some((g: string) => g.toLowerCase() === genreName.toLowerCase())) {
          sessionMatchScore += 1.0;
        }
      }

      if (sessionChecks > 0) {
        sessionVal = this.clampScore(sessionMatchScore / sessionChecks);
      }
    }

    if (sessionVal >= thresholds.minSessionThreshold) {
      rawReasons.push({
        type: 'SESSION_PREFERENCE',
        message: `Fits seamlessly into the flow of your active listening session.`,
        supportingValue: sessionVal,
        importanceScore: this.clampScore(Number((sessionVal * 0.80).toFixed(4))),
        metadata: { sessionScore: sessionVal },
      });
    }

    // 6. Preferred Mood
    // 6A. Current Mood: ONLY emitted when sessionPreferences.activeMood is present and matches the song's mood
    if (activeSessionMood && songMood && songMood.toLowerCase() === activeSessionMood.toLowerCase()) {
      const moodScore = 0.90;
      if (moodScore >= thresholds.minMoodMatchThreshold) {
        rawReasons.push({
          type: 'PREFERRED_MOOD',
          message: `Matches your current ${activeSessionMood.toLowerCase()} mood vibe.`,
          supportingValue: activeSessionMood,
          importanceScore: this.clampScore(Number((moodScore * 0.82).toFixed(4))),
          metadata: { mood: activeSessionMood, moodScore, isCurrentSessionMood: true },
        });
      }
    }
    // 6B. Song-Based Mood: Emitted when song.mood aligns with long-term preferred moods or component scores (without active session mood match)
    else if (songMood) {
      let songMoodScore = 0;
      let matchedProfileMood = songMood;

      if (tasteProfile?.preferredMoods && Array.isArray(tasteProfile.preferredMoods)) {
        const found = tasteProfile.preferredMoods.find(
          (m) => this.extractMoodName(m).toLowerCase() === songMood.toLowerCase()
        );
        if (found) {
          songMoodScore = 0.80;
          matchedProfileMood = this.extractMoodName(found) || songMood;
        }
      }

      if (songMoodScore === 0 && typeof componentScores.moodScore === 'number') {
        songMoodScore = this.clampScore(componentScores.moodScore);
      }

      if (songMoodScore >= thresholds.minMoodMatchThreshold) {
        rawReasons.push({
          type: 'PREFERRED_MOOD',
          message: `Captures the ${matchedProfileMood.toLowerCase()} mood you often enjoy.`,
          supportingValue: matchedProfileMood,
          importanceScore: this.clampScore(Number((songMoodScore * 0.78).toFixed(4))),
          metadata: { mood: matchedProfileMood, moodScore: songMoodScore, isTasteProfileMood: true },
        });
      }
    }

    // 7. Preferred Energy
    if (typeof audioFeatures?.energy === 'number' && Number.isFinite(audioFeatures.energy)) {
      const clampedEnergy = this.clampScore(audioFeatures.energy);
      const energyLevel = clampedEnergy >= 0.7 ? 'high-energy' : clampedEnergy <= 0.4 ? 'calm' : 'moderate';

      if (typeof sessionPreferences?.targetEnergy === 'number' && Number.isFinite(sessionPreferences.targetEnergy)) {
        const targetEnergy = this.clampScore(sessionPreferences.targetEnergy);
        const diff = Math.abs(clampedEnergy - targetEnergy);

        if (diff <= thresholds.minEnergyProximityThreshold) {
          const energyImportance = this.clampScore(0.75 - diff * 0.5);
          rawReasons.push({
            type: 'PREFERRED_ENERGY',
            message: `Energy pace (${energyLevel}, ${Math.round(clampedEnergy * 100)}%) aligns with your preferred session intensity.`,
            supportingValue: clampedEnergy,
            importanceScore: energyImportance,
            metadata: { energy: clampedEnergy, energyLevel },
          });
        }
      }
    }

    // 8. Novelty
    const rawNovelty = noveltyScore ?? componentScores.noveltyScore;
    if (typeof rawNovelty === 'number' && Number.isFinite(rawNovelty)) {
      const noveltyVal = this.clampScore(rawNovelty);
      if (noveltyVal >= thresholds.minNoveltyThreshold) {
        rawReasons.push({
          type: 'NOVELTY',
          message: `A fresh release and novel sound you haven't explored yet.`,
          supportingValue: noveltyVal,
          importanceScore: this.clampScore(Number((noveltyVal * 0.78).toFixed(4))),
          metadata: { noveltyScore: noveltyVal },
        });
      }
    }

    // 9. Discovery Opportunity
    const isDiscovery = Boolean(
      isDiscoveryOpportunity ||
      (typeof diversityAdjustment === 'number' && Number.isFinite(diversityAdjustment) && diversityAdjustment > 0.08) ||
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
        audioEnergy: typeof audioFeatures?.energy === 'number' ? this.clampScore(audioFeatures.energy) : undefined,
      });
    }

    // Sort reasons descending by importance score
    filteredReasons.sort((a, b) => b.importanceScore - a.importanceScore);

    // Limit to the most meaningful reasons (configured max)
    const finalReasons = filteredReasons.slice(0, Math.max(1, thresholds.maxReasonsReturned));

    // Fallback if no specific threshold was crossed
    if (finalReasons.length === 0) {
      const userTasteScore = this.clampScore(
        componentScores.userTasteAffinityScore ?? componentScores.userTasteScore,
        0.50
      );
      finalReasons.push({
        type: 'USER_TASTE_SIMILARITY',
        message: input.matchReason || 'Matches your general music preferences.',
        importanceScore: userTasteScore,
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
    const rawConfidence = reasons[0]?.importanceScore ?? 0.75;
    const confidenceScore = this.clampScore(rawConfidence, 0.75);

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
