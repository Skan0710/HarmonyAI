import { Schema, model, Document, Types } from 'mongoose';

export interface ISocialLinks {
  website?: string;
  spotify?: string;
  twitter?: string;
  instagram?: string;
}

export interface IArtist extends Document {
  _id: Types.ObjectId;
  name: string;
  bio?: string;
  avatar?: string;
  bannerImage?: string;
  genres: Types.ObjectId[];
  socialLinks?: ISocialLinks;
  monthlyListeners: number;
  verified: boolean;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
}

const artistSchema = new Schema<IArtist>(
  {
    name: {
      type: String,
      required: [true, 'Artist name is required'],
      trim: true,
      index: true,
    },
    bio: {
      type: String,
      default: '',
    },
    avatar: {
      type: String,
      default: '',
    },
    bannerImage: {
      type: String,
      default: '',
    },
    genres: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Genre',
      },
    ],
    socialLinks: {
      website: { type: String, default: '' },
      spotify: { type: String, default: '' },
      twitter: { type: String, default: '' },
      instagram: { type: String, default: '' },
    },
    monthlyListeners: {
      type: Number,
      default: 0,
      min: 0,
    },
    verified: {
      type: Boolean,
      default: false,
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

artistSchema.index({ name: 'text', tags: 'text' });

export const Artist = model<IArtist>('Artist', artistSchema);
