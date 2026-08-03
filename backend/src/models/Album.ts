import { Schema, model, Document, Types } from 'mongoose';

export type AlbumType = 'album' | 'single' | 'ep' | 'compilation';

export interface IAlbum extends Document {
  _id: Types.ObjectId;
  title: string;
  artist: Types.ObjectId;
  featuredArtists: Types.ObjectId[];
  genre?: Types.ObjectId;
  coverImage?: string;
  releaseYear?: number;
  releaseDate?: Date;
  albumType: AlbumType;
  totalTracks: number;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const albumSchema = new Schema<IAlbum>(
  {
    title: {
      type: String,
      required: [true, 'Album title is required'],
      trim: true,
      index: true,
    },
    artist: {
      type: Schema.Types.ObjectId,
      ref: 'Artist',
      required: [true, 'Primary artist is required'],
      index: true,
    },
    featuredArtists: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Artist',
      },
    ],
    genre: {
      type: Schema.Types.ObjectId,
      ref: 'Genre',
    },
    coverImage: {
      type: String,
      default: '',
    },
    releaseYear: {
      type: Number,
      min: 1800,
      max: 2100,
    },
    releaseDate: {
      type: Date,
    },
    albumType: {
      type: String,
      enum: ['album', 'single', 'ep', 'compilation'],
      default: 'album',
    },
    totalTracks: {
      type: Number,
      default: 1,
      min: 1,
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

albumSchema.index({ title: 'text', tags: 'text' });

export const Album = model<IAlbum>('Album', albumSchema);
