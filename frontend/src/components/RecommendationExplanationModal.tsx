import React, { useState, useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Sparkles,
  X,
  Fingerprint,
  Mic2,
  AudioLines,
  Users,
  Zap,
  Heart,
  Compass,
  Star,
  TrendingUp,
  RefreshCw,
  ThumbsUp,
  Target,
  Repeat,
  Ban,
} from 'lucide-react';
import type { Song } from '../types/music';
import { fetchRecommendationExplanationApi } from '../services/recommendationService';
import type { RecommendationExplanationResponse } from '../services/recommendationService';
import { submitRecommendationFeedbackApi } from '../services/recommendationTrackingService';
import { ScrollArea } from './ui/scroll-area';

export interface ExplanationFactor {
  label: string;
  scorePercent: number;
  description: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  tone: 'accent' | 'gold';
}

export interface RecommendationExplanationModalProps {
  song: Song;
  isOpen: boolean;
  onClose: () => void;
}

const REASON_META: Record<string, { icon: React.ComponentType<{ size?: number; strokeWidth?: number }>; label: string; tone: 'accent' | 'gold' }> = {
  PREFERRED_GENRE: { icon: Fingerprint, label: 'Genre match', tone: 'accent' },
  GENRE_PREFERENCE: { icon: Fingerprint, label: 'Genre match', tone: 'accent' },
  SIMILAR_ARTIST: { icon: Mic2, label: 'Artist alignment', tone: 'accent' },
  ARTIST_PREFERENCE: { icon: Mic2, label: 'Artist alignment', tone: 'accent' },
  SIMILAR_TO_LIKED_SONGS: { icon: AudioLines, label: 'Acoustic similarity', tone: 'accent' },
  CONTENT_SIMILARITY: { icon: AudioLines, label: 'Acoustic similarity', tone: 'accent' },
  COLLABORATIVE_SIMILARITY: { icon: Users, label: 'Listeners like you', tone: 'gold' },
  COLLABORATIVE_FILTERING: { icon: Users, label: 'Listeners like you', tone: 'gold' },
  SESSION_PREFERENCE: { icon: Zap, label: 'Session flow', tone: 'accent' },
  PREFERRED_MOOD: { icon: Heart, label: 'Mood match', tone: 'accent' },
  MOOD_MATCH: { icon: Heart, label: 'Mood match', tone: 'accent' },
  PREFERRED_ENERGY: { icon: Zap, label: 'Energy pace', tone: 'accent' },
  ENERGY_MATCH: { icon: Zap, label: 'Energy pace', tone: 'accent' },
  DISCOVERY_OPPORTUNITY: { icon: Compass, label: 'Discovery opportunity', tone: 'gold' },
  NOVELTY: { icon: Star, label: 'Fresh novelty', tone: 'gold' },
  POPULARITY: { icon: TrendingUp, label: 'Community popularity', tone: 'gold' },
};

const DEFAULT_META = { icon: Sparkles, label: 'Taste profile match', tone: 'accent' as const };

const toneClasses: Record<'accent' | 'gold', { badge: string; bar: string; text: string }> = {
  accent: { badge: 'bg-accent-wash text-accent', bar: 'bg-accent', text: 'text-accent' },
  gold: { badge: 'bg-gold-wash text-gold', bar: 'bg-gold', text: 'text-gold' },
};

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
        if (isMounted) setError(err?.message || 'Failed to load recommendation explanation');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [isOpen, song._id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const rawComponentScores = (song as any).componentScores;
  const rawSources: string[] = (song as any).sources || (explanationData?.contributingSignals?.sources as string[]) || [];
  const recommendationSource = rawSources[0] || 'hybrid';

  const getArtistName = (): string => {
    if (!song.artist) return 'Artist';
    if (typeof song.artist === 'object' && 'name' in song.artist) return song.artist.name;
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

  const getFallbackFactors = (): ExplanationFactor[] => {
    const factors: ExplanationFactor[] = [];
    if (rawComponentScores) {
      const { contentScore = 0, collaborativeScore = 0, popularityScore = 0, recencyScore = 0 } = rawComponentScores;

      if (contentScore > 0) {
        factors.push({
          icon: AudioLines,
          label: 'Acoustic & metadata similarity',
          scorePercent: Math.round(contentScore * 100),
          description: 'Matches the tempo, mood, genre, and acoustic signature of songs you love.',
          tone: 'accent',
        });
      }
      if (collaborativeScore > 0) {
        factors.push({
          icon: Users,
          label: 'Listeners like you',
          scorePercent: Math.round(collaborativeScore * 100),
          description: 'Listeners with similar taste frequently play and replay this track.',
          tone: 'gold',
        });
      }
      if (popularityScore > 0) {
        factors.push({
          icon: TrendingUp,
          label: 'Community popularity',
          scorePercent: Math.round(popularityScore * 100),
          description: 'High play count and active engagement across HarmonyAI.',
          tone: 'gold',
        });
      }
      if (recencyScore > 0) {
        factors.push({
          icon: Star,
          label: 'Catalog recency',
          scorePercent: Math.round(recencyScore * 100),
          description: 'A fresh release or recent addition to the catalog.',
          tone: 'gold',
        });
      }
    }
    return factors.sort((a, b) => b.scorePercent - a.scorePercent);
  };

  const fallbackFactors = getFallbackFactors();
  const hasApiReasons = explanationData && Array.isArray(explanationData.topReasons) && explanationData.topReasons.length > 0;

  const FEEDBACK_OPTIONS: { id: typeof activeFeedback; label: string; icon: React.ComponentType<{ size?: number }> }[] = [
    { id: 'helpful', label: 'Helpful', icon: ThumbsUp },
    { id: 'not_relevant', label: 'Not relevant', icon: Target },
    { id: 'too_similar', label: 'Too similar', icon: Repeat },
    { id: 'not_my_style', label: 'Not my style', icon: Ban },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 z-[var(--z-modal)] flex items-center justify-center bg-black/70 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg bg-surface-1 rounded-[var(--radius-lg)] text-text-primary max-h-[90vh]"
          >
          <ScrollArea className="max-h-[90vh]">
          <div className="p-6 space-y-5">
            <div className="flex items-start justify-between">
              <div className="space-y-1.5 pr-2">
                <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-accent flex items-center gap-1.5">
                  <Sparkles size={12} />
                  Why this song?
                </p>
                <h2 className="font-display text-xl text-text-primary line-clamp-1">{song.title}</h2>
                <p className="text-xs text-text-tertiary">by {getArtistName()}</p>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 text-text-tertiary hover:text-text-primary rounded-full hover:bg-surface-2 transition-colors cursor-pointer shrink-0"
                aria-label="Close modal"
              >
                <X size={17} />
              </button>
            </div>

            {loading && (
              <div className="space-y-2.5 py-2 animate-pulse">
                <div className="h-14 bg-surface-2 rounded-[var(--radius-md)]" />
                <div className="h-14 bg-surface-2 rounded-[var(--radius-md)]" />
                <div className="h-14 bg-surface-2 rounded-[var(--radius-md)]" />
              </div>
            )}

            {!loading && error && (
              <div className="bg-danger-wash rounded-[var(--radius-md)] p-4 text-center space-y-2">
                <p className="text-xs text-danger font-medium">{error}</p>
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
                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-[var(--radius-pill)] bg-surface-2 text-text-secondary hover:text-text-primary transition-colors cursor-pointer"
                >
                  <RefreshCw size={12} />
                  Retry
                </button>
              </div>
            )}

            {!loading && (
              <div className="space-y-4">
                {explanationData?.summary && (
                  <p className="text-sm text-text-secondary leading-relaxed">{explanationData.summary}</p>
                )}

                <p className="text-2xs font-semibold uppercase tracking-[0.1em] text-text-tertiary">
                  Strongest factors
                </p>

                {hasApiReasons ? (
                  <div className="space-y-2.5">
                    {explanationData.topReasons.map((reason, index) => {
                      const meta = REASON_META[reason.type] || DEFAULT_META;
                      const tone = toneClasses[meta.tone];
                      const scorePercent = Math.round((reason.importanceScore || 0.8) * 100);
                      const Icon = meta.icon;

                      return (
                        <div key={index} className="bg-surface-2 rounded-[var(--radius-md)] p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-2xs font-semibold rounded-[var(--radius-pill)] ${tone.badge}`}>
                              <Icon size={12} />
                              {meta.label}
                            </span>
                            <span className={`text-xs font-mono font-semibold tabular-nums ${tone.text}`}>{scorePercent}%</span>
                          </div>
                          <p className="text-xs text-text-secondary leading-relaxed">{reason.message}</p>
                          <div className="w-full h-1 bg-surface-3 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(100, Math.max(15, scorePercent))}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : fallbackFactors.length > 0 ? (
                  <div className="space-y-2.5">
                    {fallbackFactors.map((factor, index) => {
                      const tone = toneClasses[factor.tone];
                      const Icon = factor.icon;
                      return (
                        <div key={index} className="bg-surface-2 rounded-[var(--radius-md)] p-3.5 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-2xs font-semibold rounded-[var(--radius-pill)] ${tone.badge}`}>
                              <Icon size={12} />
                              {factor.label}
                            </span>
                            <span className={`text-xs font-mono font-semibold tabular-nums ${tone.text}`}>{factor.scorePercent}%</span>
                          </div>
                          <p className="text-xs text-text-secondary leading-relaxed">{factor.description}</p>
                          <div className="w-full h-1 bg-surface-3 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(100, Math.max(15, factor.scorePercent))}%` }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="bg-surface-2 rounded-[var(--radius-md)] p-4 text-center space-y-1.5">
                    <p className="text-xs text-text-secondary font-medium">Curated for your general listening profile</p>
                    <p className="text-2xs text-text-tertiary">
                      Based on catalog popularity and genre discovery patterns while we learn your taste.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="bg-surface-2 rounded-[var(--radius-md)] p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-text-secondary">How did we do with this recommendation?</span>
                {submitting && <span className="text-2xs text-accent font-medium">Saving…</span>}
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
                {FEEDBACK_OPTIONS.map(({ id, label, icon: Icon }) => {
                  const isActive = activeFeedback === id || (id === 'helpful' && activeFeedback === 'thumbs_up') || (id === 'not_my_style' && activeFeedback === 'thumbs_down');
                  const activeTone = id === 'helpful' ? 'bg-success/15 text-success' : id === 'not_my_style' ? 'bg-danger-wash text-danger' : 'bg-accent-wash text-accent';
                  return (
                    <button
                      key={id}
                      onClick={() => handleFeedback(id!)}
                      disabled={submitting}
                      className={`px-2 py-2 rounded-[var(--radius-sm)] text-2xs font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 ${
                        isActive ? activeTone : 'bg-surface-3 text-text-tertiary hover:text-text-secondary'
                      }`}
                    >
                      <Icon size={12} />
                      {label}
                    </button>
                  );
                })}
              </div>

              {activeFeedback && (
                <p className="text-2xs text-success text-center pt-1">Thanks — this helps tune your recommendations.</p>
              )}
            </div>
          </div>
          </ScrollArea>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export const WhyThisSongModal = RecommendationExplanationModal;
