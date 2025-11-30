import mongoose from "mongoose";

const gameSchema = new mongoose.Schema(
  {
    rawgId: { type: String },
    steamgriddbId: { type: String },
    title: { type: String, required: true },
    imageUrl: { type: String, required: true },
    platforms: { type: [Number], required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Game", gameSchema);
