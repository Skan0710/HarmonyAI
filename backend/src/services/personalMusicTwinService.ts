import { isValidObjectId } from '../utils/validators.js';
import {
  PersonalMusicTwin,
  IPersonalMusicTwin,
} from '../models/PersonalMusicTwin.js';
import {
  PersonalMusicTwinAttributes,
  ITwinMusicalTraits,
  ITwinGenreIdentity,
  ITwinMoodIdentity,
  ITwinListeningBehavior,
  ITwinTasteStability,
  ITwinTasteEvolution,
  ITwinEmergingInterests,
  ITwinPersonalityProfile,
  ITwinCompatibilityDimensions,
  DEFAULT_MUSICAL_TRAITS,
  getDefaultPersonalMusicTwin,
  validateAndSanitizePersonalMusicTwin,
} from '../schemas/personalMusicTwinSchema.js';
import { UnifiedMusicDNAService } from './unifiedMusicDnaService.js';
import { MusicDNASnapshotService } from './musicDnaSnapshotService.js';
import {
  TasteStabilityTransformationService,
  TasteStabilityTransformationMetrics,
} from './tasteStabilityTransformationService.js';
import {
  EmergingTasteDetectionService,
  EmergingTasteReport,
} from './emergingTasteDetectionService.js';
import {
  TasteEvolutionTimelineService,
  TasteEvolutionTimeline,
} from './tasteEvolutionTimelineService.js';
import {
  ListenerArchetypeEngine,
  ArchetypeDeterminationResult,
} from './listenerArchetypeEngine.js';
import {
  MusicalPersonalityProfileService,
  MusicalPersonalityProfile,
} from './musicalPersonalityProfileService.js';
import {
  MusicTwinEvolutionService,
} from './musicTwinEvolutionService.js';
import { UnifiedMusicDNA } from '../schemas/musicDnaSchema.js';
import { IMusicDNASnapshot } from '../models/MusicDNASnapshot.js';

export interface TwinGenerationOptions {
  forceRefresh?: boolean;
  maxAgeMinutes?: number; // default: 60 minutes
  metadataOverride?: Record<string, any>;
}

export interface TwinSynthesisInputs {
  userId: string;
  dna?: UnifiedMusicDNA | null;
  snapshots?: IMusicDNASnapshot[];
  stabilityMetrics?: TasteStabilityTransformationMetrics | null;
  emergingReport?: EmergingTasteReport | null;
  timelineReport?: TasteEvolutionTimeline | null;
  archetypeResult?: ArchetypeDeterminationResult | null;
  personalityProfile?: MusicalPersonalityProfile | null;
  isDataSufficient?: boolean;
  options?: TwinGenerationOptions;
}

export class PersonalMusicTwinService {
  /**
   * Pure deterministic synthesis: Combines multi-source signals (Music DNA, snapshots,
   * stability metrics, emerging trends, archetype engine, personality profile)
   * into a single coherent, validated PersonalMusicTwinAttributes representation.
   */
  static synthesizeTwinFromSignals(inputs: TwinSynthesisInputs): PersonalMusicTwinAttributes {
    const userId = inputs.userId;
    const isDataSufficient =
      inputs.isDataSufficient !== undefined
        ? inputs.isDataSufficient
        : inputs.dna?.listeningBehavior?.isDataSufficient ??
          (inputs.dna?.interactionsCountAtLastRefresh ?? 0) >= 10;

    // -------------------------------------------------------------------------
    // Cold Start / Insufficient History Baseline
    // -------------------------------------------------------------------------
    if (!isDataSufficient || !inputs.dna) {
      const defaultTwin = getDefaultPersonalMusicTwin(userId);
      return validateAndSanitizePersonalMusicTwin({
        ...defaultTwin,
        isDataSufficient: false,
        confidenceScore: 0.15,
        metadata: {
          generationSource: 'cold_start_fallback',
          reason: 'Insufficient user listening history to synthesize full Personal Music Twin.',
          ...inputs.options?.metadataOverride,
        },
      });
    }

    const dna = inputs.dna;
    const stability = inputs.stabilityMetrics;
    const emerging = inputs.emergingReport;
    const timeline = inputs.timelineReport;
    const archetype = inputs.archetypeResult;
    const personality = inputs.personalityProfile;

    // -------------------------------------------------------------------------
    // 1. Current Musical Identity (Acoustic, Genre, Mood)
    // -------------------------------------------------------------------------
    const lp = dna.listeningPatterns;
    const audioPref = lp?.audioFeaturePreferences;
    const tempoPref = lp?.preferredTempo;

    const dominantMusicalTraits: ITwinMusicalTraits = {
      energyPreference: audioPref?.energy ?? DEFAULT_MUSICAL_TRAITS.energyPreference,
      danceabilityPreference: audioPref?.danceability ?? DEFAULT_MUSICAL_TRAITS.danceabilityPreference,
      valencePreference: audioPref?.valence ?? DEFAULT_MUSICAL_TRAITS.valencePreference,
      acousticnessPreference: audioPref?.acousticness ?? DEFAULT_MUSICAL_TRAITS.acousticnessPreference,
      instrumentalnessPreference: audioPref?.instrumentalness ?? DEFAULT_MUSICAL_TRAITS.instrumentalnessPreference,
      targetTempoBpm: tempoPref?.target ?? DEFAULT_MUSICAL_TRAITS.targetTempoBpm,
      tempoRange: {
        min: tempoPref?.min ?? DEFAULT_MUSICAL_TRAITS.tempoRange.min,
        max: tempoPref?.max ?? DEFAULT_MUSICAL_TRAITS.tempoRange.max,
      },
      keyAcousticDescriptors:
        audioPref && Object.keys(audioPref).length > 0
          ? [
              audioPref.energy && audioPref.energy > 0.65 ? 'High Energy' : 'Balanced Energy',
              audioPref.danceability && audioPref.danceability > 0.65 ? 'Rhythmic' : 'Steady Beat',
              audioPref.valence && audioPref.valence > 0.65 ? 'Uplifting' : 'Introspective',
            ]
          : [...DEFAULT_MUSICAL_TRAITS.keyAcousticDescriptors],
    };

    // Genre Identity
    const rawGenres = dna.genreProfile?.topGenres || [];
    const coreGenres = rawGenres.slice(0, 3).map((g, idx) => ({
      name: g.name,
      affinityScore: g.score,
      isPrimary: idx === 0,
    }));
    const secondaryGenres = rawGenres.slice(3, 8).map((g) => ({
      name: g.name,
      affinityScore: g.score,
    }));

    const primaryGenreName = coreGenres[0]?.name || 'Eclectic';
    const secondaryGenreName = coreGenres[1]?.name || 'Modern';
    const signatureSound = `${primaryGenreName} & ${secondaryGenreName} Soundscape`;

    const genreIdentity: ITwinGenreIdentity = {
      coreGenres,
      secondaryGenres,
      genreDiversityScore: dna.genreProfile?.diversity?.score ?? 0.5,
      signatureSound,
    };

    // Mood Identity
    const rawMoods = dna.moodProfile?.preferredMoods || [];
    const dominantMoods = rawMoods.slice(0, 4).map((m) => ({
      mood: m.name,
      affinityScore: m.score,
    }));

    const emotionalBreadth: 'focused' | 'moderate' | 'broad' | 'dynamic' =
      dominantMoods.length <= 2 ? 'focused' : dominantMoods.length >= 4 ? 'broad' : 'moderate';

    const moodIdentity: ITwinMoodIdentity = {
      dominantMoods,
      emotionalBreadth,
      contextualMoodAffinity: {
        focus: dominantMoods[0]?.mood || 'Calm',
        evening: dominantMoods[1]?.mood || 'Chill',
      },
    };

    // -------------------------------------------------------------------------
    // 2. Behavioral Characteristics & Tendencies
    // -------------------------------------------------------------------------
    const lb = dna.listeningBehavior;
    const mb = lb?.metricsBreakdown;

    let peakListeningTime = 'evening';
    if (dna.listeningPatterns?.timeOfDayDistribution) {
      const dist = dna.listeningPatterns.timeOfDayDistribution;
      const sortedPeriods = (Object.entries(dist) as [string, number][]).sort((a, b) => b[1] - a[1]);
      if (sortedPeriods[0]?.[0]) {
        peakListeningTime = sortedPeriods[0][0];
      }
    }

    const listeningBehavior: ITwinListeningBehavior = {
      repeatListeningTendency: lb?.repeatListeningTendency ?? 0.5,
      discoveryTendency: lb?.discoveryTendency ?? 0.5,
      skipTendency: lb?.skipTendency ?? 0.25,
      sessionListeningIntensity: lb?.sessionListeningIntensity ?? 0.5,
      completionRate: mb?.completionRatio ?? 0.75,
      avgSessionDurationMinutes: mb?.avgSessionDurationMinutes ?? 25,
      peakListeningTime,
      isDataSufficient: true,
    };

    const explorationTendency = dna.tendencies?.explorationPreference ?? 0.5;
    const familiarityTendency = dna.tendencies?.familiarityPreference ?? 0.5;
    const diversityPreference = dna.tendencies?.diversityPreference ?? 0.5;

    // -------------------------------------------------------------------------
    // 3. Taste Stability & Taste Evolution Direction
    // -------------------------------------------------------------------------
    const tasteStability: ITwinTasteStability = {
      stabilityScore: stability?.tasteStability ?? lb?.preferenceStability ?? 0.6,
      volatilityScore: stability?.tasteVolatility ?? 0.3,
      preferencePersistence: stability?.preferencePersistence ?? 0.65,
      stabilityRating:
        (stability?.tasteStability ?? 0.6) >= 0.75
          ? 'highly_stable'
          : (stability?.tasteStability ?? 0.6) >= 0.45
          ? 'moderate_drift'
          : 'rapid_transformation',
      description:
        stability?.description ?? 'Stable musical foundation with gradual adoption of new sounds.',
    };

    const tasteEvolution: ITwinTasteEvolution = {
      transformationIntensity: stability?.transformationIntensity ?? 0.15,
      evolutionArchetype: stability?.archetype ?? 'Gradual Evolver',
      primaryTasteDirection:
        timeline?.dominantPhases?.[0]
          ? `Centered in ${timeline.dominantPhases[0].leadingGenre} with steady evolution.`
          : `Anchor genres in ${primaryGenreName} with emerging explorations.`,
      activePhase: timeline?.dominantPhases?.[0]?.phaseName || `${primaryGenreName} Phase`,
      velocity:
        (stability?.transformationIntensity ?? 0.15) >= 0.65
          ? 'rapid'
          : (stability?.transformationIntensity ?? 0.15) >= 0.35
          ? 'moderate'
          : (stability?.transformationIntensity ?? 0.15) >= 0.1
          ? 'gradual'
          : 'static',
    };

    // -------------------------------------------------------------------------
    // 4. Emerging & Fading Preferences
    // -------------------------------------------------------------------------
    const currentEmergingInterests: ITwinEmergingInterests = {
      genres: (emerging?.emergingGenres || []).map((g) => ({
        name: g.name,
        confidence: g.emergenceConfidence,
        momentumVelocity: g.momentumDelta,
      })),
      artists: (emerging?.emergingArtists || []).map((a) => ({
        name: a.name,
        confidence: a.emergenceConfidence,
        momentumVelocity: a.momentumDelta,
      })),
      moods: (emerging?.emergingMoods || []).map((m) => m.name),
      narrative:
        emerging?.summary?.narrative || 'Emerging preferences currently forming around active listening.',
    };

    // -------------------------------------------------------------------------
    // 5. Listener Archetype & Personality Profile
    // -------------------------------------------------------------------------
    const listenerArchetype = archetype?.primaryArchetype || 'Balanced Listener';
    const archetypeDescription =
      archetype?.description ||
      'Harmonious balance between familiar favorites and exploratory discovery.';

    const personalityTraits = personality?.personalityTraits || [];
    const topTraitLabels = personalityTraits.map((t) => t.label);

    const personalityProfile: ITwinPersonalityProfile = {
      personaName: `The ${topTraitLabels[0] || archetype?.title || 'Sonic Voyager'}`,
      tagline: archetype?.tagline || 'Navigating personal sonic frequencies',
      bio:
        personality?.narrativeSummary ||
        `Listener characterized by ${primaryGenreName} foundational taste and ${archetype?.title || 'balanced'} listening habits.`,
      vibeKeywords: [
        primaryGenreName.toLowerCase(),
        ...(dominantMoods.slice(0, 2).map((m) => m.mood.toLowerCase())),
        ...(personalityTraits.slice(0, 2).map((t) => t.trait)),
      ].filter(Boolean),
      rarityScore: Number(
        Math.min(
          0.99,
          Math.max(
            0.1,
            0.5 * (dna.genreProfile?.diversity?.score ?? 0.5) +
              0.5 * (stability?.tasteVolatility ?? 0.3)
          )
        ).toFixed(2)
      ),
    };

    // Compatibility Dimensions
    const compatibilityDimensions: ITwinCompatibilityDimensions = {
      opennessScore: explorationTendency,
      intensityScore: listeningBehavior.sessionListeningIntensity,
      eclecticismScore: diversityPreference,
      tasteVector: [
        dominantMusicalTraits.energyPreference,
        dominantMusicalTraits.danceabilityPreference,
        dominantMusicalTraits.valencePreference,
        dominantMusicalTraits.acousticnessPreference,
        dominantMusicalTraits.instrumentalnessPreference,
      ],
    };

    // Confidence Level
    const confidenceScore = Number(
      Math.min(
        0.98,
        Math.max(
          0.25,
          0.4 * (dna.confidenceScore ?? 0.5) +
            0.3 * (archetype?.confidenceScore ?? 0.5) +
            0.3 * (personality?.confidenceScore ?? 0.5)
        )
      ).toFixed(2)
    );

    // Derived metadata (established and fading preferences without raw play logs)
    const metadata = {
      generationSource: 'unified_personal_music_twin_service',
      lastRefreshedAt: new Date().toISOString(),
      establishedPreferences: emerging?.establishedPreferences || {
        genres: coreGenres.map((g) => g.name),
        artists: (dna.artistProfile?.strongestArtists || []).slice(0, 5).map((a) => a.name),
      },
      fadingPreferences: emerging?.fadingPreferences || {
        genres: [],
        artists: [],
      },
      personalityTraits: personalityTraits,
      ...inputs.options?.metadataOverride,
    };

    const rawAttributes: PersonalMusicTwinAttributes = {
      userId,
      twinVersion: '1.0.0',
      listenerArchetype,
      archetypeDescription,
      dominantMusicalTraits,
      genreIdentity,
      moodIdentity,
      explorationTendency,
      familiarityTendency,
      diversityPreference,
      listeningBehavior,
      tasteStability,
      tasteEvolution,
      currentEmergingInterests,
      personalityProfile,
      compatibilityDimensions,
      confidenceScore,
      lastUpdatedTimestamp: new Date(),
      isDataSufficient: true,
      metadata,
    };

    return validateAndSanitizePersonalMusicTwin(rawAttributes);
  }

  /**
   * Generates or fully refreshes the user's Personal Music Twin by querying all
   * upstream intelligence systems and persisting the result in MongoDB.
   */
  static async generateMusicTwin(
    userId: string,
    options: TwinGenerationOptions = {}
  ): Promise<IPersonalMusicTwin> {
    const userIdStr = userId.toString();
    if (!isValidObjectId(userIdStr)) {
      throw new Error(`Invalid userId: ${userIdStr}`);
    }

    // 1. Fetch Unified Music DNA
    const dna = await UnifiedMusicDNAService.getOrGenerateProfile(userIdStr);

    // 2-7. Concurrently fetch all upstream intelligence signals
    const [
      snapshots,
      stabilityMetrics,
      emergingReport,
      timelineReport,
      archetypeResult,
      personalityProfile,
    ] = await Promise.all([
      MusicDNASnapshotService.getSnapshots(userIdStr, { limit: 10, sortAsc: false }).catch(() => []),
      TasteStabilityTransformationService.calculateUserStabilityMetrics(userIdStr).catch(() => null),
      EmergingTasteDetectionService.detectUserEmergingTastes(userIdStr).catch(() => null),
      TasteEvolutionTimelineService.getUserEvolutionTimeline(userIdStr).catch(() => null),
      ListenerArchetypeEngine.determineUserArchetype(userIdStr).catch(() => null),
      MusicalPersonalityProfileService.getUserPersonalityProfile(userIdStr).catch(() => null),
    ]);

    // Synthesize the coherent twin attributes
    const twinAttributes = this.synthesizeTwinFromSignals({
      userId,
      dna,
      snapshots,
      stabilityMetrics,
      emergingReport,
      timelineReport,
      archetypeResult,
      personalityProfile,
      options,
    });

    // Check if previous twin exists to evolve characteristics smoothly
    const existingTwin = await PersonalMusicTwin.findByUserId(userId).catch(() => null);

    let finalAttributes = twinAttributes;
    if (existingTwin) {
      const evolutionResult = MusicTwinEvolutionService.evolveTwin(
        existingTwin.toObject() as any,
        twinAttributes,
        {
          totalInteractionCount: dna.interactionsCountAtLastRefresh,
        }
      );
      finalAttributes = evolutionResult.evolvedTwin;
    }

    // Persist or update existing document
    const updatedTwin = await PersonalMusicTwin.updateDerivedTwin(userId, finalAttributes);
    return updatedTwin;
  }

  /**
   * Explicitly refreshes an existing Music Twin or generates a new one if none exists.
   */
  static async refreshMusicTwin(
    userId: string,
    options: TwinGenerationOptions = {}
  ): Promise<IPersonalMusicTwin> {
    return this.generateMusicTwin(userId, { ...options, forceRefresh: true });
  }

  /**
   * Retrieves the user's Personal Music Twin, generating or refreshing it if missing or expired.
   */
  static async getOrGenerateTwin(
    userId: string,
    options: TwinGenerationOptions = {}
  ): Promise<IPersonalMusicTwin> {
    const userIdStr = userId.toString();
    if (!isValidObjectId(userIdStr)) {
      throw new Error(`Invalid userId: ${userIdStr}`);
    }

    if (!options.forceRefresh) {
      const existing = await PersonalMusicTwin.findByUserId(userId);
      if (existing) {
        const maxAgeMs = (options.maxAgeMinutes ?? 60) * 60 * 1000;
        const ageMs = Date.now() - new Date(existing.lastUpdatedTimestamp).getTime();
        if (ageMs < maxAgeMs) {
          return existing;
        }
      }
    }

    return this.generateMusicTwin(userId, options);
  }
}

export default PersonalMusicTwinService;
