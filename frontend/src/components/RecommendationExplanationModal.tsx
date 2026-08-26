import React, { useState, useEffect } from 'react';
import type { Song } from '../types/music';
import {
  fetchRecommendationExplanationApi,
} from '../services/recommendationService';
import type { RecommendationExplanationResponse } from '../services/recommendationService';
import { submitRecommendationFeedbackApi } from '../services/recommendationTrackingService';

export interface ExplanationFactor {
  label: string;
  scorePercent: number;
  description: string;
  badgeColor: string;
  icon: string;
}

export interface RecommendationExplanationModalProps {
  song: Song;
  isOpen: boolean;
  onClose: () => void;
}

export const RecommendationExplanationModal: React.FC<RecommendationExplanationModalProps> = ({
  song,
  isOpen,
  onClose,
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [explanationData, setExplanationData] = useState<RecommendationExplanationResponse | null>(null);
  const [activeFeedback, setActiveFeedback] = useState<
    'helpful' | 'not_relevant' | 'too_similar' | 'not_my_style' | 'thumbs_up' | 'thumbs_down' | null
  >(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!isOpen || !song._id) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    fetchRecommendationExplanationApi(song._id)
      .then((res) => {
        if (!isMounted) return;
        if (res.error) {
          setError(res.error);
        } else if (res.data) {
          setExplanationData(res.data);
        }
      })
      .catch((err) => {
        if (isMounted) {
          setError(err?.message || 'Failed to load recommendation explanation');
        }
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, song._id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const rawComponentScores = (song as any).componentScores;
  const rawSources: string[] = (song as any).sources || (explanationData?.contributingSignals?.sources as string[]) || [];
  const recommendationSource = rawSources[0] || 'hybrid';

  const getArtistName = (): string => {
    if (!song.artist) return 'Artist';
    if (typeof song.artist === 'object' && 'name' in song.artist) {
      return song.artist.name;
    }
    return String(song.artist);
  };

  const handleFeedback = async (
    feedback: 'helpful' | 'not_relevant' | 'too_similar' | 'not_my_style' | 'thumbs_up' | 'thumbs_down'
  ) => {
    if (!song._id || submitting) return;
    setSubmitting(true);
    setActiveFeedback(feedback);
    await submitRecommendationFeedbackApi(song._id, feedback, recommendationSource, {
      primaryExplanation: explanationData?.primaryExplanation,
      reasonsCount: explanationData?.topReasons?.length,
      recommendationScore: explanationData?.recommendationScore,
    });
    setSubmitting(false);
  };

  const getReasonBadgeInfo = (type: string) => {
    switch (type) {
      case 'PREFERRED_GENRE':
      case 'GENRE_PREFERENCE':
        return {
          icon: '🎸',
          label: 'Genre Match',
          badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
          gradient: 'from-indigo-500 to-indigo-400',
        };
      case 'SIMILAR_ARTIST':
      case 'ARTIST_PREFERENCE':
        return {
          icon: '🎤',
          label: 'Artist Alignment',
          badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
          gradient: 'from-purple-500 to-purple-400',
        };
      case 'SIMILAR_TO_LIKED_SONGS':
      case 'CONTENT_SIMILARITY':
        return {
          icon: '🎵',
          label: 'Acoustic Similarity',
          badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
          gradient: 'from-cyan-500 to-blue-400',
        };
      case 'COLLABORATIVE_SIMILARITY':
      case 'COLLABORATIVE_FILTERING':
        return {
          icon: '👥',
          label: 'Listeners Like You',
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
          gradient: 'from-amber-500 to-yellow-400',
        };
      case 'SESSION_PREFERENCE':
        return {
          icon: '⚡',
          label: 'Session Flow',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
          gradient: 'from-emerald-500 to-teal-400',
        };
      case 'PREFERRED_MOOD':
      case 'MOOD_MATCH':
        return {
          icon: '✨',
          label: 'Mood Match',
          badgeColor: 'bg-teal-500/20 text-teal-300 border-teal-500/30',
          gradient: 'from-teal-500 to-emerald-400',
        };
      case 'PREFERRED_ENERGY':
      case 'ENERGY_MATCH':
        return {
          icon: '🔥',
          label: 'Energy Pace',
          badgeColor: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
          gradient: 'from-orange-500 to-amber-400',
        };
      case 'DISCOVERY_OPPORTUNITY':
        return {
          icon: '🧭',
          label: 'Discovery Opportunity',
          badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
          gradient: 'from-rose-500 to-pink-400',
        };
      case 'NOVELTY':
        return {
          icon: '🌟',
          label: 'Fresh Novelty',
          badgeColor: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30',
          gradient: 'from-fuchsia-500 to-purple-400',
        };
      case 'POPULARITY':
        return {
          icon: '📈',
          label: 'Community Popularity',
          badgeColor: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
          gradient: 'from-blue-500 to-sky-400',
        };
      default:
        return {
          icon: '✨',
          label: 'Taste Profile Match',
          badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
          gradient: 'from-indigo-500 to-purple-400',
        };
    }
  };

  // Build fallback factors if API response not yet loaded or returned empty
  const getFallbackFactors = (): ExplanationFactor[] => {
    const factors: ExplanationFactor[] = [];
    if (rawComponentScores) {
      const { contentScore = 0, collaborativeScore = 0, popularityScore = 0, recencyScore = 0 } = rawComponentScores;

      if (contentScore > 0) {
        factors.push({
          icon: '🎵',
          label: 'Acoustic & Metadata Similarity',
          scorePercent: Math.round(contentScore * 100),
          description: 'Matches the tempo, mood, genre, and acoustic signature of songs you love.',
          badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
        });
      }
      if (collaborativeScore > 0) {
        factors.push({
          icon: '👥',
          label: 'Listeners Like You',
          scorePercent: Math.round(collaborativeScore * 100),
          description: 'Listeners with similar music tastes frequently play and replay this track.',
          badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
        });
      }
      if (popularityScore > 0) {
        factors.push({
          icon: '📈',
          label: 'Community Popularity',
          scorePercent: Math.round(popularityScore * 100),
          description: 'High play count and active engagement across the HarmonyAI network.',
          badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
        });
      }
      if (recencyScore > 0) {
        factors.push({
          icon: '🌟',
          label: 'Catalog Recency',
          scorePercent: Math.round(recencyScore * 100),
          description: 'Fresh release or recent addition to our catalog.',
          badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
        });
      }
    }
    return factors.sort((a, b) => b.scorePercent - a.scorePercent);
  };

  const fallbackFactors = getFallbackFactors();
  const hasApiReasons = explanationData && Array.isArray(explanationData.topReasons) && explanationData.topReasons.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-lg bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl space-y-5 text-slate-100 overflow-hidden max-h-[90vh] overflow-y-auto"
      >
        <div className="absolute -top-12 -right-12 w-48 h-48 bg-indigo-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-purple-500/15 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="space-y-1.5 pr-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold">
              <span>💡 Why this song?</span>
            </div>
            <h2 className="text-xl font-bold text-white tracking-tight line-clamp-1">{song.title}</h2>
            <p className="text-xs text-slate-400 font-medium">by {getArtistName()}</p>

            {rawSources.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-1">
                {rawSources.map((src, i) => (
                  <span key={i} className="px-2 py-0.5 text-[10px] font-mono font-medium rounded-md bg-slate-800 text-slate-300 border border-slate-700">
                    Source: {src}
                  </span>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-800/80 hover:bg-slate-800 transition-colors flex-shrink-0"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Loading State */}
        {loading && (
          <div className="space-y-3 py-4 animate-pulse">
            <div className="h-4 bg-slate-800 rounded w-1/3 mb-2" />
            <div className="h-16 bg-slate-800/80 border border-slate-700/50 rounded-2xl p-4" />
            <div className="h-16 bg-slate-800/80 border border-slate-700/50 rounded-2xl p-4" />
            <div className="h-16 bg-slate-800/80 border border-slate-700/50 rounded-2xl p-4" />
          </div>
        )}

        {/* Error State with Retry */}
        {!loading && error && (
          <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-4 text-center space-y-2">
            <p className="text-xs text-rose-300 font-medium">{error}</p>
            <button
              onClick={() => {
                if (song._id) {
                  setLoading(true);
                  setError(null);
                  fetchRecommendationExplanationApi(song._id)
                    .then((res) => {
                      if (res.error) setError(res.error);
                      else if (res.data) setExplanationData(res.data);
                    })
                    .finally(() => setLoading(false));
                }
              }}
              className="px-3 py-1 text-xs rounded-xl bg-slate-800 text-slate-200 hover:text-white border border-slate-700 hover:border-slate-600 transition-colors"
            >
              🔄 Retry
            </button>
          </div>
        )}

        {/* Main Explanation Reasons Content */}
        {!loading && (
          <div className="space-y-4">
            {/* Top Summary Banner */}
            {explanationData?.summary && (
              <div className="bg-indigo-950/40 border border-indigo-500/20 rounded-2xl p-3.5 flex items-start gap-2.5">
                <span className="text-lg">✨</span>
                <p className="text-xs text-indigo-200 leading-relaxed font-medium">
                  {explanationData.summary}
                </p>
              </div>
            )}

            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Strongest Recommendation Factors
            </p>

            {/* Render dynamically fetched structured reasons */}
            {hasApiReasons ? (
              <div className="space-y-3">
                {explanationData.topReasons.map((reason, index) => {
                  const badge = getReasonBadgeInfo(reason.type);
                  const scorePercent = Math.round((reason.importanceScore || 0.8) * 100);

                  return (
                    <div
                      key={index}
                      className="bg-slate-800/70 border border-slate-700/60 rounded-2xl p-3.5 space-y-2 hover:border-slate-600 transition-colors shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${badge.badgeColor}`}>
                          <span>{badge.icon}</span>
                          <span>{badge.label}</span>
                        </span>
                        <span className="text-xs font-bold text-indigo-300 font-mono">
                          {scorePercent}% Match
                        </span>
                      </div>

                      <p className="text-xs text-slate-200 leading-relaxed">{reason.message}</p>

                      {/* Visual Match Bar */}
                      <div className="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${badge.gradient} rounded-full transition-all duration-500`}
                          style={{ width: `${Math.min(100, Math.max(15, scorePercent))}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : fallbackFactors.length > 0 ? (
              /* Fallback to local component scores */
              <div className="space-y-3">
                {fallbackFactors.map((factor, index) => (
                  <div
                    key={index}
                    className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-3.5 space-y-2 hover:border-slate-600 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${factor.badgeColor}`}>
                        <span>{factor.icon}</span>
                        <span>{factor.label}</span>
                      </span>
                      <span className="text-xs font-bold text-indigo-300 font-mono">
                        {factor.scorePercent}% Match
                      </span>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">{factor.description}</p>

                    <div className="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 via-purple-400 to-pink-400 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(15, factor.scorePercent))}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              /* Fallback State for minimal metadata */
              <div className="bg-slate-800/40 border border-slate-800 rounded-2xl p-4 text-center space-y-2">
                <div className="text-2xl">🎵</div>
                <p className="text-xs text-slate-300 font-medium">Curated for your general listening profile</p>
                <p className="text-[11px] text-slate-400">
                  Recommended based on global catalog popularity and genre discovery patterns.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Recommendation Feedback Section */}
        <div className="bg-slate-800/50 border border-slate-700/60 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-200">How did we do with this recommendation?</span>
            {submitting && (
              <span className="text-[11px] text-indigo-400 font-medium animate-pulse">Saving feedback...</span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              onClick={() => handleFeedback('helpful')}
              disabled={submitting}
              className={`px-2.5 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeFeedback === 'helpful' || activeFeedback === 'thumbs_up'
                  ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-md shadow-emerald-500/10 scale-[1.02]'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-emerald-500/40 hover:text-white'
              }`}
              title="Helpful & spot on"
            >
              <span>🌟</span>
              <span>Helpful</span>
            </button>

            <button
              onClick={() => handleFeedback('not_relevant')}
              disabled={submitting}
              className={`px-2.5 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeFeedback === 'not_relevant'
                  ? 'bg-amber-500/25 text-amber-300 border-amber-500/50 shadow-md shadow-amber-500/10 scale-[1.02]'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-amber-500/40 hover:text-white'
              }`}
              title="Not relevant right now"
            >
              <span>🎯</span>
              <span>Not Relevant</span>
            </button>

            <button
              onClick={() => handleFeedback('too_similar')}
              disabled={submitting}
              className={`px-2.5 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeFeedback === 'too_similar'
                  ? 'bg-cyan-500/25 text-cyan-300 border-cyan-500/50 shadow-md shadow-cyan-500/10 scale-[1.02]'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-cyan-500/40 hover:text-white'
              }`}
              title="Too similar or repetitive"
            >
              <span>🔁</span>
              <span>Too Similar</span>
            </button>

            <button
              onClick={() => handleFeedback('not_my_style')}
              disabled={submitting}
              className={`px-2.5 py-2 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
                activeFeedback === 'not_my_style' || activeFeedback === 'thumbs_down'
                  ? 'bg-rose-500/25 text-rose-300 border-rose-500/50 shadow-md shadow-rose-500/10 scale-[1.02]'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:border-rose-500/40 hover:text-white'
              }`}
              title="Not my style"
            >
              <span>🚫</span>
              <span>Not My Style</span>
            </button>
          </div>

          {activeFeedback && (
            <p className="text-[11px] text-emerald-400/90 font-medium text-center pt-1 animate-in fade-in">
              ✓ Thank you! Your feedback helps HarmonyAI tune your recommendations.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>Engine: Hybrid AI Recommendation Engine</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};

export const WhyThisSongModal = RecommendationExplanationModal;
