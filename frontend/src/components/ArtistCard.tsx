import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck } from 'lucide-react';
import type { Artist } from '../types/music';
import { formatListeners } from '../utils/formatters';

interface ArtistCardProps {
  artist: Artist;
}

export const ArtistCard: React.FC<ArtistCardProps> = ({ artist }) => {
  const navigate = useNavigate();
  const [imgError, setImgError] = useState(false);

  const fallbackAvatar =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="%23d9a15b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231b1815;"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>';

  const imageUrl = imgError || (!artist.profileImage && !artist.avatar) ? fallbackAvatar : (artist.profileImage || artist.avatar);

  const handleClick = () => {
    if (artist._id) {
      navigate(`/artists/${artist._id}`);
    }
  };

  return (
    <div
      onClick={handleClick}
      className="group relative cursor-pointer w-40 sm:w-44 md:w-48 bg-surface-1 hover:bg-surface-2 rounded-[var(--radius-md)] p-4 transition-colors duration-[var(--duration-base)] flex flex-col items-center text-center shrink-0"
    >
      <div className="relative w-28 h-28 sm:w-32 sm:h-32 rounded-full overflow-hidden bg-surface-2 mb-3">
        <img
          src={imageUrl}
          alt={artist.name}
          onError={() => setImgError(true)}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />

        {artist.verified && (
          <div className="absolute bottom-1 right-1 bg-accent text-text-on-accent rounded-full p-1" title="Verified Artist">
            <BadgeCheck size={12} strokeWidth={2} />
          </div>
        )}
      </div>

      <h3 className="font-medium text-text-primary text-sm line-clamp-1 group-hover:text-accent transition-colors w-full">
        {artist.name}
      </h3>
      <p className="text-xs text-text-tertiary mt-1 line-clamp-1">{formatListeners(artist.monthlyListeners)}</p>
    </div>
  );
};
