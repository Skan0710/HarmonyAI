import React from 'react';

export const PlaylistSkeletonLoader: React.FC = () => {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Header Banner Skeleton */}
      <div className="relative overflow-hidden rounded-3xl bg-slate-900/80 border border-slate-800 p-6 sm:p-10 flex flex-col sm:flex-row items-center gap-6">
        <div className="w-36 h-36 sm:w-44 sm:h-44 bg-slate-800 rounded-2xl shrink-0" />
        <div className="flex-1 space-y-3 w-full">
          <div className="h-4 bg-slate-800 rounded w-24" />
          <div className="h-8 bg-slate-800 rounded w-2/3" />
          <div className="h-4 bg-slate-800 rounded w-1/2" />
          <div className="h-4 bg-slate-800 rounded w-1/3 pt-2" />
        </div>
      </div>

      {/* Track List Skeleton */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-14 bg-slate-800/60 rounded-xl w-full" />
        ))}
      </div>
    </div>
  );
};
