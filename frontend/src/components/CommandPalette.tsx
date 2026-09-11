import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Compass,
  LayoutGrid,
  Library,
  ListMusic,
  Heart,
  Wand2,
  Sparkles,
  SlidersHorizontal,
  Fingerprint,
  Play,
} from 'lucide-react';
import { SearchModal } from './ui/search-modal';
import type { SearchResult, QuickAction } from './ui/search-modal';
import { searchGlobal } from '../services/searchService';
import { usePlayerStore } from '../store/usePlayerStore';
import { useCommandPaletteStore } from '../store/useCommandPaletteStore';
import { useRecentSearchesStore } from '../store/useRecentSearchesStore';

interface PaletteResult extends SearchResult {
  _navigate: string;
}

const fallbackCover =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 24 24" fill="none" stroke="%23d9a15b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231b1815;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

const getArtistName = (artist: unknown): string => {
  if (artist && typeof artist === 'object' && 'name' in artist) {
    return String((artist as { name: string }).name);
  }
  return 'Unknown Artist';
};

export const CommandPalette: React.FC = () => {
  const navigate = useNavigate();
  const { isOpen, close, setOpen } = useCommandPaletteStore();
  const playSong = usePlayerStore((state) => state.playSong);
  const addSearch = useRecentSearchesStore((state) => state.addSearch);

  const [results, setResults] = useState<PaletteResult[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleQueryChange = useCallback(
    (value: string) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      const trimmed = value.trim();

      if (!trimmed) {
        setResults([]);
        return;
      }

      debounceRef.current = setTimeout(async () => {
        const { results: data } = await searchGlobal(trimmed, 6);
        if (!data) {
          setResults([]);
          return;
        }

        const mapped: PaletteResult[] = [
          ...data.songs.map((song: any) => ({
            name: song.title,
            meta: `${getArtistName(song.artist)} · Song`,
            avatar: song.coverImage || fallbackCover,
            _navigate: `/songs/${song._id}`,
            actions: [
              {
                icon: <Play className="h-4 w-4" />,
                label: 'Play',
                onClick: () => playSong(song),
              },
            ],
          })),
          ...data.artists.map((artist: any) => ({
            name: artist.name,
            meta: 'Artist',
            avatar: artist.profileImage || artist.avatar || fallbackCover,
            _navigate: `/artists/${artist._id}`,
          })),
          ...data.albums.map((album: any) => ({
            name: album.title,
            meta: 'Album',
            avatar: album.coverImage || fallbackCover,
            _navigate: `/albums/${album._id}`,
          })),
        ];

        setResults(mapped);
      }, 250);
    },
    [playSong]
  );

  const handleSelectResult = useCallback(
    (result: SearchResult) => {
      const target = (result as PaletteResult)._navigate;
      if (target) {
        addSearch(result.name);
        navigate(target);
      }
      close();
    },
    [addSearch, navigate, close]
  );

  const quickActions: QuickAction[] = useMemo(
    () => [
      { label: 'Discover', icon: <Compass className="h-[15px] w-[15px]" />, onClick: () => { navigate('/discover'); close(); } },
      { label: 'Browse genres', icon: <LayoutGrid className="h-[15px] w-[15px]" />, onClick: () => { navigate('/genres'); close(); } },
      { label: 'Music library', icon: <Library className="h-[15px] w-[15px]" />, onClick: () => { navigate('/library'); close(); } },
      { label: 'Your playlists', icon: <ListMusic className="h-[15px] w-[15px]" />, onClick: () => { navigate('/playlists'); close(); } },
      { label: 'Liked songs', icon: <Heart className="h-[15px] w-[15px]" />, onClick: () => { navigate('/liked-songs'); close(); } },
      { label: 'AI playlist generator', icon: <Wand2 className="h-[15px] w-[15px]" />, onClick: () => { navigate('/ai-playlist'); close(); } },
      { label: 'Music DNA', icon: <Fingerprint className="h-[15px] w-[15px]" />, onClick: () => { navigate('/music-dna'); close(); } },
      { label: 'AI Assistant', icon: <Sparkles className="h-[15px] w-[15px]" />, onClick: () => { navigate('/assistant'); close(); } },
      { label: 'Preferences', icon: <SlidersHorizontal className="h-[15px] w-[15px]" />, onClick: () => { navigate('/preferences'); close(); } },
    ],
    [navigate, close]
  );

  return (
    <SearchModal
      modal
      hotkey="k"
      open={isOpen}
      onOpenChange={setOpen}
      placeholder="Search songs, artists, albums, or jump to a page…"
      tags={[]}
      files={[]}
      results={results}
      quickActions={quickActions}
      onQueryChange={handleQueryChange}
      onSelectResult={handleSelectResult}
    />
  );
};
