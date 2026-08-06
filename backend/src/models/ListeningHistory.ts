import { Schema, model, Document, Types } from 'mongoose';

export interface IListeningHistory extends Document {
  user: Types.ObjectId;
  song: Types.ObjectId;
  playedAt: Date;
}

const listeningHistorySchema = new Schema<IListeningHistory>(
  {
    user: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    song: {
      type: Schema.Types.ObjectId,
      ref: 'Song',
      required: true,
      index: true,
    },
    playedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

// Compound index for querying user history sorted by newest first
listeningHistorySchema.index({ user: 1, playedAt: -1 });

export const ListeningHistory = model<IListeningHistory>('ListeningHistory', listeningHistorySchema);
