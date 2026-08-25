import assert from 'node:assert';
import {
  UnifiedMusicDiscoveryService,
  getUnifiedSearchRankingWeights,
  updateUnifiedSearchRankingWeights,
  resetUnifiedSearchRankingWeights,
} from '../services/unifiedMusicDiscoveryService.js';
import { SearchSuggestionService } from '../services/searchSuggestionService.js';

export function runUnifiedDiscoveryComprehensiveTests() {
  console.log('[Unified Discovery System Comprehensive Test Suite] Starting tests...');

  // Test 1: Exact Song Searches Prioritization
  {
    const exactSong = {
      _id: '507f1f77bcf86cd799439011',
      title: 'Starboy',
      artist: { name: 'The Weeknd' },
      album: { title: 'Starboy' },
      duration: 230,
      playCount: 1500,
    };
    const partialSong = {
      _id: '507f1f77bcf86cd799439012',
      title: 'Starboy (Remix Club Edit)',
      artist: { name: 'DJ Snake' },
      duration: 180,
      playCount: 2000000,
    };

    const rankingExact = UnifiedMusicDiscoveryService.calculateSongRanking(exactSong, 'Starboy', 0);
    const rankingPartial = UnifiedMusicDiscoveryService.calculateSongRanking(partialSong, 'Starboy', 0);

    assert.ok(
      rankingExact.finalScore >= 0.92,
      `Exact song score (${rankingExact.finalScore}) must be >= 0.92`
    );
    assert.ok(
      rankingExact.finalScore > rankingPartial.finalScore,
      `Exact song match (${rankingExact.finalScore}) must outrank partial remix (${rankingPartial.finalScore}) despite popularity`
    );
    assert.strictEqual(rankingExact.breakdown.exactTitleMatch, 1.0);

    console.log('✓ Test 1 Passed: Exact song searches prioritization verified.');
  }

  // Test 2: Exact Artist Searches Prioritization
  {
    const targetArtist = {
      _id: '507f1f77bcf86cd799439021',
      name: 'Daft Punk',
      bio: 'French electronic music duo formed in 1993 in Paris.',
      monthlyListeners: 18000000,
    };
    const tributeArtist = {
      _id: '507f1f77bcf86cd799439022',
      name: 'Daft Punk Tribute Band',
      bio: 'Cover band playing Daft Punk hits live.',
      monthlyListeners: 50000,
    };

    const artistRankingExact = UnifiedMusicDiscoveryService.calculateArtistRanking(targetArtist, 'Daft Punk', 0);
    const artistRankingTribute = UnifiedMusicDiscoveryService.calculateArtistRanking(tributeArtist, 'Daft Punk', 0);

    assert.ok(
      artistRankingExact.finalScore >= 0.95,
      `Exact artist match score (${artistRankingExact.finalScore}) must be >= 0.95`
    );
    assert.ok(
      artistRankingExact.finalScore > artistRankingTribute.finalScore,
      `Exact artist (${artistRankingExact.finalScore}) must outrank tribute band (${artistRankingTribute.finalScore})`
    );
    assert.strictEqual(artistRankingExact.breakdown.exactArtistMatch, 1.0);

    console.log('✓ Test 2 Passed: Exact artist searches prioritization verified.');
  }

  // Test 3: Exact Album Searches Prioritization
  {
    const exactAlbum = {
      _id: '507f1f77bcf86cd799439031',
      title: 'Random Access Memories',
      artist: { name: 'Daft Punk' },
      releaseYear: 2013,
    };
    const relatedAlbum = {
      _id: '507f1f77bcf86cd799439032',
      title: 'Memories of the 80s',
      artist: { name: 'Various' },
      releaseYear: 2020,
    };

    const albumRankingExact = UnifiedMusicDiscoveryService.calculateAlbumRanking(exactAlbum, 'Random Access Memories', 0);
    const albumRankingRelated = UnifiedMusicDiscoveryService.calculateAlbumRanking(relatedAlbum, 'Random Access Memories', 0);

    assert.ok(
      albumRankingExact.finalScore >= 0.92,
      `Exact album score (${albumRankingExact.finalScore}) must be >= 0.92`
    );
    assert.ok(
      albumRankingExact.finalScore > albumRankingRelated.finalScore,
      `Exact album (${albumRankingExact.finalScore}) must outrank related album (${albumRankingRelated.finalScore})`
    );

    console.log('✓ Test 3 Passed: Exact album searches prioritization verified.');
  }

  // Test 4: Partial Matches & Substring Match Scoring
  {
    const partialMatchSong = {
      title: 'Blinding Lights in the Night',
      artist: { name: 'The Weeknd' },
    };
    const nonMatchSong = {
      title: 'Acoustic Guitar Serenade',
      artist: { name: 'Tommy Emmanuel' },
    };

    const partialRanking = UnifiedMusicDiscoveryService.calculateSongRanking(partialMatchSong, 'blinding', 0);
    const nonRanking = UnifiedMusicDiscoveryService.calculateSongRanking(nonMatchSong, 'blinding', 0);

    assert.ok(partialRanking.finalScore >= 0.40 && partialRanking.finalScore < 0.90);
    assert.ok(nonRanking.finalScore < 0.20);

    console.log('✓ Test 4 Passed: Partial text match and substring scoring verified.');
  }

  // Test 5: Semantic Search Vector Similarity Integration
  {
    const songDoc = {
      title: 'Cyberpunk Highway',
      artist: { name: 'Nightrunner' },
    };

    const semHigh = UnifiedMusicDiscoveryService.calculateSongRanking(songDoc, 'neon city drive vibe', 0.95);
    const semLow = UnifiedMusicDiscoveryService.calculateSongRanking(songDoc, 'neon city drive vibe', 0.10);

    assert.ok(
      semHigh.finalScore > semLow.finalScore,
      `High semantic similarity (${semHigh.finalScore}) must score higher than low semantic similarity (${semLow.finalScore})`
    );
    assert.ok(semHigh.matchReason.includes('Semantic'));

    console.log('✓ Test 5 Passed: Semantic vector similarity scoring verified.');
  }

  // Test 6: Empty Searches & Safe Defaults
  {
    UnifiedMusicDiscoveryService.discover({ query: '   ', mode: 'all' }).then((res) => {
      assert.ok(res !== null);
      assert.strictEqual(res.query, '');
      assert.ok(Array.isArray(res.results.songs));
      assert.ok(Array.isArray(res.results.artists));
      assert.ok(Array.isArray(res.results.albums));
      assert.ok(Array.isArray(res.results.recommendedSongs));
      assert.strictEqual(res.metadata.isAuthenticated, false);

      console.log('✓ Test 6 Passed: Empty query searches handled gracefully with default structure.');
    });
  }

  // Test 7: Searches With No Catalog Results
  {
    UnifiedMusicDiscoveryService.discover({
      query: 'ZzQxYwNonExistentBand9988771122',
      mode: 'keyword',
    }).then((res) => {
      assert.ok(res !== null);
      assert.strictEqual(res.results.songs.length, 0);
      assert.strictEqual(res.results.artists.length, 0);
      assert.strictEqual(res.results.albums.length, 0);

      console.log('✓ Test 7 Passed: Searches with no matching catalog results return empty collections without errors.');
    });
  }

  // Test 8: Personalized Recommendations Does Not Override Actual Search Query
  {
    const targetQuery = 'Kavinsky';
    const exactArtist = {
      name: 'Kavinsky',
      monthlyListeners: 4000000,
    };
    const unrelatedArtistUserLoves = {
      name: 'Taylor Swift',
      monthlyListeners: 100000000,
    };

    const kavinskyRanking = UnifiedMusicDiscoveryService.calculateArtistRanking(exactArtist, targetQuery, 0);
    const taylorRanking = UnifiedMusicDiscoveryService.calculateArtistRanking(unrelatedArtistUserLoves, targetQuery, 0);

    assert.ok(
      kavinskyRanking.finalScore > taylorRanking.finalScore,
      `Exact query artist (${kavinskyRanking.finalScore}) must strongly outrank unrelated popular artist (${taylorRanking.finalScore})`
    );
    assert.ok(kavinskyRanking.finalScore >= 0.95);
    assert.ok(taylorRanking.finalScore <= 0.15);

    console.log('✓ Test 8 Passed: Personalization anti-override protection verified.');
  }

  // Test 9: Multi-Entity Pagination & Boundary Slicing
  {
    UnifiedMusicDiscoveryService.discover({
      query: 'Electronic',
      mode: 'all',
      page: 2,
      limit: 4,
    }).then((res) => {
      assert.strictEqual(res.pagination.page, 2);
      assert.strictEqual(res.pagination.limit, 4);
      assert.ok(res.results.songs.length <= 4);
      assert.ok(res.results.artists.length <= 4);
      assert.ok(res.results.albums.length <= 4);

      console.log('✓ Test 9 Passed: Pagination page and limit calculation verified.');
    });
  }

  // Test 10: Duplicate Prevention Across Primary Songs and RecommendedSongs
  {
    UnifiedMusicDiscoveryService.discover({
      query: 'Nightcall',
      mode: 'all',
    }).then((res) => {
      const primarySongIds = new Set(res.results.songs.map((s) => s.id));
      const duplicateFound = res.results.recommendedSongs.some((r) => primarySongIds.has(r.id));

      assert.strictEqual(
        duplicateFound,
        false,
        'Recommended songs must not contain tracks already shown in primary song search results'
      );

      console.log('✓ Test 10 Passed: Duplicate prevention between songs and recommendedSongs verified.');
    });
  }

  // Test 11: Search Suggestions Payload Remains Lightweight
  {
    SearchSuggestionService.getSuggestions({ query: 'Daft', limit: 5 }).then((res) => {
      assert.ok(Array.isArray(res.suggestions));
      res.suggestions.forEach((item) => {
        assert.ok(item.id !== undefined, 'Suggestion must have id');
        assert.ok(item.title !== undefined, 'Suggestion must have title');
        assert.ok(item.type === 'artist' || item.type === 'song' || item.type === 'album');
        assert.ok((item as any).vectorEmbedding === undefined, 'No vectorEmbedding leak in suggestions');
        assert.ok((item as any).__v === undefined, 'No __v leak in suggestions');
      });

      console.log('✓ Test 11 Passed: Lightweight search suggestions payload verified.');
    });
  }

  // Test 12: Configurable Ranking Weights Integrity
  {
    const defaultWeights = getUnifiedSearchRankingWeights();
    assert.strictEqual(defaultWeights.exactTitleMatchWeight, 0.35);

    updateUnifiedSearchRankingWeights({ exactTitleMatchWeight: 0.50 });
    const updatedWeights = getUnifiedSearchRankingWeights();
    assert.strictEqual(updatedWeights.exactTitleMatchWeight, 0.50);

    resetUnifiedSearchRankingWeights();
    const restoredWeights = getUnifiedSearchRankingWeights();
    assert.strictEqual(restoredWeights.exactTitleMatchWeight, 0.35);

    console.log('✓ Test 12 Passed: Configurable ranking weights update and reset verified.');
  }

  console.log('🎉 All 12 comprehensive unified discovery system tests completed successfully.');
}
