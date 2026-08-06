import React from 'react';

interface TrendingSearchesProps {
  onSelectTrending: (query: string) => void;
}

const TRENDING_TOPICS = [
  { term: 'Synthwave', icon: '🔥' },
  { term: 'Midnight Echoes', icon: '🎵' },
  { term: 'Acoustic Sessions', icon: '🎤' },
  { term: 'Summer Vibe', icon: '💿' },
  { term: 'Rock Anthems', icon: '🎸' },
  { term: 'Chill Beats', icon: '🎷' },
  { term: 'Pop Hits', icon: '✨' },
  { term: 'Lo-Fi Chill', icon: '🎧' },
];

export const TrendingSearches: React.FC<TrendingSearchesProps> = ({ onSelectTrending }) => {
  return (
    <div className="bg-slate-900/60 border border-slate-800 rounded-3xl p-6 space-y-4 backdrop-blur-xl shadow-xl">
      <div className="flex items-center gap-2 text-slate-200">
        <span className="text-xl">🔥</span>
        <h3 className="font-bold text-base sm:text-lg tracking-tight">Trending Searches</h3>
      </div>
      <p className="text-slate-400 text-xs sm:text-sm">
        Popular music genres, acoustic vibes, and trending topics right now on HarmonyAI.
      </p>

      <div className="flex flex-wrap gap-2.5 pt-1">
        {TRENDING_TOPICS.map((topic) => (
          <button
            key={topic.term}
            onClick={() => onSelectTrending(topic.term)}
            className="group px-3.5 py-2 bg-slate-800/80 hover:bg-indigo-600/30 border border-slate-700/80 hover:border-indigo-500/50 rounded-2xl text-xs font-semibold text-slate-300 hover:text-indigo-200 transition-all duration-200 hover:scale-105 active:scale-95 flex items-center gap-2 shadow-sm"
          >
            <span className="group-hover:rotate-12 transition-transform">{topic.icon}</span>
            <span>{topic.term}</span>
          </button>
        ))}
      </div>
    </div>
  );
};
