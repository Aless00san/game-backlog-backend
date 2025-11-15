import mongoose from "mongoose";

const platformSchema = new mongoose.Schema({
  _id: Number,
  name: String,
  slug: String,
});

export default mongoose.model("Platform", platformSchema);
