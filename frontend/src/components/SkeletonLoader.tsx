import React from 'react';

export const CardSkeleton: React.FC = () => {
  return (
    <div className="w-full h-64 bg-surface-1 border border-border-subtle rounded-[var(--radius-lg)] p-4 animate-pulse flex flex-col justify-between">
      <div className="w-full aspect-square bg-surface-2 rounded-[var(--radius-artwork)]" />
      <div className="space-y-2 mt-3">
        <div className="h-4 bg-surface-2 rounded w-3/4" />
        <div className="h-3 bg-surface-2 rounded w-1/2" />
      </div>
    </div>
  );
};

export const HeroSkeleton: React.FC = () => {
  return (
    <div className="w-full h-64 bg-surface-1 border border-border-subtle rounded-[var(--radius-lg)] p-8 animate-pulse flex flex-col justify-center space-y-4">
      <div className="h-4 bg-surface-2 rounded w-1/4" />
      <div className="h-8 bg-surface-2 rounded w-3/4" />
      <div className="h-4 bg-surface-2 rounded w-1/2" />
    </div>
  );
};

export const PageSkeleton: React.FC = () => {
  return (
    <div className="space-y-8 py-4 animate-pulse">
      <div className="h-4 bg-surface-2 rounded w-1/3" />
      <HeroSkeleton />
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {Array.from({ length: 5 }).map((_, idx) => (
          <CardSkeleton key={idx} />
        ))}
      </div>
    </div>
  );
};
