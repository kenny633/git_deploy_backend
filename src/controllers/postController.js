// controllers/postController.js
const Post = require("../models/Post");
const Comment = require("../models/Comment");
const { formatComment } = require("../utils/responseFormatter");
const { validateToken } = require("../middleware/authMiddleware");
const natural = require('natural');
const { TfIdf } = natural;
const nodejieba = require('nodejieba');

class PostController {
  // 睇posts
  static async getAllPosts(_, res) {
    try {
      const posts = await Post.find()
        .sort({ Creation_time: -1 })
        .populate("user_id", "username name role");
      res.json(posts);
    } catch (error) {
      console.error("Error fetching posts:", error);
      res
        .status(500)
        .json({ message: "Error fetching posts", error: error.message });
    }
  }

  //創建文章
  static async createPost(req, res) {
    try {
      const { title, img_path, content } = req.body;
      const user_id = req.userId;
      console.log(
        `Creating post with title: ${title}, img_path: ${img_path}, content: ${content}, user_id: ${user_id}`
      );

      const newPost = new Post({
        title,
        img_path,
        content,
        user_id,
        Creation_time: new Date(),
      });

      console.log("成功創建文章,文章編號：", newPost._id);
      // Save the post
      const savedPost = await newPost.save();
      // Log the saved post
      console.log("Saved post:", savedPost);

      // Send response with both message and postId
      res.status(201).json({
        message: "post_created",
        postId: savedPost._id.toString(),
      });
    } catch (error) {
      console.error("Error creating post:", error);
      res.status(500).json({
        message: "cannot_create_newPost",
        error: error.message,
      });
    }
  }
  //編輯帖子
  static async editPost(req, res) {
    try {
      const { postId } = req.params;
      const { title, img_path, content } = req.body;
      const userId = req.userId;

      // 檢查帖子是否存在且用戶是發帖人
      const post = await Post.findOne({ _id: postId, user_id: userId });
      if (!post) {
        return res
          .status(404)
          .json({ message: "Post not found or unauthorized" });
      }

      // 更新帖子
      post.title = title || post.title;
      post.img_path = img_path || post.img_path;
      post.content = content || post.content;

      const updatedPost = await post.save();
      const populatedPost = await Post.findById(updatedPost._id).populate(
        "user_id",
        "username name role"
      );

      res.json({ message: "Post updated successfully", post: populatedPost });
    } catch (error) {
      console.error("Error updating post:", error);
      res
        .status(500)
        .json({ message: "Error updating post", error: error.message });
    }
  }
  //睇帶有評論的帖子：// router.get("/:postId"
// controllers/commentController.js
static async getPostWithComments(req, res) {
  try {
    const { postId } = req.params;
    const post = await Post.findById(postId).populate(
      "user_id",
      "username name role"
    );
    if (!post) {
      return res.status(404).json({ message: "Post not found" });
    }

    // Get comments for this post with populated user data
    const comments = await Comment.find({ postId })
      .sort({ Creation_time: -1 })
      .populate("user_id", "username name role");

    // Check if the user is logged in
    let userId = req.userId; // Assuming userId is already set in the request
    // userId = '67360493f86783ed1c4890fb'
    const userCommentStatus = {};
    console.log("Checking comment status for user:", userId);
    if (userId) {
      console.log("User is logged in, checking comment status");
      // For each comment, check if the user has liked or disliked it
      for (let comment of comments) {
        userCommentStatus[comment._id] = {
          hasLiked: comment.likingUsers.has(userId) || false,
          hasDisliked: comment.dislikingUsers.has(userId) || false
        };
      }
    }

    // Format comments with user status
    const formattedComments = comments.map(comment => ({
      ...formatComment(comment),
      hasLiked: userCommentStatus[comment._id]?.hasLiked || false,
      hasDisliked: userCommentStatus[comment._id]?.hasDisliked || false,
      //返回不喜歡的數量
      dislikes: comment.dislikingUsers.size,
    }
  ));

    const formattedPost = {
      _id: post._id,
      title: post.title,
      content: post.content,
      img_path: post.img_path,
      Creation_time: new Date(post.Creation_time).toLocaleString("en-US", {
        timeZone: "Asia/Shanghai",
      }),
      user: post.user_id
        ? {
            _id: post.user_id._id,
            username: post.user_id.username,
            role: post.user_id.role,
          }
        : null,
    };

    res.json({
      post: formattedPost,
      comments: formattedComments,
    });
  } catch (error) {
    console.error("Error fetching post with comments:", error);
    res.status(500).json({ error: error.message });
  }
}


// 获取post的相关推荐
static async getRecommendations(req, res) {
  const { postId } = req.params;

  // 获取所有帖子以便进行文本相似度比较
  const posts = await Post.find();

  // 获取目标帖子的内容
  const targetPost = await Post.findById(postId);
  if (!targetPost) {
    return res.status(404).json({ error: 'Post not found' });
  }

  const similarities = [];

  // 计算该post与其他所有帖子的文本相似度
  for (let i = 0; i < posts.length; i++) {
    if (posts[i]._id.toString() !== postId) { // 排除自身
      const similarity = calculateJaccardSimilarity(targetPost.content, posts[i].content);
      similarities.push({
        index: i,
        similarity,
      });
    }
  }

  // 将相似度排序并过滤掉相似度为零的帖子
  const sortedRecommendations = similarities
    .filter(item => item.similarity > 0) // 过滤掉相似度为零的帖子
    .sort((a, b) => b.similarity - a.similarity)
    .slice(0, 5) // 取出前五个最相似的帖子
    .map(({ index, similarity }) => ({
      _id: posts[index]._id,
      title: posts[index].title,
      img_path: posts[index].img_path,
      similarity,
    }));

  // 返回结果
  res.json({
    recommendations: sortedRecommendations,
  });
}

}

// 计算 Jaccard 相似度的函数
function calculateJaccardSimilarity(textA, textB) {
  const setA = new Set(segmentText(textA)); // 使用分词处理
  const setB = new Set(segmentText(textB));

  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size; // 返回 Jaccard 相似度
}

// 更新分词函数
function segmentText(text) {
  const englishWords = text.split(/\W+/).filter(Boolean); // 英文分词
  const chineseWords = nodejieba.cut(text); // 使用 nodejieba 进行中文分词
  return [...englishWords, ...chineseWords]; // 合并分词结果
}
module.exports = PostController;
