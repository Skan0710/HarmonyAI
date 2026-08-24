import type { Song } from './song';

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
