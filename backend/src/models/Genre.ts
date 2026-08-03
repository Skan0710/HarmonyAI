import { Schema, model, Document, Types } from 'mongoose';

export interface IGenre extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  description?: string;
  coverImage?: string;
  parentGenre?: Types.ObjectId;
  tags: string[];
  isFeatured: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const genreSchema = new Schema<IGenre>(
  {
    name: {
      type: String,
      required: [true, 'Genre name is required'],
      unique: true,
      trim: true,
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      default: '',
    },
    coverImage: {
      type: String,
      default: '',
    },
    parentGenre: {
      type: Schema.Types.ObjectId,
      ref: 'Genre',
      default: null,
    },
    tags: {
      type: [String],
      default: [],
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

genreSchema.pre('save', function () {
  if (this.isModified('name') || !this.slug) {
    this.slug = this.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/[\s-]+/g, '-');
  }
});

export const Genre = model<IGenre>('Genre', genreSchema);
