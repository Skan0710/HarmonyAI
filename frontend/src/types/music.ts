export interface Genre {
  _id: string;
  name: string;
  slug?: string;
  description?: string;
  coverImage?: string;
}

export interface Artist {
  _id: string;
  name: string;
  bio?: string;
  profileImage?: string;
  avatar?: string;
  monthlyListeners?: number;
  verified?: boolean;
}

export interface Album {
  _id: string;
  title: string;
  artist?: Artist | string;
  coverImage?: string;
  releaseYear?: number;
  albumType?: string;
  totalTracks?: number;
}

export interface AudioFeatures {
  bpm?: number;
  key?: string;
  energy?: number;
  danceability?: number;
  valence?: number;
  acousticness?: number;
}

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
  tags?: string[];
  explicit?: boolean;
  createdAt?: string;
}

export interface PaginationData {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface SongsApiResponse {
  success: boolean;
  data: Song[];
  pagination: PaginationData;
  message?: string;
}
