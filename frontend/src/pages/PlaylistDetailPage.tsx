import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import type { Playlist, Song } from '../types/music';
import { fetchPlaylistByIdApi, removeSongFromPlaylistApi, deletePlaylistApi } from '../services/playlistService';
import { usePlayerStore } from '../store/usePlayerStore';
import { Breadcrumbs } from '../components/Breadcrumbs';
import { EditPlaylistModal } from '../components/EditPlaylistModal';
import { ConfirmDeleteModal } from '../components/ConfirmDeleteModal';
import { PlaylistSkeletonLoader } from '../components/PlaylistSkeletonLoader';
import { formatTime } from '../utils/formatters';

export const PlaylistDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const playSong = usePlayerStore((state) => state.playSong);

  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [deleting, setDeleting] = useState<boolean>(false);

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

  const handleConfirmDelete = async () => {
    if (!id) return;
    setDeleting(true);

    const { success, error: err } = await deletePlaylistApi(id);
    setDeleting(false);

    if (success) {
      setIsDeleteModalOpen(false);
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

  const totalDurationSecs = playlist?.songs
    ? playlist.songs.reduce((acc, song) => acc + (song.duration || 0), 0)
    : 0;

  const formatTotalDuration = (totalSeconds: number): string => {
    if (!totalSeconds) return '0 secs';
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
      return `${hours} hr ${minutes} mins`;
    }
    if (minutes > 0) {
      return `${minutes} mins ${seconds} secs`;
    }
    return `${seconds} secs`;
  };

  const fallbackCover =
    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 24 24" fill="none" stroke="%23d9a15b" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="background:%231b1815;"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

  return (
    <div className="space-y-8 pb-16">
      <Breadcrumbs
        items={[
          { label: 'Playlists', path: '/playlists' },
          { label: playlist ? playlist.name : 'Playlist Details' },
        ]}
      />

      {loading && <PlaylistSkeletonLoader />}

      {error && !loading && (
        <div className="p-8 bg-surface-1 border border-danger/30 rounded-[var(--radius-lg)] text-center max-w-lg mx-auto space-y-4">
          <div className="w-14 h-14 rounded-full bg-danger-wash text-danger flex items-center justify-center mx-auto">
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <p className="text-danger font-semibold text-sm">{error}</p>
          <div className="flex items-center justify-center gap-3 pt-2">
            <button
              onClick={loadPlaylist}
              className="px-4 py-2 bg-accent hover:bg-accent-strong text-text-on-accent text-xs font-bold rounded-[var(--radius-pill)] transition-colors cursor-pointer"
            >
              Retry
            </button>
            <button
              onClick={() => navigate('/playlists')}
              className="px-4 py-2 bg-surface-2 hover:bg-surface-3 text-text-secondary text-xs font-semibold rounded-[var(--radius-pill)] transition-colors cursor-pointer"
            >
              Back to Playlists
            </button>
          </div>
        </div>
      )}

      {!loading && !error && playlist && (
        <>
          {/* Header Banner */}
          <div className="relative overflow-hidden rounded-[var(--radius-lg)] bg-surface-1 border border-border-subtle p-6 sm:p-10">
            <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-end gap-6">
              <img
                src={playlist.coverImage || fallbackCover}
                alt={playlist.name}
                className="w-36 h-36 sm:w-44 sm:h-44 rounded-[var(--radius-artwork)] object-cover bg-surface-2 shrink-0 border border-border-subtle shadow-2xl"
              />

              <div className="flex-1 text-center sm:text-left space-y-2 min-w-0">
                <span className="px-3 py-1 bg-accent-wash text-accent text-xs font-bold uppercase tracking-wider rounded-[var(--radius-pill)] border border-accent/30">
                  {playlist.visibility || 'Public'} Playlist
                </span>

                <h1 className="font-display text-3xl sm:text-5xl text-text-primary tracking-tight truncate">
                  {playlist.name}
                </h1>

                {playlist.description && (
                  <p className="text-text-secondary text-sm max-w-2xl line-clamp-2">
                    {playlist.description}
                  </p>
                )}

                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 pt-1 text-xs text-text-tertiary">
                  <span>
                    Created by{' '}
                    <strong className="text-text-secondary">
                      {typeof playlist.owner === 'object' ? playlist.owner.name : 'User'}
                    </strong>
                  </span>
                  <span>•</span>
                  <span className="font-mono text-accent font-semibold">
                    {playlist.songs ? playlist.songs.length : 0} {playlist.songs?.length === 1 ? 'song' : 'songs'}
                  </span>
                  <span>•</span>
                  <span className="font-mono text-success font-semibold">
                    {formatTotalDuration(totalDurationSecs)}
                  </span>
                </div>
              </div>

              {/* Header Action Buttons */}
              <div className="flex items-center gap-3 shrink-0">
                {playlist.songs && playlist.songs.length > 0 && (
                  <button
                    onClick={handlePlayAll}
                    className="px-6 py-3.5 bg-accent hover:bg-accent-strong text-text-on-accent font-bold text-sm rounded-[var(--radius-pill)] hover:scale-105 active:scale-95 transition-all flex items-center gap-2.5 cursor-pointer"
                  >
                    <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    <span>Play All</span>
                  </button>
                )}

                {/* Edit Playlist Button */}
                <button
                  onClick={() => setIsEditModalOpen(true)}
                  className="p-3.5 bg-surface-2 hover:bg-accent/80 text-text-secondary hover:text-text-on-accent rounded-[var(--radius-lg)] border border-border-default transition-colors cursor-pointer"
                  title="Edit Playlist Details"
                  aria-label="Edit Playlist Details"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>

                {/* Delete Playlist Button */}
                <button
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="p-3.5 bg-surface-2 hover:bg-danger-wash text-text-tertiary hover:text-danger rounded-[var(--radius-lg)] border border-border-default transition-colors cursor-pointer"
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
              <div className="w-16 h-16 rounded-full bg-surface-1 border border-border-default text-accent flex items-center justify-center mx-auto">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-text-primary">This playlist is empty</h3>
              <p className="text-text-tertiary text-xs">
                Add songs from the Music Library or Search page to build your playlist.
              </p>
            </div>
          ) : (
            <div className="bg-surface-1 border border-border-subtle rounded-[var(--radius-lg)] p-4 sm:p-6 space-y-2">
              <div className="hidden sm:grid grid-cols-12 text-xs font-semibold text-text-tertiary px-4 py-2 border-b border-border-subtle uppercase tracking-wider">
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
                  className="group cursor-pointer rounded-[var(--radius-md)] p-3 sm:px-4 sm:py-3 bg-surface-0/40 hover:bg-surface-2 border border-border-subtle hover:border-border-default transition-all flex sm:grid sm:grid-cols-12 items-center justify-between gap-3"
                >
                  <span className="hidden sm:inline col-span-1 text-xs font-mono text-text-tertiary group-hover:text-accent">
                    {idx + 1}
                  </span>

                  <div className="col-span-6 flex items-center gap-3 min-w-0">
                    <img
                      src={song.coverImage || fallbackCover}
                      alt={song.title}
                      className="w-10 h-10 rounded-[var(--radius-sm)] object-cover bg-surface-2 shrink-0 border border-border-subtle"
                    />
                    <div className="min-w-0">
                      <h4 className="text-xs sm:text-sm font-semibold text-text-primary group-hover:text-accent truncate">
                        {song.title}
                      </h4>
                      <p className="text-[11px] text-text-tertiary truncate sm:hidden">
                        {getArtistName(song.artist)}
                      </p>
                    </div>
                  </div>

                  <div className="hidden sm:block col-span-3 text-xs text-text-secondary truncate">
                    {getArtistName(song.artist)}
                  </div>

                  <div className="col-span-1 text-right text-xs font-mono text-text-tertiary">
                    {formatTime(song.duration)}
                  </div>

                  <div className="col-span-1 text-right">
                    <button
                      onClick={(e) => handleRemoveSong(song._id, e)}
                      className="opacity-0 group-hover:opacity-100 p-1 text-text-tertiary hover:text-danger rounded-[var(--radius-sm)] transition-opacity cursor-pointer"
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

          {/* Edit Playlist Modal Dialog */}
          <EditPlaylistModal
            playlist={playlist}
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            onSuccess={(updated) => setPlaylist(updated)}
          />

          {/* Confirm Delete Playlist Modal Dialog */}
          <ConfirmDeleteModal
            isOpen={isDeleteModalOpen}
            title={`Delete "${playlist.name}"?`}
            message="Are you sure you want to delete this playlist? This action cannot be undone."
            loading={deleting}
            onConfirm={handleConfirmDelete}
            onClose={() => setIsDeleteModalOpen(false)}
          />
        </>
      )}
    </div>
  );
};
