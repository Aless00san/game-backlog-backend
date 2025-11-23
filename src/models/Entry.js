import mongoose from 'mongoose';

const entrySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    gameid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game',
      required: true,
    },
    playedOnPlatform: { type: Number, required: true },
    status: {
      type: String,
      enum: ['Backlog', 'Playing', 'Completed'],
      default: 'Backlog',
      required: true,
    },
  },
  { timestamps: true }
);

// This enforces one review per user per game per platform (only one review for the same game on the same platform)
entrySchema.index(
  { user: 1, gameid: 1, playedOnPlatform: 1 },
  { unique: true }
);

const Entry = mongoose.model('Entry', entrySchema);
export default Entry;
