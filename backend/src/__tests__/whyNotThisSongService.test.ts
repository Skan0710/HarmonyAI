import assert from 'node:assert';
import {
  WhyNotThisSongService,
  WhyNotSignalInput,
} from '../services/whyNotThisSongService.js';

export function runWhyNotThisSongServiceTests() {
  console.log('[Why Not This Song Service Test Suite] Starting tests...');

  // Test 1: Insufficient Data / Cold Start Handling (No unsupported claims)
  {
    const coldStartInput: WhyNotSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439031',
        title: 'New Track',
        genre: { name: 'Jazz' },
      },
      tasteProfile: {
        combinedGenres: [],
        combinedArtists: [],
      },
      totalUserInteractions: 0,
    };

    const result = WhyNotThisSongService.analyzeWhyNot(coldStartInput);

    assert.strictEqual(result.hasSufficientData, false);
    assert.strictEqual(result.reasons[0].type, 'INSUFFICIENT_DATA');
    assert.ok(result.primaryReason.includes('Insufficient listening history'));

    console.log('✓ Test 1 Passed: Cold start / insufficient data handled gracefully without unsupported claims.');
  }

  // Test 2: Low Genre Similarity with Top Preferred Genre Context
  {
    const input: WhyNotSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439032',
        title: 'Aria in D Minor',
        genre: { name: 'Opera' },
      },
      tasteProfile: {
        combinedGenres: [
          { name: 'Synthwave', affinityScore: 0.95 },
          { name: 'Indie Rock', affinityScore: 0.80 },
          { name: 'Opera', affinityScore: 0.05 },
        ],
        combinedArtists: [
          { name: 'Kavinsky', affinityScore: 0.90 },
        ],
      },
      totalUserInteractions: 50,
    };

    const result = WhyNotThisSongService.analyzeWhyNot(input);
    const genreReason = result.reasons.find((r) => r.type === 'LOW_GENRE_AFFINITY');

    assert.strictEqual(result.hasSufficientData, true);
    assert.ok(genreReason !== undefined);
    assert.ok(genreReason.message.includes('Opera'));
    assert.ok(genreReason.message.includes('Synthwave and Indie Rock'));
    assert.ok(genreReason.divergenceScore > 0.7);

    console.log('✓ Test 2 Passed: Low genre similarity with top preferred genre comparison verified.');
  }

  // Test 3: Low Artist Similarity
  {
    const input: WhyNotSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439033',
        title: 'Random Pop Song',
        artist: { name: 'Unknown Artist X' },
      },
      tasteProfile: {
        combinedArtists: [
          { name: 'Daft Punk', affinityScore: 0.95 },
          { name: 'The Weeknd', affinityScore: 0.90 },
        ],
      },
      totalUserInteractions: 40,
    };

    const result = WhyNotThisSongService.analyzeWhyNot(input);
    const artistReason = result.reasons.find((r) => r.type === 'LOW_ARTIST_AFFINITY');

    assert.ok(artistReason !== undefined);
    assert.ok(artistReason.message.includes('Unknown Artist X'));
    assert.ok(artistReason.message.includes('outside your regular listening rotation'));

    console.log('✓ Test 3 Passed: Low artist similarity verified.');
  }

  // Test 4: Incompatible Tempo (Significantly slower/faster than session pace)
  {
    const input: WhyNotSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439034',
        title: 'Slow Ballad',
        audioFeatures: { tempo: 60 },
      },
      sessionPreferences: {
        targetTempo: 130, // 70 BPM difference
      },
      totalUserInteractions: 20,
    };

    const result = WhyNotThisSongService.analyzeWhyNot(input);
    const tempoReason = result.reasons.find((r) => r.type === 'INCOMPATIBLE_TEMPO');

    assert.ok(tempoReason !== undefined);
    assert.ok(tempoReason.message.includes('60 BPM is significantly slower'));
    assert.ok(tempoReason.message.includes('130 BPM'));
    assert.ok(tempoReason.divergenceScore >= 0.8);

    console.log('✓ Test 4 Passed: Incompatible tempo detection verified.');
  }

  // Test 5: Incompatible Energy (Contrasts with target intensity)
  {
    const input: WhyNotSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439035',
        title: 'Sleep Drone',
        audioFeatures: { energy: 0.15 },
      },
      sessionPreferences: {
        targetEnergy: 0.85, // 0.70 difference
      },
      totalUserInteractions: 25,
    };

    const result = WhyNotThisSongService.analyzeWhyNot(input);
    const energyReason = result.reasons.find((r) => r.type === 'INCOMPATIBLE_ENERGY');

    assert.ok(energyReason !== undefined);
    assert.ok(energyReason.message.includes('Lower energy level (15%) contrasts with your target session intensity (85%)'));

    console.log('✓ Test 5 Passed: Incompatible energy detection verified.');
  }

  // Test 6: Incompatible Mood
  {
    const input: WhyNotSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439036',
        title: 'Melancholy Echoes',
        mood: 'Sad',
      },
      sessionPreferences: {
        activeMood: 'Party',
      },
      totalUserInteractions: 15,
    };

    const result = WhyNotThisSongService.analyzeWhyNot(input);
    const moodReason = result.reasons.find((r) => r.type === 'INCOMPATIBLE_MOOD');

    assert.ok(moodReason !== undefined);
    assert.ok(moodReason.message.includes('Sad mood contrasts with your active Party session vibe'));

    console.log('✓ Test 6 Passed: Incompatible mood detection verified.');
  }

  // Test 7: Previous Skips of Similar Songs / Artist / Genre
  {
    const input: WhyNotSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439037',
        title: 'Repetitive Track',
        artist: { name: 'Skipped Band' },
      },
      skippedArtists: ['Skipped Band'],
      totalUserInteractions: 30,
    };

    const result = WhyNotThisSongService.analyzeWhyNot(input);
    const skipReason = result.reasons.find((r) => r.type === 'PREVIOUS_SKIPS_SIMILAR_TRACKS');

    assert.ok(skipReason !== undefined);
    assert.ok(skipReason.message.includes('frequently skipped tracks by Skipped Band'));
    assert.strictEqual(skipReason.divergenceScore, 0.88);

    console.log('✓ Test 7 Passed: Previous skips reason extraction verified.');
  }

  // Test 8: Low Session Relevance
  {
    const input: WhyNotSignalInput = {
      song: { _id: '507f1f77bcf86cd799439038', title: 'Out of Context Song' },
      componentScores: { sessionScore: 0.15 },
      totalUserInteractions: 10,
    };

    const result = WhyNotThisSongService.analyzeWhyNot(input);
    const sessionReason = result.reasons.find((r) => r.type === 'LOW_SESSION_RELEVANCE');

    assert.ok(sessionReason !== undefined);
    assert.ok(sessionReason.message.includes('Low continuity with the tracks in your active queue'));

    console.log('✓ Test 8 Passed: Low session relevance reason verified.');
  }

  // Test 9: Ranking by Divergence & Max Reasons Limit
  {
    const multiNegativeInput: WhyNotSignalInput = {
      song: {
        _id: '507f1f77bcf86cd799439039',
        title: 'Complete Mismatch Song',
        artist: { name: 'Skipped Band' },
        genre: { name: 'Opera' },
        mood: 'Sad',
        audioFeatures: { tempo: 50, energy: 0.10 },
      },
      tasteProfile: {
        combinedGenres: [{ name: 'Synthwave', affinityScore: 0.95 }],
        combinedArtists: [{ name: 'Kavinsky', affinityScore: 0.90 }],
      },
      sessionPreferences: {
        activeMood: 'Energetic',
        targetEnergy: 0.90,
        targetTempo: 130,
      },
      skippedArtists: ['Skipped Band'],
      totalUserInteractions: 50,
      maxReasonsReturned: 3,
    };

    const result = WhyNotThisSongService.analyzeWhyNot(multiNegativeInput);

    assert.strictEqual(result.reasons.length, 3, 'Must return strictly top 3 divergence reasons');
    assert.ok(result.reasons[0].divergenceScore >= result.reasons[1].divergenceScore);
    assert.ok(result.reasons[1].divergenceScore >= result.reasons[2].divergenceScore);
    assert.ok(result.suitabilityScore < 0.5);

    console.log('✓ Test 9 Passed: Divergence score ranking and max reasons limit verified.');
  }

  console.log('🎉 All 9 Why Not This Song service tests completed successfully.');
}
