import assert from 'node:assert';
import {
  UnifiedMusicDiscoveryService,
  NormalizedSongItem,
  NormalizedArtistItem,
  NormalizedAlbumItem,
} from '../services/unifiedMusicDiscoveryService.js';
import { unifiedDiscovery } from '../controllers/searchController.js';

export function runUnifiedMusicDiscoveryServiceTests() {
  console.log('[Unified Music Discovery Service Test Suite] Starting tests...');

  // Mock data items
  const mockSongDoc = {
    _id: '507f1f77bcf86cd799439011',
    title: 'Starboy Nightcall',
    duration: 234, // 3m 54s
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

  // Test 2: Normalized Song Structure
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

    console.log('✓ Test 2 Passed: Song normalization structure verified.');
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

  // Test 5: Multi-Entity Unified Discovery (Songs, Artists, Albums)
  {
    UnifiedMusicDiscoveryService.discover({
      query: 'Synthwave electronic night drive',
      mode: 'all',
      limit: 10,
    }).then((res) => {
      assert.ok(res !== null);
      assert.strictEqual(res.query, 'Synthwave electronic night drive');
      assert.strictEqual(res.mode, 'all');
      assert.ok(Array.isArray(res.results.songs));
      assert.ok(Array.isArray(res.results.artists));
      assert.ok(Array.isArray(res.results.albums));
      assert.ok(typeof res.counts.songs === 'number');
      assert.ok(typeof res.counts.artists === 'number');
      assert.ok(typeof res.counts.albums === 'number');
      assert.ok(typeof res.counts.total === 'number');
      assert.ok(res.metadata.tookMs >= 0);
      assert.ok(Array.isArray(res.metadata.sourcesUsed));

      console.log('✓ Test 5 Passed: Multi-entity unified discovery execution verified.');
    });
  }

  // Test 6: Internal Mode Separation (Keyword Mode, Semantic Mode, Recommendations Mode)
  {
    Promise.all([
      UnifiedMusicDiscoveryService.discover({ query: 'Lo-fi chill beats', mode: 'keyword' }),
      UnifiedMusicDiscoveryService.discover({ query: 'Calm ambient focus piano', mode: 'semantic' }),
      UnifiedMusicDiscoveryService.discover({ mode: 'recommendations' }),
    ]).then(([kwRes, semRes, recRes]) => {
      assert.strictEqual(kwRes.mode, 'keyword');
      assert.strictEqual(semRes.mode, 'semantic');
      assert.strictEqual(recRes.mode, 'recommendations');

      console.log('✓ Test 6 Passed: Mode separation (keyword, semantic, recommendations) verified.');
    });
  }

  // Test 7: Empty and Unfulfillable Queries Handling
  {
    UnifiedMusicDiscoveryService.discover({
      query: '',
      mode: 'keyword',
    }).then((res) => {
      assert.ok(res !== null);
      assert.strictEqual(res.query, '');
      assert.strictEqual(res.counts.total, 0);
      assert.strictEqual(res.metadata.hasResults, false);

      console.log('✓ Test 7 Passed: Empty query handled gracefully without exceptions.');
    });
  }

  // Test 8: Controller API Endpoint & Parameter Validation
  {
    const req: any = {
      query: { q: 'Synthwave', mode: 'hybrid', limit: '5' },
      user: { _id: '507f1f77bcf86cd799439011' },
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
      assert.ok(responseBody.data !== undefined);
      assert.ok(responseBody.data.results !== undefined);
      assert.ok(responseBody.data.counts !== undefined);

      console.log('✓ Test 8 Passed: Unified discovery API controller endpoint verified.');
    });
  }

  // Test 9: Query Length Boundary Defense
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

      console.log('✓ Test 9 Passed: Excessive query length capped and rejected with 400.');
    });
  }

  console.log('🎉 All unified music discovery service tests completed successfully.');
}
