import assert from 'node:assert';
import { Types } from 'mongoose';
import {
  PersonalMusicTwinService,
  TwinSynthesisInputs,
} from '../services/personalMusicTwinService.js';
import { ARCHETYPE_DEFINITIONS } from '../services/listenerArchetypeEngine.js';

export async function runPersonalMusicTwinServiceTests() {
  console.log('[Personal Music Twin Service Test Suite] Starting tests...\n');

  // ---------------------------------------------------------------------------
  // Test 1: Full Coherent Personal Music Twin Synthesis
  // ---------------------------------------------------------------------------
  console.log('Test 1: Full coherent Personal Music Twin synthesis from multi-source intelligence');
  {
    const userId = new Types.ObjectId();
    const mockDna: any = {
      userId: userId.toString(),
      dnaVersion: '1.0.0',
      genreProfile: {
        topGenres: [
          { name: 'Synthwave', score: 0.92, playCount: 85 },
          { name: 'Cyberpunk', score: 0.84, playCount: 65 },
          { name: 'Darksynth', score: 0.76, playCount: 45 },
          { name: 'Electro Rock', score: 0.55, playCount: 20 },
        ],
        diversity: { score: 0.65, level: 'moderate' },
      },
      artistProfile: {
        strongestArtists: [
          { name: 'Gunship', score: 0.95, playCount: 90 },
          { name: 'The Midnight', score: 0.88, playCount: 75 },
          { name: 'Carpenter Brut', score: 0.82, playCount: 60 },
        ],
        diversity: { score: 0.70, level: 'moderate' },
      },
      moodProfile: {
        preferredMoods: [
          { name: 'Energetic', score: 0.90 },
          { name: 'Nocturnal', score: 0.85 },
          { name: 'Euphoric', score: 0.75 },
          { name: 'Atmospheric', score: 0.70 },
        ],
      },
      listeningBehavior: {
        repeatListeningTendency: 0.35,
        discoveryTendency: 0.75,
        skipTendency: 0.15,
        sessionListeningIntensity: 0.80,
        preferenceStability: 0.68,
        isDataSufficient: true,
        metricsBreakdown: {
          completionRatio: 0.88,
          avgSessionDurationMinutes: 45,
        },
      },
      tendencies: {
        explorationPreference: 0.75,
        familiarityPreference: 0.35,
        diversityPreference: 0.70,
      },
      listeningPatterns: {
        audioFeaturePreferences: {
          energy: 0.85,
          danceability: 0.70,
          valence: 0.60,
          acousticness: 0.15,
          instrumentalness: 0.65,
        },
        preferredTempo: {
          min: 115,
          max: 140,
          target: 126,
        },
        timeOfDayDistribution: {
          morning: 0.1,
          afternoon: 0.2,
          evening: 0.3,
          night: 0.4,
          late_night: 0.0,
        },
      },
      confidenceScore: 0.85,
      interactionsCountAtLastRefresh: 50,
    };

    const mockStability: any = {
      tasteStability: 0.72,
      tasteVolatility: 0.28,
      preferencePersistence: 0.78,
      transformationIntensity: 0.35,
      archetype: 'Gradual Evolver',
      description: 'Progressive musical broadening with high core stability.',
    };

    const mockEmerging: any = {
      emergingGenres: [
        { name: 'Industrial Techno', emergenceConfidence: 0.80, momentumDelta: 0.45 },
      ],
      emergingArtists: [
        { name: 'Kavinsky', emergenceConfidence: 0.75, momentumDelta: 0.38 },
      ],
      emergingMoods: [{ name: 'High Velocity' }],
      establishedPreferences: {
        genres: ['Synthwave', 'Cyberpunk'],
        artists: ['Gunship', 'The Midnight'],
      },
      fadingPreferences: {
        genres: ['Chiptune'],
        artists: ['Anamanaguchi'],
      },
      summary: {
        narrative: 'Expanding from retro synthwave into heavier industrial electronic soundscapes.',
      },
    };

    const mockTimeline: any = {
      dominantPhases: [
        {
          phaseName: 'Synthwave & Cyberpunk Era',
          leadingGenre: 'Synthwave',
          leadingArtist: 'Gunship',
          averageExploration: 0.75,
        },
      ],
    };

    const mockArchetype: any = {
      primaryArchetype: 'Explorer',
      title: ARCHETYPE_DEFINITIONS['Explorer'].title,
      tagline: ARCHETYPE_DEFINITIONS['Explorer'].tagline,
      description: ARCHETYPE_DEFINITIONS['Explorer'].description,
      confidenceScore: 0.82,
    };

    const mockPersonality: any = {
      personalityTraits: [
        {
          id: 'highly_exploratory',
          trait: 'highly exploratory',
          label: 'Sonic Trailblazer',
          category: 'exploration',
          score: 0.75,
          threshold: 0.70,
          evidence: 'High willingness to explore unfamiliar tracks.',
          confidence: 0.80,
        },
      ],
      narrativeSummary: 'A sonic explorer listener characterized by dynamic curiosity and electronic soundscapes.',
      confidenceScore: 0.80,
    };

    const inputs: TwinSynthesisInputs = {
      userId,
      dna: mockDna,
      stabilityMetrics: mockStability,
      emergingReport: mockEmerging,
      timelineReport: mockTimeline,
      archetypeResult: mockArchetype,
      personalityProfile: mockPersonality,
      isDataSufficient: true,
    };

    const twin = PersonalMusicTwinService.synthesizeTwinFromSignals(inputs);

    // 1. Verify User and Archetype
    assert.strictEqual(twin.userId.toString(), userId.toString());
    assert.strictEqual(twin.listenerArchetype, 'Explorer');
    assert.strictEqual(twin.archetypeDescription, ARCHETYPE_DEFINITIONS['Explorer'].description);
    assert.strictEqual(twin.isDataSufficient, true);

    // 2. Verify Dominant Musical Traits (Acoustic Identity)
    assert.strictEqual(twin.dominantMusicalTraits.energyPreference, 0.85);
    assert.strictEqual(twin.dominantMusicalTraits.danceabilityPreference, 0.70);
    assert.strictEqual(twin.dominantMusicalTraits.targetTempoBpm, 126);
    assert.strictEqual(twin.dominantMusicalTraits.tempoRange.min, 115);
    assert.strictEqual(twin.dominantMusicalTraits.tempoRange.max, 140);
    assert.ok(twin.dominantMusicalTraits.keyAcousticDescriptors.includes('High Energy'));

    // 3. Verify Genre and Mood Identity
    assert.strictEqual(twin.genreIdentity.coreGenres.length, 3);
    assert.strictEqual(twin.genreIdentity.coreGenres[0].name, 'Synthwave');
    assert.strictEqual(twin.genreIdentity.coreGenres[0].isPrimary, true);
    assert.strictEqual(twin.genreIdentity.signatureSound, 'Synthwave & Cyberpunk Soundscape');
    assert.strictEqual(twin.moodIdentity.dominantMoods.length, 4);
    assert.strictEqual(twin.moodIdentity.dominantMoods[0].mood, 'Energetic');
    assert.strictEqual(twin.moodIdentity.emotionalBreadth, 'broad');

    // 4. Verify Behavioral Characteristics
    assert.strictEqual(twin.listeningBehavior.repeatListeningTendency, 0.35);
    assert.strictEqual(twin.listeningBehavior.discoveryTendency, 0.75);
    assert.strictEqual(twin.listeningBehavior.completionRate, 0.88);
    assert.strictEqual(twin.listeningBehavior.avgSessionDurationMinutes, 45);
    assert.strictEqual(twin.listeningBehavior.peakListeningTime, 'night'); // highest period in mock

    // 5. Verify Taste Stability & Evolution
    assert.strictEqual(twin.tasteStability.stabilityScore, 0.72);
    assert.strictEqual(twin.tasteStability.volatilityScore, 0.28);
    assert.strictEqual(twin.tasteStability.stabilityRating, 'moderate_drift');
    assert.strictEqual(twin.tasteEvolution.transformationIntensity, 0.35);
    assert.strictEqual(twin.tasteEvolution.velocity, 'moderate');
    assert.strictEqual(twin.tasteEvolution.activePhase, 'Synthwave & Cyberpunk Era');

    // 6. Verify Emerging and Established Preferences
    assert.strictEqual(twin.currentEmergingInterests.genres.length, 1);
    assert.strictEqual(twin.currentEmergingInterests.genres[0].name, 'Industrial Techno');
    assert.strictEqual(twin.currentEmergingInterests.artists[0].name, 'Kavinsky');
    assert.strictEqual(twin.currentEmergingInterests.moods[0], 'High Velocity');
    assert.ok(twin.metadata?.establishedPreferences.genres.includes('Synthwave'));
    assert.ok(twin.metadata?.fadingPreferences.genres.includes('Chiptune'));

    // 7. Verify Personality Profile & Compatibility
    assert.strictEqual(twin.personalityProfile.personaName, 'The Sonic Trailblazer');
    assert.ok(twin.personalityProfile.vibeKeywords.includes('synthwave'));
    assert.strictEqual(twin.compatibilityDimensions.tasteVector.length, 5);
    assert.strictEqual(twin.compatibilityDimensions.tasteVector[0], 0.85); // energy

    // 8. Verify Confidence Level
    assert.ok(twin.confidenceScore >= 0.75, `Confidence score should be high: ${twin.confidenceScore}`);

    console.log(`✓ Test 1 Passed: Successfully synthesized coherent Personal Music Twin (confidence: ${(twin.confidenceScore * 100).toFixed(0)}%).`);
  }

  // ---------------------------------------------------------------------------
  // Test 2: Cold Start and Insufficient History Safe Handling
  // ---------------------------------------------------------------------------
  console.log('\nTest 2: Cold start and insufficient history safe baseline synthesis');
  {
    const userId = new Types.ObjectId();

    // Case A: dna is null
    const coldTwinA = PersonalMusicTwinService.synthesizeTwinFromSignals({
      userId,
      dna: null,
      isDataSufficient: false,
    });

    assert.strictEqual(coldTwinA.isDataSufficient, false);
    assert.strictEqual(coldTwinA.confidenceScore, 0.15);
    assert.strictEqual(coldTwinA.listenerArchetype, 'Balanced Explorer');
    assert.strictEqual(coldTwinA.metadata?.generationSource, 'cold_start_fallback');

    // Case B: dna has < 10 interactions
    const coldTwinB = PersonalMusicTwinService.synthesizeTwinFromSignals({
      userId,
      dna: {
        userId: userId.toString(),
        interactionsCountAtLastRefresh: 3,
        listeningBehavior: { isDataSufficient: false },
      } as any,
    });

    assert.strictEqual(coldTwinB.isDataSufficient, false);
    assert.strictEqual(coldTwinB.confidenceScore, 0.15);
    assert.strictEqual(coldTwinB.listenerArchetype, 'Balanced Explorer');

    console.log('✓ Test 2 Passed: Insufficient history correctly generated safe fallback Twin with baseline confidence floor.');
  }

  // ---------------------------------------------------------------------------
  // Test 3: Derived Representation Integrity (No Raw Play Logs)
  // ---------------------------------------------------------------------------
  console.log('\nTest 3: Derived representation non-duplication verification');
  {
    const userId = new Types.ObjectId();
    const twin = PersonalMusicTwinService.synthesizeTwinFromSignals({
      userId,
      dna: {
        userId: userId.toString(),
        interactionsCountAtLastRefresh: 25,
        listeningBehavior: { isDataSufficient: true },
      } as any,
      isDataSufficient: true,
    });

    const twinKeys = Object.keys(twin);
    assert.ok(!twinKeys.includes('rawInteractions'), 'Must not contain raw interaction logs');
    assert.ok(!twinKeys.includes('playHistory'), 'Must not contain raw play history');
    assert.ok(!twinKeys.includes('tracks'), 'Must not duplicate raw track lists');

    console.log('✓ Test 3 Passed: Verified pure derived intelligence without raw history duplication.');
  }

  // ---------------------------------------------------------------------------
  // Test 4: Automatic Sanitization and Boundary Clamping
  // ---------------------------------------------------------------------------
  console.log('\nTest 4: Sanitization and bounds clamping resilience');
  {
    const userId = new Types.ObjectId();
    const skewedDna: any = {
      userId: userId.toString(),
      interactionsCountAtLastRefresh: 30,
      listeningPatterns: {
        audioFeaturePreferences: {
          energy: 1.85, // out of range
          acousticness: -0.4, // out of range
        },
        preferredTempo: {
          target: 350, // exceeds max 240
        },
      },
      tendencies: {
        explorationPreference: 2.5, // out of range
        familiarityPreference: -1.0, // out of range
      },
      listeningBehavior: {
        repeatListeningTendency: 1.5,
        isDataSufficient: true,
      },
    };

    const sanitizedTwin = PersonalMusicTwinService.synthesizeTwinFromSignals({
      userId,
      dna: skewedDna,
      isDataSufficient: true,
    });

    assert.strictEqual(sanitizedTwin.dominantMusicalTraits.energyPreference, 1.0);
    assert.strictEqual(sanitizedTwin.dominantMusicalTraits.acousticnessPreference, 0.0);
    assert.strictEqual(sanitizedTwin.dominantMusicalTraits.targetTempoBpm, 240);
    assert.strictEqual(sanitizedTwin.explorationTendency, 1.0);
    assert.strictEqual(sanitizedTwin.familiarityTendency, 0.0);
    assert.strictEqual(sanitizedTwin.listeningBehavior.repeatListeningTendency, 1.0);

    console.log('✓ Test 4 Passed: Automatic boundary clamping safely normalizes extreme signal values.');
  }

  // ---------------------------------------------------------------------------
  // Test 5: Metadata Override and Extensible Configuration
  // ---------------------------------------------------------------------------
  console.log('\nTest 5: Metadata customization and extensible options');
  {
    const userId = new Types.ObjectId();
    const twinWithOptions = PersonalMusicTwinService.synthesizeTwinFromSignals({
      userId,
      dna: {
        userId: userId.toString(),
        interactionsCountAtLastRefresh: 30,
        listeningBehavior: { isDataSufficient: true },
      } as any,
      isDataSufficient: true,
      options: {
        metadataOverride: {
          customUspTag: 'future_audio_sync',
          experimentGroup: 'b_variant',
        },
      },
    });

    assert.strictEqual(twinWithOptions.metadata?.customUspTag, 'future_audio_sync');
    assert.strictEqual(twinWithOptions.metadata?.experimentGroup, 'b_variant');

    console.log('✓ Test 5 Passed: Metadata overrides and options applied cleanly.');
  }

  console.log('\n[Personal Music Twin Service Test Suite] All tests passed!\n');
  return true;
}

// Standalone execution support
if (
  process.argv[1]?.endsWith('personalMusicTwinService.test.ts') ||
  process.argv[1]?.endsWith('personalMusicTwinService.test.js')
) {
  runPersonalMusicTwinServiceTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Test suite failed:', err);
      process.exit(1);
    });
}
