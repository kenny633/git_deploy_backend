// utils/responseFormatter.js
const formatComment = (comment) => ({
  _id: comment._id,
  content: comment.content,
  likes: comment.likes,
  Creation_time: new Date(comment.Creation_time).toLocaleString("en-US", {
    timeZone: "Asia/Shanghai",
  }),
  user: comment.user_id
    ? {
        _id: comment.user_id._id,
        username: comment.user_id.username,
        status: comment.user_id.status,
      }
    : null,
});
module.exports = {
  formatComment,
};
