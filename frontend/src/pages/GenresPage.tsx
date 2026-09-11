import React, { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { LayoutGrid } from 'lucide-react';
import type { Genre, Song } from '../types/music';
import { fetchGenres, fetchSongs } from '../services/songService';
import { MusicGrid } from '../components/MusicGrid';
import { AnimatedLink } from '../components/ui/AnimatedLink';
import { PerspectiveCarousel } from '../components/ui/perspective-carousel';
import { usePlayerStore } from '../store/usePlayerStore';

const fallbackCover =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="500" viewBox="0 0 24 24" fill="none" stroke="%23d9a15b" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" style="background:%231b1815;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

export const GenresPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const playSong = usePlayerStore((state) => state.playSong);

  const selectedGenreId = searchParams.get('genre') || '';

  const [genres, setGenres] = useState<Genre[]>([]);
  const [selectedGenre, setSelectedGenre] = useState<Genre | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);

  const [loadingGenres, setLoadingGenres] = useState<boolean>(true);
  const [loadingSongs, setLoadingSongs] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadGenres = async () => {
      setLoadingGenres(true);
      setError(null);

      const res = await fetchGenres();

      if (res.error) {
        setError(res.error);
      } else if (res.genres) {
        setGenres(res.genres);
      }

      setLoadingGenres(false);
    };

    loadGenres();
  }, []);

  const loadGenreSongs = useCallback(async (genreId: string) => {
    setLoadingSongs(true);
    setError(null);

    const res = await fetchSongs({ genreId, limit: 50 });

    if (res.error) {
      setError(res.error);
    } else if (res.songs) {
      setSongs(res.songs);
    }

    setLoadingSongs(false);
  }, []);

  useEffect(() => {
    if (selectedGenreId && genres.length > 0) {
      const found = genres.find((g) => g._id === selectedGenreId || g.slug === selectedGenreId);
      if (found) {
        setSelectedGenre(found);
        loadGenreSongs(found._id);
      } else {
        setSelectedGenre(null);
        setSongs([]);
      }
    } else {
      setSelectedGenre(null);
      setSongs([]);
    }
  }, [selectedGenreId, genres, loadGenreSongs]);

  const handleSelectGenre = (genre: Genre) => {
    setSearchParams({ genre: genre._id });
  };

  const handlePlaySong = (song: Song) => {
    playSong(song, songs);
  };

  const carouselItems = genres.map((genre) => ({
    src: genre.coverImage || fallbackCover,
    title: genre.name,
    alt: genre.name,
  }));

  return (
    <div className="pb-16">
      <section className="border-b border-border-subtle px-5 sm:px-8 lg:px-12 pt-10 pb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-text-tertiary uppercase tracking-[0.14em]">Browse</p>
          <h1 className="font-display text-2xl sm:text-3xl text-text-primary leading-snug mt-3">
            {selectedGenre ? selectedGenre.name : 'Genres'}
          </h1>
          <p className="text-text-tertiary text-sm mt-2 max-w-lg">
            {selectedGenre
              ? selectedGenre.description || `Explore top tracks in ${selectedGenre.name}.`
              : 'A spectrum of sound, drag or tap through to find your next mood.'}
          </p>
        </div>

        {selectedGenre && (
          <AnimatedLink to="/genres" showArrow={false} className="text-sm font-medium text-text-secondary hover:text-accent self-start sm:self-center">
            ← All genres
          </AnimatedLink>
        )}
      </section>

      <div className="px-5 sm:px-8 lg:px-12 pt-9">
        {error && (
          <div className="p-6 bg-danger-wash rounded-[var(--radius-md)] text-center max-w-lg mb-8">
            <p className="text-danger text-sm">{error}</p>
          </div>
        )}

        {!selectedGenre && (
          <section>
            {loadingGenres ? (
              <div className="h-[420px] bg-surface-1 rounded-[var(--radius-lg)] animate-pulse" />
            ) : genres.length === 0 ? (
              <div className="py-16 text-center max-w-md mx-auto space-y-2">
                <LayoutGrid size={28} className="text-text-tertiary mx-auto" strokeWidth={1.5} />
                <h3 className="font-display text-lg text-text-primary">No genres yet</h3>
              </div>
            ) : (
              <div className="h-[420px] sm:h-[480px] rounded-[var(--radius-lg)] bg-surface-1 overflow-hidden">
                <PerspectiveCarousel
                  items={carouselItems}
                  activeIndex={activeIndex}
                  onActiveIndexChange={setActiveIndex}
                  loop
                  slideWidth={220}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      handleSelectGenre(genres[activeIndex]);
                    }
                  }}
                  slideClassName="cursor-pointer"
                  imageClassName="rounded-[var(--radius-md)]"
                  labelClassName="font-display italic text-text-primary text-base mt-1"
                  controlsClassName="!border-0 !bg-surface-0/80 !text-text-secondary backdrop-blur-md"
                />
              </div>
            )}

            {!loadingGenres && genres.length > 0 && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={() => handleSelectGenre(genres[activeIndex])}
                  className="px-5 py-2.5 rounded-[var(--radius-pill)] bg-accent hover:bg-accent-strong text-text-on-accent text-sm font-semibold transition-colors cursor-pointer"
                >
                  Explore {genres[activeIndex]?.name}
                </button>
              </div>
            )}
          </section>
        )}

        {selectedGenre && (
          <section className="space-y-5">
            <h2 className="text-lg font-semibold text-text-primary font-body">
              Tracks in {selectedGenre.name}{' '}
              <span className="text-text-tertiary font-normal text-sm">· {songs.length}</span>
            </h2>

            <MusicGrid
              songs={songs}
              loading={loadingSongs}
              onPlaySong={handlePlaySong}
              emptyMessage={`No songs found in ${selectedGenre.name} yet.`}
            />
          </section>
        )}
      </div>
    </div>
  );
};
