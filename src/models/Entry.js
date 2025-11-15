import mongoose from "mongoose";

const entrySchema = new mongoose.Schema(
  {
    reviewer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    gameid: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Game",
      required: true,
    },
    review: { type: String, required: true },
    date: { type: Date, required: true },
    playedOnPlatform: { type: Number, required: true },
  },
  { timestamps: true }
);

// This enforces une review per user per game per platform (only one review for the same game on the same platform)
entrySchema.index(
  { reviewer: 1, gameid: 1, playedOnPlatform: 1 },
  { unique: true }
);

const Entry = mongoose.model("Entry", entrySchema);
export default Entry;
