import assert from 'node:assert';
import { Types } from 'mongoose';
import { AdaptiveSessionScoringService } from '../services/adaptiveSessionScoringService.js';
import {
  getAdaptiveSessionWeights,
  updateAdaptiveSessionWeights,
  resetAdaptiveSessionWeights,
} from '../config/recommendationConfig.js';
import { TemporarySessionProfile } from '../services/sessionProfileService.js';
import { ISessionEvent } from '../models/ListeningSession.js';

export function runAdaptiveSessionScoringTests() {
  console.log('[Adaptive Session Scoring Test Suite] Starting tests...');

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

  const likedSongId = new Types.ObjectId();
  const skippedSongId = new Types.ObjectId();

  const likedSongDoc = {
    _id: likedSongId,
    title: 'Liked Synth Track',
    genre: { name: 'Synthwave' },
    artist: { _id: 'artist_a', name: 'Artist A' },
    audioFeatures: { energy: 0.85, bpm: 130 },
    mood: 'Energetic',
  };

  const skippedSongDoc = {
    _id: skippedSongId,
    title: 'Skipped Slow Track',
    genre: { name: 'Acoustic' },
    artist: { _id: 'artist_b', name: 'Artist B' },
    audioFeatures: { energy: 0.2, bpm: 70 },
    mood: 'Chill',
  };

  const songMap = new Map<string, any>();
  songMap.set(likedSongId.toString(), likedSongDoc);
  songMap.set(skippedSongId.toString(), skippedSongDoc);

  // Test 1: Increased score for song similar to liked track vs skipped track
  {
    const sessionEvents: ISessionEvent[] = [
      { song: skippedSongId, action: 'skip', timestamp: new Date(Date.now() - 10000) },
      { song: likedSongId, action: 'like', timestamp: new Date() },
    ];

    const candidateSimilarToLiked = {
      _id: new Types.ObjectId(),
      title: 'Candidate Synth',
      genre: { name: 'Synthwave' },
      artist: { _id: 'artist_a', name: 'Artist A' },
      audioFeatures: { energy: 0.85, bpm: 130 },
      mood: 'Energetic',
    };

    const candidateSimilarToSkipped = {
      _id: new Types.ObjectId(),
      title: 'Candidate Acoustic',
      genre: { name: 'Acoustic' },
      artist: { _id: 'artist_b', name: 'Artist B' },
      audioFeatures: { energy: 0.2, bpm: 70 },
      mood: 'Chill',
    };

    const feedbackLiked = AdaptiveSessionScoringService.calculateInteractionFeedbackScore(
      candidateSimilarToLiked,
      sessionEvents,
      songMap
    );

    const feedbackSkipped = AdaptiveSessionScoringService.calculateInteractionFeedbackScore(
      candidateSimilarToSkipped,
      sessionEvents,
      songMap
    );

    assert.ok(feedbackLiked.feedbackScore > feedbackSkipped.feedbackScore, 'Candidate similar to liked song scores higher than candidate similar to skipped song');
    assert.ok(feedbackLiked.positiveBoost > 0, 'Positive feedback boost is recorded');
    assert.ok(feedbackSkipped.negativePenalty > 0, 'Negative feedback penalty is recorded');

    console.log('✓ Test 1 Passed: Liked song boost & skipped song penalty verified.');
  }

  // Test 2: Consideration of session genre, artist, mood, energy and tempo preferences
  {
    const candidateMatching = {
      _id: new Types.ObjectId(),
      title: 'Matching Track',
      genre: { name: 'Synthwave' },
      artist: { _id: 'artist_a', name: 'Artist A' },
      audioFeatures: { energy: 0.85, bpm: 130 },
      mood: 'Energetic',
    };

    const candidateMismatched = {
      _id: new Types.ObjectId(),
      title: 'Mismatched Track',
      genre: { name: 'Classical' },
      artist: { _id: 'artist_z', name: 'Artist Z' },
      audioFeatures: { energy: 0.1, bpm: 60 },
      mood: 'Sad',
    };

    const affinityMatch = AdaptiveSessionScoringService.calculateSessionProfileAffinity(
      candidateMatching,
      mockSessionProfile
    );
    const affinityMismatch = AdaptiveSessionScoringService.calculateSessionProfileAffinity(
      candidateMismatched,
      mockSessionProfile
    );

    assert.ok(affinityMatch > 0.8, 'High affinity for matching genre, artist, mood, energy, and tempo');
    assert.ok(affinityMatch > affinityMismatch, 'Matching track scores higher than mismatched track');

    console.log('✓ Test 2 Passed: Session profile affinity (genre, artist, mood, energy, tempo) verified.');
  }

  // Test 3: Higher weight given to recent interactions (Recency Decay)
  {
    // If skip was older and like was recent, net feedback should be strongly positive
    const sessionEventsLikeRecent: ISessionEvent[] = [
      { song: skippedSongId, action: 'skip', timestamp: new Date(Date.now() - 60000) },
      { song: likedSongId, action: 'like', timestamp: new Date() },
    ];

    const candidateSynth = {
      _id: new Types.ObjectId(),
      title: 'Candidate Synth',
      genre: { name: 'Synthwave' },
      artist: { _id: 'artist_a', name: 'Artist A' },
      audioFeatures: { energy: 0.85, bpm: 130 },
      mood: 'Energetic',
    };

    const res = AdaptiveSessionScoringService.calculateInteractionFeedbackScore(
      candidateSynth,
      sessionEventsLikeRecent,
      songMap
    );

    assert.ok(res.feedbackScore > 0.6, 'Recent liked interaction outweighs older skip');

    console.log('✓ Test 3 Passed: Interaction recency decay weighting verified.');
  }

  // Test 4: Configurable Interaction Weights
  {
    const initialWeights = getAdaptiveSessionWeights();
    assert.strictEqual(initialWeights.likeInteractionMultiplier, 1.5);
    assert.strictEqual(initialWeights.skipInteractionMultiplier, -1.2);

    updateAdaptiveSessionWeights({ likeInteractionMultiplier: 2.5 });
    assert.strictEqual(getAdaptiveSessionWeights().likeInteractionMultiplier, 2.5);

    resetAdaptiveSessionWeights();
    assert.strictEqual(getAdaptiveSessionWeights().likeInteractionMultiplier, 1.5);

    console.log('✓ Test 4 Passed: Configurable interaction weights verified.');
  }

  console.log('🎉 All adaptive session scoring tests completed successfully.');
}
