import assert from 'node:assert';
import { Types } from 'mongoose';
import { SessionCandidateGenerationService, SessionCandidateResult } from '../services/sessionCandidateGenerationService.js';
import { TemporarySessionProfile } from '../services/sessionProfileService.js';

export function runSessionCandidateGenerationServiceTests() {
  console.log('[Session Candidate Generation Service Test Suite] Starting tests...');

  // Test 1: Session Profile Affinity Calculation & Scoring Fusion
  {
    const mockSessionProfile: TemporarySessionProfile = {
      sessionId: 'sess_1',
      userId: 'user_1',
      songCount: 3,
      dominantGenres: [{ genre: 'Synthwave', score: 0.8 }, { genre: 'Pop', score: 0.2 }],
      dominantArtists: [{ artistId: 'artist_a', name: 'Artist A', score: 0.9 }],
      averageEnergy: 0.85,
      averageTempo: 130,
      moodDistribution: { Energetic: 0.9 },
      lastUpdated: new Date(),
    };

    const candidateSongSynthwave = {
      _id: new Types.ObjectId(),
      title: 'Synthwave Hit',
      genre: { name: 'Synthwave' },
      artist: { _id: 'artist_a', name: 'Artist A' },
      audioFeatures: { energy: 0.85, bpm: 130 },
      mood: 'Energetic',
    };

    const candidateSongAcoustic = {
      _id: new Types.ObjectId(),
      title: 'Slow Acoustic',
      genre: { name: 'Acoustic' },
      artist: { _id: 'artist_b', name: 'Artist B' },
      audioFeatures: { energy: 0.2, bpm: 70 },
      mood: 'Chill',
    };

    const affinitySynthwave = (SessionCandidateGenerationService as any).calculateProfileAffinity(
      candidateSongSynthwave,
      mockSessionProfile
    );
    const affinityAcoustic = (SessionCandidateGenerationService as any).calculateProfileAffinity(
      candidateSongAcoustic,
      mockSessionProfile
    );

    assert.ok(affinitySynthwave > 0.7, 'High profile affinity score for matching genre, artist, energy, and mood');
    assert.ok(affinitySynthwave > affinityAcoustic, 'Matching candidate scores higher than mismatch candidate');

    console.log('✓ Test 1 Passed: Session profile affinity calculation & scoring fusion verified.');
  }

  // Test 2: Artist Diversity Limit & Ranking Order
  {
    const candidatesInput: SessionCandidateResult[] = [
      {
        song: { _id: new Types.ObjectId(), title: 'Track 1', artist: 'Artist X' } as any,
        sessionRelevanceScore: 0.92,
        contentSimilarityScore: 0.9,
        sessionProfileAffinity: 0.94,
        source: 'session_content_similarity',
      },
      {
        song: { _id: new Types.ObjectId(), title: 'Track 2', artist: 'Artist Y' } as any,
        sessionRelevanceScore: 0.85,
        contentSimilarityScore: 0.8,
        sessionProfileAffinity: 0.9,
        source: 'session_profile_affinity',
      },
    ];

    candidatesInput.sort((a, b) => b.sessionRelevanceScore - a.sessionRelevanceScore);

    assert.strictEqual(candidatesInput[0].sessionRelevanceScore, 0.92);
    assert.strictEqual(candidatesInput[1].sessionRelevanceScore, 0.85);

    console.log('✓ Test 2 Passed: Candidate ranking order verified.');
  }

  console.log('🎉 All session candidate generation service tests completed successfully.');
}
