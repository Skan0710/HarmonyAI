import assert from 'node:assert';
import {
  MusicDNAProfilingService,
} from '../services/musicDnaProfilingService.js';
import {
  MusicDNAExtractionService,
  RawHistoryRecord,
} from '../services/musicDnaExtractionService.js';

export async function runDetailedMusicDNAProfilingTests() {
  console.log('[Detailed Music DNA Profiling Test Suite] Starting tests...');

  // Test 1: Distinguishing Established vs Emerging Preferences
  {
    const userId = crypto.randomUUID().toString();
    const now = new Date('2026-07-01T12:00:00Z');
    const history: RawHistoryRecord[] = [];

    // Long-term foundational listening (played between 20 and 60 days ago):
    // Established genres: 'Synthwave', 'Indie Rock'
    // Established artists: 'The Midnight', 'Arctic Monkeys'
    for (let i = 0; i < 25; i++) {
      history.push({
        song: {
          _id: `foundational_${i}`,
          genre: { _id: 'g_synth', name: 'Synthwave' },
          artist: { _id: 'a_midnight', name: 'The Midnight' },
          mood: 'Chill',
        },
        playedAt: new Date(now.getTime() - (20 + i) * 24 * 3600 * 1000),
        completed: true,
      });
    }

    for (let i = 0; i < 15; i++) {
      history.push({
        song: {
          _id: `indie_${i}`,
          genre: { _id: 'g_indie', name: 'Indie Rock' },
          artist: { _id: 'a_arctic', name: 'Arctic Monkeys' },
          mood: 'Energetic',
        },
        playedAt: new Date(now.getTime() - (25 + i) * 24 * 3600 * 1000),
        completed: true,
      });
    }

    // Short-term emerging listening (past 3 days):
    // New discovery with ZERO historical plays:
    // Emerging genre: 'Nu-Disco'
    // Emerging artist: 'Purple Disco Machine'
    for (let i = 0; i < 8; i++) {
      history.push({
        song: {
          _id: `disco_${i}`,
          genre: { _id: 'g_disco', name: 'Nu-Disco' },
          artist: { _id: 'a_purple', name: 'Purple Disco Machine' },
          mood: 'Upbeat',
        },
        playedAt: new Date(now.getTime() - (1 + (i % 3)) * 24 * 3600 * 1000),
        completed: true,
      });
    }

    const rawInputs = {
      userId,
      user: {
        _id: userId,
        likedSongs: [],
        favoriteGenres: [{ _id: 'g_synth', name: 'Synthwave' }],
      },
      history,
      referenceDate: now,
    };

    const profile = MusicDNAProfilingService.generateDetailedProfileFromData(rawInputs, {
      referenceDate: now,
    });

    // Verify emerging genres detection
    const emergingGenreNames = profile.emergingGenres.map((g) => g.name);
    assert.ok(
      emergingGenreNames.includes('Nu-Disco'),
      'Nu-Disco must be identified as an emerging genre'
    );
    const nuDisco = profile.emergingGenres.find((g) => g.name === 'Nu-Disco')!;
    assert.strictEqual(nuDisco.preferenceType, 'emerging');
    assert.ok(nuDisco.shortTermScore > 0);
    assert.strictEqual(nuDisco.longTermScore, 0, 'Emerging item has 0 long-term baseline score');

    // Verify emerging artists detection
    const emergingArtistNames = profile.emergingArtists.map((a) => a.name);
    assert.ok(
      emergingArtistNames.includes('Purple Disco Machine'),
      'Purple Disco Machine must be identified as an emerging artist'
    );
    const purpleDisco = profile.emergingArtists.find((a) => a.name === 'Purple Disco Machine')!;
    assert.strictEqual(purpleDisco.preferenceType, 'emerging');

    // Verify established foundational taste is PRESERVED (Synthwave remains top or strong)
    const synthwave = profile.topGenres.find((g) => g.name === 'Synthwave');
    assert.ok(synthwave, 'Synthwave must be present in top genres');
    assert.ok(synthwave!.longTermScore > 0, 'Synthwave must have strong long-term foundational score');
    assert.ok(synthwave!.score > 0.5, 'Synthwave overall blended score must be preserved');

    // Also check through MusicDNAExtractionService unified wrapper
    const profileFromExtraction = MusicDNAExtractionService.generateDetailedProfileFromData(rawInputs, {
      referenceDate: now,
    });
    assert.strictEqual(profileFromExtraction.emergingGenres[0]?.name, profile.emergingGenres[0]?.name);

    console.log('✓ Test 1 Passed: Established vs emerging preferences cleanly differentiated and foundational taste preserved.');
  }

  // Test 2: Genre and Artist Diversity Metrics Calculation
  {
    const userId = crypto.randomUUID().toString();

    // 2A: Monoculture Case (Low Diversity)
    const monocultureHistory: RawHistoryRecord[] = [];
    for (let i = 0; i < 20; i++) {
      monocultureHistory.push({
        song: {
          _id: `mono_${i}`,
          genre: { _id: 'g_ambient', name: 'Ambient' },
          artist: { _id: 'a_eno', name: 'Brian Eno' },
          mood: 'Relaxed',
        },
        playedAt: new Date(),
        completed: true,
      });
    }

    const lowDiversityProfile = MusicDNAProfilingService.generateDetailedProfileFromData({
      userId,
      user: { _id: userId },
      history: monocultureHistory,
    });

    assert.strictEqual(lowDiversityProfile.genreDiversity.level, 'low');
    assert.strictEqual(lowDiversityProfile.artistDiversity.level, 'low');
    assert.strictEqual(lowDiversityProfile.genreDiversity.effectiveCount, 1);
    assert.ok(lowDiversityProfile.genreDiversity.score <= 0.35);

    // 2B: Eclectic Case (High Diversity across 10 genres and 12 artists)
    const eclecticHistory: RawHistoryRecord[] = [];
    const genres = ['Rock', 'Jazz', 'Classical', 'Hip-Hop', 'EDM', 'Pop', 'Soul', 'Folk', 'Metal', 'Reggae'];
    const artists = ['Artist A', 'Artist B', 'Artist C', 'Artist D', 'Artist E', 'Artist F', 'Artist G', 'Artist H', 'Artist I', 'Artist J', 'Artist K', 'Artist L'];

    for (let i = 0; i < 60; i++) {
      eclecticHistory.push({
        song: {
          _id: `eclectic_${i}`,
          genre: { _id: `g_${i % genres.length}`, name: genres[i % genres.length] },
          artist: { _id: `a_${i % artists.length}`, name: artists[i % artists.length] },
          mood: 'Upbeat',
        },
        playedAt: new Date(),
        completed: true,
      });
    }

    const highDiversityProfile = MusicDNAProfilingService.generateDetailedProfileFromData({
      userId,
      user: { _id: userId },
      history: eclecticHistory,
    });

    assert.ok(
      highDiversityProfile.genreDiversity.level === 'high' ||
      highDiversityProfile.genreDiversity.level === 'very_high',
      `Expected high/very_high genre diversity, got ${highDiversityProfile.genreDiversity.level}`
    );
    assert.ok(highDiversityProfile.genreDiversity.score >= 0.7);
    assert.strictEqual(highDiversityProfile.genreDiversity.effectiveCount, 10);
    assert.strictEqual(highDiversityProfile.artistDiversity.effectiveCount, 12);

    console.log('✓ Test 2 Passed: Diversity metrics accurately classify low concentration vs high eclecticism.');
  }

  // Test 3: Safe Missing Metadata Handling
  {
    const userId = crypto.randomUUID().toString();

    // History with missing/corrupted metadata:
    // - song is null
    // - song.genre is undefined
    // - song.artist is undefined
    // - song.mood is missing
    // - playedAt is missing
    const corruptedHistory: RawHistoryRecord[] = [
      {
        song: null,
      },
      {
        song: {
          _id: 'song_no_genre',
          title: 'Track Without Genre',
          artist: { _id: 'a_known', name: 'Known Artist' },
        },
        playedAt: undefined,
      },
      {
        song: {
          _id: 'song_no_artist',
          title: 'Track Without Artist',
          genre: { _id: 'g_known', name: 'Known Genre' },
        },
      },
      {
        song: {
          _id: 'song_bare',
          title: 'Bare Track',
        },
      },
    ];

    // Must execute cleanly without throwing errors or producing NaNs
    const safeProfile = MusicDNAProfilingService.generateDetailedProfileFromData({
      userId,
      user: { _id: userId, likedSongs: [null as any, { title: 'Broken' } as any] },
      history: corruptedHistory,
    });

    assert.strictEqual(safeProfile.userId, userId);
    assert.ok(Array.isArray(safeProfile.topGenres));
    assert.ok(Array.isArray(safeProfile.emergingGenres));
    assert.ok(Array.isArray(safeProfile.strongestArtists));
    assert.ok(Array.isArray(safeProfile.emergingArtists));
    assert.ok(!isNaN(safeProfile.genreDiversity.score));
    assert.ok(!isNaN(safeProfile.artistDiversity.score));
    assert.ok(!isNaN(safeProfile.confidenceScore));

    console.log('✓ Test 3 Passed: Missing/corrupt metadata handled safely with zero crashes.');
  }

  // Test 4: Normalized Score Boundaries [0.0, 1.0]
  {
    const userId = crypto.randomUUID().toString();
    const history: RawHistoryRecord[] = [
      {
        song: {
          _id: 's1',
          genre: { _id: 'g1', name: 'Electronic' },
          artist: { _id: 'a1', name: 'Daft Punk' },
          mood: 'Energetic',
        },
        completed: true,
      },
      {
        song: {
          _id: 's2',
          genre: { _id: 'g2', name: 'House' },
          artist: { _id: 'a2', name: 'Justice' },
          mood: 'Party',
        },
        completed: true,
      },
    ];

    const profile = MusicDNAProfilingService.generateDetailedProfileFromData({
      userId,
      history,
    });

    for (const g of profile.topGenres) {
      assert.ok(g.score >= 0.0 && g.score <= 1.0, `Genre score ${g.score} must be in [0, 1]`);
      assert.ok(g.shortTermScore >= 0.0 && g.shortTermScore <= 1.0);
      assert.ok(g.longTermScore >= 0.0 && g.longTermScore <= 1.0);
    }

    for (const a of profile.strongestArtists) {
      assert.ok(a.score >= 0.0 && a.score <= 1.0, `Artist score ${a.score} must be in [0, 1]`);
      assert.ok(a.shortTermScore >= 0.0 && a.shortTermScore <= 1.0);
      assert.ok(a.longTermScore >= 0.0 && a.longTermScore <= 1.0);
    }

    for (const m of profile.preferredMoods) {
      assert.ok(m.score >= 0.0 && m.score <= 1.0, `Mood score ${m.score} must be in [0, 1]`);
    }

    assert.ok(profile.genreDiversity.score >= 0.0 && profile.genreDiversity.score <= 1.0);
    assert.ok(profile.artistDiversity.score >= 0.0 && profile.artistDiversity.score <= 1.0);

    console.log('✓ Test 4 Passed: All scores strictly bounded within [0.0, 1.0].');
  }

  console.log('🎉 All Detailed Music DNA Profiling tests passed successfully!');
}

// Self-executing runner
if (process.argv[1]?.includes('detailedMusicDnaProfiling.test')) {
  runDetailedMusicDNAProfilingTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Detailed Music DNA Profiling test failed:', err);
      process.exit(1);
    });
}
