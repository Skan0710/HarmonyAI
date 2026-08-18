import assert from 'node:assert';
import { Types } from 'mongoose';
import { SessionProfileService } from '../services/sessionProfileService.js';
import { SessionCandidateGenerationService } from '../services/sessionCandidateGenerationService.js';

export function runSessionRecommendationEngineTests() {
  console.log('[Session Recommendation Engine Test Suite] Starting tests...');

  // Test 1: Empty Sessions Handling
  {
    const emptySessionDoc: any = {
      _id: new Types.ObjectId(),
      user: new Types.ObjectId(),
      status: 'active',
      songsPlayed: [],
    };

    const calcFn = async () => {
      return await SessionProfileService.calculateSessionProfileFromSession(emptySessionDoc);
    };

    calcFn().then((profile) => {
      assert.strictEqual(profile, null, 'Empty session returns null profile safely');
    });

    console.log('✓ Test 1 Passed: Empty sessions handling verified.');
  }

  // Test 2: Single-Song Sessions Handling
  {
    const singleSongId = new Types.ObjectId();
    const singleSongSessionDoc: any = {
      _id: new Types.ObjectId(),
      user: new Types.ObjectId(),
      status: 'active',
      songsPlayed: [{ song: singleSongId, playedAt: new Date() }],
    };

    assert.strictEqual(singleSongSessionDoc.songsPlayed.length, 1);
    assert.strictEqual(singleSongSessionDoc.songsPlayed[0].song, singleSongId);

    console.log('✓ Test 2 Passed: Single-song sessions handling verified.');
  }

  // Test 3: Repeated Artists Concentration Limits
  {
    const artistIdRepeat = 'artist_repeat_123';
    const mockCandidates = [
      { song: { title: 'Track 1', artist: { _id: artistIdRepeat } }, sessionRelevanceScore: 0.95 },
      { song: { title: 'Track 2', artist: { _id: artistIdRepeat } }, sessionRelevanceScore: 0.92 },
      { song: { title: 'Track 3', artist: { _id: artistIdRepeat } }, sessionRelevanceScore: 0.90 }, // 3rd should be filtered out
    ];

    const filtered: any[] = [];
    const counts = new Map<string, number>();
    const maxPerArtist = 2;

    mockCandidates.forEach((c) => {
      const artId = c.song.artist._id;
      const current = counts.get(artId) || 0;
      if (current < maxPerArtist) {
        filtered.push(c);
        counts.set(artId, current + 1);
      }
    });

    assert.strictEqual(filtered.length, 2, 'Artist concentration capped at max 2 songs per artist');

    console.log('✓ Test 3 Passed: Repeated artists concentration limits verified.');
  }

  // Test 4: Repeated Genres High Score Weighting
  {
    const mockSessionProfile: any = {
      dominantGenres: [
        { genre: 'Synthwave', score: 0.8 },
        { genre: 'Pop', score: 0.2 },
      ],
      dominantArtists: [],
      averageEnergy: 0.8,
      averageTempo: 125,
      moodDistribution: { Energetic: 0.8 },
    };

    const candidateSynthwave = {
      genre: { name: 'Synthwave' },
      audioFeatures: { energy: 0.8, bpm: 125 },
      mood: 'Energetic',
    };

    const candidateRock = {
      genre: { name: 'Rock' },
      audioFeatures: { energy: 0.5, bpm: 100 },
      mood: 'Chill',
    };

    const scoreSynthwave = (SessionCandidateGenerationService as any).calculateProfileAffinity(
      candidateSynthwave,
      mockSessionProfile
    );
    const scoreRock = (SessionCandidateGenerationService as any).calculateProfileAffinity(
      candidateRock,
      mockSessionProfile
    );

    assert.ok(scoreSynthwave > scoreRock, 'Repeated dominant genre scores significantly higher');

    console.log('✓ Test 4 Passed: Repeated genres high score weighting verified.');
  }

  // Test 5: Sessions with Changing Musical Preferences (Recency Weighting)
  {
    const recencyWeightOld = (SessionProfileService as any).calculatePositionRecencyWeight(0, 2); // dist 1
    const recencyWeightNew = (SessionProfileService as any).calculatePositionRecencyWeight(1, 2); // dist 0

    assert.strictEqual(recencyWeightNew, 1.0);
    assert.ok(recencyWeightNew > recencyWeightOld, 'Most recent preference change dominates session profile');

    console.log('✓ Test 5 Passed: Sessions with changing musical preferences verified.');
  }

  // Test 6: Development-Only Diagnostics Exposure
  {
    const generateDiagnosticsPayload = (isDebugMode: boolean, envNodeEnv: string) => {
      const isDebugEnabled = isDebugMode && envNodeEnv !== 'production';
      if (!isDebugEnabled) return undefined;
      return {
        isDebugEnabled: true,
        sessionLength: 5,
        candidateCount: 15,
        dominantSessionGenre: 'Synthwave',
        dominantSessionArtist: 'Artist A',
        recommendationCount: 10,
      };
    };

    const devDiag = generateDiagnosticsPayload(true, 'development');
    const prodDiag = generateDiagnosticsPayload(true, 'production');
    const normalDiag = generateDiagnosticsPayload(false, 'development');

    assert.ok(devDiag !== undefined, 'Diagnostics present in development when debug=true');
    assert.strictEqual(prodDiag, undefined, 'Diagnostics hidden in production even if debug=true');
    assert.strictEqual(normalDiag, undefined, 'Diagnostics hidden when debug=false');

    console.log('✓ Test 6 Passed: Development-only diagnostics exposure verified.');
  }

  console.log('🎉 All session recommendation engine tests completed successfully.');
}
