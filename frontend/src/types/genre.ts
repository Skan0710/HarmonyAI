export interface Genre {
  _id: string;
  name: string;
  slug?: string;
  description?: string;
  coverImage?: string;
  songCount?: number;
}
