import mongoose from "mongoose";

const gameSchema = new mongoose.Schema(
  {
    rawgId: { type: String, required: false },
    steamgriddbId: { type: String, required: false },
    title: { type: String, required: true },
    imageUrl: { type: String, required: true },
    platform: { type: String, required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Game", gameSchema);
