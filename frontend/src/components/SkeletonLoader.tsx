import React from 'react';

export const CardSkeleton: React.FC = () => {
  return (
    <div className="w-full h-64 bg-slate-800/50 border border-slate-700/40 rounded-2xl p-4 animate-pulse flex flex-col justify-between">
      <div className="w-full aspect-square bg-slate-700/50 rounded-xl" />
      <div className="space-y-2 mt-3">
        <div className="h-4 bg-slate-700/60 rounded w-3/4" />
        <div className="h-3 bg-slate-700/40 rounded w-1/2" />
      </div>
    </div>
  );
};

export const HeroSkeleton: React.FC = () => {
  return (
    <div className="w-full h-64 bg-slate-900/80 border border-slate-800 rounded-3xl p-8 animate-pulse flex flex-col justify-center space-y-4">
      <div className="h-4 bg-slate-800 rounded w-1/4" />
      <div className="h-8 bg-slate-800 rounded w-3/4" />
      <div className="h-4 bg-slate-800 rounded w-1/2" />
    </div>
  );
};

export const PageSkeleton: React.FC = () => {
  return (
    <div className="space-y-8 py-4 animate-pulse">
      <div className="h-4 bg-slate-800 rounded w-1/3" />
      <HeroSkeleton />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, idx) => (
          <CardSkeleton key={idx} />
        ))}
      </div>
    </div>
  );
};
