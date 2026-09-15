import type { Song } from './song';

export interface Playlist {
  _id: string;
  name: string;
  description?: string;
  coverImage?: string;
  owner: { _id: string; name: string; profilePicture?: string } | string;
  songs: Song[];
  visibility?: 'public' | 'private';
  isCollaborative?: boolean;
  songCount?: number;
  createdAt?: string;
  updatedAt?: string;
}
