import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Playlist, Song } from '../types/music';
import { fetchPlaylistByIdApi, removeSongFromPlaylistApi, deletePlaylistApi } from '../services/playlistService';
import { usePlayerStore } from '../store/usePlayerStore';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { formatTime } from '../utils/formatters';

export const PlaylistDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const playSong = usePlayerStore((state) => state.playSong);

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlaylist = async () => {
    if (!id) return;
    setLoading(true);
    setError(null);

    const { playlist: data, error: err } = await fetchPlaylistByIdApi(id);

    if (err) {
      setError(err);
    } else if (data) {
      setPlaylist(data);
    }

    setLoading(false);
  };

  useEffect(() => {
    loadPlaylist();
  }, [id]);

  const handlePlayAll = () => {
    if (playlist && playlist.songs && playlist.songs.length > 0) {
      playSong(playlist.songs[0], playlist.songs);
    }
  };

  const handlePlaySong = (song: Song) => {
    if (playlist && playlist.songs) {
      playSong(song, playlist.songs);
    }
  };

  const handleRemoveSong = async (songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!id) return;

    const { playlist: updated, error: err } = await removeSongFromPlaylistApi(id, songId);

    if (err) {
      alert(err);
    } else if (updated) {
      setPlaylist(updated);
    }
  };

  const handleDeletePlaylist = async () => {
    if (!id || !window.confirm('Are you sure you want to delete this playlist?')) return;

    const { success, error: err } = await deletePlaylistApi(id);

    if (success) {
      navigate('/playlists', { replace: true });
    } else {
      alert(err || 'Failed to delete playlist');
    }
  };

  const getArtistName = (artist: any): string => {
    if (!artist) return 'Unknown Artist';
    if (typeof artist === 'object' && 'name' in artist) {
      return artist.name;
    }
    return String(artist);
  };

  const fallbackCover =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="%23818cf8" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231e293b;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

  return (
    <div className="space-y-8 pb-16">
      <Breadcrumbs
        items={[
          { label: 'Playlists', path: '/playlists' },
          { label: playlist ? playlist.name : 'Playlist Details' },
        ]}
      />

      {loading && (
        <div className="h-64 bg-slate-800/60 rounded-3xl animate-pulse w-full" />
      )}

      {error && !loading && (
        <div className="p-6 bg-slate-800/60 border border-rose-500/30 rounded-2xl text-center max-w-lg mx-auto space-y-3">
          <p className="text-rose-400 font-medium text-sm">{error}</p>
          <button
            onClick={() => navigate('/playlists')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-xl"
          >
            ← Back to Playlists
          </button>
        </div>
      )}

      {!loading && !error && playlist && (
        <>
          {/* Header Banner */}
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border border-indigo-500/20 p-6 sm:p-10 shadow-2xl backdrop-blur-xl">
            <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-end gap-6">
              <img
                src={playlist.coverImage || fallbackCover}
                alt={playlist.name}
                className="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl object-cover bg-slate-800 shrink-0 border border-slate-700/60 shadow-2xl"
              />

              <div className="flex-1 text-center sm:text-left space-y-2 min-w-0">
                <span className="px-3 py-1 bg-indigo-500/20 text-indigo-300 text-xs font-bold uppercase tracking-wider rounded-full border border-indigo-500/30">
                  {playlist.visibility || 'Public'} Playlist
                </span>

                <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight truncate">
                  {playlist.name}
                </h1>

                {playlist.description && (
                  <p className="text-slate-300 text-sm max-w-2xl line-clamp-2">
                    {playlist.description}
                  </p>
                )}

                <div className="flex items-center justify-center sm:justify-start gap-4 pt-1 text-xs text-slate-400">
                  <span>
                    Created by{' '}
                    <strong className="text-slate-200">
                      {typeof playlist.owner === 'object' ? playlist.owner.name : 'User'}
                    </strong>
                  </span>
                  <span>•</span>
                  <span className="font-mono text-indigo-400 font-semibold">
                    {playlist.songs ? playlist.songs.length : 0} tracks
                  </span>
                </div>
              </div>

              {/* Header Buttons */}
              <div className="flex items-center gap-3 shrink-0">
                {playlist.songs && playlist.songs.length > 0 && (
                  <button
                    onClick={handlePlayAll}
                    className="px-6 py-3.5 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-2xl shadow-xl shadow-indigo-600/30 hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5"
                  >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    <span>Play All</span>
                  </button>
                )}

                <button
                  onClick={handleDeletePlaylist}
                  className="p-3.5 bg-slate-800/80 hover:bg-rose-950/80 text-slate-400 hover:text-rose-300 rounded-2xl border border-slate-700/80 transition-colors"
                  title="Delete Playlist"
                  aria-label="Delete Playlist"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Playlist Track List */}
          {!playlist.songs || playlist.songs.length === 0 ? (
            <div className="py-16 text-center max-w-md mx-auto space-y-3">
              <div className="w-16 h-16 rounded-full bg-slate-800/80 border border-slate-700 text-indigo-400 flex items-center justify-center mx-auto">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-slate-200">This playlist is empty</h3>
              <p className="text-slate-400 text-xs">
                Add songs from the Music Library or Search page to build your playlist.
              </p>
            </div>
          ) : (
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-xl space-y-2">
              <div className="hidden sm:grid grid-cols-12 text-xs font-semibold text-slate-400 px-4 py-2 border-b border-slate-800 uppercase tracking-wider">
                <span className="col-span-1">#</span>
                <span className="col-span-6">Title</span>
                <span className="col-span-3">Artist</span>
                <span className="col-span-1 text-right">Duration</span>
                <span className="col-span-1 text-right">Action</span>
              </div>

              {playlist.songs.map((song, idx) => (
                <div
                  key={song._id || idx}
                  onClick={() => handlePlaySong(song)}
                  className="group cursor-pointer rounded-xl p-3 sm:px-4 sm:py-3 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-800 hover:border-slate-700/80 transition-all flex sm:grid sm:grid-cols-12 items-center justify-between gap-3"
                >
                  <span className="hidden sm:inline col-span-1 text-xs font-mono text-slate-500 group-hover:text-indigo-400">
                    {idx + 1}
                  </span>

                  <div className="col-span-6 flex items-center gap-3 min-w-0">
                    <img
                      src={song.coverImage || fallbackCover}
                      alt={song.title}
                      className="w-10 h-10 rounded-lg object-cover bg-slate-800 shrink-0 border border-slate-700/60"
                    />
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-indigo-300 truncate">
                        {song.title}
                      </h4>
                      <p className="text-[11px] text-slate-400 truncate sm:hidden">
                        {getArtistName(song.artist)}
                      </p>
                    </div>
                  </div>

                  <div className="hidden sm:block col-span-3 text-xs text-slate-300 truncate">
                    {getArtistName(song.artist)}
                  </div>

                  <div className="col-span-1 text-right text-xs font-mono text-slate-400">
                    {formatTime(song.duration)}
                  </div>

                  <div className="col-span-1 text-right">
                    <button
                      onClick={(e) => handleRemoveSong(song._id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-rose-400 rounded transition-opacity"
                      title="Remove from Playlist"
                      aria-label="Remove from Playlist"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};
