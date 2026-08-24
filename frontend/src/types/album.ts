import type { Artist } from './artist';

export interface Album {
  _id: string;
  title: string;
  artist?: Artist | string;
  coverImage?: string;
  releaseYear?: number;
  albumType?: string;
  totalTracks?: number;
}
