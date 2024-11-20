// src/models/Post.js
const mongoose = require("mongoose");

const PostSchema = new mongoose.Schema({
  title: { type: String, required: true },
  img_path: { type: String, required: false },
  content: { type: String, required: true },
  user_id: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
  Creation_time: {
    type: Date,
    default: Date.now,
    index: true,
  },
});
PostSchema.index({ user_id: 1, Creation_time: -1 });
module.exports = mongoose.model("Post", PostSchema);
