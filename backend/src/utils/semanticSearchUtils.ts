export interface SongSemanticInput {
  _id?: any;
  title: string;
  artist?: any;
  featuredArtists?: any[];
  album?: any;
  genre?: any;
  mood?: string;
  language?: string;
  tags?: string[];
  releaseYear?: number;
  audioFeatures?: {
    bpm?: number;
    key?: string;
    energy?: number;
    danceability?: number;
    valence?: number;
    acousticness?: number;
    instrumentalness?: number;
    liveness?: number;
    speechiness?: number;
  };
}

/**
 * Deterministically extracts entity name string from populated ObjectId object or string.
 */
function extractName(field: any, defaultFallback = ''): string {
  if (!field) return defaultFallback;
  if (typeof field === 'object' && field !== null) {
    if ('name' in field) return String(field.name || '').trim();
    if ('title' in field) return String(field.title || '').trim();
    if ('_id' in field) return String(field._id || '').trim();
  }
  return String(field).trim();
}

/**
 * Reusable function that converts a song's important metadata (title, artist, album, genre,
 * mood, language, audio characteristics, and tags) into a deterministic searchable text representation
 * prepared for semantic search embeddings.
 */
export function generateSongSemanticText(song: SongSemanticInput): string {
  if (!song) return '';

  const title = String(song.title || '').trim();
  const artistName = extractName(song.artist, 'Unknown Artist');

  // Featured Artists
  const featuredNames = Array.isArray(song.featuredArtists)
    ? song.featuredArtists.map((a) => extractName(a)).filter(Boolean)
    : [];

  const albumTitle = extractName(song.album, '');
  const genreName = extractName(song.genre, '');
  const mood = String(song.mood || '').trim();
  const language = String(song.language || '').trim();
  const releaseYear = song.releaseYear ? String(song.releaseYear) : '';

  // Tags (Sorted deterministically)
  const tagsList = Array.isArray(song.tags)
    ? [...song.tags].map((t) => String(t).trim().toLowerCase()).sort()
    : [];

  // Audio Characteristics (Formated deterministically)
  const af = song.audioFeatures || {};
  const audioParts: string[] = [];

  if (typeof af.bpm === 'number' && !isNaN(af.bpm)) {
    audioParts.push(`${af.bpm} BPM`);
  }
  if (af.key && String(af.key).trim()) {
    audioParts.push(`Key ${String(af.key).trim()}`);
  }
  if (typeof af.energy === 'number' && !isNaN(af.energy)) {
    audioParts.push(`Energy ${af.energy.toFixed(2)}`);
  }
  if (typeof af.danceability === 'number' && !isNaN(af.danceability)) {
    audioParts.push(`Danceability ${af.danceability.toFixed(2)}`);
  }
  if (typeof af.valence === 'number' && !isNaN(af.valence)) {
    audioParts.push(`Valence ${af.valence.toFixed(2)}`);
  }
  if (typeof af.acousticness === 'number' && !isNaN(af.acousticness)) {
    audioParts.push(`Acousticness ${af.acousticness.toFixed(2)}`);
  }

  // Construct deterministic structured text clauses
  const clauses: string[] = [];

  if (title) clauses.push(`Title: ${title}`);
  if (artistName) clauses.push(`Artist: ${artistName}`);
  if (featuredNames.length > 0) clauses.push(`Featured Artists: ${featuredNames.join(', ')}`);
  if (albumTitle) clauses.push(`Album: ${albumTitle}`);
  if (genreName) clauses.push(`Genre: ${genreName}`);
  if (mood) clauses.push(`Mood: ${mood}`);
  if (language) clauses.push(`Language: ${language}`);
  if (releaseYear) clauses.push(`Release Year: ${releaseYear}`);
  if (audioParts.length > 0) clauses.push(`Audio Characteristics: ${audioParts.join(', ')}`);
  if (tagsList.length > 0) clauses.push(`Tags: ${tagsList.join(', ')}`);

  return clauses.join('. ') + '.';
}

/**
 * Returns a complete semantic document representation with ID and summary metadata.
 */
export function generateSongSemanticDocument(song: SongSemanticInput): {
  songId: string;
  semanticText: string;
  metadataSummary: Record<string, any>;
} {
  const songId = song._id ? String(song._id) : '';
  const semanticText = generateSongSemanticText(song);

  return {
    songId,
    semanticText,
    metadataSummary: {
      title: song.title,
      artist: extractName(song.artist),
      genre: extractName(song.genre),
      mood: song.mood,
      language: song.language,
    },
  };
}
