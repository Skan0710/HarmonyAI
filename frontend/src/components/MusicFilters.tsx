import React from 'react';
import type { Genre, Artist, Album } from '../types/music';

interface MusicFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedGenreId: string;
  onGenreChange: (genreId: string) => void;
  selectedArtistId: string;
  onArtistChange: (artistId: string) => void;
  selectedAlbumId: string;
  onAlbumChange: (albumId: string) => void;
  sortBy: string;
  onSortByChange: (sortBy: string) => void;
  sortOrder: 'asc' | 'desc';
  onSortOrderToggle: () => void;
  genres: Genre[];
  artists: Artist[];
  albums: Album[];
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export const MusicFilters: React.FC<MusicFiltersProps> = ({
  searchQuery,
  onSearchChange,
  selectedGenreId,
  onGenreChange,
  selectedArtistId,
  onArtistChange,
  selectedAlbumId,
  onAlbumChange,
  sortBy,
  onSortByChange,
  sortOrder,
  onSortOrderToggle,
  genres,
  artists,
  albums,
  onClearFilters,
  hasActiveFilters,
}) => {
  return (
    <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-4 space-y-4 backdrop-blur-md">
      {/* Top Row: Search & Action Buttons */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Search Bar Input */}
        <div className="relative flex-1">
          <svg
            className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search songs, artists, tags..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full bg-slate-900/80 border border-slate-700/80 rounded-xl pl-10 pr-9 py-2.5 text-sm text-slate-200 placeholder-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 text-xs font-semibold p-1"
              aria-label="Clear Search"
            >
              ✕
            </button>
          )}
        </div>

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            onClick={onClearFilters}
            className="px-3.5 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 hover:text-rose-300 text-xs font-medium rounded-xl border border-rose-500/30 transition-all flex items-center justify-center gap-1.5 self-start md:self-auto"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Reset Filters
          </button>
        )}
      </div>

      {/* Bottom Row: Dropdown Selects for Filters & Sorting */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1 border-t border-slate-700/40">
        {/* Genre Filter */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Genre</label>
          <select
            value={selectedGenreId}
            onChange={(e) => onGenreChange(e.target.value)}
            className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Genres</option>
            {genres.map((g) => (
              <option key={g._id} value={g._id}>
                {g.name}
              </option>
            ))}
          </select>
        </div>

        {/* Artist Filter */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Artist</label>
          <select
            value={selectedArtistId}
            onChange={(e) => onArtistChange(e.target.value)}
            className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Artists</option>
            {artists.map((a) => (
              <option key={a._id} value={a._id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        {/* Album Filter */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Album</label>
          <select
            value={selectedAlbumId}
            onChange={(e) => onAlbumChange(e.target.value)}
            className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
          >
            <option value="">All Albums</option>
            {albums.map((al) => (
              <option key={al._id} value={al._id}>
                {al.title}
              </option>
            ))}
          </select>
        </div>

        {/* Sort By & Order Toggle */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">Sort By</label>
          <div className="flex items-center gap-1.5">
            <select
              value={sortBy}
              onChange={(e) => onSortByChange(e.target.value)}
              className="w-full bg-slate-900/90 border border-slate-700/80 rounded-xl px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
            >
              <option value="playCount">Popularity (Most Played)</option>
              <option value="releaseYear">Release Year</option>
              <option value="title">Title (A-Z)</option>
              <option value="createdAt">Date Added</option>
            </select>

            <button
              onClick={onSortOrderToggle}
              title={`Sort order: ${sortOrder === 'asc' ? 'Ascending' : 'Descending'}`}
              className="p-2 bg-slate-900/90 border border-slate-700/80 hover:border-indigo-500 text-slate-300 hover:text-white rounded-xl transition-colors shrink-0"
              aria-label="Toggle sort order"
            >
              {sortOrder === 'asc' ? (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h9m5 8l-4 4m0 0l-4-4m4 4V8" />
                </svg>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
