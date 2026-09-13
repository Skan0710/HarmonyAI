import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Disc, Search, Music2 } from 'lucide-react';
import type { Album } from '../types/music';
import { fetchAlbums } from '../services/songService';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { Seo } from '../components/Seo';

const fallbackCover =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 24 24" fill="none" stroke="%23d9a15b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231b1815;"><rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></svg>';

export const AlbumsPage: React.FC = () => {
  const navigate = useNavigate();
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [brokenImages, setBrokenImages] = useState<Set<string>>(new Set());

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const res = await fetchAlbums();
      if (res.albums) {
        setAlbums(res.albums);
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const getArtistName = (album: Album): string => {
    if (!album.artist) return 'Various Artists';
    if (typeof album.artist === 'object' && 'name' in album.artist) {
      return (album.artist as { name: string }).name;
    }
    return String(album.artist);
  };

  const filteredAlbums = useMemo(() => {
    if (!searchQuery.trim()) return albums;
    const q = searchQuery.toLowerCase().trim();
    return albums.filter((a) => {
      const titleMatch = a.title.toLowerCase().includes(q);
      const artistMatch = getArtistName(a).toLowerCase().includes(q);
      return titleMatch || artistMatch;
    });
  }, [albums, searchQuery]);

  return (
    <div className="space-y-8 pb-16">
      <Seo
        title="Albums"
        description="Browse all studio albums, EPs, and compilations on HarmonyAI."
        path="/albums"
      />

      <Breadcrumbs
        items={[
          { label: 'Music Library', path: '/library' },
          { label: 'Albums' },
        ]}
      />

      {/* Header Banner */}
      <div className="relative overflow-hidden bg-surface-1 border border-border-subtle rounded-[var(--radius-lg)] p-6 sm:p-10 flex flex-col sm:flex-row sm:items-end justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent-wash text-accent text-xs font-semibold uppercase tracking-wider border border-accent/20">
            <Disc size={13} />
            Discography
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-text-primary tracking-tight">
            Albums
          </h1>
          <p className="text-xs sm:text-sm text-text-tertiary max-w-xl">
            Explore curated albums and full projects. Tap any album to see its tracklist and listen immediately.
          </p>
        </div>

        {/* Search filter input */}
        <div className="relative w-full sm:w-72 shrink-0">
          <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Filter albums or artists..."
            className="w-full pl-9 pr-4 py-2 bg-surface-2 border border-border-subtle rounded-[var(--radius-pill)] text-text-primary text-xs sm:text-sm placeholder-text-tertiary focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </div>

      {/* Albums Grid */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="space-y-3 animate-pulse">
              <div className="aspect-square bg-surface-2 rounded-[var(--radius-artwork)]" />
              <div className="h-3 bg-surface-2 rounded w-3/4" />
              <div className="h-2.5 bg-surface-2 rounded w-1/2" />
            </div>
          ))}
        </div>
      ) : filteredAlbums.length === 0 ? (
        <div className="p-12 text-center bg-surface-1 border border-border-subtle rounded-[var(--radius-lg)] space-y-3">
          <Music2 size={32} className="mx-auto text-text-tertiary" />
          <p className="text-sm text-text-primary font-medium">No albums found</p>
          <p className="text-xs text-text-tertiary">
            {searchQuery ? `No results matching "${searchQuery}".` : 'No albums currently available.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 sm:gap-6">
          {filteredAlbums.map((album) => {
            const isBroken = brokenImages.has(album._id);
            const cover = isBroken || !album.coverImage ? fallbackCover : album.coverImage;

            return (
              <div
                key={album._id}
                onClick={() => navigate(`/albums/${album._id}`)}
                className="group relative bg-surface-1 hover:bg-surface-2 border border-border-subtle hover:border-border-strong rounded-[var(--radius-lg)] p-3 sm:p-4 transition-all duration-200 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="relative aspect-square rounded-[var(--radius-artwork)] overflow-hidden bg-surface-2 mb-3 shadow-md">
                    <img
                      src={cover}
                      alt={album.title}
                      onError={() => setBrokenImages((prev) => new Set(prev).add(album._id))}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    {album.albumType && (
                      <span className="absolute top-2 left-2 px-2 py-0.5 rounded-[var(--radius-sm)] bg-surface-0/80 backdrop-blur-md text-[10px] font-bold uppercase tracking-wider text-accent border border-border-subtle">
                        {album.albumType}
                      </span>
                    )}
                  </div>

                  <h3 className="font-semibold text-text-primary text-sm truncate group-hover:text-accent transition-colors">
                    {album.title}
                  </h3>
                  <p className="text-xs text-text-tertiary truncate mt-0.5">
                    {getArtistName(album)}
                  </p>
                </div>

                <div className="flex items-center justify-between mt-3 pt-2 border-t border-border-subtle text-[11px] text-text-tertiary font-mono">
                  <span>{album.releaseYear || '—'}</span>
                  <span>{album.totalTracks ? `${album.totalTracks} tracks` : ''}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
