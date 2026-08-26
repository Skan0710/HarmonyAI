export type RecommendationExplanationType =
  | 'USER_TASTE_SIMILARITY'
  | 'CONTENT_SIMILARITY'
  | 'COLLABORATIVE_FILTERING'
  | 'GENRE_PREFERENCE'
  | 'ARTIST_PREFERENCE'
  | 'MOOD_MATCH'
  | 'ENERGY_MATCH'
  | 'TEMPO_MATCH'
  | 'SESSION_RELEVANCE'
  | 'NOVELTY'
  | 'DIVERSITY'
  | 'POPULARITY';

export interface ExplanationItem {
  type: RecommendationExplanationType;
  message: string;
  supportingValue?: number | string | Record<string, any>;
  importanceScore: number; // 0.0 to 1.0
  metadata?: Record<string, any>;
}

export interface RecommendationExplanation {
  songId: string;
  primaryExplanation: string;
  explanations: ExplanationItem[];
  summary: string;
  confidenceScore: number;
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
    [key: string]: any;
  };
  sources?: string[];
  similarityScore?: number;
  seedSong?: any;
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
   * Explains why a single song was recommended based on its scores, metadata, and user profile signals.
   * Keeps explanation generation strictly separate from candidate ranking.
   */
  public static explainSong(input: ExplanationSignalInput): RecommendationExplanation {
    const {
      song,
      componentScores = {},
      sources = [],
      similarityScore,
      seedSong,
      tasteProfile,
      sessionPreferences,
      noveltyScore,
      diversityAdjustment,
      matchReason,
    } = input;

    const songId = String(song?._id || song?.id || '');
    const songTitle = song?.title || 'This track';
    const artistName = this.extractArtistName(song?.artist);
    const genreName = this.extractGenreName(song?.genre);
    const audioFeatures = song?.audioFeatures || {};

    const explanations: ExplanationItem[] = [];

    // 1. User Taste Similarity Signal
    const userTasteScore =
      componentScores.userTasteAffinityScore ??
      componentScores.userTasteScore ??
      (sources.includes('hybrid') ? 0.85 : 0);

    if (userTasteScore > 0.3) {
      const pct = this.toPercent(userTasteScore);
      explanations.push({
        type: 'USER_TASTE_SIMILARITY',
        message: `Matches your overall music taste profile (${pct}% affinity).`,
        supportingValue: userTasteScore,
        importanceScore: Number((userTasteScore * 0.95).toFixed(4)),
        metadata: { affinityPercent: pct },
      });
    }

    // 2. Genre Preference Signal
    if (genreName && tasteProfile?.combinedGenres && Array.isArray(tasteProfile.combinedGenres)) {
      const matchedGenre = tasteProfile.combinedGenres.find(
        (g) => g.name?.toLowerCase() === genreName.toLowerCase() || g.genreId === String(song?.genre?._id || song?.genre)
      );
      if (matchedGenre && (matchedGenre.affinityScore || 0) > 0.2) {
        const score = matchedGenre.affinityScore || 0.8;
        const pct = this.toPercent(score);
        explanations.push({
          type: 'GENRE_PREFERENCE',
          message: `Features ${genreName}, one of your most listened-to genres (${pct}% affinity).`,
          supportingValue: genreName,
          importanceScore: Number((score * 0.90).toFixed(4)),
          metadata: { genre: genreName, affinityScore: score },
        });
      }
    } else if (genreName && (sources.includes('genre') || componentScores.genreScore)) {
      const score = componentScores.genreScore || 0.75;
      explanations.push({
        type: 'GENRE_PREFERENCE',
        message: `Aligned with your ${genreName} genre preferences.`,
        supportingValue: genreName,
        importanceScore: Number((score * 0.80).toFixed(4)),
        metadata: { genre: genreName },
      });
    }

    // 3. Artist Preference Signal
    if (artistName && tasteProfile?.combinedArtists && Array.isArray(tasteProfile.combinedArtists)) {
      const matchedArtist = tasteProfile.combinedArtists.find(
        (a) => a.name?.toLowerCase() === artistName.toLowerCase() || a.artistId === String(song?.artist?._id || song?.artist)
      );
      if (matchedArtist && (matchedArtist.affinityScore || 0) > 0.2) {
        const score = matchedArtist.affinityScore || 0.85;
        const pct = this.toPercent(score);
        explanations.push({
          type: 'ARTIST_PREFERENCE',
          message: `By ${artistName}, an artist you listen to frequently (${pct}% affinity).`,
          supportingValue: artistName,
          importanceScore: Number((score * 0.92).toFixed(4)),
          metadata: { artist: artistName, affinityScore: score },
        });
      }
    }

    // 4. Content & Acoustic Similarity Signal
    const contentScore =
      similarityScore ??
      componentScores.contentScore ??
      componentScores.contentSimilarity ??
      (sources.includes('content') || sources.includes('seed_similarity') ? 0.80 : 0);

    if (contentScore > 0.35) {
      const pct = this.toPercent(contentScore);
      let seedMsg = '';
      if (seedSong && seedSong.title) {
        seedMsg = ` to "${seedSong.title}"`;
      }
      explanations.push({
        type: 'CONTENT_SIMILARITY',
        message: `Shares strong acoustic signature and style similarity${seedMsg} (${pct}% match).`,
        supportingValue: contentScore,
        importanceScore: Number((contentScore * 0.88).toFixed(4)),
        metadata: {
          similarityScore: contentScore,
          seedSongTitle: seedSong?.title,
        },
      });
    }

    // 5. Collaborative Filtering Signal
    const collabScore = componentScores.collaborativeScore ?? (sources.includes('collaborative') ? 0.82 : 0);
    if (collabScore > 0.3) {
      const pct = this.toPercent(collabScore);
      explanations.push({
        type: 'COLLABORATIVE_FILTERING',
        message: `Listeners with musical tastes similar to yours frequently replay this song (${pct}% match).`,
        supportingValue: collabScore,
        importanceScore: Number((collabScore * 0.85).toFixed(4)),
        metadata: { collaborativeScore: collabScore },
      });
    }

    // 6. Session Relevance Signal
    const sessionScore = componentScores.sessionScore ?? (sessionPreferences ? 0.78 : 0);
    if (sessionScore > 0.3) {
      explanations.push({
        type: 'SESSION_RELEVANCE',
        message: `Fits the mood and rhythm of your current listening session.`,
        supportingValue: sessionScore,
        importanceScore: Number((sessionScore * 0.75).toFixed(4)),
        metadata: { sessionScore },
      });
    }

    // 7. Mood & Activity Match Signal
    const targetMood = sessionPreferences?.activeMood || (song?.mood ? String(song.mood) : undefined);
    if (targetMood) {
      explanations.push({
        type: 'MOOD_MATCH',
        message: `Matches the ${targetMood.toLowerCase()} mood vibe.`,
        supportingValue: targetMood,
        importanceScore: 0.72,
        metadata: { mood: targetMood },
      });
    }

    // 8. Energy Match Signal
    if (typeof audioFeatures?.energy === 'number') {
      const energyLevel = audioFeatures.energy >= 0.7 ? 'high-energy' : audioFeatures.energy <= 0.4 ? 'calm' : 'moderate';
      if (sessionPreferences?.targetEnergy !== undefined) {
        const diff = Math.abs(audioFeatures.energy - sessionPreferences.targetEnergy);
        if (diff <= 0.25) {
          explanations.push({
            type: 'ENERGY_MATCH',
            message: `Energy level (${energyLevel}, ${Math.round(audioFeatures.energy * 100)}%) aligns with your desired listening pace.`,
            supportingValue: audioFeatures.energy,
            importanceScore: 0.70,
            metadata: { energy: audioFeatures.energy, energyLevel },
          });
        }
      }
    }

    // 9. Tempo Match Signal
    if (typeof audioFeatures?.tempo === 'number' && audioFeatures.tempo > 0) {
      const bpm = Math.round(audioFeatures.tempo);
      if (sessionPreferences?.targetTempo !== undefined) {
        const diff = Math.abs(bpm - sessionPreferences.targetTempo);
        if (diff <= 15) {
          explanations.push({
            type: 'TEMPO_MATCH',
            message: `Rhythm matches your active tempo target around ${bpm} BPM.`,
            supportingValue: bpm,
            importanceScore: 0.65,
            metadata: { bpm },
          });
        }
      }
    }

    // 10. Novelty Signal
    const noveltyVal = noveltyScore ?? componentScores.noveltyScore;
    if (typeof noveltyVal === 'number' && noveltyVal > 0.4) {
      explanations.push({
        type: 'NOVELTY',
        message: `A fresh discovery you haven't listened to yet.`,
        supportingValue: noveltyVal,
        importanceScore: Number((noveltyVal * 0.68).toFixed(4)),
        metadata: { noveltyScore: noveltyVal },
      });
    }

    // 11. Diversity Signal
    const diversityVal = diversityAdjustment ?? componentScores.diversityScore;
    if (typeof diversityVal === 'number' && Math.abs(diversityVal) > 0.05) {
      explanations.push({
        type: 'DIVERSITY',
        message: `Adds curated variety to balance your listening experience.`,
        supportingValue: diversityVal,
        importanceScore: 0.60,
        metadata: { diversityAdjustment: diversityVal },
      });
    }

    // 12. Community Popularity Signal
    const popScore = componentScores.popularityScore ?? (song?.playCount ? Math.min(1.0, song.playCount / 100000) : 0);
    if (popScore > 0.4) {
      explanations.push({
        type: 'POPULARITY',
        message: `Popular community hit with high engagement across the network.`,
        supportingValue: popScore,
        importanceScore: Number((popScore * 0.55).toFixed(4)),
        metadata: { popularityScore: popScore },
      });
    }

    // Fallback if no specific signals matched
    if (explanations.length === 0) {
      explanations.push({
        type: 'USER_TASTE_SIMILARITY',
        message: matchReason || 'Recommended based on your personalized HarmonyAI taste profile.',
        importanceScore: 0.50,
      });
    }

    // Sort explanations descending by importance score
    explanations.sort((a, b) => b.importanceScore - a.importanceScore);

    const primaryExplanation = explanations[0]?.message || 'Recommended for you.';
    const confidenceScore = explanations[0]?.importanceScore || 0.75;

    // Compose rich multi-factor summary
    const topPoints = explanations.slice(0, 2).map((e) => e.message);
    const summary = topPoints.join(' ');

    return {
      songId,
      primaryExplanation,
      explanations,
      summary,
      confidenceScore,
    };
  }

  /**
   * Batch generation of explanations for an array of songs/candidates.
   */
  public static explainBatch(
    items: ExplanationSignalInput[]
  ): RecommendationExplanation[] {
    if (!Array.isArray(items)) return [];
    return items.map((item) => this.explainSong(item));
  }
}
