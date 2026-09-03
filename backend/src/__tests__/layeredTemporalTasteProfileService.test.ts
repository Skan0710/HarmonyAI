import assert from 'node:assert';
import { Types } from 'mongoose';
import {
  LayeredTemporalTasteProfileService,
  TasteAffinityItem,
} from '../services/layeredTemporalTasteProfileService.js';
import { RawTemporalInteractionEvent } from '../services/temporalPreferenceAggregationService.js';
import { ListeningHistory } from '../models/ListeningHistory.js';
import { User } from '../models/User.js';
import { ListeningSession } from '../models/ListeningSession.js';

export async function runLayeredTemporalTasteProfileServiceTests() {
  console.log('[Layered Temporal Taste Profile Service Test Suite] Starting tests...');

  const originalHistoryFind = (ListeningHistory as any).find;
  const originalUserFindById = (User as any).findById;
  const originalSessionFind = (ListeningSession as any).find;

  try {
    const userId = new Types.ObjectId().toString();
    const now = new Date('2026-09-01T12:00:00.000Z');

    // Test 1: Generate Short-Term, Medium-Term, and Long-Term Taste Layers
    {
      const events: RawTemporalInteractionEvent[] = [
        // Short-term (yesterday)
        {
          genreName: 'Synthwave',
          artistName: 'Kavinsky',
          mood: 'Energetic',
          action: 'complete',
          timestamp: new Date(now.getTime() - 1 * 86400000),
        },
        // Medium-term (25 days ago)
        {
          genreName: 'Electronic',
          artistName: 'Daft Punk',
          mood: 'Upbeat',
          action: 'complete',
          timestamp: new Date(now.getTime() - 25 * 86400000),
        },
        // Long-term (100 days ago)
        {
          genreName: 'Rock',
          artistName: 'Queen',
          mood: 'Classic',
          action: 'like',
          timestamp: new Date(now.getTime() - 100 * 86400000),
        },
      ];

      const profile = LayeredTemporalTasteProfileService.generateFromEvents(userId, events, {
        referenceDate: now,
      });

      // Verify Short-Term Layer
      assert.strictEqual(profile.shortTerm.layerName, 'short_term');
      assert.strictEqual(profile.shortTerm.timeframeDays, 14);
      assert.strictEqual(profile.shortTerm.role, 'immediate_momentum');
      assert.strictEqual(profile.shortTerm.genres.length, 1);
      assert.strictEqual(profile.shortTerm.genres[0].name, 'Synthwave');
      assert.strictEqual(profile.shortTerm.topGenre, 'Synthwave');
      assert.strictEqual(profile.shortTerm.topArtist, 'Kavinsky');

      // Verify Medium-Term Layer
      assert.strictEqual(profile.mediumTerm.layerName, 'medium_term');
      assert.strictEqual(profile.mediumTerm.timeframeDays, 60);
      assert.strictEqual(profile.mediumTerm.role, 'rotational_habits');
      const medGenres = profile.mediumTerm.genres.map((g) => g.name);
      assert.ok(medGenres.includes('Synthwave') && medGenres.includes('Electronic'));

      // Verify Long-Term Layer
      assert.strictEqual(profile.longTerm.layerName, 'long_term');
      assert.strictEqual(profile.longTerm.timeframeDays, 180);
      assert.strictEqual(profile.longTerm.role, 'foundational_taste');
      const longGenres = profile.longTerm.genres.map((g) => g.name);
      assert.ok(longGenres.includes('Synthwave') && longGenres.includes('Electronic') && longGenres.includes('Rock'));

      console.log('✓ Test 1 Passed: Short-term, medium-term, and long-term layers generated correctly.');
    }

    // Test 2: Preservation of Individual Layers Inside the Unified Profile
    {
      const events: RawTemporalInteractionEvent[] = [
        {
          genreName: 'Ambient',
          artistName: 'Brian Eno',
          mood: 'Calm',
          action: 'complete',
          timestamp: new Date(now.getTime() - 2 * 86400000),
        },
        {
          genreName: 'Metal',
          artistName: 'Iron Maiden',
          mood: 'Aggressive',
          action: 'complete',
          timestamp: new Date(now.getTime() - 90 * 86400000),
        },
      ];

      const profile = LayeredTemporalTasteProfileService.generateFromEvents(userId, events, {
        referenceDate: now,
      });

      // Individual layers must remain pristine and unmerged
      assert.ok(profile.shortTerm.genres.some((g) => g.name === 'Ambient'));
      assert.ok(!profile.shortTerm.genres.some((g) => g.name === 'Metal'), 'Metal should not exist in short-term layer');

      assert.ok(profile.longTerm.genres.some((g) => g.name === 'Metal'));
      assert.ok(profile.longTerm.genres.some((g) => g.name === 'Ambient'));

      // Unified profile contains the combination
      assert.ok(profile.unifiedGenres.some((g) => g.name === 'Ambient'));
      assert.ok(profile.unifiedGenres.some((g) => g.name === 'Metal'));

      console.log('✓ Test 2 Passed: Individual layers strictly preserved alongside unified profile.');
    }

    // Test 3: Taste Stability Calculation (Consistent Taste vs Active Pivot)
    {
      const stableShort: TasteAffinityItem[] = [
        { name: 'Rock', score: 1.0, rawWeight: 10, interactionCount: 5, lastInteractionAt: now },
        { name: 'Metal', score: 0.8, rawWeight: 8, interactionCount: 4, lastInteractionAt: now },
      ];
      const stableLong: TasteAffinityItem[] = [
        { name: 'Rock', score: 1.0, rawWeight: 20, interactionCount: 15, lastInteractionAt: now },
        { name: 'Metal', score: 0.75, rawWeight: 15, interactionCount: 10, lastInteractionAt: now },
      ];

      const highStability = LayeredTemporalTasteProfileService.calculateTasteStability(stableShort, stableLong);
      assert.ok(highStability >= 0.95, `Expected high stability for aligned tastes, got ${highStability}`);

      // Complete pivot: Short-term is Jazz and Pop, Long-term is Rock and Metal
      const pivotShort: TasteAffinityItem[] = [
        { name: 'Jazz', score: 1.0, rawWeight: 10, interactionCount: 5, lastInteractionAt: now },
        { name: 'Pop', score: 0.8, rawWeight: 8, interactionCount: 4, lastInteractionAt: now },
      ];

      const lowStability = LayeredTemporalTasteProfileService.calculateTasteStability(pivotShort, stableLong);
      assert.strictEqual(lowStability, 0.0, 'Disjoint genres must yield 0.0 stability indicating active pivot');

      console.log('✓ Test 3 Passed: Taste stability metric distinguishes stable vs pivoting listening habits.');
    }

    // Test 4: Configurable Layer Blend Weights
    {
      const events: RawTemporalInteractionEvent[] = [
        {
          genreName: 'ImmediateSpike',
          action: 'complete',
          timestamp: new Date(now.getTime() - 1 * 86400000),
        },
        ...Array.from({ length: 15 }, (_, i) => ({
          genreName: 'FoundationalClassic',
          action: 'complete' as const,
          timestamp: new Date(now.getTime() - (90 + i * 4) * 86400000),
        })),
      ];

      // Configuration A: 80% Short-term, 10% Medium-term, 10% Long-term
      const shortDominant = LayeredTemporalTasteProfileService.generateFromEvents(userId, events, {
        weights: { shortTermWeight: 0.80, mediumTermWeight: 0.10, longTermWeight: 0.10 },
        referenceDate: now,
      });
      assert.strictEqual(shortDominant.unifiedGenres[0].name, 'ImmediateSpike');

      // Configuration B: 10% Short-term, 20% Medium-term, 70% Long-term
      const longDominant = LayeredTemporalTasteProfileService.generateFromEvents(userId, events, {
        weights: { shortTermWeight: 0.10, mediumTermWeight: 0.20, longTermWeight: 0.70 },
        referenceDate: now,
      });
      assert.strictEqual(longDominant.unifiedGenres[0].name, 'FoundationalClassic');

      console.log('✓ Test 4 Passed: Layer blend weights configure priority between recent spike and foundation.');
    }

    // Test 5: Acoustic Targets Extraction and Blending
    {
      const songs = [
        { audioFeatures: { energy: 0.80, tempo: 130, valence: 0.70, danceability: 0.65 } },
        { audioFeatures: { energy: 0.60, tempo: 110, valence: 0.50, danceability: 0.55 } },
      ];

      const targets = LayeredTemporalTasteProfileService.extractAcousticTargets(songs);
      assert.strictEqual(targets.energy, 0.70);
      assert.strictEqual(targets.tempo, 120);
      assert.strictEqual(targets.valence, 0.60);
      assert.strictEqual(targets.danceability, 0.60);

      console.log('✓ Test 5 Passed: Acoustic profile target extraction verified.');
    }

    // Test 6: End-to-End Aggregation Reusing Existing Preference Services with Mocked MongoDB
    {
      const mockHistoryDocs = [
        {
          user: userId,
          song: {
            _id: new Types.ObjectId(),
            genre: { _id: new Types.ObjectId(), name: 'Synthwave' },
            artist: { _id: new Types.ObjectId(), name: 'Gunship' },
            mood: 'Retro',
            title: 'Tech Noir',
            audioFeatures: { energy: 0.85, tempo: 125, valence: 0.75 },
          },
          playedAt: new Date(now.getTime() - 2 * 86400000),
          completed: true,
          skipped: false,
        },
      ];

      const mockUserDoc = {
        _id: userId,
        favoriteGenres: [{ _id: new Types.ObjectId(), name: 'Synthwave' }],
        favoriteArtists: [{ _id: new Types.ObjectId(), name: 'Gunship' }],
        likedSongs: [],
        createdAt: new Date(now.getTime() - 90 * 86400000),
      };

      (ListeningHistory as any).find = () => ({
        populate: () => ({
          lean: async () => mockHistoryDocs,
        }),
      });

      (User as any).findById = () => ({
        populate: () => ({
          populate: () => ({
            populate: () => ({
              lean: async () => mockUserDoc,
            }),
          }),
        }),
      });

      (ListeningSession as any).find = () => ({
        select: () => ({
          lean: async () => [],
        }),
      });

      const fullProfile = await LayeredTemporalTasteProfileService.generateLayeredTasteProfile(userId, {
        referenceDate: now,
      });

      assert.strictEqual(fullProfile.userId, userId);
      assert.ok(fullProfile.shortTerm.genres.length > 0);
      assert.strictEqual(fullProfile.shortTerm.genres[0].name, 'Synthwave');
      assert.ok(fullProfile.unifiedGenres.length > 0);
      assert.strictEqual(fullProfile.unifiedGenres[0].name, 'Synthwave');
      assert.strictEqual(fullProfile.dominantTasteCategory, 'Synthwave');
      assert.ok(fullProfile.tasteStabilityScore >= 0.0 && fullProfile.tasteStabilityScore <= 1.0);

      console.log('✓ Test 6 Passed: End-to-end layered taste profile generation verified with mocked services.');
    }

    console.log('🎉 ALL 6 Layered Temporal Taste Profile Service tests completed successfully.');
  } finally {
    (ListeningHistory as any).find = originalHistoryFind;
    (User as any).findById = originalUserFindById;
    (ListeningSession as any).find = originalSessionFind;
  }
}
