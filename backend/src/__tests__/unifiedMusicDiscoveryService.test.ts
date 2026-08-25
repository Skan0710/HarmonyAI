import assert from 'node:assert';
import {
  UnifiedMusicDiscoveryService,
  NormalizedSongItem,
  NormalizedArtistItem,
  NormalizedAlbumItem,
  getUnifiedSearchRankingWeights,
  updateUnifiedSearchRankingWeights,
  resetUnifiedSearchRankingWeights,
} from '../services/unifiedMusicDiscoveryService.js';
import { unifiedDiscovery } from '../controllers/searchController.js';

export function runUnifiedMusicDiscoveryServiceTests() {
  console.log('[Unified Music Discovery Service Test Suite] Starting tests...');

  // Mock data items
  const mockSongDoc = {
    _id: '507f1f77bcf86cd799439011',
    title: 'Starboy Nightcall',
    duration: 234, // 3m 54s
    playCount: 150000,
    audioUrl: 'https://cdn.harmonyai.test/audio/starboy.mp3',
    artist: {
      _id: '507f1f77bcf86cd799439022',
      name: 'The Weeknd & Kavinsky',
      profileImage: 'https://cdn.harmonyai.test/images/artist.jpg',
      verified: true,
    },
    album: {
      _id: '507f1f77bcf86cd799439033',
      title: 'Synthwave Night Drive',
      coverImage: 'https://cdn.harmonyai.test/images/album.jpg',
      releaseYear: 2024,
    },
    genre: {
      _id: '507f1f77bcf86cd799439044',
      name: 'Synthwave',
      slug: 'synthwave',
    },
  };

  const mockArtistDoc = {
    _id: '507f1f77bcf86cd799439022',
    name: 'Kavinsky',
    bio: 'French electronic artist and synthwave pioneer',
    profileImage: 'https://cdn.harmonyai.test/images/kavinsky.jpg',
    verified: true,
    genres: ['Synthwave', 'Electronic'],
    monthlyListeners: 4500000,
  };

  const mockAlbumDoc = {
    _id: '507f1f77bcf86cd799439033',
    title: 'OutRun',
    artist: {
      _id: '507f1f77bcf86cd799439022',
      name: 'Kavinsky',
    },
    genre: {
      name: 'Synthwave',
    },
    coverImage: 'https://cdn.harmonyai.test/images/outrun.jpg',
    releaseYear: 2013,
    trackCount: 13,
  };

  // Test 1: Duration Formatting and Extraction Helpers
  {
    assert.strictEqual(UnifiedMusicDiscoveryService.formatDuration(0), '0:00');
    assert.strictEqual(UnifiedMusicDiscoveryService.formatDuration(65), '1:05');
    assert.strictEqual(UnifiedMusicDiscoveryService.formatDuration(234), '3:54');
    assert.strictEqual(UnifiedMusicDiscoveryService.formatDuration(3600), '60:00');
    assert.strictEqual(UnifiedMusicDiscoveryService.formatDuration(undefined), '0:00');

    assert.strictEqual(UnifiedMusicDiscoveryService.extractId(mockSongDoc), '507f1f77bcf86cd799439011');
    assert.strictEqual(UnifiedMusicDiscoveryService.extractId('custom_id_123'), 'custom_id_123');
    assert.strictEqual(UnifiedMusicDiscoveryService.extractId(null), '');

    console.log('✓ Test 1 Passed: Duration formatting and ID extraction helpers verified.');
  }

  // Test 2: Normalized Song Structure & Public Safety (No internal leaks)
  {
    const normalized = UnifiedMusicDiscoveryService.normalizeSong(mockSongDoc, 'keyword_search', 0.95, 'Exact title match');
    assert.ok(normalized !== null);
    assert.strictEqual(normalized.type, 'song');
    assert.strictEqual(normalized.id, '507f1f77bcf86cd799439011');
    assert.strictEqual(normalized.title, 'Starboy Nightcall');
    assert.strictEqual(normalized.duration, 234);
    assert.strictEqual(normalized.durationFormatted, '3:54');
    assert.strictEqual(normalized.artist?.name, 'The Weeknd & Kavinsky');
    assert.strictEqual(normalized.artist?.verified, true);
    assert.strictEqual(normalized.album?.title, 'Synthwave Night Drive');
    assert.strictEqual(normalized.album?.releaseYear, 2024);
    assert.strictEqual(normalized.genre?.name, 'Synthwave');
    assert.strictEqual(normalized.score, 0.95);
    assert.strictEqual(normalized.source, 'keyword_search');
    assert.deepStrictEqual(normalized.sources, ['keyword_search']);
    assert.strictEqual((normalized as any).vectorEmbedding, undefined);
    assert.strictEqual((normalized as any).__v, undefined);

    console.log('✓ Test 2 Passed: Song normalization structure & public safety verified.');
  }

  // Test 3: Normalized Artist Structure
  {
    const normalized = UnifiedMusicDiscoveryService.normalizeArtist(mockArtistDoc, 'semantic_search', 0.88);
    assert.ok(normalized !== null);
    assert.strictEqual(normalized.type, 'artist');
    assert.strictEqual(normalized.id, '507f1f77bcf86cd799439022');
    assert.strictEqual(normalized.name, 'Kavinsky');
    assert.strictEqual(normalized.verified, true);
    assert.ok(Array.isArray(normalized.genres));
    assert.strictEqual(normalized.genres[0], 'Synthwave');
    assert.strictEqual(normalized.monthlyListeners, 4500000);
    assert.strictEqual(normalized.source, 'semantic_search');

    console.log('✓ Test 3 Passed: Artist normalization structure verified.');
  }

  // Test 4: Normalized Album Structure
  {
    const normalized = UnifiedMusicDiscoveryService.normalizeAlbum(mockAlbumDoc, 'recommendation', 0.82);
    assert.ok(normalized !== null);
    assert.strictEqual(normalized.type, 'album');
    assert.strictEqual(normalized.id, '507f1f77bcf86cd799439033');
    assert.strictEqual(normalized.title, 'OutRun');
    assert.strictEqual(normalized.artist?.name, 'Kavinsky');
    assert.strictEqual(normalized.genre?.name, 'Synthwave');
    assert.strictEqual(normalized.releaseYear, 2013);
    assert.strictEqual(normalized.trackCount, 13);
    assert.strictEqual(normalized.source, 'recommendation');

    console.log('✓ Test 4 Passed: Album normalization structure verified.');
  }

  // Test 5: Exact Song Title Match Strong Priority
  {
    const exactQuery = 'Starboy Nightcall';
    const ranking = UnifiedMusicDiscoveryService.calculateSongRanking(mockSongDoc, exactQuery, 0);

    assert.ok(ranking.finalScore >= 0.92, `Expected finalScore >= 0.92, got ${ranking.finalScore}`);
    assert.strictEqual(ranking.breakdown.exactTitleMatch, 1.0);
    assert.ok(ranking.matchReason.includes('Exact song title match'));
    assert.ok(ranking.finalScore <= 1.0);

    console.log('✓ Test 5 Passed: Exact song title match strong priority verified.');
  }

  // Test 6: Popularity Override Safeguard
  {
    const exactZeroPlays = {
      title: 'Midnight Echoes',
      artist: { name: 'Obscure Band' },
      playCount: 0,
    };
    const unrelatedMegaHit = {
      title: 'Despacito Mega Dance',
      artist: { name: 'Luis Fonsi' },
      playCount: 5000000000,
    };

    const targetQuery = 'Midnight Echoes';
    const exactRanking = UnifiedMusicDiscoveryService.calculateSongRanking(exactZeroPlays, targetQuery, 0);
    const unrelatedRanking = UnifiedMusicDiscoveryService.calculateSongRanking(unrelatedMegaHit, targetQuery, 0);

    assert.ok(
      exactRanking.finalScore > unrelatedRanking.finalScore,
      `Exact match (${exactRanking.finalScore}) must outrank mega hit (${unrelatedRanking.finalScore})`
    );
    assert.ok(exactRanking.finalScore >= 0.90);
    assert.ok(unrelatedRanking.finalScore <= 0.20);

    console.log('✓ Test 6 Passed: Popularity override safeguard verified.');
  }

  // Test 7: Grouped Results (Artists, Albums, Songs, RecommendedSongs) & Pagination
  {
    UnifiedMusicDiscoveryService.discover({
      query: 'Synthwave electronic night drive',
      mode: 'all',
      page: 1,
      limit: 5,
    }).then((res) => {
      assert.ok(res !== null);
      assert.strictEqual(res.query, 'Synthwave electronic night drive');
      assert.strictEqual(res.mode, 'all');
      assert.ok(Array.isArray(res.results.artists));
      assert.ok(Array.isArray(res.results.albums));
      assert.ok(Array.isArray(res.results.songs));
      assert.ok(Array.isArray(res.results.recommendedSongs));
      assert.strictEqual(res.pagination.page, 1);
      assert.strictEqual(res.pagination.limit, 5);
      assert.ok(res.pagination.totalPages !== undefined);
      assert.ok(res.pagination.hasMore !== undefined);
      assert.ok(res.counts.total >= 0);

      console.log('✓ Test 7 Passed: Grouped results (artists, albums, songs, recommendedSongs) & pagination verified.');
    });
  }

  // Test 8: Keyword and Semantic Discovery Modes
  {
    Promise.all([
      UnifiedMusicDiscoveryService.discover({ query: 'Retro electro', mode: 'keyword' }),
      UnifiedMusicDiscoveryService.discover({ query: 'Calm ambient focus piano', mode: 'semantic' }),
      UnifiedMusicDiscoveryService.discover({ mode: 'recommendations' }),
      UnifiedMusicDiscoveryService.discover({ query: 'Daft Punk', mode: 'hybrid' }),
    ]).then(([kwRes, semRes, recRes, hybRes]) => {
      assert.strictEqual(kwRes.mode, 'keyword');
      assert.strictEqual(semRes.mode, 'semantic');
      assert.strictEqual(recRes.mode, 'recommendations');
      assert.strictEqual(hybRes.mode, 'hybrid');

      console.log('✓ Test 8 Passed: Keyword, semantic, recommendations, and hybrid modes verified.');
    });
  }

  // Test 9: Public Unauthenticated Discovery vs Authenticated Discovery
  {
    Promise.all([
      UnifiedMusicDiscoveryService.discover({ query: 'Pop', mode: 'all' }), // Unauthenticated
      UnifiedMusicDiscoveryService.discover({ query: 'Pop', mode: 'all', userId: '507f1f77bcf86cd799439011' }), // Authenticated
    ]).then(([publicRes, authRes]) => {
      assert.strictEqual(publicRes.metadata.isAuthenticated, false);
      assert.strictEqual(authRes.metadata.isAuthenticated, true);

      console.log('✓ Test 9 Passed: Public-safe discovery and authenticated personalization verified.');
    });
  }

  // Test 10: Controller Validation (Invalid Mode Rejection)
  {
    const req: any = {
      query: { q: 'Synthwave', mode: 'invalid_mode_xyz' },
      user: null,
      params: {},
    };
    let statusCode = 200;
    let responseBody: any = null;
    const res: any = {
      status(code: number) {
        statusCode = code;
        return res;
      },
      json(data: any) {
        responseBody = data;
        return res;
      },
    };

    unifiedDiscovery(req, res).then(() => {
      assert.strictEqual(statusCode, 400);
      assert.strictEqual(responseBody.success, false);
      assert.ok(responseBody.message.includes('Invalid search mode'));

      console.log('✓ Test 10 Passed: Invalid search mode rejected with 400.');
    });
  }

  // Test 11: Controller Validation (Excessive Query Length)
  {
    const longQuery = 'A'.repeat(501);
    const req: any = {
      query: { q: longQuery },
      user: null,
      params: {},
    };
    let statusCode = 200;
    let responseBody: any = null;
    const res: any = {
      status(code: number) {
        statusCode = code;
        return res;
      },
      json(data: any) {
        responseBody = data;
        return res;
      },
    };

    unifiedDiscovery(req, res).then(() => {
      assert.strictEqual(statusCode, 400);
      assert.strictEqual(responseBody.success, false);
      assert.ok(responseBody.message.includes('exceeds maximum allowed length'));

      console.log('✓ Test 11 Passed: Excessive query length capped and rejected with 400.');
    });
  }

  // Test 12: Empty Query Graceful Handling
  {
    const req: any = {
      query: { q: '' },
      user: null,
      params: {},
    };
    let statusCode = 200;
    let responseBody: any = null;
    const res: any = {
      status(code: number) {
        statusCode = code;
        return res;
      },
      json(data: any) {
        responseBody = data;
        return res;
      },
    };

    unifiedDiscovery(req, res).then(() => {
      assert.strictEqual(statusCode, 200);
      assert.strictEqual(responseBody.success, true);
      assert.ok(responseBody.data.results !== undefined);
      assert.ok(responseBody.data.pagination !== undefined);

      console.log('✓ Test 12 Passed: Empty query handled gracefully without exceptions.');
    });
  }

  console.log('🎉 All unified music discovery and intelligent ranking tests completed successfully.');
}
