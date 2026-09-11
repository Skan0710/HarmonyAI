import { supabase } from '../config/supabase.js';
import { isValidObjectId } from '../utils/validators.js';
import { fetchMusicDnaRawInputs } from './musicDnaDataFetchService.js';
import {
  MusicDNAExtractionService,
  ExtractionRawInputs,
  ExtractionOptions,
  RawHistoryRecord,
} from './musicDnaExtractionService.js';
import {
  DetailedTasteItem,
  DiversityMetric,
  DiversityLevel,
  DetailedMusicDNAProfile,
  PreferenceEvolutionType,
  clampNumber,
} from '../schemas/musicDnaSchema.js';

export class MusicDNAProfilingService {
  /**
   * Generates a comprehensive Detailed Music DNA Profile from in-memory raw inputs.
   * Pure, modular, safe against missing metadata, and fully reproducible.
   */
  static generateDetailedProfileFromData(
    inputs: ExtractionRawInputs,
    options: ExtractionOptions = {}
  ): DetailedMusicDNAProfile {
    const { userId, user, history = [] } = inputs;
    const now = options.referenceDate || new Date();
    const shortTermDays = options.shortTermDays || 14;
    const longTermDays = options.longTermDays || 180;

    const shortTermCutoff = new Date(now.getTime() - shortTermDays * 24 * 60 * 60 * 1000);
    const longTermCutoff = new Date(now.getTime() - longTermDays * 24 * 60 * 60 * 1000);

    // 1. Run baseline extraction to obtain unified dimensions and confidence
    const baselineDNA = MusicDNAExtractionService.extractFromRawData(inputs, options);

    // 2. Partition history into short-term (<= 14 days) and long-term baseline
    const shortTermPlays: RawHistoryRecord[] = [];
    const longTermPlays: RawHistoryRecord[] = [];

    for (const rec of history) {
      if (!rec) continue;
      const playedAt = rec.playedAt ? new Date(rec.playedAt) : now;
      if (playedAt >= shortTermCutoff) {
        shortTermPlays.push(rec);
      } else {
        longTermPlays.push(rec);
      }
    }

    const likedSongs = user?.likedSongs || [];
    const favoriteGenres = user?.favoriteGenres || [];
    const favoriteArtists = user?.favoriteArtists || [];

    // 3. Profile Genres (Top & Emerging)
    const { topGenres, emergingGenres } = this.profileCategory(
      shortTermPlays,
      longTermPlays,
      likedSongs,
      favoriteGenres,
      'genre'
    );

    // 4. Profile Artists (Strongest & Emerging)
    const { topGenres: strongestArtists, emergingGenres: emergingArtists } = this.profileCategory(
      shortTermPlays,
      longTermPlays,
      likedSongs,
      favoriteArtists,
      'artist'
    );

    // 5. Profile Moods
    const preferredMoods = this.profileMoods(shortTermPlays, longTermPlays, likedSongs);

    // 6. Calculate Diversity Metrics
    const genreDiversity = this.calculateDiversityMetric(
      topGenres.map((g) => ({ name: g.name, playCount: g.playCount })),
      'genre'
    );

    const artistDiversity = this.calculateDiversityMetric(
      strongestArtists.map((a) => ({ name: a.name, playCount: a.playCount })),
      'artist'
    );

    // 7. Temporal Overview
    const stabilityScore = baselineDNA.temporalTaste.stabilityScore ?? 0.7;
    const establishedTasteSummary =
      topGenres.filter((g) => g.preferenceType === 'established').slice(0, 3).map((g) => g.name).join(', ') ||
      'No established genres yet';
    const emergingTasteSummary =
      emergingGenres.slice(0, 3).map((g) => g.name).join(', ') || 'No emerging preferences detected';

    return {
      userId,
      dnaVersion: baselineDNA.dnaVersion,
      topGenres,
      emergingGenres,
      strongestArtists,
      emergingArtists,
      preferredMoods,
      genreDiversity,
      artistDiversity,
      temporalOverview: {
        stabilityScore,
        activeWindow: 'medium_term',
        establishedTasteSummary,
        emergingTasteSummary,
      },
      confidenceScore: baselineDNA.confidenceScore,
      generatedAt: now,
      metadata: {
        totalPlays: history.length,
        shortTermPlaysCount: shortTermPlays.length,
        longTermPlaysCount: longTermPlays.length,
        ...baselineDNA.metadata,
      },
    };
  }

  /**
   * Fetches user profile and listening history from Supabase and generates the Detailed Music DNA Profile.
   */
  static async generateDetailedProfile(
    userId: string,
    options: ExtractionOptions = {}
  ): Promise<DetailedMusicDNAProfile> {
    if (!isValidObjectId(userId)) {
      throw new Error('Invalid user ID');
    }

    const inputs: ExtractionRawInputs = await fetchMusicDnaRawInputs(userId, {
      referenceDate: options.referenceDate,
    });

    const detailedProfile = this.generateDetailedProfileFromData(inputs, options);

    // If persistence requested, record that a detailed profile was (re)computed.
    //
    // Note: unlike the old Mongoose `MusicDNA` model, the Postgres `music_dna`
    // table has no free-form `metadata` column, so there's nowhere to cache
    // `detailedProfileSnapshot` (genre/artist diversity + emerging lists) the
    // way the old code did via `musicDnaDoc.metadata.detailedProfileSnapshot`.
    // We only touch `last_calculated_at` on the existing row (mirroring the
    // old "only persist if a MusicDNA doc already exists" guard); the
    // detailed profile itself is still returned to the caller either way.
    if (options.persist) {
      const { data: existing } = await supabase
        .from('music_dna')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();

      if (existing) {
        await (supabase.from('music_dna') as any)
          .update({ last_calculated_at: new Date().toISOString() })
          .eq('user_id', userId);
      }
    }

    return detailedProfile;
  }

  // --------------------------------------------------------------------------
  // MODULAR PROFILING SUB-ROUTINES
  // --------------------------------------------------------------------------

  /**
   * Profiles a dimension (genre or artist), distinguishing established vs emerging preferences.
   * Recent behavior identifies emerging interests without replacing established long-term taste.
   */
  static profileCategory(
    shortTermPlays: RawHistoryRecord[],
    longTermPlays: RawHistoryRecord[],
    likedSongs: any[],
    explicitFavorites: any[],
    category: 'genre' | 'artist'
  ): { topGenres: DetailedTasteItem[]; emergingGenres: DetailedTasteItem[] } {
    const shortMap = new Map<string, { id?: string; name: string; rawScore: number; playCount: number }>();
    const longMap = new Map<string, { id?: string; name: string; rawScore: number; playCount: number }>();
    const allNames = new Map<string, { id?: string; name: string }>();

    // Helper to safely extract name and id from a record
    const extractItem = (rec: RawHistoryRecord): { id?: string; name: string } | null => {
      if (!rec || !rec.song || typeof rec.song !== 'object') return null;
      const target = category === 'genre' ? rec.song.genre : rec.song.artist;
      if (!target) return null;

      const id = typeof target === 'object' && target._id ? target._id.toString() : String(target);
      const name = typeof target === 'object' && target.name ? String(target.name).trim() : id;
      return name ? { id, name } : null;
    };

    // 1. Seed explicit favorites and liked songs into the long-term baseline (foundational taste)
    for (const fav of explicitFavorites) {
      if (!fav) continue;
      const id = typeof fav === 'object' && fav._id ? fav._id.toString() : String(fav);
      const name = typeof fav === 'object' && fav.name ? String(fav.name).trim() : id;
      if (!name) continue;

      const key = name.toLowerCase();
      allNames.set(key, { id, name });
      const curr = longMap.get(key) || { id, name, rawScore: 0, playCount: 0 };
      curr.rawScore += 12; // High foundational weight
      longMap.set(key, curr);
    }

    for (const song of likedSongs) {
      if (!song || typeof song !== 'object') continue;
      const target = category === 'genre' ? song.genre : song.artist;
      if (!target) continue;

      const id = typeof target === 'object' && target._id ? target._id.toString() : String(target);
      const name = typeof target === 'object' && target.name ? String(target.name).trim() : id;
      if (!name) continue;

      const key = name.toLowerCase();
      allNames.set(key, { id, name });
      const curr = longMap.get(key) || { id, name, rawScore: 0, playCount: 0 };
      curr.rawScore += 6; // Liked songs foundational weight
      longMap.set(key, curr);
    }

    // 2. Accumulate long-term plays
    for (const rec of longTermPlays) {
      const item = extractItem(rec);
      if (!item) continue;

      const key = item.name.toLowerCase();
      allNames.set(key, item);
      const curr = longMap.get(key) || { ...item, rawScore: 0, playCount: 0 };
      curr.playCount += 1;
      const weight = rec.skipped ? -1 : rec.completed ? 4 : 2;
      curr.rawScore = Math.max(0, curr.rawScore + weight);
      longMap.set(key, curr);
    }

    // 3. Accumulate short-term plays
    for (const rec of shortTermPlays) {
      const item = extractItem(rec);
      if (!item) continue;

      const key = item.name.toLowerCase();
      allNames.set(key, item);
      const curr = shortMap.get(key) || { ...item, rawScore: 0, playCount: 0 };
      curr.playCount += 1;
      const weight = rec.skipped ? -1 : rec.completed ? 4 : 2;
      curr.rawScore = Math.max(0, curr.rawScore + weight);
      shortMap.set(key, curr);
    }

    const maxShort = Math.max(1, ...Array.from(shortMap.values()).map((v) => v.rawScore));
    const maxLong = Math.max(1, ...Array.from(longMap.values()).map((v) => v.rawScore));

    const detailedItems: DetailedTasteItem[] = [];
    const emergingList: DetailedTasteItem[] = [];

    for (const [key, meta] of allNames.entries()) {
      const shortItem = shortMap.get(key);
      const longItem = longMap.get(key);

      const shortTermScore = shortItem ? Number(Math.min(1.0, shortItem.rawScore / maxShort).toFixed(4)) : 0;
      const longTermScore = longItem ? Number(Math.min(1.0, longItem.rawScore / maxLong).toFixed(4)) : 0;
      const totalPlayCount = (longItem?.playCount || 0) + (shortItem?.playCount || 0);

      // Blended score preserves foundational long-term taste (0.60) while incorporating short-term momentum (0.40)
      let score = 0;
      if (longTermScore > 0 && shortTermScore > 0) {
        score = Number((0.4 * shortTermScore + 0.6 * longTermScore).toFixed(4));
      } else if (longTermScore > 0) {
        score = Number((0.85 * longTermScore).toFixed(4));
      } else {
        score = shortTermScore;
      }

      const delta = Number((shortTermScore - longTermScore).toFixed(4));

      // Determine preference evolution type:
      // "emerging": has short-term momentum but was NEVER part of long-term history/likes
      let preferenceType: PreferenceEvolutionType = 'established';
      let explanation = '';

      if (shortTermScore > 0 && longTermScore === 0) {
        preferenceType = 'emerging';
        explanation = `Recent discovery: ${meta.name} entered listening habits recently with strong momentum.`;
      } else if (longTermScore > 0 && shortTermScore === 0) {
        preferenceType = 'cooling';
        explanation = `Historical favorite: ${meta.name} is a foundational interest, though less frequent in recent rotations.`;
      } else if (delta >= 0.15) {
        preferenceType = 'rising';
        explanation = `Surging: ${meta.name} is experiencing an active uptick in recent listening (+${(delta * 100).toFixed(0)}%).`;
      } else if (delta <= -0.15) {
        preferenceType = 'cooling';
        explanation = `Cooling: ${meta.name} listening frequency has moderated compared to historical habits.`;
      } else {
        preferenceType = 'established';
        explanation = `Established: ${meta.name} remains a consistent, enduring preference in the user's taste foundation.`;
      }

      const detailedItem: DetailedTasteItem = {
        id: meta.id,
        name: meta.name,
        score,
        preferenceType,
        playCount: totalPlayCount,
        shortTermScore,
        longTermScore,
        momentumDelta: delta,
        explanation,
      };

      detailedItems.push(detailedItem);

      if (preferenceType === 'emerging') {
        emergingList.push(detailedItem);
      }
    }

    // Sort by final score descending
    detailedItems.sort((a, b) => b.score - a.score);
    emergingList.sort((a, b) => b.shortTermScore - a.shortTermScore);

    return {
      topGenres: detailedItems,
      emergingGenres: emergingList,
    };
  }

  /**
   * Profiles preferred moods with momentum tracking.
   */
  static profileMoods(
    shortTermPlays: RawHistoryRecord[],
    longTermPlays: RawHistoryRecord[],
    likedSongs: any[]
  ): DetailedTasteItem[] {
    const shortMoods = new Map<string, number>();
    const longMoods = new Map<string, number>();
    const allMoodNames = new Set<string>();

    for (const song of likedSongs) {
      if (song && typeof song === 'object' && song.mood) {
        const mood = String(song.mood).trim();
        if (mood) {
          allMoodNames.add(mood);
          longMoods.set(mood, (longMoods.get(mood) || 0) + 4);
        }
      }
    }

    for (const rec of longTermPlays) {
      if (rec.song && typeof rec.song === 'object' && rec.song.mood) {
        const mood = String(rec.song.mood).trim();
        if (mood) {
          allMoodNames.add(mood);
          longMoods.set(mood, (longMoods.get(mood) || 0) + (rec.completed ? 3 : 1));
        }
      }
    }

    for (const rec of shortTermPlays) {
      if (rec.song && typeof rec.song === 'object' && rec.song.mood) {
        const mood = String(rec.song.mood).trim();
        if (mood) {
          allMoodNames.add(mood);
          shortMoods.set(mood, (shortMoods.get(mood) || 0) + (rec.completed ? 3 : 1));
        }
      }
    }

    const maxShort = Math.max(1, ...Array.from(shortMoods.values()));
    const maxLong = Math.max(1, ...Array.from(longMoods.values()));

    const moodItems: DetailedTasteItem[] = [];

    for (const mood of allMoodNames) {
      const sScore = Number(((shortMoods.get(mood) || 0) / maxShort).toFixed(4));
      const lScore = Number(((longMoods.get(mood) || 0) / maxLong).toFixed(4));
      const delta = Number((sScore - lScore).toFixed(4));

      const blended =
        sScore > 0 && lScore > 0
          ? Number((0.45 * sScore + 0.55 * lScore).toFixed(4))
          : lScore > 0
          ? Number((0.85 * lScore).toFixed(4))
          : sScore;

      let preferenceType: PreferenceEvolutionType = 'established';
      if (sScore > 0 && lScore === 0) preferenceType = 'emerging';
      else if (delta >= 0.15) preferenceType = 'rising';
      else if (delta <= -0.15) preferenceType = 'cooling';

      moodItems.push({
        name: mood,
        score: blended,
        preferenceType,
        playCount: (shortMoods.get(mood) || 0) + (longMoods.get(mood) || 0),
        shortTermScore: sScore,
        longTermScore: lScore,
        momentumDelta: delta,
        explanation:
          preferenceType === 'emerging'
            ? `Recently favored mood: ${mood}`
            : `Consistent listening mood: ${mood}`,
      });
    }

    return moodItems.sort((a, b) => b.score - a.score);
  }

  /**
   * Computes normalized Shannon Entropy ($H / \log_2(K)$) and qualitative level
   * for genre or artist diversity.
   */
  static calculateDiversityMetric(
    items: { name: string; playCount: number }[],
    type: 'genre' | 'artist'
  ): DiversityMetric {
    const activeItems = items.filter((i) => i.playCount > 0);
    const K = activeItems.length;

    if (K === 0) {
      return {
        score: 0.5,
        effectiveCount: 0,
        normalizedEntropy: 0.5,
        level: 'moderate',
        summary: `Insufficient data to evaluate ${type} diversity.`,
      };
    }

    if (K === 1) {
      return {
        score: 0.1,
        effectiveCount: 1,
        normalizedEntropy: 0.1,
        level: 'low',
        summary: `Strong ${type} concentration focused almost exclusively on ${activeItems[0].name}.`,
      };
    }

    const totalPlays = activeItems.reduce((acc, curr) => acc + curr.playCount, 0);
    let entropy = 0;

    for (const item of activeItems) {
      const p = item.playCount / totalPlays;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }

    // Maximum possible entropy for K categories is log2(K)
    const maxEntropy = Math.log2(K);
    const normalizedEntropy = Number((entropy / maxEntropy).toFixed(4));

    // Combined diversity score balances entropy (evenness) and catalog breadth (K count)
    const breadthFactor = Math.min(1.0, K / (type === 'genre' ? 8 : 15));
    const finalScore = Number((0.65 * normalizedEntropy + 0.35 * breadthFactor).toFixed(4));

    let level: DiversityLevel = 'moderate';
    if (finalScore < 0.35) level = 'low';
    else if (finalScore < 0.65) level = 'moderate';
    else if (finalScore < 0.85) level = 'high';
    else level = 'very_high';

    const summary =
      level === 'low'
        ? `Low ${type} diversity with listening concentrated in a tight niche (${K} distinct ${type}s).`
        : level === 'moderate'
        ? `Balanced ${type} diversity exploring ${K} distinct ${type}s with defined core favorites.`
        : level === 'high'
        ? `Broad ${type} diversity spreading listening across ${K} distinct ${type}s.`
        : `Extremely eclectic ${type} diversity with an expansive mix across ${K} distinct ${type}s.`;

    return {
      score: finalScore,
      effectiveCount: K,
      normalizedEntropy,
      level,
      summary,
    };
  }
}

export default MusicDNAProfilingService;
