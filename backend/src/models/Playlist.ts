import { Schema, model, Document, Types } from 'mongoose';

export interface IPlaylist extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  coverImage?: string;
  owner: Types.ObjectId;
  songs: Types.ObjectId[];
  visibility: 'public' | 'private';
  collaborators?: Types.ObjectId[]; // Extensible for future collaborative playlists
  isCollaborative?: boolean; // Extensible for collaborative editing permissions
  createdAt: Date;
  updatedAt: Date;
}

const playlistSchema = new Schema<IPlaylist>(
  {
    name: {
      type: String,
      required: [true, 'Playlist name is required'],
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
    coverImage: {
      type: String,
      default: '',
    },
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    songs: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Song',
      },
    ],
    visibility: {
      type: String,
      enum: ['public', 'private'],
      default: 'public',
    },
    collaborators: [
      {
        type: Schema.Types.ObjectId,
        ref: 'User',
      },
    ],
    isCollaborative: {
      type: Boolean,
      default: false,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Index for fetching user's playlists efficiently
playlistSchema.index({ owner: 1, createdAt: -1 });

export const Playlist = model<IPlaylist>('Playlist', playlistSchema);
