import React from 'react';
import type { Song } from '../types/music';

export interface ExplanationFactor {
  label: string;
  scorePercent: number;
  description: string;
  badgeColor: string;
}

interface RecommendationExplanationModalProps {
  song: Song;
  isOpen: boolean;
  onClose: () => void;
}

export const RecommendationExplanationModal: React.FC<RecommendationExplanationModalProps> = ({
  song,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const rawComponentScores = (song as any).componentScores;
  const rawSources: string[] = (song as any).sources || [];
  const rawExplanation = (song as any).explanation;

  const factors: ExplanationFactor[] = [];

  if (rawComponentScores) {
    const { contentScore = 0, collaborativeScore = 0, popularityScore = 0, recencyScore = 0 } = rawComponentScores;

    if (contentScore > 0) {
      factors.push({
        label: 'Acoustic & Metadata Similarity',
        scorePercent: Math.round(contentScore * 100),
        description: 'Matches the tempo, mood, genre, and acoustic signature of songs you love.',
        badgeColor: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      });
    }

    if (collaborativeScore > 0) {
      factors.push({
        label: 'Listeners Like You',
        scorePercent: Math.round(collaborativeScore * 100),
        description: 'Listeners with similar music tastes frequently play and replay this track.',
        badgeColor: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      });
    }

    if (popularityScore > 0) {
      factors.push({
        label: 'Community Popularity',
        scorePercent: Math.round(popularityScore * 100),
        description: 'High play count and active engagement across the HarmonyAI network.',
        badgeColor: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      });
    }

    if (recencyScore > 0) {
      factors.push({
        label: 'Catalog Recency',
        scorePercent: Math.round(recencyScore * 100),
        description: 'Fresh release or recent addition to our catalog.',
        badgeColor: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      });
    }
  }

  // Handle similarity explanation breakdown if available
  if (rawExplanation && rawExplanation.majorContributors) {
    for (const contributor of rawExplanation.majorContributors) {
      if (!factors.some((f) => f.label.includes(contributor))) {
        factors.push({
          label: contributor,
          scorePercent: 85,
          description: 'Direct acoustic attribute match identified by HarmonyAI vector engine.',
          badgeColor: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
        });
      }
    }
  }

  // Sort factors descending by strongest score percent first
  factors.sort((a, b) => b.scorePercent - a.scorePercent);

  const getArtistName = (): string => {
    if (!song.artist) return 'Artist';
    if (typeof song.artist === 'object' && 'name' in song.artist) {
      return song.artist.name;
    }
    return String(song.artist);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl p-6 shadow-2xl space-y-6 text-slate-100 overflow-hidden"
      >
        <div className="absolute -top-12 -right-12 w-40 h-40 bg-indigo-500/10 rounded-full blur-2xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-800 pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-xs font-semibold">
              ✨ AI Recommendation Insights
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
            className="p-1.5 text-slate-400 hover:text-white rounded-full bg-slate-800/80 hover:bg-slate-800 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Strongest Recommendation Factors Section */}
        <div className="space-y-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Strongest Recommendation Factors
          </p>

          {factors.length > 0 ? (
            <div className="space-y-3">
              {factors.map((factor, index) => (
                <div
                  key={index}
                  className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-3.5 space-y-2 hover:border-slate-600 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <span className={`px-2.5 py-0.5 text-xs font-semibold rounded-full border ${factor.badgeColor}`}>
                      {factor.label}
                    </span>
                    <span className="text-xs font-bold text-indigo-300 font-mono">
                      {factor.scorePercent}% Match
                    </span>
                  </div>

                  <p className="text-xs text-slate-300 leading-relaxed">{factor.description}</p>

                  {/* Visual Match Bar */}
                  <div className="w-full h-1.5 bg-slate-700/60 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-indigo-500 via-purple-400 to-pink-400 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, Math.max(10, factor.scorePercent))}%` }}
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

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
          <span>Engine: Hybrid Neural Vector Scoring</span>
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
