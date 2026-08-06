import React from 'react';
import { useNavigate } from 'react-router-dom';
import type { GroupedSearchResults } from '../services/searchService';
import { useRecentSearchesStore } from '../store/useRecentSearchesStore';
import { usePlayerStore } from '../store/usePlayerStore';

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
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23818cf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231e293b;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

  // 1. Show Recent Searches (When query is empty)
  if (!hasQuery) {
    if (recentSearches.length === 0) {
      return null;
    }

    return (
      <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl p-3 space-y-2 animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between px-2 pb-1.5 border-b border-slate-800">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Recent Searches
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              clearAllSearches();
            }}
            className="text-[11px] font-semibold text-rose-400 hover:text-rose-300 transition-colors"
          >
            Clear All
          </button>
        </div>

        <div className="space-y-0.5 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700">
          {recentSearches.map((item) => (
            <div
              key={item}
              onClick={() => handleSelectRecent(item)}
              className="group flex items-center justify-between px-3 py-2 rounded-xl hover:bg-slate-800/80 cursor-pointer text-xs transition-colors"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <svg className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <span className="text-slate-200 group-hover:text-white truncate font-medium">{item}</span>
              </div>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeSearch(item);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 rounded transition-opacity"
                title="Remove search"
                aria-label="Remove search"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Show Live Suggestions (When typing)
  if (loading) {
    return (
      <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl p-4 text-center">
        <div className="inline-flex items-center gap-2 text-xs text-indigo-400">
          <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          <span>Searching catalog suggestions...</span>
        </div>
      </div>
    );
  }

  if (!suggestions || suggestions.total === 0) {
    return null;
  }

  return (
    <div className="absolute top-full left-0 right-0 z-50 mt-2 bg-slate-900/95 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl p-3 space-y-3 max-h-96 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 animate-in fade-in zoom-in-95 duration-150">
      {/* Songs Suggestions */}
      {suggestions.songs.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Songs</div>
          {suggestions.songs.slice(0, 4).map((song) => (
            <div
              key={song._id}
              onClick={() => handleSongClick(song)}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/80 cursor-pointer transition-colors"
            >
              <img
                src={song.coverImage || fallbackCover}
                alt={song.title}
                className="w-8 h-8 rounded-lg object-cover bg-slate-800 shrink-0 border border-slate-700/60"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-100 truncate hover:text-indigo-300">{song.title}</p>
                <p className="text-[11px] text-slate-400 truncate">{getArtistName(song.artist)}</p>
              </div>
              <span className="text-[10px] font-mono text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded border border-indigo-500/20">
                Track
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Artists Suggestions */}
      {suggestions.artists.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Artists</div>
          {suggestions.artists.slice(0, 3).map((artist) => (
            <div
              key={artist._id}
              onClick={() => handleArtistClick(artist)}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/80 cursor-pointer transition-colors"
            >
              <div className="w-8 h-8 rounded-full overflow-hidden bg-slate-800 shrink-0 border border-slate-700">
                <img
                  src={artist.profileImage || artist.avatar || fallbackCover}
                  alt={artist.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <p className="text-xs font-semibold text-slate-100 truncate flex-1">{artist.name}</p>
              <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                Artist
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Albums Suggestions */}
      {suggestions.albums.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-2">Albums</div>
          {suggestions.albums.slice(0, 3).map((album) => (
            <div
              key={album._id}
              onClick={() => handleAlbumClick(album)}
              className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-800/80 cursor-pointer transition-colors"
            >
              <img
                src={album.coverImage || fallbackCover}
                alt={album.title}
                className="w-8 h-8 rounded-lg object-cover bg-slate-800 shrink-0 border border-slate-700/60"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-slate-100 truncate">{album.title}</p>
                <p className="text-[11px] text-slate-400 truncate">{getArtistName(album.artist)}</p>
              </div>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                Album
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
