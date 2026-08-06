import React from 'react';

export const SearchSkeletonLoader: React.FC = () => {
  return (
    <div className="space-y-10 animate-pulse">
      {/* 1. Songs Section Skeleton */}
      <div className="space-y-4">
        <div className="h-7 bg-slate-800/80 rounded-lg w-44" />
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-slate-800/60 border border-slate-700/50 rounded-2xl p-3.5 space-y-3">
              <div className="w-full aspect-square bg-slate-700/60 rounded-xl" />
              <div className="h-4 bg-slate-700/70 rounded w-3/4" />
              <div className="h-3 bg-slate-700/50 rounded w-1/2" />
            </div>
          ))}
        </div>
      </div>

      {/* 2. Artists Section Skeleton */}
      <div className="space-y-4">
        <div className="h-7 bg-slate-800/80 rounded-lg w-40" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-44 h-48 bg-slate-800/60 border border-slate-700/50 rounded-2xl p-4 flex flex-col items-center space-y-3 shrink-0">
              <div className="w-24 h-24 rounded-full bg-slate-700/60" />
              <div className="h-4 bg-slate-700/70 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>

      {/* 3. Albums Section Skeleton */}
      <div className="space-y-4">
        <div className="h-7 bg-slate-800/80 rounded-lg w-40" />
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="w-44 h-52 bg-slate-800/60 border border-slate-700/50 rounded-2xl p-3.5 space-y-3 shrink-0">
              <div className="w-full aspect-square bg-slate-700/60 rounded-xl" />
              <div className="h-4 bg-slate-700/70 rounded w-3/4" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
