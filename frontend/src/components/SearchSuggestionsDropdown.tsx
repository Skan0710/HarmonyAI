import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { GroupedSearchResults } from '../services/searchService';
import { useRecentSearchesStore } from '../store/useRecentSearchesStore';
import { usePlayerStore } from '../store/usePlayerStore';
import { ScrollArea } from './ui/scroll-area';

interface SearchSuggestionsDropdownProps {
  query: string;
  suggestions: GroupedSearchResults | null;
  loading?: boolean;
  onSelectSearch: (query: string) => void;
  onClose: () => void;
}

export const SearchSuggestionsDropdown: React.FC<SearchSuggestionsDropdownProps> = ({
  query,
  suggestions,
  loading = false,
  onSelectSearch,
  onClose,
}) => {
  const navigate = useNavigate();
  const { recentSearches, removeSearch, clearAllSearches } = useRecentSearchesStore();
  const playSong = usePlayerStore((state) => state.playSong);

  const trimmedQuery = query.trim();
  const hasQuery = Boolean(trimmedQuery);

  const getArtistName = (artist: any): string => {
    if (!artist) return 'Unknown Artist';
    if (typeof artist === 'object' && 'name' in artist) {
      return artist.name;
    }
    return String(artist);
  };

  const handleSelectRecent = (searchTerm: string) => {
    onSelectSearch(searchTerm);
    onClose();
  };

  const handleSongClick = (song: any) => {
    playSong(song);
    navigate(`/songs/${song._id}`);
    onClose();
  };

  const handleArtistClick = (artist: any) => {
    navigate(`/artists/${artist._id}`);
    onClose();
  };

  const handleAlbumClick = (album: any) => {
    navigate(`/albums/${album._id}`);
    onClose();
  };

  const fallbackCover =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23d9a15b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231b1815;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

  // 1. Show Recent Searches (When query is empty)
  if (!hasQuery) {
    if (recentSearches.length === 0) {
      return null;
    }

    return (
      <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-surface-1/95 border border-border-default rounded-[var(--radius-lg)] shadow-2xl backdrop-blur-xl p-3 space-y-2 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-2 pb-1.5 border-b border-border-subtle">
          <span className="text-xs font-bold text-text-tertiary uppercase tracking-wider flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-accent" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Recent Searches
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearAllSearches();
            }}
            className="text-[11px] font-semibold text-danger hover:text-danger/80 transition-colors cursor-pointer"
          >
            Clear All
          </button>
        </div>

        <ScrollArea className="max-h-60">
        <div className="space-y-0.5">
          {recentSearches.map((item) => (
            <div
              key={item}
              onClick={() => handleSelectRecent(item)}
              className="group flex items-center justify-between px-3 py-2 rounded-[var(--radius-md)] hover:bg-surface-2 cursor-pointer text-xs transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <svg className="w-3.5 h-3.5 text-text-tertiary group-hover:text-accent shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="text-text-secondary group-hover:text-text-primary truncate font-medium">{item}</span>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeSearch(item);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-text-tertiary hover:text-danger rounded transition-opacity cursor-pointer"
                title="Remove search"
                aria-label="Remove search"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        </ScrollArea>
      </div>
    );
  }

  // 2. Show Live Suggestions (When typing)
  if (loading) {
    return (
      <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-surface-1/95 border border-border-default rounded-[var(--radius-lg)] shadow-2xl backdrop-blur-xl p-4 text-center">
        <div className="inline-flex items-center gap-2 text-xs text-accent">
          <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          <span>Searching catalog suggestions...</span>
        </div>
      </div>
    );
  }

  if (!suggestions || suggestions.total === 0) {
    return null;
  }

  return (
    <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-surface-1/95 border border-border-default rounded-[var(--radius-lg)] shadow-2xl backdrop-blur-xl p-3 animate-in fade-in zoom-in-95 duration-150">
      <ScrollArea className="max-h-96">
      <div className="space-y-3">
      {/* Songs Suggestions */}
      {suggestions.songs.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider px-2">Songs</div>
          {suggestions.songs.slice(0, 4).map((song) => (
            <div
              key={song._id}
              onClick={() => handleSongClick(song)}
              className="flex items-center gap-3 p-2 rounded-[var(--radius-md)] hover:bg-surface-2 cursor-pointer transition-colors"
            >
              <img
                src={song.coverImage || fallbackCover}
                alt={song.title}
                className="w-8 h-8 rounded-[var(--radius-artwork)] object-cover bg-surface-2 shrink-0 border border-border-default"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-text-primary truncate hover:text-accent">{song.title}</p>
                <p className="text-[11px] text-text-tertiary truncate">{getArtistName(song.artist)}</p>
              </div>
              <span className="text-[10px] font-mono text-accent bg-accent-wash px-2 py-0.5 rounded-[var(--radius-sm)] border border-accent/20">
                Track
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Artists Suggestions */}
      {suggestions.artists.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider px-2">Artists</div>
          {suggestions.artists.slice(0, 3).map((artist) => (
            <div
              key={artist._id}
              onClick={() => handleArtistClick(artist)}
              className="flex items-center gap-3 p-2 rounded-[var(--radius-md)] hover:bg-surface-2 cursor-pointer transition-colors"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden bg-surface-2 shrink-0 border border-border-default">
                <img
                  src={artist.profileImage || artist.avatar || fallbackCover}
                  alt={artist.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-xs font-semibold text-text-primary truncate flex-1">{artist.name}</p>
              <span className="text-[10px] font-mono text-gold bg-gold-wash px-2 py-0.5 rounded-[var(--radius-sm)] border border-gold/20">
                Artist
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Albums Suggestions */}
      {suggestions.albums.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider px-2">Albums</div>
          {suggestions.albums.slice(0, 3).map((album) => (
            <div
              key={album._id}
              onClick={() => handleAlbumClick(album)}
              className="flex items-center gap-3 p-2 rounded-[var(--radius-md)] hover:bg-surface-2 cursor-pointer transition-colors"
            >
              <img
                src={album.coverImage || fallbackCover}
                alt={album.title}
                className="w-8 h-8 rounded-[var(--radius-artwork)] object-cover bg-surface-2 shrink-0 border border-border-default"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-text-primary truncate">{album.title}</p>
                <p className="text-[11px] text-text-tertiary truncate">{getArtistName(album.artist)}</p>
              </div>
              <span className="text-[10px] font-mono text-success bg-success/10 px-2 py-0.5 rounded-[var(--radius-sm)] border border-success/20">
                Album
              </span>
            </div>
          ))}
        </div>
      )}
      </div>
      </ScrollArea>
    </div>
  );
};
