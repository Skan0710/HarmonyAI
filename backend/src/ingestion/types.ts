export interface IngestionTrack {
  title: string;
  artistName: string;
  albumTitle?: string;
  itunesTrackId?: number;
  itunesCollectionId?: number;
  duration: number; // in seconds
  coverImage?: string;
  releaseYear?: number;
  genreKey: string;
  explicit?: boolean;
  trackNumber?: number;
  isrc?: string;
  language?: string;
}

export interface IngestionAlbum {
  title: string;
  artistName: string;
  itunesCollectionId?: number;
  coverImage?: string;
  releaseYear?: number;
  genreKey: string;
  albumType: 'album' | 'ep' | 'single' | 'compilation';
  totalTracks?: number;
}

export interface IngestionArtist {
  name: string;
  genreKey: string;
  bio?: string;
  image?: string;
  tags?: string[];
  itunesArtistId?: number;
  musicbrainzId?: string;
}

export interface IngestionOptions {
  targetTracks?: number;
  batchSize?: number;
  isTest?: boolean;
  testArtistLimit?: number;
  genres?: string[];
  dryRun?: boolean;
}

export interface IngestionReport {
  existingSongsPreserved: number;
  existingArtistsPreserved: number;
  existingAlbumsPreserved: number;
  newArtistsImported: number;
  newAlbumsImported: number;
  newSongsImported: number;
  duplicateTracksSkipped: number;
  nonEnglishFiltered: number;
  errors: string[];
}
