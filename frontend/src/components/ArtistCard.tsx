import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Artist } from '../types/music';

interface ArtistCardProps {
  artist: Artist;
}

export const ArtistCard: React.FC<ArtistCardProps> = ({ artist }) => {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);

  const formatListeners = (listeners?: number): string => {
    if (!listeners) return '0 listeners';
    if (listeners >= 1_000_000) return `${(listeners / 1_000_000).toFixed(1)}M listeners`;
    if (listeners >= 1_000) return `${(listeners / 1_000).toFixed(0)}k listeners`;
    return `${listeners} listeners`;
  };

  const fallbackAvatar =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="%23818cf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231e293b;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

  const imageUrl = imgError || (!artist.profileImage && !artist.avatar) ? fallbackAvatar : (artist.profileImage || artist.avatar);

  const handleClick = () => {
    if (artist._id) {
      navigate(`/artists/${artist._id}`);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="group relative cursor-pointer w-40 sm:w-44 md:w-48 bg-slate-800/60 hover:bg-slate-800/90 border border-slate-700/50 hover:border-indigo-500/50 rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-2xl hover:shadow-indigo-500/15 flex flex-col items-center text-center shrink-0"
    >
      {/* Avatar Container */}
      <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-slate-900 mb-3 shadow-md border-2 border-slate-700/60 group-hover:border-indigo-500/60 transition-all duration-300">
        <img
          src={imageUrl}
          alt={artist.name}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />

        {/* Verified Badge Overlay */}
        {artist.verified && (
          <div className="absolute bottom-1 right-1 bg-indigo-600 text-white rounded-full p-1 border-2 border-slate-900 shadow-md" title="Verified Artist">
            <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
            </svg>
          </div>
        )}
      </div>

      {/* Artist Details */}
      <h3 className="font-semibold text-slate-100 text-sm line-clamp-1 group-hover:text-indigo-300 transition-colors w-full">
        {artist.name}
      </h3>
      <p className="text-xs text-slate-400 mt-1 line-clamp-1">{formatListeners(artist.monthlyListeners)}</p>
      <span className="mt-2.5 text-[10px] uppercase font-bold tracking-wider px-2.5 py-0.5 bg-indigo-500/10 text-indigo-300 rounded-full border border-indigo-500/20">
        Artist
      </span>
    </div>
  );
};
