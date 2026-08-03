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
  profileImage?: string;
  avatar?: string;
  bannerImage?: string;
  genres: Types.ObjectId[];
  socialLinks?: ISocialLinks;
  monthlyListeners: number;
  verified: boolean;
  tags: string[];
  // Recommendation extensibility fields
  similarArtists?: Types.ObjectId[];
  vectorEmbedding?: number[];
  recommendationMetadata?: Record<string, any>;
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
    profileImage: {
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
      min: [0, 'Monthly listeners cannot be negative'],
    },
    verified: {
      type: Boolean,
      default: false,
    },
    tags: {
      type: [String],
      default: [],
    },
    similarArtists: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Artist',
      },
    ],
    vectorEmbedding: {
      type: [Number],
      default: undefined,
    },
    recommendationMetadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

artistSchema.pre('save', function () {
  if (this.profileImage && !this.avatar) {
    this.avatar = this.profileImage;
  } else if (this.avatar && !this.profileImage) {
    this.profileImage = this.avatar;
  }
});

artistSchema.index({ name: 'text', tags: 'text' });
artistSchema.index({ monthlyListeners: -1 });

export const Artist = model<IArtist>('Artist', artistSchema);
