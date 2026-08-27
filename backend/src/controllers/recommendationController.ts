import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Song } from '../models/Song.js';
import { User } from '../models/User.js';
import { ListeningSession } from '../models/ListeningSession.js';
import { RecommendationInteraction } from '../models/RecommendationInteraction.js';
import { ContentRecommendationService } from '../services/recommendationService.js';
import { CollaborativeFilteringService } from '../services/collaborativeFilteringService.js';
import { HybridRecommendationService } from '../services/hybridRecommendationService.js';
import { ContextAwareRecommendationService } from '../services/contextAwareRecommendationService.js';
import { ContextualAssistantService } from '../services/contextualAssistantService.js';
import { SessionRecommendationService } from '../services/sessionRecommendationService.js';
import { SmartAutoplayService } from '../services/smartAutoplayService.js';
import { ContentSimilarityService } from '../services/similarityService.js';
import { SongFeatureExtractionService } from '../services/songFeatureExtractionService.js';
import { UserTasteProfileService } from '../services/userTasteProfileService.js';
import { RecommendationExplanationService } from '../services/recommendationExplanationService.js';
import { validateAndSanitizeRecommendationContext } from '../schemas/recommendationContextSchema.js';
import { ContextPreferenceMappingService } from '../services/contextPreferenceMappingService.js';
import { controllerWrapper, ensureAuth, ControllerError } from '../utils/controllerHelpers.js';
import { extractQueryParams, isValidObjectId } from '../utils/validators.js';

export const getSimilarSongs = controllerWrapper(async (req: Request, res: Response) => {
  const { songId } = req.params;

  if (!songId || !Types.ObjectId.isValid(songId)) {
    throw new ControllerError(400, 'Invalid song ID format');
  }

  const q = extractQueryParams(req, { limit: 'int' });
  const parsedLimit = isNaN(q.limit) || q.limit < 1 ? 10 : q.limit;

  const isDebugMode =
    req.query.debug === 'true' && process.env.NODE_ENV !== 'production';

  const recommendations = await ContentRecommendationService.getRecommendationsForSong(
    songId,
    parsedLimit,
    isDebugMode
  );

  res.status(200).json({
    success: true,
    data: recommendations,
    ...(isDebugMode ? { debug: { isDebugEnabled: true, evaluatedCandidates: recommendations.length } } : {}),
  });
});

export const getCollaborativeRecommendations = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const q = extractQueryParams(req, { limit: 'int' });
  const parsedLimit = isNaN(q.limit) || q.limit < 1 ? 10 : q.limit;

  const isDebugMode =
    req.query.debug === 'true' && process.env.NODE_ENV !== 'production';

  try {
    const result = await CollaborativeFilteringService.getRecommendationsForUser(
      user._id.toString(),
      parsedLimit,
      20,
      isDebugMode
    );

    if (isDebugMode && result && typeof result === 'object' && 'diagnostics' in result) {
      res.status(200).json({
        success: true,
        data: result.recommendations,
        debug: { isDebugEnabled: true, diagnostics: result.diagnostics },
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: Array.isArray(result) ? result : [],
    });
  } catch (error: any) {
    // Cold start / insufficient history → return empty array (not an error)
    res.status(200).json({
      success: true,
      data: [],
      message: error.message || 'Insufficient listening history for collaborative recommendations',
    });
  }
});

export const getHybridRecommendations = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const q = extractQueryParams(req, { limit: 'int' });
  const parsedLimit = isNaN(q.limit) || q.limit < 1 ? 10 : q.limit;

  const seedSongId = req.query.seedSongId ? String(req.query.seedSongId) : undefined;
  if (seedSongId && !Types.ObjectId.isValid(seedSongId)) {
    throw new ControllerError(400, 'Invalid seed song ID format');
  }

  // Optional Context Support (preserves backward compatibility when absent)
  const situation = req.query.situation || req.query.context;
  const mood = req.query.mood ? String(req.query.mood) : undefined;
  const energyParam = req.query.energy || req.query.desiredEnergy || req.query.energyLevel;
  const desiredEnergy = energyParam && !isNaN(parseFloat(String(energyParam))) ? parseFloat(String(energyParam)) : undefined;
  const tempoParam = req.query.tempo || req.query.desiredTempo;
  const desiredTempo = tempoParam && !isNaN(parseFloat(String(tempoParam))) ? parseFloat(String(tempoParam)) : undefined;
  const genresParam = req.query.genres || req.query.preferredGenres;
  const preferredGenres = typeof genresParam === 'string' ? genresParam.split(',').map((g) => g.trim()).filter(Boolean) : undefined;
  const influenceParam = req.query.contextInfluence;
  const contextInfluence = influenceParam && !isNaN(parseFloat(String(influenceParam))) ? parseFloat(String(influenceParam)) : undefined;

  let contextObj: any = undefined;
  if (situation || mood || desiredEnergy !== undefined || desiredTempo !== undefined || preferredGenres) {
    contextObj = {
      situation: situation ? String(situation) : undefined,
      mood,
      desiredEnergy,
      desiredTempo,
      preferredGenres,
    };
  }

  try {
    const result = await HybridRecommendationService.getHybridRecommendations({
      userId: user._id.toString(),
      seedSongId,
      limit: parsedLimit,
      context: contextObj,
      contextInfluence,
    });

    res.status(200).json({
      success: true,
      strategyUsed: result.strategyUsed,
      userClassification: result.userClassification,
      count: result.recommendations.length,
      data: result.recommendations || [],
    });
  } catch (error: any) {
    // Cold start fallback → return empty array (not an error)
    res.status(200).json({
      success: true,
      strategyUsed: 'COLD_START',
      userClassification: 'NEW',
      count: 0,
      data: [],
      message: error.message || 'Failed to fetch hybrid recommendations safely',
    });
  }
});

export const getContextualRecommendations = controllerWrapper(async (req: Request, res: Response) => {
  const q = extractQueryParams(req, { limit: 'int' });
  const parsedLimit = isNaN(q.limit) || q.limit < 1 ? 10 : Math.min(50, q.limit);

  const mood = req.query.mood ? String(req.query.mood) : undefined;
  const activity = req.query.activity ? String(req.query.activity) : undefined;

  const energyParam = req.query.energy || req.query.energyLevel;
  const energyLevel =
    energyParam && !isNaN(parseFloat(String(energyParam)))
      ? parseFloat(String(energyParam))
      : undefined;

  const durationParam =
    req.query.duration || req.query.durationMinutes || req.query.preferredDurationMinutes;
  const durationMinutes =
    durationParam && !isNaN(parseInt(String(durationParam), 10))
      ? parseInt(String(durationParam), 10)
      : undefined;

  const userId = req.user?._id?.toString();

  try {
    const result = await ContextAwareRecommendationService.getContextualRecommendations({
      userId,
      mood,
      activity,
      energyLevel,
      durationMinutes,
      limit: parsedLimit,
    });

    res.status(200).json({
      success: true,
      strategyUsed: result.strategyUsed,
      userClassification: result.userClassification,
      detectedContext: result.detectedContext,
      count: result.count,
      data: result.data || [],
    });
  } catch (error: any) {
    // Fallback → return empty array (not an error)
    res.status(200).json({
      success: true,
      strategyUsed: 'COLD_START',
      userClassification: 'NEW',
      detectedContext: {},
      count: 0,
      data: [],
      message: error.message || 'Contextual recommendations generated fallback response',
    });
  }
});

export const processContextualAssistantRequest = controllerWrapper(async (req: Request, res: Response) => {
  const { prompt, limit } = req.body;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    throw new ControllerError(400, 'Prompt string is required');
  }

  const parsedLimit = limit && !isNaN(parseInt(String(limit), 10)) ? parseInt(String(limit), 10) : 10;
  const userId = req.user?._id?.toString();

  const result = await ContextualAssistantService.processAssistantRequest({
    userPrompt: prompt.trim(),
    userId,
    limit: parsedLimit,
  });

  res.status(200).json({
    success: true,
    message: 'Contextual assistant request processed successfully',
    data: result,
  });
});

export const getSessionRecommendations = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const q = extractQueryParams(req, { limit: 'int' });
  const parsedLimit = isNaN(q.limit) || q.limit < 1 ? 10 : Math.min(50, q.limit);

  const isDebugMode =
    req.query.debug === 'true' && process.env.NODE_ENV !== 'production';

  try {
    const result = await SessionRecommendationService.getSessionRecommendations({
      userId: user._id.toString(),
      limit: parsedLimit,
      isDebugMode,
    });

    res.status(200).json({
      success: true,
      hasActiveSession: result.hasActiveSession,
      strategyUsed: result.strategyUsed,
      sessionId: result.sessionId,
      songCountInSession: result.songCountInSession,
      count: result.count,
      data: result.data || [],
      ...(isDebugMode && result.diagnostics ? { diagnostics: result.diagnostics } : {}),
    });
  } catch (error: any) {
    // Fallback → return empty array (not an error)
    res.status(200).json({
      success: true,
      hasActiveSession: false,
      strategyUsed: 'COLD_START_FALLBACK',
      count: 0,
      data: [],
      message: error.message || 'Session recommendations generated fallback response',
    });
  }
});

export const getSmartAutoplayCandidates = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const q = extractQueryParams(req, { limit: 'int' });
  const parsedLimit = isNaN(q.limit) || q.limit < 1 ? 5 : Math.min(25, q.limit);

  const lastPlayedArtistId = req.query.lastPlayedArtistId ? String(req.query.lastPlayedArtistId) : undefined;
  const excludeQueueParam = req.query.excludeQueue ? String(req.query.excludeQueue).split(',') : [];

  const isDebugMode =
    req.query.debug === 'true' && process.env.NODE_ENV !== 'production';

  try {
    const result = await SmartAutoplayService.generateAutoplayCandidates({
      userId: user._id.toString(),
      limit: parsedLimit,
      lastPlayedArtistId,
      currentQueueSongIds: excludeQueueParam,
      isDebugMode,
    });

    res.status(200).json({
      success: true,
      strategyUsed: 'SMART_AUTOPLAY',
      count: result.candidates.length,
      data: result.candidates,
      ...(isDebugMode && result.diagnostics ? { diagnostics: result.diagnostics } : {}),
    });
  } catch (error: any) {
    // Fallback → return empty array (not an error)
    res.status(200).json({
      success: true,
      strategyUsed: 'SMART_AUTOPLAY_FALLBACK',
      count: 0,
      data: [],
      message: error.message || 'Smart autoplay generated fallback response',
    });
  }
});

export const getRecommendationExplanation = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const { songId } = req.params;

  if (!songId || !Types.ObjectId.isValid(songId)) {
    throw new ControllerError(400, 'Invalid song ID format');
  }

  // 1. Fetch song with populated artist and genre
  const song = await Song.findById(songId)
    .populate('artist', 'name image bio genres')
    .populate('genre', 'name description')
    .lean();

  if (!song) {
    throw new ControllerError(404, 'Song not found');
  }

  const userId = user._id.toString();

  // 2. Fetch User Taste Profile
  let tasteProfile: any = null;
  try {
    tasteProfile = await UserTasteProfileService.generateTasteProfile(userId);
  } catch {
    // Graceful fallback if user has no taste profile yet
  }

  // 3. Fetch Active Listening Session if available
  let activeSessionPreferences: any = null;
  try {
    const activeSession = await ListeningSession.findOne({ user: user._id, status: 'active' }).lean();
    if (activeSession && activeSession.contextSnapshot) {
      activeSessionPreferences = {
        activeMood: activeSession.contextSnapshot.mood,
        targetEnergy: activeSession.contextSnapshot.energyLevel,
        sessionGenres: activeSession.contextSnapshot.activity ? [activeSession.contextSnapshot.activity] : [],
      };
    }
  } catch {
    // Continue safely
  }

  // 4. Fetch Recent Recommendation Interactions for this song
  let recentInteractions: any[] = [];
  try {
    recentInteractions = await RecommendationInteraction.find({
      user: user._id,
      song: song._id,
    })
      .sort({ timestamp: -1 })
      .limit(5)
      .lean();
  } catch {
    // Continue safely
  }

  // 5. Fetch Liked Songs Sample for acoustic content comparison
  let likedSongsSample: any[] = [];
  try {
    const userDoc = await User.findById(userId)
      .select('likedSongs')
      .populate({
        path: 'likedSongs',
        select: 'title artist genre audioFeatures mood language',
        options: { limit: 5, sort: { createdAt: -1 } },
      })
      .lean();
    likedSongsSample = (userDoc?.likedSongs as any[]) || [];
  } catch {
    // Continue safely
  }

  // 6. Calculate or retrieve existing component scores from recommendation context
  const artistName = RecommendationExplanationService.extractArtistName(song.artist);
  const genreName = RecommendationExplanationService.extractGenreName(song.genre);

  // Genre affinity
  let genreAffinity = 0;
  if (genreName && tasteProfile?.combinedGenres && Array.isArray(tasteProfile.combinedGenres)) {
    const matchedGenre = tasteProfile.combinedGenres.find(
      (g: any) => g.name?.toLowerCase() === genreName.toLowerCase() || g.genreId === String((song.genre as any)?._id || song.genre)
    );
    if (matchedGenre && typeof matchedGenre.affinityScore === 'number') {
      genreAffinity = RecommendationExplanationService.clampScore(matchedGenre.affinityScore);
    }
  }

  // Artist affinity
  let artistAffinity = 0;
  if (artistName && tasteProfile?.combinedArtists && Array.isArray(tasteProfile.combinedArtists)) {
    const matchedArtist = tasteProfile.combinedArtists.find(
      (a: any) => a.name?.toLowerCase() === artistName.toLowerCase() || a.artistId === String((song.artist as any)?._id || song.artist)
    );
    if (matchedArtist && typeof matchedArtist.affinityScore === 'number') {
      artistAffinity = RecommendationExplanationService.clampScore(matchedArtist.affinityScore);
    }
  }

  // User Taste Overall Affinity
  const userTasteAffinityScore = RecommendationExplanationService.clampScore(
    Math.max(genreAffinity, artistAffinity, (genreAffinity + artistAffinity) / 2)
  );

  // Content similarity score with user's liked songs
  let contentSimilarityScore = 0;
  if (likedSongsSample.length > 0) {
    try {
      const songFeatures = SongFeatureExtractionService.extractFeatures(song);
      const similarities = likedSongsSample.map((likedSong) => {
        try {
          const likedFeatures = SongFeatureExtractionService.extractFeatures(likedSong);
          return ContentSimilarityService.calculateSimilarity(likedFeatures, songFeatures);
        } catch {
          return 0.5;
        }
      });
      contentSimilarityScore = Math.max(...similarities);
    } catch {
      contentSimilarityScore = 0.5;
    }
  }

  // Collaborative signal from interactions or interaction matrix
  let collaborativeScore = 0;
  if (recentInteractions.length > 0) {
    collaborativeScore = 0.80;
  }

  // Popularity signal
  const popularityScore = song.playCount ? Math.min(1.0, song.playCount / 50000) : 0.4;

  const componentScores = {
    contentScore: contentSimilarityScore,
    collaborativeScore,
    userTasteAffinityScore,
    popularityScore,
    genreScore: genreAffinity,
    artistScore: artistAffinity,
  };

  const sources: string[] = [];
  if (recentInteractions.length > 0) {
    sources.push(recentInteractions[0].recommendationSource || 'hybrid');
  } else {
    if (genreAffinity > 0.5) sources.push('genre');
    if (artistAffinity > 0.5) sources.push('artist');
    if (contentSimilarityScore > 0.6) sources.push('content');
    if (sources.length === 0) sources.push('hybrid');
  }

  // Determine overall recommendation score without recalculating unrelated scores
  const recommendationScore = RecommendationExplanationService.clampScore(
    userTasteAffinityScore * 0.4 +
    contentSimilarityScore * 0.3 +
    collaborativeScore * 0.2 +
    popularityScore * 0.1
  );

  // Determine if song is currently recommended / has valid recommendation context
  const isCurrentlyRecommended = Boolean(
    recentInteractions.length > 0 ||
    recommendationScore >= 0.35 ||
    genreAffinity >= 0.40 ||
    artistAffinity >= 0.40 ||
    contentSimilarityScore >= 0.50
  );

  // Generate structured explanation
  const explanation = RecommendationExplanationService.explainSong({
    song,
    componentScores,
    sources,
    similarityScore: contentSimilarityScore,
    likedSongsSample,
    tasteProfile,
    sessionPreferences: activeSessionPreferences,
  });

  res.status(200).json({
    success: true,
    data: {
      song: {
        _id: song._id,
        title: song.title,
        artist: song.artist,
        genre: song.genre,
        duration: song.duration,
        coverImage: song.coverImage,
        audioUrl: song.audioUrl,
        audioFeatures: song.audioFeatures,
        mood: song.mood,
        playCount: song.playCount,
      },
      isCurrentlyRecommended,
      recommendationScore,
      primaryExplanation: isCurrentlyRecommended ? explanation.primaryExplanation : 'This song is not currently in your active recommendations.',
      topReasons: isCurrentlyRecommended ? explanation.reasons : [],
      contributingSignals: {
        userTasteAffinityScore,
        contentSimilarity: contentSimilarityScore,
        collaborativeScore,
        genreAffinity,
        artistAffinity,
        popularityScore,
        sources,
      },
      summary: isCurrentlyRecommended ? explanation.summary : 'Not currently recommended based on your recent listening profile.',
      confidenceScore: isCurrentlyRecommended ? explanation.confidenceScore : 0,
    },
  });
});

export const getContextAwareRecommendations = controllerWrapper(async (req: Request, res: Response) => {
  const user = ensureAuth(req, res);
  if (!user) return;

  const rawSituation = req.query.context || req.query.situation || req.body?.context || req.body?.situation;
  const rawMood = req.query.mood || req.body?.mood;
  const rawEnergy = req.query.energy || req.query.desiredEnergy || req.body?.energy || req.body?.desiredEnergy;
  const rawTempo = req.query.tempo || req.query.desiredTempo || req.body?.tempo || req.body?.desiredTempo;
  const rawGenre = req.query.genre || req.query.genres || req.query.preferredGenres || req.body?.genre || req.body?.genres || req.body?.preferredGenres;
  const rawDiscovery = req.query.discoveryLevel || req.query.discovery || req.body?.discoveryLevel || req.body?.discovery;
  const rawLimit = req.query.limit || req.body?.limit;

  const parsedLimit = rawLimit && !isNaN(parseInt(String(rawLimit), 10))
    ? Math.min(50, Math.max(1, parseInt(String(rawLimit), 10)))
    : 10;

  // 1. Validate & Sanitize Context Attributes
  const validation = validateAndSanitizeRecommendationContext({
    situation: rawSituation,
    mood: rawMood,
    desiredEnergy: rawEnergy,
    desiredTempo: rawTempo,
    preferredGenres: typeof rawGenre === 'string' ? rawGenre.split(',').map((g) => g.trim()).filter(Boolean) : rawGenre,
    discoveryLevel: rawDiscovery,
  });

  if (!validation.isValid && validation.errors.length > 0) {
    throw new ControllerError(400, validation.errors.join('; '));
  }

  const sanitizedContext = validation.sanitized;
  const derivedPreferences = ContextPreferenceMappingService.mapContextToPreferences(sanitizedContext);

  try {
    // 2. Fetch Hybrid Recommendations with Contextual Modulation
    const result = await HybridRecommendationService.getHybridRecommendations({
      userId: user._id.toString(),
      limit: parsedLimit,
      context: sanitizedContext,
    });

    // 3. Attach Explanations & Context Fit Metadata
    const enrichedRecommendations = (result.recommendations || []).map((item) => {
      const explanation = RecommendationExplanationService.explainSong({
        song: item.song,
        componentScores: item.componentScores,
        sources: item.sources,
        sessionPreferences: {
          activeMood: derivedPreferences.targetMood,
          targetEnergy: derivedPreferences.targetEnergy,
          targetTempo: derivedPreferences.targetTempo,
          sessionGenres: derivedPreferences.preferredGenres,
        },
      });

      return {
        song: item.song,
        hybridScore: item.hybridScore,
        recommendationScore: item.finalScore ?? item.hybridScore,
        primaryExplanation: explanation.primaryExplanation,
        topReasons: explanation.reasons || explanation.explanations,
        componentScores: item.componentScores,
        sources: item.sources,
        metadata: item.metadata,
      };
    });

    res.status(200).json({
      success: true,
      context: {
        situation: derivedPreferences.situation,
        mood: derivedPreferences.targetMood,
        desiredEnergy: derivedPreferences.targetEnergy,
        desiredTempo: derivedPreferences.targetTempo,
        preferredGenres: derivedPreferences.preferredGenres,
        discoveryLevel: derivedPreferences.noveltyPreference,
        derivedPreferences: {
          targetEnergy: derivedPreferences.targetEnergy,
          targetTempo: derivedPreferences.targetTempo,
          targetMood: derivedPreferences.targetMood,
          preferredGenres: derivedPreferences.preferredGenres,
          noveltyPreference: derivedPreferences.noveltyPreference,
          rankingWeights: derivedPreferences.rankingWeights,
        },
        appliedOverrides: derivedPreferences.appliedOverrides,
      },
      strategyUsed: result.strategyUsed,
      userClassification: result.userClassification,
      count: enrichedRecommendations.length,
      data: enrichedRecommendations,
    });
  } catch (error: any) {
    // Graceful fallback on empty or failed query
    res.status(200).json({
      success: true,
      context: {
        situation: derivedPreferences.situation,
        mood: derivedPreferences.targetMood,
        desiredEnergy: derivedPreferences.targetEnergy,
        desiredTempo: derivedPreferences.targetTempo,
        preferredGenres: derivedPreferences.preferredGenres,
        discoveryLevel: derivedPreferences.noveltyPreference,
      },
      strategyUsed: 'COLD_START',
      userClassification: 'NEW',
      count: 0,
      data: [],
      message: error.message || 'No context-aware recommendations available for this profile.',
    });
  }
});

