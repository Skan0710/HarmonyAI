import { Types } from 'mongoose';
import { UnifiedMusicDNAService } from './unifiedMusicDnaService.js';
import { TasteStabilityTransformationService } from './tasteStabilityTransformationService.js';
import { EmergingTasteDetectionService } from './emergingTasteDetectionService.js';
import { ListenerArchetypeEngine } from './listenerArchetypeEngine.js';

export type LevelCategory = 'high' | 'moderate' | 'low';
export type StabilityLevelCategory = 'high' | 'moderate' | 'volatile';

export interface LevelMetric {
  level: LevelCategory;
  score: number; // [0.0, 1.0]
  description?: string;
}

export interface StabilityMetric {
  level: StabilityLevelCategory;
  score: number; // [0.0, 1.0]
  archetype?: string;
  description?: string;
}

export interface TransformationMetric {
  intensityScore: number; // [0.0, 1.0]
  level: LevelCategory;
  archetype?: string;
  velocity?: 'rapid' | 'moderate' | 'gradual' | 'static';
  description?: string;
}

export interface PersonalityTrait {
  id: string;
  trait: string; // e.g. 'highly exploratory', 'genre loyal', 'mood driven'
  label: string;
  category: 'exploration' | 'diversity' | 'loyalty' | 'mood' | 'discovery' | 'habits' | 'stability' | 'transformation';
  score: number;
  threshold: number;
  evidence: string;
  confidence: number;
}

export interface ProfileGenreSummary {
  name: string;
  affinity: number; // [0.0, 1.0]
  rank: number;
  playCount?: number;
}

export interface ProfileMoodSummary {
  mood: string;
  affinity: number; // [0.0, 1.0]
  rank: number;
}

export interface ProfileArtistSummary {
  artistName: string;
  affinity: number; // [0.0, 1.0]
  rank: number;
  playCount?: number;
}

export interface ProfileEmergingSummary {
  genres: { name: string; confidence: number; momentumVelocity?: number }[];
  artists: { name: string; confidence: number; momentumVelocity?: number }[];
  moods: string[];
  summaryNarrative?: string;
}

export interface MusicalPersonalityProfile {
  userId?: string;
  generatedAt: Date;
  isDataSufficient: boolean;
  confidenceScore: number;

  // High-level Archetype summary
  archetype: {
    primary: string;
    title: string;
    tagline: string;
  };

  // Structured Core Dimensions
  dominantGenres: ProfileGenreSummary[];
  dominantMoods: ProfileMoodSummary[];
  strongestArtists: ProfileArtistSummary[];

  // Behavioral & Preference Levels
  explorationLevel: LevelMetric;
  familiarityLevel: LevelMetric;
  diversityLevel: LevelMetric;
  listeningIntensity: LevelMetric;
  repetitionTendency: LevelMetric;
  tasteStability: StabilityMetric;
  tasteTransformation: TransformationMetric;

  // Emerging Trends
  emergingInterests: ProfileEmergingSummary;

  // Descriptive Personality Traits (Derived deterministically from scores)
  personalityTraits: PersonalityTrait[];

  // Human-friendly narrative summary
  narrativeSummary: string;
}

export interface PersonalityProfileInputSignals {
  userId?: string;
  explorationTendency?: number;
  familiarityPreference?: number;
  genreDiversity?: number;
  artistDiversity?: number;
  diversityPreference?: number;
  repeatListeningTendency?: number;
  noveltyPreference?: number;
  discoveryTendency?: number;
  sessionIntensity?: number;
  completionRate?: number;
  skipTendency?: number;
  avgDailyMinutes?: number;
  tasteStability?: number;
  transformationIntensity?: number;
  stabilityArchetype?: string;
  transformationArchetype?: string;
  moodFocusScore?: number;
  dominantGenres?: { name: string; affinity: number; playCount?: number }[];
  dominantMoods?: { mood: string; affinity: number }[];
  strongestArtists?: { artistName: string; affinity: number; playCount?: number }[];
  emergingGenres?: { name: string; confidence: number; momentumVelocity?: number }[];
  emergingArtists?: { name: string; confidence: number; momentumVelocity?: number }[];
  emergingMoods?: string[];
  emergingNarrative?: string;
  interactionCount?: number;
  isDataSufficient?: boolean;
}

export class MusicalPersonalityProfileService {
  /**
   * Helper: classify normalized score [0.0, 1.0] into 'high' | 'moderate' | 'low'.
   */
  static classifyLevel(score: number, highCutoff = 0.67, moderateCutoff = 0.34): LevelCategory {
    if (score >= highCutoff) return 'high';
    if (score >= moderateCutoff) return 'moderate';
    return 'low';
  }

  /**
   * Helper: classify stability score [0.0, 1.0] into 'high' | 'moderate' | 'volatile'.
   */
  static classifyStability(score: number): StabilityLevelCategory {
    if (score >= 0.67) return 'high';
    if (score >= 0.40) return 'moderate';
    return 'volatile';
  }

  /**
   * Pure deterministic calculation: Converts multi-signal inputs into a structured
   * musical personality profile and derives descriptive personality traits based strictly on scores.
   */
  static generateProfileFromSignals(
    inputs: PersonalityProfileInputSignals
  ): MusicalPersonalityProfile {
    const clamp01 = (v?: number, fallback = 0.5): number => {
      if (v === undefined || isNaN(v)) return fallback;
      return Math.min(1.0, Math.max(0.0, Number(v)));
    };

    const isDataSufficient =
      inputs.isDataSufficient !== undefined
        ? inputs.isDataSufficient
        : (inputs.interactionCount ?? 0) >= 10;

    const explorationScore = clamp01(inputs.explorationTendency, 0.5);
    const familiarityScore = clamp01(inputs.familiarityPreference, 0.5);
    const genreDivScore = clamp01(inputs.genreDiversity, 0.5);
    const artistDivScore = clamp01(inputs.artistDiversity, 0.5);
    const combinedDiversityScore = clamp01(
      inputs.diversityPreference ?? 0.5 * (genreDivScore + artistDivScore),
      0.5
    );
    const repeatScore = clamp01(inputs.repeatListeningTendency, 0.5);
    const noveltyScore = clamp01(inputs.noveltyPreference ?? inputs.discoveryTendency, 0.5);
    const intensityScore = clamp01(
      inputs.sessionIntensity ??
        (inputs.avgDailyMinutes ? Math.min(1.0, inputs.avgDailyMinutes / 90) : 0.5),
      0.5
    );
    const stabilityScore = clamp01(inputs.tasteStability, 0.5);
    const transformScore = clamp01(inputs.transformationIntensity, 0.1);
    const moodFocus = clamp01(inputs.moodFocusScore, 0.4);

    // Format top items
    const dominantGenres: ProfileGenreSummary[] = (inputs.dominantGenres || []).slice(0, 5).map(
      (g, idx) => ({
        name: g.name,
        affinity: clamp01(g.affinity, 0.5),
        rank: idx + 1,
        playCount: g.playCount,
      })
    );

    const dominantMoods: ProfileMoodSummary[] = (inputs.dominantMoods || []).slice(0, 5).map(
      (m, idx) => ({
        mood: m.mood,
        affinity: clamp01(m.affinity, 0.5),
        rank: idx + 1,
      })
    );

    const strongestArtists: ProfileArtistSummary[] = (inputs.strongestArtists || []).slice(0, 5).map(
      (a, idx) => ({
        artistName: a.artistName,
        affinity: clamp01(a.affinity, 0.5),
        rank: idx + 1,
        playCount: a.playCount,
      })
    );

    const emergingInterests: ProfileEmergingSummary = {
      genres: inputs.emergingGenres || [],
      artists: inputs.emergingArtists || [],
      moods: inputs.emergingMoods || [],
      summaryNarrative: inputs.emergingNarrative,
    };

    // Determine Archetype using the ListenerArchetypeEngine
    const archetypeResult = ListenerArchetypeEngine.determineArchetypeFromSignals({
      userId: inputs.userId,
      explorationTendency: explorationScore,
      repeatListeningTendency: repeatScore,
      genreDiversity: genreDivScore,
      artistDiversity: artistDivScore,
      noveltyPreference: noveltyScore,
      familiarityPreference: familiarityScore,
      preferenceStability: stabilityScore,
      recentTasteChanges: transformScore,
      moodFocusScore: moodFocus,
      interactionCount: inputs.interactionCount ?? (isDataSufficient ? 25 : 3),
      isDataSufficient,
    });

    // -------------------------------------------------------------------------
    // Deterministic Personality Trait Extraction
    // -------------------------------------------------------------------------
    const candidateTraits: PersonalityTrait[] = [];

    if (isDataSufficient) {
      // 1. Exploration & Novelty traits
      if (explorationScore >= 0.70) {
        candidateTraits.push({
          id: 'highly_exploratory',
          trait: 'highly exploratory',
          label: 'Sonic Trailblazer',
          category: 'exploration',
          score: explorationScore,
          threshold: 0.70,
          evidence: `High willingness to explore unfamiliar tracks (${(explorationScore * 100).toFixed(0)}% exploration score).`,
          confidence: Number(Math.min(1.0, (explorationScore - 0.5) * 2).toFixed(2)),
        });
      } else if (explorationScore <= 0.30) {
        candidateTraits.push({
          id: 'familiarity_anchored',
          trait: 'familiarity anchored',
          label: 'Rooted Listener',
          category: 'exploration',
          score: familiarityScore,
          threshold: 0.70,
          evidence: `Strong gravitation toward known favorite tracks (${(familiarityScore * 100).toFixed(0)}% familiarity score).`,
          confidence: Number(Math.min(1.0, (familiarityScore - 0.5) * 2).toFixed(2)),
        });
      }

      if (noveltyScore >= 0.70) {
        candidateTraits.push({
          id: 'discovery_oriented',
          trait: 'discovery oriented',
          label: 'Frontier Seeker',
          category: 'discovery',
          score: noveltyScore,
          threshold: 0.70,
          evidence: `High appetite for newly released and emerging music (${(noveltyScore * 100).toFixed(0)}% novelty preference).`,
          confidence: Number(Math.min(1.0, (noveltyScore - 0.5) * 2).toFixed(2)),
        });
      }

      // 2. Diversity & Horizon traits
      if (combinedDiversityScore >= 0.70 || (genreDivScore >= 0.70 && artistDivScore >= 0.70)) {
        candidateTraits.push({
          id: 'highly_diverse',
          trait: 'highly diverse',
          label: 'Eclectic Enthusiast',
          category: 'diversity',
          score: combinedDiversityScore,
          threshold: 0.70,
          evidence: `Broad musical horizons spanning genres (${(genreDivScore * 100).toFixed(0)}%) and artists (${(artistDivScore * 100).toFixed(0)}%).`,
          confidence: Number(Math.min(1.0, (combinedDiversityScore - 0.5) * 2).toFixed(2)),
        });
      }

      if (genreDivScore <= 0.35 && repeatScore >= 0.55) {
        candidateTraits.push({
          id: 'genre_loyal',
          trait: 'genre loyal',
          label: 'Genre Devotee',
          category: 'loyalty',
          score: 1.0 - genreDivScore,
          threshold: 0.65,
          evidence: `Concentrated listening within a signature sound profile (${(genreDivScore * 100).toFixed(0)}% genre diversity).`,
          confidence: Number(Math.min(1.0, (0.5 - genreDivScore) * 2.5).toFixed(2)),
        });
      }

      // 3. Artist focus vs varied
      if (artistDivScore <= 0.35) {
        candidateTraits.push({
          id: 'artist_focused',
          trait: 'artist focused',
          label: 'Catalog Immerser',
          category: 'loyalty',
          score: 1.0 - artistDivScore,
          threshold: 0.65,
          evidence: `Deep dedication to specific artists and discographies (${(artistDivScore * 100).toFixed(0)}% artist diversity).`,
          confidence: Number(Math.min(1.0, (0.5 - artistDivScore) * 2.5).toFixed(2)),
        });
      } else if (artistDivScore >= 0.75) {
        candidateTraits.push({
          id: 'artist_varied',
          trait: 'artist varied',
          label: 'Broad Networker',
          category: 'diversity',
          score: artistDivScore,
          threshold: 0.75,
          evidence: `Listening spreads across a wide, varied roster of artists (${(artistDivScore * 100).toFixed(0)}% artist diversity).`,
          confidence: Number(Math.min(1.0, (artistDivScore - 0.5) * 2).toFixed(2)),
        });
      }

      // 4. Mood and emotional alignment
      if (moodFocus >= 0.68) {
        candidateTraits.push({
          id: 'mood_driven',
          trait: 'mood driven',
          label: 'Atmosphere Crafter',
          category: 'mood',
          score: moodFocus,
          threshold: 0.68,
          evidence: `Music choices closely mirror emotional contexts and ambient states (${(moodFocus * 100).toFixed(0)}% mood focus).`,
          confidence: Number(Math.min(1.0, (moodFocus - 0.4) * 2).toFixed(2)),
        });
      }

      // 5. Repetition & Comfort traits
      if (familiarityScore >= 0.70 && stabilityScore >= 0.65) {
        candidateTraits.push({
          id: 'comfort_oriented',
          trait: 'comfort oriented',
          label: 'Sanctuary Seeker',
          category: 'stability',
          score: (familiarityScore + stabilityScore) / 2,
          threshold: 0.68,
          evidence: `Finds solace and emotional resonance in familiar, comforting tracks (${(familiarityScore * 100).toFixed(0)}% familiarity, ${(stabilityScore * 100).toFixed(0)}% stability).`,
          confidence: Number(Math.min(1.0, (familiarityScore - 0.5) * 2).toFixed(2)),
        });
      }

      if (repeatScore >= 0.75) {
        candidateTraits.push({
          id: 'repeat_enthusiast',
          trait: 'repeat enthusiast',
          label: 'Loop Aficionado',
          category: 'habits',
          score: repeatScore,
          threshold: 0.75,
          evidence: `High affinity for replaying beloved songs repeatedly (${(repeatScore * 100).toFixed(0)}% repeat tendency).`,
          confidence: Number(Math.min(1.0, (repeatScore - 0.5) * 2).toFixed(2)),
        });
      }

      // 6. Transformation & Stability
      if (transformScore >= 0.60) {
        candidateTraits.push({
          id: 'taste_transformer',
          trait: 'taste transformer',
          label: 'Dynamic Evolver',
          category: 'transformation',
          score: transformScore,
          threshold: 0.60,
          evidence: `Rapid evolution in musical taste and active sonic reinvention (${(transformScore * 100).toFixed(0)}% transformation intensity).`,
          confidence: Number(Math.min(1.0, (transformScore - 0.4) * 2).toFixed(2)),
        });
      } else if (stabilityScore >= 0.80 && transformScore <= 0.20) {
        candidateTraits.push({
          id: 'taste_anchor',
          trait: 'taste anchor',
          label: 'Bedrock Believer',
          category: 'stability',
          score: stabilityScore,
          threshold: 0.80,
          evidence: `Exceptionally rock-solid taste that withstands transient trends (${(stabilityScore * 100).toFixed(0)}% stability).`,
          confidence: Number(Math.min(1.0, (stabilityScore - 0.5) * 2).toFixed(2)),
        });
      }

      // Fallback trait if no extreme traits triggered (balanced profile)
      if (candidateTraits.length === 0) {
        candidateTraits.push({
          id: 'balanced_adapter',
          trait: 'balanced adapter',
          label: 'Equilibrium Seeker',
          category: 'habits',
          score: 0.50,
          threshold: 0.50,
          evidence: 'Maintains an even equilibrium between exploration and familiar classics.',
          confidence: 0.75,
        });
      }
    } else {
      // Cold start / insufficient data fallback traits
      candidateTraits.push({
        id: 'emerging_listener',
        trait: 'emerging listener',
        label: 'New Explorer',
        category: 'habits',
        score: 0.50,
        threshold: 0.50,
        evidence: 'Initial listening patterns are forming as history is collected.',
        confidence: 0.20,
      });
    }

    // Sort candidate traits descending by confidence/score and select top 4
    const selectedTraits = candidateTraits
      .sort((a, b) => b.confidence - a.confidence || b.score - a.score)
      .slice(0, 5);

    // Build narrative summary
    let narrativeSummary: string;
    if (!isDataSufficient) {
      narrativeSummary =
        'Your musical personality profile is currently forming. As you play more tracks, HarmonyAI will extract deeper stylistic nuances and emergent traits.';
    } else {
      const traitNames = selectedTraits.map((t) => t.trait).join(', ');
      const topGenre = dominantGenres[0]?.name ? `anchored around ${dominantGenres[0].name}` : '';
      narrativeSummary = `A ${archetypeResult.title.toLowerCase()} listener characterized as ${traitNames}${topGenre ? ` and ${topGenre}` : ''}. Exhibits ${MusicalPersonalityProfileService.classifyLevel(explorationScore)} exploration and ${MusicalPersonalityProfileService.classifyLevel(familiarityScore)} familiarity preference.`;
    }

    const confidenceScore = isDataSufficient
      ? Number(
          Math.min(
            0.98,
            Math.max(
              0.25,
              0.4 * archetypeResult.confidenceScore +
                0.3 * (inputs.interactionCount ? Math.min(1.0, inputs.interactionCount / 40) : 0.7) +
                0.3 * (selectedTraits[0]?.confidence ?? 0.6)
            )
          ).toFixed(2)
        )
      : 0.15;

    return {
      userId: inputs.userId,
      generatedAt: new Date(),
      isDataSufficient,
      confidenceScore,
      archetype: {
        primary: archetypeResult.primaryArchetype,
        title: archetypeResult.title,
        tagline: archetypeResult.tagline,
      },
      dominantGenres,
      dominantMoods,
      strongestArtists,
      explorationLevel: {
        level: this.classifyLevel(explorationScore),
        score: explorationScore,
        description: `${(explorationScore * 100).toFixed(0)}% exploration tendency`,
      },
      familiarityLevel: {
        level: this.classifyLevel(familiarityScore),
        score: familiarityScore,
        description: `${(familiarityScore * 100).toFixed(0)}% familiarity preference`,
      },
      diversityLevel: {
        level: this.classifyLevel(combinedDiversityScore),
        score: combinedDiversityScore,
        description: `${(combinedDiversityScore * 100).toFixed(0)}% overall variety score`,
      },
      listeningIntensity: {
        level: this.classifyLevel(intensityScore),
        score: intensityScore,
        description: `${(intensityScore * 100).toFixed(0)}% session intensity index`,
      },
      repetitionTendency: {
        level: this.classifyLevel(repeatScore),
        score: repeatScore,
        description: `${(repeatScore * 100).toFixed(0)}% repeat replay tendency`,
      },
      tasteStability: {
        level: this.classifyStability(stabilityScore),
        score: stabilityScore,
        archetype: inputs.stabilityArchetype,
        description: `${(stabilityScore * 100).toFixed(0)}% taste persistence score`,
      },
      tasteTransformation: {
        level: this.classifyLevel(transformScore),
        intensityScore: transformScore,
        archetype: inputs.transformationArchetype,
        velocity:
          transformScore >= 0.7
            ? 'rapid'
            : transformScore >= 0.4
            ? 'moderate'
            : transformScore >= 0.15
            ? 'gradual'
            : 'static',
        description: `${(transformScore * 100).toFixed(0)}% transformation intensity`,
      },
      emergingInterests,
      personalityTraits: selectedTraits,
      narrativeSummary,
    };
  }

  /**
   * DB-backed method: Converts the user's Unified Music DNA, stability metrics, and emerging trends
   * into an integrated Musical Personality Profile.
   */
  static async getUserPersonalityProfile(userId: string): Promise<MusicalPersonalityProfile> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new Error(`Invalid userId: ${userId}`);
    }

    // 1. Fetch Unified Music DNA
    const dna = await UnifiedMusicDNAService.getOrGenerateProfile(userId);

    // 2. Fetch Taste Stability & Transformation Metrics safely
    const stabilityMetrics = await TasteStabilityTransformationService.calculateUserStabilityMetrics(
      userId
    ).catch(() => null);

    // 3. Fetch Emerging Taste Report safely
    const emergingReport = await EmergingTasteDetectionService.detectUserEmergingTastes(
      userId
    ).catch(() => null);

    // 4. Map dominant genres, moods, and artists
    const dominantGenres = (dna.genreProfile?.topGenres || []).map((g) => ({
      name: g.name,
      affinity: g.score,
      playCount: g.playCount,
    }));

    const dominantMoods = (dna.moodProfile?.preferredMoods || []).map((m) => ({
      mood: m.name,
      affinity: m.score,
    }));

    const strongestArtists = (dna.artistProfile?.strongestArtists || []).map((a) => ({
      artistName: a.name,
      affinity: a.score,
      playCount: a.playCount,
    }));

    // 5. Emerging interests
    const emergingGenres = (emergingReport?.emergingGenres || []).map((g: any) => ({
      name: g.name,
      confidence: g.emergenceConfidence,
      momentumVelocity: g.momentumDelta,
    }));

    const emergingArtists = (emergingReport?.emergingArtists || []).map((a: any) => ({
      name: a.name,
      confidence: a.emergenceConfidence,
      momentumVelocity: a.momentumDelta,
    }));

    const emergingMoods = (emergingReport?.emergingMoods || []).map((m: any) => m.name);

    // 6. Extract behavioral signals
    const explorationTendency = dna.tendencies?.explorationPreference ?? 0.5;
    const familiarityPreference = dna.tendencies?.familiarityPreference ?? 0.5;
    const genreDiversity = dna.genreProfile?.diversity?.score ?? 0.5;
    const artistDiversity = dna.artistProfile?.diversity?.score ?? 0.5;
    const diversityPreference = dna.tendencies?.diversityPreference ?? 0.5;
    const repeatListeningTendency = dna.listeningBehavior?.repeatListeningTendency ?? 0.5;
    const noveltyPreference = dna.listeningBehavior?.discoveryTendency ?? 0.5;
    const sessionIntensity = dna.listeningBehavior?.sessionListeningIntensity ?? 0.5;
    const completionRate = dna.listeningBehavior?.metricsBreakdown?.completionRatio ?? 0.75;
    const skipTendency = dna.listeningBehavior?.skipTendency ?? 0.2;
    const avgDailyMinutes = dna.listeningBehavior?.metricsBreakdown?.avgSessionDurationMinutes;

    const tasteStability =
      stabilityMetrics?.tasteStability ?? dna.listeningBehavior?.preferenceStability ?? 0.5;
    const transformationIntensity =
      stabilityMetrics?.transformationIntensity ?? stabilityMetrics?.tasteVolatility ?? 0.15;
    const stabilityArchetype = stabilityMetrics?.archetype;

    const topMoodScore = dna.moodProfile?.preferredMoods?.[0]?.score ?? 0.5;
    const moodFocusScore = Math.min(1.0, topMoodScore * 0.9);

    const interactionCount = dna.interactionsCountAtLastRefresh ?? 0;
    const isDataSufficient =
      dna.listeningBehavior?.isDataSufficient ?? interactionCount >= 10;

    const inputSignals: PersonalityProfileInputSignals = {
      userId,
      explorationTendency,
      familiarityPreference,
      genreDiversity,
      artistDiversity,
      diversityPreference,
      repeatListeningTendency,
      noveltyPreference,
      sessionIntensity,
      completionRate,
      skipTendency,
      avgDailyMinutes,
      tasteStability,
      transformationIntensity,
      stabilityArchetype,
      moodFocusScore,
      dominantGenres,
      dominantMoods,
      strongestArtists,
      emergingGenres,
      emergingArtists,
      emergingMoods,
      emergingNarrative: emergingReport?.summary?.narrative,
      interactionCount,
      isDataSufficient,
    };

    return this.generateProfileFromSignals(inputSignals);
  }
}

export default MusicalPersonalityProfileService;
