/**
 * Barrel re-export: all music-related types.
 *
 * Prefer importing from the specific module (e.g. '../types/song') for new code.
 * This file re-exports everything for backward compatibility with existing imports.
 */

export type { Genre } from './genre';
export type { Artist } from './artist';
export type { Album } from './album';
export type { AudioFeatures } from './audio';
export type { Song } from './song';
export type { Playlist } from './playlist';
export type { PaginationData, SongsApiResponse } from './api';
