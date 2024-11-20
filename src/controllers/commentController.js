// controllers/commentController.js
const Comment = require("../models/Comment");
const mongoose = require("mongoose");
const { formatComment } = require("../utils/responseFormatter");

class CommentController {
  // 獲取帖子的評論：/router.get '/'
  static async getPostComments(req, res) {
    try {
      const comments = await Comment.find({ postId: req.params.postId })
        .sort({ creationTime: -1 })
        .populate("user_id", "username name role");
      res.json(comments.map(formatComment));
      //   comments.map(
      // (comment) => ({
      // _id: comment._id,
      // content: comment.content,
      // likes: comment.likes,
      // Creation_time: new Date(comment.Creation_time).toLocaleString("en-US", {
      //   timeZone: "Asia/Shanghai",
      // }
      // ),
      //     user: {
      //       _id: comment.user_id._id,
      //       username: comment.user_id.username,
      //       status: comment.user_id.status,
      //     },
      //   })
      // )
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ error: error.message });
    }
  }
  ///
  //////提交評論
  //////router.post('/:postId/comments',
  static async createComment(req, res) {
    try {
      const { content } = req.body;
      const { postId } = req.params;
      const user_id = req.userId;
      console.log(user_id);
      const creationTime = new Date();
      const user = await mongoose.model("User").findById(user_id);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      //創建一個新的 Comment 實例
      const newComment = new Comment({
        postId,
        user_id,
        content,
        Creation_time: new Date(),
      });
      const savedComment = await newComment.save();
      const populatedComment = await Comment.findById(
        savedComment._id
      ).populate("user_id", "username name role");
      res.status(201).json(formatComment(populatedComment));
    } catch (error) {
      console.error("Error creating comment:", error);
      res.status(500).json({
        error: error.message,
        stack: process.env.NODE_ENV === "development" ? error.stack : undefined, // This will help debug any mongoose errors
      });
    }
  }

  //
  // Like  點讚評論：
  //
  //創建了一個單獨的 updateLikeStatus 方法，該方法使用 MongoDB 的原子運算符在單個操作中處理資料庫更新。
  static async updateLikeStatus(commentId, userId, hasLiked) {
    const updateOperation = hasLiked
      ? //     Used $set and $pull operators to manage the likingUsers map efficiently.
        // 使用 $set和 $pull 運算符來有效地管理 likingUsers 映射
        {
          $unset: { [`likingUsers.${userId}`]: "" },
          // 使用 $inc 運算符以原子方式遞增/遞減點讚數。
          $inc: { likes: -1 },
        }
      : {
          $set: { [`likingUsers.${userId}`]: true },
          $inc: { likes: 1 },
        };
    //將 findByIdAndUpdate 與 { new： true } 結合使用，以在單個查詢中獲取更新的文檔。
    return Comment.findByIdAndUpdate(commentId, updateOperation, {
      new: true,
      runValidators: true,
    }).populate("user_id", "username name role");
  }

  static async updateDislikeStatus(commentId, userId, hasDisliked) {
    const updateOperation = hasDisliked
      ? {
          $unset: { [`dislikingUsers.${userId}`]: "" },
          $inc: { dislikes: -1 },
        }
      : {
          $set: { [`dislikingUsers.${userId}`]: true },
          $inc: { dislikes: 1 },
        };
    return Comment.findByIdAndUpdate(commentId, updateOperation, {
      new: true,
      runValidators: true,
    }).populate("user_id", "username name role");
  }
  //
  // 點讚評論
  //
  static async toggleLike(req, res) {
    try {
      const user_id = req.userId;
      // Expecting user_id from the request body
      // Find the comment by commentId
      const { commentId } = req.params;

      // First, check if comment exists and get current like status
      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }

      // 檢查使用者是否已經點讚該評論
      const hasLiked = comment.likingUsers.get(user_id);
      //檢查使用者是否已經點過踩
      const hasDisliked = comment.dislikingUsers.get(user_id);
      //如果使用者已經點過踩，則取消踩
      if (hasDisliked) {
        await CommentController.updateDislikeStatus(commentId, user_id, true);
      }

      // 使用單次數據庫操作完成所有更新
      const updatedComment = await CommentController.updateLikeStatus(
        commentId,
        user_id,
        hasLiked
      );
      if (!updatedComment) {
        return res.status(404).json({ message: "Failed to update comment" });
      }

      res.json({
        ...formatComment(updatedComment),
        hasLiked: !hasLiked,
        hasDisliked: false,
      });
    } catch (error) {
      console.error("Error toggling like:", error);
      res.status(500).json({ error: error.message });
    }
  }

  static async toggleDislike(req, res) {
    try {
      const user_id = req.userId;
      const { commentId } = req.params;
      const comment = await Comment.findById(commentId);
      if (!comment) {
        return res.status(404).json({ message: "Comment not found" });
      }
      //檢查使用者是否已經點過踩
      const hasDisliked = comment.dislikingUsers.get(user_id);
      console.log(`Has Disliked: ${hasDisliked}`);
      //檢查使用者是否已經點過讚
      const hasLiked = comment.likingUsers.get(user_id);
      //如果使用者已經點過讚，則取消讚
      if (hasLiked) {
        await CommentController.updateLikeStatus(commentId, user_id, true);
      }
      //使用單次數據庫操作完成所有更新
      const updatedComment = await CommentController.updateDislikeStatus(
        commentId,
        user_id,
        hasDisliked,
      );
      if (!updatedComment) {
        return res.status(404).json({ message: "Failed to update comment" });
      }
      // Ensure the response includes the necessary fields
      res.json({
        ...formatComment(updatedComment),
        hasDisliked: !hasDisliked,
        hasLiked: false,
        dislikes: updatedComment.dislikes,
      });
    } catch (error) {
      console.error("Error toggling dislike:", error);
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = CommentController;
