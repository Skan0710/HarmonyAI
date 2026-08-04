import React, { useState } from 'react';
import type { Album } from '../types/music';

interface AlbumCardProps {
  album: Album;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({ album }) => {
  const [imgError, setImgError] = useState(false);

  const getArtistName = (): string => {
    if (!album.artist) return 'Various Artists';
    if (typeof album.artist === 'object' && 'name' in album.artist) {
      return (album.artist as { name: string }).name;
    }
    return String(album.artist);
  };

  const fallbackCover =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="%23818cf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231e293b;"><rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></svg>';

  const coverUrl = imgError || !album.coverImage ? fallbackCover : album.coverImage;

  return (
    <div className="group relative w-44 sm:w-48 bg-slate-800/60 hover:bg-slate-800 border border-slate-700/50 hover:border-indigo-500/40 rounded-2xl p-3.5 transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 flex flex-col justify-between shrink-0">
      <div>
        {/* Cover Container */}
        <div className="relative aspect-square w-full rounded-xl overflow-hidden bg-slate-900 mb-3 shadow-md">
          <img
            src={coverUrl}
            alt={album.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />

          {album.albumType && (
            <div className="absolute top-2 right-2">
              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-slate-900/80 backdrop-blur-md text-slate-200 rounded-md border border-slate-700">
                {album.albumType}
              </span>
            </div>
          )}
        </div>

        {/* Details */}
        <h3 className="font-semibold text-slate-100 text-sm line-clamp-1 group-hover:text-indigo-400 transition-colors">
          {album.title}
        </h3>
        <p className="text-xs text-slate-400 mt-0.5 line-clamp-1">{getArtistName()}</p>
      </div>

      <div className="mt-3 pt-2 border-t border-slate-700/40 flex items-center justify-between text-[11px] text-slate-400">
        <span>{album.releaseYear || 'Album'}</span>
        {album.totalTracks && <span>{album.totalTracks} tracks</span>}
      </div>
    </div>
  );
};
