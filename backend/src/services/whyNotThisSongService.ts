export type NegativeReasonType =
  | 'LOW_GENRE_AFFINITY'
  | 'LOW_ARTIST_AFFINITY'
  | 'INCOMPATIBLE_TEMPO'
  | 'INCOMPATIBLE_ENERGY'
  | 'INCOMPATIBLE_MOOD'
  | 'PREVIOUS_SKIPS_SIMILAR_TRACKS'
  | 'LOW_SESSION_RELEVANCE'
  | 'INSUFFICIENT_DATA';

export interface NegativeExplanationReason {
  type: NegativeReasonType;
  message: string;
  divergenceScore: number; // strictly bounded in [0.0, 1.0], higher = stronger divergence
  supportingValue?: any;
  metadata?: Record<string, any>;
}

export interface WhyNotThisSongAnalysisResult {
  songId: string;
  hasSufficientData: boolean;
  primaryReason: string;
  reasons: NegativeExplanationReason[];
  summary: string;
  suitabilityScore: number; // 0.0 to 1.0 (lower means less suitable)
}

export interface WhyNotSignalInput {
  song: any;
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
  skippedSongIds?: Set<string> | string[];
  skippedGenres?: string[];
  skippedArtists?: string[];
  totalUserInteractions?: number;
  componentScores?: {
    userTasteAffinityScore?: number;
    contentScore?: number;
    collaborativeScore?: number;
    popularityScore?: number;
    sessionScore?: number;
    genreScore?: number;
    artistScore?: number;
    [key: string]: any;
  };
  maxReasonsReturned?: number;
}

export class WhyNotThisSongService {
  /**
   * Helper: Clamps a score strictly to the [0.0, 1.0] range.
   */
  public static clampScore(val: any, defaultVal: number = 0.0): number {
    if (typeof val !== 'number' || !Number.isFinite(val) || Number.isNaN(val)) {
      return Math.max(0.0, Math.min(1.0, defaultVal));
    }
    return Math.max(0.0, Math.min(1.0, val));
  }

  /**
   * Helper: Extracts artist name from string or populated object.
   */
  public static extractArtistName(artist: any): string {
    if (!artist) return '';
    if (typeof artist === 'string') return artist.trim();
    if (typeof artist === 'object' && artist.name) return String(artist.name).trim();
    return '';
  }

  /**
   * Helper: Extracts genre name from string or populated object.
   */
  public static extractGenreName(genre: any): string {
    if (!genre) return '';
    if (typeof genre === 'string') return genre.trim();
    if (typeof genre === 'object' && genre.name) return String(genre.name).trim();
    return '';
  }

  /**
   * Helper: Extracts mood name from string or populated object.
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
   * Analyzes why a song may have a low recommendation score for the current user.
   * Identifies negative and weak signals, handles cold start / insufficient data explicitly,
   * avoids unsupported claims, and returns the strongest divergence reasons.
   */
  public static analyzeWhyNot(input: WhyNotSignalInput): WhyNotThisSongAnalysisResult {
    const {
      song,
      tasteProfile,
      sessionPreferences,
      skippedSongIds,
      skippedGenres = [],
      skippedArtists = [],
      totalUserInteractions = 0,
      componentScores = {},
      maxReasonsReturned = 3,
    } = input;

    const songId = String(song?._id || song?.id || '');
    const artistName = this.extractArtistName(song?.artist);
    const genreName = this.extractGenreName(song?.genre);
    const songMood = this.extractMoodName(song?.mood);
    const activeSessionMood = this.extractMoodName(sessionPreferences?.activeMood);
    const audioFeatures = song?.audioFeatures || {};

    const userGenres = Array.isArray(tasteProfile?.combinedGenres) ? tasteProfile.combinedGenres : [];
    const userArtists = Array.isArray(tasteProfile?.combinedArtists) ? tasteProfile.combinedArtists : [];

    // 1. Data Sufficiency Check
    // If user has zero or near-zero listening history and no taste profile, do not make unsupported claims
    const hasTasteData = userGenres.length > 0 || userArtists.length > 0;
    const hasInteractionHistory = typeof totalUserInteractions === 'number' && totalUserInteractions >= 3;

    if (!hasTasteData && !hasInteractionHistory) {
      return {
        songId,
        hasSufficientData: false,
        primaryReason: 'Insufficient listening history to determine strong negative preferences.',
        reasons: [
          {
            type: 'INSUFFICIENT_DATA',
            message: 'Not enough listening history yet to determine if this track fits your taste profile.',
            divergenceScore: 0.50,
          },
        ],
        summary: 'Not enough listening history yet to determine if this track fits your taste profile.',
        suitabilityScore: 0.50,
      };
    }

    const rawReasons: NegativeExplanationReason[] = [];

    // 2. Previous Skips of Similar Songs / Artist / Genre
    let isRecentlySkipped = false;
    if (skippedSongIds) {
      if (skippedSongIds instanceof Set && skippedSongIds.has(songId)) {
        isRecentlySkipped = true;
      } else if (Array.isArray(skippedSongIds) && skippedSongIds.includes(songId)) {
        isRecentlySkipped = true;
      }
    }

    const isSkippedArtist = Boolean(
      artistName && skippedArtists.some((a) => a.toLowerCase() === artistName.toLowerCase())
    );
    const isSkippedGenre = Boolean(
      genreName && skippedGenres.some((g) => g.toLowerCase() === genreName.toLowerCase())
    );

    if (isRecentlySkipped || isSkippedArtist || isSkippedGenre) {
      const skipContext = isRecentlySkipped
        ? 'this song recently'
        : isSkippedArtist
        ? `tracks by ${artistName}`
        : `tracks in ${genreName}`;
      rawReasons.push({
        type: 'PREVIOUS_SKIPS_SIMILAR_TRACKS',
        message: `You frequently skipped ${skipContext}.`,
        divergenceScore: 0.88,
        metadata: { isRecentlySkipped, isSkippedArtist, isSkippedGenre },
      });
    }

    // 3. Incompatible Tempo (Diverges from active session target or preferred pace)
    if (
      typeof sessionPreferences?.targetTempo === 'number' &&
      typeof audioFeatures?.tempo === 'number' &&
      audioFeatures.tempo > 0
    ) {
      const targetTempo = sessionPreferences.targetTempo;
      const songTempo = audioFeatures.tempo;
      const tempoDiff = Math.abs(songTempo - targetTempo);

      if (tempoDiff >= 25) {
        const paceDesc = songTempo < targetTempo ? 'slower' : 'faster';
        const divergence = this.clampScore(0.60 + Math.min(0.35, tempoDiff / 100));
        rawReasons.push({
          type: 'INCOMPATIBLE_TEMPO',
          message: `Tempo at ${Math.round(songTempo)} BPM is significantly ${paceDesc} than your active session pace around ${Math.round(targetTempo)} BPM.`,
          divergenceScore: divergence,
          supportingValue: songTempo,
          metadata: { songTempo, targetTempo, tempoDiff },
        });
      }
    }

    // 4. Incompatible Energy (Contrasts with active session intensity)
    if (
      typeof sessionPreferences?.targetEnergy === 'number' &&
      typeof audioFeatures?.energy === 'number' &&
      Number.isFinite(audioFeatures.energy)
    ) {
      const targetEnergy = this.clampScore(sessionPreferences.targetEnergy);
      const songEnergy = this.clampScore(audioFeatures.energy);
      const energyDiff = Math.abs(songEnergy - targetEnergy);

      if (energyDiff >= 0.35) {
        const energyDesc = songEnergy < targetEnergy ? 'Lower' : 'Higher';
        const divergence = this.clampScore(0.60 + energyDiff * 0.35);
        rawReasons.push({
          type: 'INCOMPATIBLE_ENERGY',
          message: `${energyDesc} energy level (${Math.round(songEnergy * 100)}%) contrasts with your target session intensity (${Math.round(targetEnergy * 100)}%).`,
          divergenceScore: divergence,
          supportingValue: songEnergy,
          metadata: { songEnergy, targetEnergy, energyDiff },
        });
      }
    }

    // 5. Incompatible Mood (Contrasts with active session mood)
    if (activeSessionMood && songMood && songMood.toLowerCase() !== activeSessionMood.toLowerCase()) {
      rawReasons.push({
        type: 'INCOMPATIBLE_MOOD',
        message: `${songMood} mood contrasts with your active ${activeSessionMood} session vibe.`,
        divergenceScore: 0.72,
        supportingValue: songMood,
        metadata: { songMood, activeSessionMood },
      });
    }

    // 6. Low Genre Similarity (Only if user has established favorite genres and this genre is low/absent)
    if (genreName && userGenres.length > 0) {
      const matchedGenre = userGenres.find(
        (g) => g.name?.toLowerCase() === genreName.toLowerCase() || g.genreId === String((song?.genre as any)?._id || song?.genre)
      );
      const genreAffinity = matchedGenre && typeof matchedGenre.affinityScore === 'number'
        ? this.clampScore(matchedGenre.affinityScore)
        : 0;

      // Find top preferred genres to avoid generic claims
      const topPreferredGenres = userGenres
        .filter((g) => (g.affinityScore || 0) >= 0.60)
        .map((g) => g.name)
        .filter(Boolean)
        .slice(0, 2);

      if (genreAffinity <= 0.20 && topPreferredGenres.length > 0) {
        const topDesc = topPreferredGenres.join(' and ');
        rawReasons.push({
          type: 'LOW_GENRE_AFFINITY',
          message: `Features ${genreName}, which is outside your primary genres (strongly preferring ${topDesc}).`,
          divergenceScore: this.clampScore(0.85 - genreAffinity * 0.5),
          supportingValue: genreName,
          metadata: { genre: genreName, genreAffinity, topPreferredGenres },
        });
      }
    }

    // 7. Low Artist Similarity (Outside user's active listening rotation)
    if (artistName && userArtists.length > 0) {
      const matchedArtist = userArtists.find(
        (a) => a.name?.toLowerCase() === artistName.toLowerCase() || a.artistId === String((song?.artist as any)?._id || song?.artist)
      );
      const artistAffinity = matchedArtist && typeof matchedArtist.affinityScore === 'number'
        ? this.clampScore(matchedArtist.affinityScore)
        : 0;

      if (artistAffinity <= 0.15 && userArtists.some((a) => (a.affinityScore || 0) >= 0.60)) {
        rawReasons.push({
          type: 'LOW_ARTIST_AFFINITY',
          message: `By ${artistName}, an artist outside your regular listening rotation.`,
          divergenceScore: this.clampScore(0.75 - artistAffinity * 0.5),
          supportingValue: artistName,
          metadata: { artist: artistName, artistAffinity },
        });
      }
    }

    // 8. Low Session Relevance
    if (
      typeof componentScores.sessionScore === 'number' &&
      Number.isFinite(componentScores.sessionScore) &&
      componentScores.sessionScore < 0.30
    ) {
      rawReasons.push({
        type: 'LOW_SESSION_RELEVANCE',
        message: 'Low continuity with the tracks in your active queue.',
        divergenceScore: 0.65,
        supportingValue: componentScores.sessionScore,
        metadata: { sessionScore: componentScores.sessionScore },
      });
    }

    // Sort reasons descending by divergence score (strongest detractors first)
    rawReasons.sort((a, b) => b.divergenceScore - a.divergenceScore);

    // Filter to top configured max reasons
    const reasons = rawReasons.slice(0, Math.max(1, maxReasonsReturned));

    // Fallback if no strong negative signal was flagged
    if (reasons.length === 0) {
      reasons.push({
        type: 'LOW_GENRE_AFFINITY',
        message: 'Does not strongly match your primary listening taste profile.',
        divergenceScore: 0.50,
      });
    }

    const primaryReason = reasons[0]?.message || 'Does not match your current listening preferences.';
    const highestDivergence = reasons[0]?.divergenceScore || 0.50;
    const suitabilityScore = this.clampScore(1.0 - highestDivergence * 0.8, 0.35);

    const topPoints = reasons.slice(0, 2).map((r) => r.message);
    const summary = topPoints.join(' ');

    return {
      songId,
      hasSufficientData: true,
      primaryReason,
      reasons,
      summary,
      suitabilityScore,
    };
  }
}
