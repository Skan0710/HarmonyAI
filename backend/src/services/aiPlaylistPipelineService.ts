import { ISong, Song } from '../models/Song.js';
import { AIPlaylistPreference } from '../schemas/aiPlaylistPreferenceSchema.js';
import { AIPlaylistGenerationService } from './aiPlaylistGenerationService.js';
import { PlaylistCandidateGenerationService, PlaylistCandidateItem } from './playlistCandidateGenerationService.js';
import { PlaylistDiversityFilteringService } from './playlistDiversityFilteringService.js';

export interface AIPlaylistGenerationResponse {
  preferences: AIPlaylistPreference;
  songs: ISong[];
  candidatesEvaluated: number;
  selectedCount: number;
  metadata: {
    prompt: string;
    generatedAt: Date;
    strategy: string;
    userId?: string;
  };
}

export class AIPlaylistPipelineService {
  /**
   * Complete end-to-end AI playlist generation pipeline:
   * 1. Natural-language preference extraction
   * 2. Candidate generation
   * 3. Hybrid recommendation scoring
   * 4. Diversity filtering
   * Generates a final list of real Song documents from the database without automatically saving to DB.
   * Handles insufficient matching songs gracefully.
   */
  static async generateAIPlaylist(params: {
    prompt: string;
    userId?: string;
    count?: number;
  }): Promise<AIPlaylistGenerationResponse> {
    const { prompt, userId, count } = params;

    if (!prompt || !prompt.trim()) {
      throw new Error('Playlist prompt is required');
    }

    // 1. Natural-Language Preference Extraction
    const preferences = await AIPlaylistGenerationService.extractPlaylistPreferences(prompt);

    if (typeof count === 'number' && count > 0) {
      preferences.requestedSongCount = Math.min(50, count);
    }

    const targetCount = preferences.requestedSongCount || 12;

    // 2 & 3. Candidate Generation & Hybrid Recommendation Scoring
    const candidates = await PlaylistCandidateGenerationService.generatePlaylistCandidates({
      preference: preferences,
      userId,
      candidateLimit: Math.max(30, targetCount * 3),
    });

    // 4. Diversity Filtering
    let selectedCandidates = PlaylistDiversityFilteringService.selectDiversePlaylistSongs({
      candidates,
      targetCount,
      requestedGenres: preferences.genres,
    });

    // 5. Insufficient Matching Songs Graceful Fallback
    if (selectedCandidates.length < targetCount) {
      const selectedSongIds = new Set(
        selectedCandidates
          .map((c) => (c.song._id ? String(c.song._id) : (c.song as any).id))
          .filter(Boolean)
      );

      // Sourcing overflow candidates from unused candidate pool
      const unusedCandidates = candidates.filter(
        (c) => !selectedSongIds.has(c.song._id ? String(c.song._id) : (c.song as any).id)
      );

      for (const overflowItem of unusedCandidates) {
        if (selectedCandidates.length >= targetCount) break;
        selectedCandidates.push(overflowItem);
        selectedSongIds.add(overflowItem.song._id ? String(overflowItem.song._id) : (overflowItem.song as any).id);
      }

      // If catalog still under target count, fetch general published catalog songs
      if (selectedCandidates.length < targetCount) {
        try {
          const fallbackDocs = await Song.find({
            isPublished: true,
            _id: { $nin: Array.from(selectedSongIds) },
          })
            .populate('artist', 'name')
            .populate('album', 'title')
            .populate('genre', 'name slug')
            .limit(targetCount - selectedCandidates.length)
            .lean();

          for (const fallbackSong of fallbackDocs) {
            selectedCandidates.push({
              song: fallbackSong as ISong,
              candidateScore: 0.3,
              matchBreakdown: {
                genreMatch: false,
                artistMatch: false,
                moodMatch: false,
                audioFeatureScore: 0.5,
                userTasteAffinityScore: 0.5,
                semanticScore: 0,
              },
              sources: ['catalog_fallback'],
            });
          }
        } catch (err: any) {
          console.warn(`[AIPlaylistPipeline Warning]: Catalog fallback fetch failed: ${err.message}`);
        }
      }
    }

    const finalSongs = selectedCandidates.map((item) => item.song);

    // 6. Return Structured Response (Without saving to DB)
    return {
      preferences,
      songs: finalSongs,
      candidatesEvaluated: candidates.length,
      selectedCount: finalSongs.length,
      metadata: {
        prompt: prompt.trim(),
        generatedAt: new Date(),
        strategy: 'AI_SEMANTIC_HYBRID_DIVERSE',
        userId,
      },
    };
  }
}
