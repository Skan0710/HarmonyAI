import assert from 'node:assert';
import {
  generateSongSemanticText,
  generateSongSemanticDocument,
  SongSemanticInput,
} from '../utils/semanticSearchUtils.js';

export function runSemanticSearchUtilsTests() {
  console.log('[Semantic Search Utils Test Suite] Starting tests...');

  // Test 1: Full Metadata Conversion & Determinism
  {
    const song: SongSemanticInput = {
      _id: '507f1f77bcf86cd799439011',
      title: 'Midnight City',
      artist: { _id: 'art_1', name: 'M83' },
      album: { _id: 'alb_1', title: 'Hurry Up, We\'re Dreaming' },
      genre: { _id: 'gen_1', name: 'Synthwave' },
      mood: 'Energetic',
      language: 'English',
      releaseYear: 2011,
      tags: ['electronic', 'synthpop', '80s-vibes'],
      audioFeatures: {
        bpm: 120,
        key: 'C#',
        energy: 0.85,
        danceability: 0.75,
        valence: 0.65,
        acousticness: 0.15,
      },
    };

    const text1 = generateSongSemanticText(song);
    const text2 = generateSongSemanticText(song);

    assert.strictEqual(text1, text2, 'Semantic text generation must be 100% deterministic');
    assert.ok(text1.includes('Title: Midnight City'));
    assert.ok(text1.includes('Artist: M83'));
    assert.ok(text1.includes('Album: Hurry Up, We\'re Dreaming'));
    assert.ok(text1.includes('Genre: Synthwave'));
    assert.ok(text1.includes('Mood: Energetic'));
    assert.ok(text1.includes('Language: English'));
    assert.ok(text1.includes('Audio Characteristics: 120 BPM, Key C#, Energy 0.85, Danceability 0.75, Valence 0.65, Acousticness 0.15'));

    console.log('✓ Test 1 Passed: Full metadata conversion and determinism verified.');
  }

  // Test 2: Handling Optional / Missing Fields
  {
    const minimalSong: SongSemanticInput = {
      title: 'Minimal Instrumental Track',
      artist: 'Independent Artist',
      genre: 'Classical',
    };

    const text = generateSongSemanticText(minimalSong);

    assert.ok(text.includes('Title: Minimal Instrumental Track'));
    assert.ok(text.includes('Artist: Independent Artist'));
    assert.ok(text.includes('Genre: Classical'));
    assert.strictEqual(text.includes('Album:'), false, 'Missing album omitted cleanly');
    assert.strictEqual(text.includes('Audio Characteristics:'), false, 'Missing audio features omitted cleanly');

    console.log('✓ Test 2 Passed: Optional and missing fields handled cleanly.');
  }

  // Test 3: Document Summary Generation
  {
    const songDoc: SongSemanticInput = {
      _id: '507f1f77bcf86cd799439011',
      title: 'Starlight',
      artist: { name: 'Muse' },
      genre: { name: 'Alternative Rock' },
      mood: 'Epic',
      language: 'English',
    };

    const doc = generateSongSemanticDocument(songDoc);

    assert.strictEqual(doc.songId, '507f1f77bcf86cd799439011');
    assert.strictEqual(doc.metadataSummary.title, 'Starlight');
    assert.strictEqual(doc.metadataSummary.artist, 'Muse');
    assert.ok(doc.semanticText.length > 0);

    console.log('✓ Test 3 Passed: Semantic document creation verified.');
  }

  console.log('🎉 All semantic search utility tests completed successfully.');
}
