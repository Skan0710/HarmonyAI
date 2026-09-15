import { IngestionTrack } from '../types.js';

// Non-Latin scripts to strictly filter out:
// Cyrillic (0400-04FF), Arabic (0600-06FF), Devanagari (0900-097F),
// Gurmukhi/Punjabi (0A00-0A7F), Bengali/Odia/Tamil/Telugu/Kannada/Malayalam (0B00-0D7F),
// Thai (0E00-0E7F), Japanese Hiragana/Katakana (3040-30FF),
// CJK Unified Ideographs (4E00-9FFF), Korean Hangul (AC00-D7AF)
const NON_LATIN_SCRIPT_REGEX =
  /[\u0400-\u04FF\u0600-\u06FF\u0900-\u097F\u0A00-\u0A7F\u0B00-\u0D7F\u0E00-\u0E7F\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/;

// Forbidden non-music or non-English keywords (case-insensitive)
const FORBIDDEN_KEYWORDS = [
  // Non-music audio
  'podcast',
  'interview',
  'commentary',
  'behind the scenes',
  'trailer',
  'teaser',
  'reaction',
  'ringtone',
  'sound effect',
  'white noise',
  'audiobook',
  'guided meditation',
  'spoken word lesson',
  'karaoke version',
  // Non-English regional markers
  'bollywood',
  'tollywood',
  'kollywood',
  'punjabi',
  'bhangra',
  'k-pop',
  'kpop',
  'j-pop',
  'jpop',
  'anime opening',
  'anime ending',
  'c-pop',
  'mandopop',
  'cantopop',
  'desh bhakti',
  'bhajan',
  'qawwali',
];

export function isEnglishTrack(track: IngestionTrack): { valid: boolean; reason?: string } {
  const { title, artistName, albumTitle, duration } = track;

  if (!title || !title.trim()) {
    return { valid: false, reason: 'Empty title' };
  }
  if (!artistName || !artistName.trim()) {
    return { valid: false, reason: 'Empty artist name' };
  }

  // Duration check (standard songs are between 30s and 20 mins)
  if (duration < 30) {
    return { valid: false, reason: `Duration too short: ${duration}s` };
  }
  if (duration > 1200) {
    return { valid: false, reason: `Duration too long: ${duration}s` };
  }

  const combinedText = `${title} ${artistName} ${albumTitle || ''}`.toLowerCase();

  // Script check
  if (NON_LATIN_SCRIPT_REGEX.test(combinedText)) {
    return { valid: false, reason: 'Contains non-Latin script' };
  }

  // Keyword check
  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (combinedText.includes(keyword)) {
      return { valid: false, reason: `Contains forbidden keyword: "${keyword}"` };
    }
  }

  return { valid: true };
}

export function isEnglishArtist(artistName: string, tags?: string[]): boolean {
  if (!artistName || !artistName.trim()) return false;
  if (NON_LATIN_SCRIPT_REGEX.test(artistName)) return false;

  const text = `${artistName} ${(tags || []).join(' ')}`.toLowerCase();
  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (text.includes(keyword)) return false;
  }
  return true;
}
