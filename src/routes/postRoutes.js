// routes/postRoutes.js
const express = require("express");
require("dotenv").config();
const router = express.Router();
const PostController = require("../controllers/postController");
const CommentController = require("../controllers/commentController");
const { validateToken,extractUserId } = require("../middleware/authMiddleware");
// 睇posts
router.get("/", PostController.getAllPosts);
//創建文章
router.post("/create-post", validateToken, PostController.createPost);
//睇帶有評論的帖子：
router.get("/:postId",extractUserId,PostController.getPostWithComments);
// 評論
// 獲取帖子的評論：/router.get '/'
router.get(
  "/:postId/comments",
  CommentController.getPostComments
);
//////提交評論
router.post(
  "/:postId/comments",
  validateToken,
  CommentController.createComment
);
//// Like  點讚評論：
router.post(
  "/:postId/comments/:commentId/like",
  validateToken,
  CommentController.toggleLike
);
//dislike 踩評論
router.post(
  "/:postId/comments/:commentId/dislike",
  validateToken,
  CommentController.toggleDislike
);

///獲取文章的相關推薦
router.get("/recommendations/:postId", PostController.getRecommendations);
module.exports = router;
