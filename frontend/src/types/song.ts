import type { Artist } from './artist';
import type { Album } from './album';
import type { Genre } from './genre';
import type { AudioFeatures } from './audio';

export interface Song {
  _id: string;
  title: string;
  artist: Artist | string;
  featuredArtists?: (Artist | string)[];
  album?: Album | string;
  genre: Genre | string;
  duration: number; // in seconds
  coverImage?: string;
  audioUrl: string;
  releaseYear?: number;
  playCount: number;
  audioFeatures?: AudioFeatures;
  mood?: string;
  tags?: string[];
  language?: string;
  explicit?: boolean;
  createdAt?: string;
}
