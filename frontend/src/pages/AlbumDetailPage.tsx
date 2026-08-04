import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import type { Album, Song } from '../types/music';
import { fetchAlbumById, fetchSongs, recordSongPlay } from '../services/songService';
import { MusicGrid } from '../components/MusicGrid';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { AudioPlayer } from '../components/AudioPlayer';

export const AlbumDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [album, setAlbum] = useState<Album | null>(null);
  const [albumSongs, setAlbumSongs] = useState<Song[]>([]);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [imgError, setImgError] = useState<boolean>(false);
  const [currentPlayingSong, setCurrentPlayingSong] = useState<Song | null>(null);

  useEffect(() => {
    if (!id) return;

    const loadAlbumData = async () => {
      setLoading(true);
      setError(null);
      setImgError(false);

      const res = await fetchAlbumById(id);

      if (res.error || !res.album) {
        setError(res.error || 'Album details not found');
        setAlbum(null);
      } else {
        setAlbum(res.album);

        const songsRes = await fetchSongs({ albumId: id, limit: 50 });
        if (songsRes.songs) {
          setAlbumSongs(songsRes.songs);
        }
      }

      setLoading(false);
    };

    loadAlbumData();
  }, [id]);

  const handlePlaySong = (song: Song) => {
    if (currentPlayingSong?._id === song._id) {
      setCurrentPlayingSong(null);
    } else {
      setCurrentPlayingSong(song);
      recordSongPlay(song._id);
    }
  };

  const getArtistId = (): string | null => {
    if (!album?.artist) return null;
    if (typeof album.artist === 'object' && '_id' in album.artist) {
      return (album.artist as { _id: string })._id;
    }
    return String(album.artist);
  };

  const getArtistName = (): string => {
    if (!album?.artist) return 'Various Artists';
    if (typeof album.artist === 'object' && 'name' in album.artist) {
      return (album.artist as { name: string }).name;
    }
    return String(album.artist);
  };

  const fallbackCover =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 24 24" fill="none" stroke="%23818cf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231e293b;"><rect x="4" y="4" width="16" height="16" rx="2"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/></svg>';

  const coverUrl = imgError || !album?.coverImage ? fallbackCover : album?.coverImage;
  const artistId = getArtistId();

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto space-y-8 py-8 animate-pulse">
        <div className="h-4 bg-slate-800 rounded w-1/3 mb-4" />
        <div className="flex flex-col sm:flex-row gap-8">
          <div className="w-56 h-56 bg-slate-800 rounded-2xl" />
          <div className="space-y-4 flex-1">
            <div className="h-6 bg-slate-800 rounded w-1/4" />
            <div className="h-8 bg-slate-800 rounded w-3/4" />
            <div className="h-4 bg-slate-800 rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !album) {
    return (
      <div className="max-w-md mx-auto my-12 p-8 bg-slate-800/60 border border-slate-700/60 rounded-2xl text-center">
        <div className="w-14 h-14 rounded-full bg-rose-500/10 text-rose-400 flex items-center justify-center mx-auto mb-4">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-slate-100 mb-2">Album Not Found</h2>
        <p className="text-sm text-slate-400 mb-6">{error || 'The requested album could not be found.'}</p>
        <button
          onClick={() => navigate('/library')}
          className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl transition-colors shadow-lg shadow-indigo-600/30"
        >
          Explore Music Library
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-16">
      {/* Breadcrumbs Navigation */}
      <Breadcrumbs
        items={[
          { label: 'Music Library', path: '/library' },
          { label: 'Albums' },
          { label: album.title },
        ]}
      />

      {/* Album Header Hero Section */}
      <div className="relative overflow-hidden bg-slate-900/90 border border-slate-800 rounded-3xl p-6 sm:p-10 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-8 z-10 relative">
          <div className="relative w-52 h-52 sm:w-60 sm:h-60 rounded-2xl overflow-hidden bg-slate-800 border-2 border-slate-700/80 shadow-2xl shrink-0">
            <img
              src={coverUrl}
              alt={album.title}
              onError={() => setImgError(true)}
              className="w-full h-full object-cover"
            />
          </div>

          <div className="flex-1 space-y-4 text-center sm:text-left">
            <div>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mb-1.5">
                <span className="text-xs font-bold uppercase tracking-wider text-indigo-400">
                  {album.albumType || 'Album'}
                </span>
                {album.releaseYear && (
                  <span className="text-xs text-slate-400 bg-slate-800 px-2.5 py-0.5 rounded-md border border-slate-700">
                    {album.releaseYear}
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                {album.title}
              </h1>

              <div className="mt-2 flex items-center justify-center sm:justify-start gap-2 text-base text-slate-300">
                <span className="text-slate-400">By</span>
                {artistId ? (
                  <Link
                    to={`/artists/${artistId}`}
                    className="font-bold text-indigo-400 hover:text-indigo-300 hover:underline transition-colors flex items-center gap-1.5"
                  >
                    {getArtistName()}
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </Link>
                ) : (
                  <span className="font-bold text-slate-200">{getArtistName()}</span>
                )}
              </div>
            </div>

            <div className="inline-flex items-center gap-4 p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-xs text-slate-300">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Total Songs</span>
                <span className="font-bold text-slate-100 text-sm">{albumSongs.length || album.totalTracks || 1} tracks</span>
              </div>
              <div className="w-px h-6 bg-slate-800" />
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Release Year</span>
                <span className="font-bold text-indigo-300 text-sm">{album.releaseYear || 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-100 tracking-tight">
              Tracklist ({albumSongs.length} Songs)
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-0.5">
              Click any song card to view full details or hit play to listen directly.
            </p>
          </div>
        </div>

        <MusicGrid
          songs={albumSongs}
          loading={false}
          onPlaySong={handlePlaySong}
          currentSongId={currentPlayingSong?._id}
          emptyMessage={`No songs uploaded under "${album.title}" yet.`}
        />
      </section>

      {/* Audio Player Bar */}
      <AudioPlayer song={currentPlayingSong} onClose={() => setCurrentPlayingSong(null)} />
    </div>
  );
};
