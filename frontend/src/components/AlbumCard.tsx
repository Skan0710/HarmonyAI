import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Album } from '../types/music';

interface AlbumCardProps {
  album: Album;
}

export const AlbumCard: React.FC<AlbumCardProps> = ({ album }) => {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);

  const getArtistName = (): string => {
    if (!album.artist) return 'Various Artists';
    if (typeof album.artist === 'object' && 'name' in album.artist) {
      return (album.artist as { name: string }).name;
    }
    return String(album.artist);
  };

  const fallbackCover =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="%23d9a15b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231b1815;"><rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></svg>';

  const coverUrl = imgError || !album.coverImage ? fallbackCover : album.coverImage;

  const handleClick = () => {
    if (album._id) {
      navigate(`/albums/${album._id}`);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="group relative cursor-pointer w-40 sm:w-44 md:w-48 bg-surface-1 hover:bg-surface-2 rounded-[var(--radius-md)] p-3 transition-colors duration-[var(--duration-base)] flex flex-col justify-between shrink-0"
    >
      <div>
        <div className="relative aspect-square w-full rounded-[var(--radius-artwork)] overflow-hidden bg-surface-2 mb-3">
          <img
            src={coverUrl}
            alt={album.title}
            onError={() => setImgError(true)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
          />

          {album.albumType && (
            <div className="absolute top-2 right-2">
              <span className="px-2 py-0.5 text-2xs font-medium uppercase tracking-wide bg-surface-0/80 backdrop-blur-md text-text-secondary rounded-[var(--radius-sharp)]">
                {album.albumType}
              </span>
            </div>
          )}
        </div>

        <h3 className="font-semibold text-text-primary text-sm line-clamp-1 group-hover:text-accent transition-colors">
          {album.title}
        </h3>
        <p className="text-xs text-text-tertiary mt-0.5 line-clamp-1">{getArtistName()}</p>
      </div>

      <div className="mt-3 pt-2.5 border-t border-border-subtle flex items-center justify-between text-2xs text-text-tertiary">
        <span>{album.releaseYear || 'Album'}</span>
        {album.totalTracks && <span>{album.totalTracks} tracks</span>}
      </div>
    </div>
  );
};
