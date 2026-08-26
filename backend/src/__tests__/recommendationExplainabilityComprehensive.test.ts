import assert from 'node:assert';
import { Types } from 'mongoose';
import {
  RecommendationExplanationService,
  ExplanationSignalInput,
} from '../services/recommendationExplanationService.js';
import {
  WhyNotThisSongService,
  WhyNotSignalInput,
} from '../services/whyNotThisSongService.js';
import { submitFeedback } from '../controllers/recommendationInteractionController.js';
import { RecommendationInteraction } from '../models/RecommendationInteraction.js';

export async function runComprehensiveExplainabilityTests() {
  console.log('[Recommendation Explainability Comprehensive Test Suite] Starting tests...');

  // -------------------------------------------------------------
  // Test 1: Strong Genre Similarity
  // -------------------------------------------------------------
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439011',
        title: 'Cyberpunk Drive',
        genre: { name: 'Synthwave' },
      },
      tasteProfile: {
        combinedGenres: [
          { name: 'Synthwave', affinityScore: 0.95 },
          { name: 'Rock', affinityScore: 0.20 },
        ],
      },
    };

    const explanation = RecommendationExplanationService.explainSong(input);
    const genreReason = explanation.reasons.find((r) => r.type === 'PREFERRED_GENRE');

    assert.ok(genreReason !== undefined, 'Must produce PREFERRED_GENRE for 95% genre match');
    assert.ok(genreReason.message.includes('Synthwave'));
    assert.ok(genreReason.message.includes('95% affinity'));
    assert.ok(genreReason.importanceScore >= 0.80 && genreReason.importanceScore <= 1.0);
    console.log('✓ Test 1 Passed: Strong genre similarity correctly identified and formatted.');
  }

  // -------------------------------------------------------------
  // Test 2: Strong Artist Similarity
  // -------------------------------------------------------------
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439012',
        title: 'Nightfall',
        artist: { name: 'Kavinsky' },
      },
      tasteProfile: {
        combinedArtists: [
          { name: 'Kavinsky', affinityScore: 0.92 },
        ],
      },
    };

    const explanation = RecommendationExplanationService.explainSong(input);
    const artistReason = explanation.reasons.find((r) => r.type === 'SIMILAR_ARTIST');

    assert.ok(artistReason !== undefined, 'Must produce SIMILAR_ARTIST for 92% artist match');
    assert.ok(artistReason.message.includes('Kavinsky'));
    assert.ok(artistReason.message.includes('92% affinity'));
    assert.ok(artistReason.importanceScore >= 0.80 && artistReason.importanceScore <= 1.0);
    console.log('✓ Test 2 Passed: Strong artist similarity correctly identified.');
  }

  // -------------------------------------------------------------
  // Test 3: Session Relevance (Mood, Energy, and Tempo Flow)
  // -------------------------------------------------------------
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439013',
        title: 'Hyper Pulse',
        mood: 'Energetic',
        audioFeatures: { energy: 0.88, tempo: 128 },
      },
      sessionPreferences: {
        activeMood: 'Energetic',
        targetEnergy: 0.85,
        targetTempo: 130,
      },
      componentScores: { sessionScore: 0.90 },
    };

    const explanation = RecommendationExplanationService.explainSong(input);
    const sessionReason = explanation.reasons.find((r) => r.type === 'SESSION_PREFERENCE');
    const moodReason = explanation.reasons.find((r) => r.type === 'PREFERRED_MOOD');
    const energyReason = explanation.reasons.find((r) => r.type === 'PREFERRED_ENERGY');

    assert.ok(sessionReason !== undefined, 'Must produce SESSION_PREFERENCE');
    assert.ok(moodReason !== undefined, 'Must produce PREFERRED_MOOD');
    assert.ok(energyReason !== undefined, 'Must produce PREFERRED_ENERGY');
    assert.ok(moodReason.message.toLowerCase().includes('energetic'));
    assert.ok(energyReason.message.includes('Energy pace') && energyReason.message.includes('session intensity'));
    console.log('✓ Test 3 Passed: Session relevance, mood, and energy matches correctly extracted.');
  }

  // -------------------------------------------------------------
  // Test 4: Novelty Recommendations & Contradiction Suppression
  // -------------------------------------------------------------
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439014',
        title: 'Deep Unknown',
        artist: { name: 'Brand New Emerging Artist' },
        genre: { name: 'Ambient Lo-Fi' },
      },
      noveltyScore: 0.88,
      isDiscoveryOpportunity: true,
      tasteProfile: {
        combinedArtists: [], // Unfamiliar artist
      },
    };

    const explanation = RecommendationExplanationService.explainSong(input);
    const noveltyReason = explanation.reasons.find((r) => r.type === 'NOVELTY');
    const discoveryReason = explanation.reasons.find((r) => r.type === 'DISCOVERY_OPPORTUNITY');
    const artistReason = explanation.reasons.find((r) => r.type === 'SIMILAR_ARTIST');

    assert.ok(noveltyReason !== undefined || discoveryReason !== undefined, 'Must identify novelty/discovery');
    assert.strictEqual(artistReason, undefined, 'Must NOT falsely claim familiar artist similarity for novel discovery');
    console.log('✓ Test 4 Passed: Novelty recommendations and contradiction resolution verified.');
  }

  // -------------------------------------------------------------
  // Test 5: Collaborative Recommendations ("Listeners like you")
  // -------------------------------------------------------------
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439015',
        title: 'Community Hit',
      },
      componentScores: { collaborativeScore: 0.85 },
      sources: ['collaborative'],
    };

    const explanation = RecommendationExplanationService.explainSong(input);
    const collabReason = explanation.reasons.find((r) => r.type === 'COLLABORATIVE_SIMILARITY');

    assert.ok(collabReason !== undefined, 'Must produce COLLABORATIVE_SIMILARITY');
    assert.ok(collabReason.message.includes('listeners with similar musical taste'));
    assert.ok(collabReason.message.includes('85% match'));
    console.log('✓ Test 5 Passed: Collaborative recommendations accurately explained.');
  }

  // -------------------------------------------------------------
  // Test 6: Weak Recommendation Signals (No unsupported claims)
  // -------------------------------------------------------------
  {
    const input: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439016',
        title: 'Generic Track',
      },
      componentScores: {
        contentScore: 0.05,
        collaborativeScore: 0.05,
        genreScore: 0.05,
        artistScore: 0.05,
        popularityScore: 0.10,
      },
      tasteProfile: {
        combinedGenres: [],
        combinedArtists: [],
      },
    };

    const explanation = RecommendationExplanationService.explainSong(input);
    assert.ok(explanation.reasons.length > 0);
    // Should fallback to general taste match, never making false high-affinity claims
    assert.strictEqual(explanation.reasons.some((r) => r.type === 'PREFERRED_GENRE'), false);
    assert.strictEqual(explanation.reasons.some((r) => r.type === 'SIMILAR_ARTIST'), false);
    console.log('✓ Test 6 Passed: Weak recommendation signals do not generate unsupported claims.');
  }

  // -------------------------------------------------------------
  // Test 7: Users with Insufficient History (Cold-Start Safeguard)
  // -------------------------------------------------------------
  {
    const coldStartWhyNotInput: WhyNotSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439017',
        title: 'Random Song',
      },
      tasteProfile: null,
      totalUserInteractions: 0,
    };

    const whyNotResult = WhyNotThisSongService.analyzeWhyNot(coldStartWhyNotInput);
    assert.strictEqual(whyNotResult.hasSufficientData, false);
    assert.strictEqual(whyNotResult.reasons[0].type, 'INSUFFICIENT_DATA');
    assert.ok(whyNotResult.primaryReason.includes('Insufficient listening history'));

    console.log('✓ Test 7 Passed: Cold-start users explicitly flagged as insufficient data.');
  }

  // -------------------------------------------------------------
  // Test 8: Songs with Incomplete Metadata
  // -------------------------------------------------------------
  {
    const incompleteSongInput: ExplanationSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439018',
        title: 'Song with Missing Attributes',
        artist: null,
        genre: undefined,
        mood: {},
        audioFeatures: null,
      },
      sessionPreferences: null,
      tasteProfile: null,
      componentScores: undefined,
    };

    const explanation = RecommendationExplanationService.explainSong(incompleteSongInput);
    assert.ok(explanation !== null);
    assert.ok(typeof explanation.primaryExplanation === 'string');
    assert.ok(!explanation.primaryExplanation.includes('undefined'));
    assert.ok(!explanation.primaryExplanation.includes('[object Object]'));
    assert.ok(!explanation.summary.includes('undefined'));
    assert.ok(explanation.confidenceScore >= 0.0 && explanation.confidenceScore <= 1.0);

    console.log('✓ Test 8 Passed: Songs with incomplete metadata handled safely without crash or formatting artifacts.');
  }

  // -------------------------------------------------------------
  // Test 9: Why This Song vs Why Not This Song Analysis
  // -------------------------------------------------------------
  {
    const whyNotInput: WhyNotSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439019',
        title: 'Slow Classical Piece',
        genre: { name: 'Classical' },
        audioFeatures: { tempo: 55, energy: 0.15 },
      },
      tasteProfile: {
        combinedGenres: [{ name: 'EDM', affinityScore: 0.95 }],
      },
      sessionPreferences: {
        targetTempo: 135,
        targetEnergy: 0.90,
      },
      totalUserInteractions: 45,
    };

    const result = WhyNotThisSongService.analyzeWhyNot(whyNotInput);
    assert.strictEqual(result.hasSufficientData, true);
    assert.ok(result.reasons.length >= 2);
    assert.ok(result.reasons.some((r) => r.type === 'LOW_GENRE_AFFINITY'));
    assert.ok(result.reasons.some((r) => r.type === 'INCOMPATIBLE_TEMPO'));
    assert.ok(result.suitabilityScore < 0.40);

    console.log('✓ Test 9 Passed: Why not this song divergence analysis verified.');
  }

  // -------------------------------------------------------------
  // Test 10: Recommendation Feedback Submission
  // -------------------------------------------------------------
  {
    const mockUserId = new Types.ObjectId();
    const mockSongId = new Types.ObjectId();
    let savedInteraction: any = null;

    const originalDeleteMany = RecommendationInteraction.deleteMany;
    const originalPrototypeSave = RecommendationInteraction.prototype.save;

    (RecommendationInteraction as any).deleteMany = async () => ({ deletedCount: 0 });
    (RecommendationInteraction.prototype as any).save = async function () {
      savedInteraction = this;
      return this;
    };

    try {
      const req: any = {
        user: { _id: mockUserId, email: 'tester@test.com' },
        body: {
          songId: mockSongId.toString(),
          feedback: 'not_my_style',
          explanationContext: {
            primaryExplanation: 'Features Synthwave',
            confidenceScore: 0.88,
          },
        },
      };

      let statusCode = 200;
      let jsonBody: any = null;
      const res: any = {
        status(code: number) {
          statusCode = code;
          return this;
        },
        json(data: any) {
          jsonBody = data;
          return this;
        },
      };

      await submitFeedback(req, res);
      assert.strictEqual(statusCode, 200);
      assert.strictEqual(jsonBody.success, true);
      assert.strictEqual(savedInteraction.explanationFeedback, 'not_my_style');
      assert.strictEqual(savedInteraction.metadata.confidenceScore, 0.88);

      console.log('✓ Test 10 Passed: Recommendation feedback end-to-end recording verified.');
    } finally {
      RecommendationInteraction.deleteMany = originalDeleteMany;
      RecommendationInteraction.prototype.save = originalPrototypeSave;
    }
  }

  // -------------------------------------------------------------
  // Test 11: Ranking Invariance Guarantee
  // -------------------------------------------------------------
  {
    const candidates = [
      {
        song: { _id: '1', title: 'Top Ranked Track', score: 0.95 },
        componentScores: { contentScore: 0.95 },
      },
      {
        song: { _id: '2', title: 'Second Track', score: 0.85 },
        componentScores: { contentScore: 0.85 },
      },
      {
        song: { _id: '3', title: 'Third Track', score: 0.75 },
        componentScores: { contentScore: 0.75 },
      },
    ];

    const initialOrder = candidates.map((c) => c.song._id);
    const initialScores = candidates.map((c) => c.song.score);

    // Generate explanations
    const explanations = RecommendationExplanationService.explainBatch(candidates);
    assert.strictEqual(explanations.length, 3);

    // Verify candidates were not mutated or reordered
    const finalOrder = candidates.map((c) => c.song._id);
    const finalScores = candidates.map((c) => c.song.score);

    assert.deepStrictEqual(initialOrder, finalOrder, 'Candidate ordering must NOT change');
    assert.deepStrictEqual(initialScores, finalScores, 'Candidate scores must NOT change');

    console.log('✓ Test 11 Passed: Ranking invariance guaranteed — explanation generation is non-mutating.');
  }

  console.log('🎉 All 11 Comprehensive Recommendation Explainability tests completed successfully.');
}
