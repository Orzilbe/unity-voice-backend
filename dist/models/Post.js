"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("./db"));
class Post {
    // Find post by ID
    static async findById(postId) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM posts WHERE PostID = ?', [postId]);
            return rows.length ? rows[0] : null;
        }
        catch (error) {
            console.error('Error finding post by ID:', error);
            throw error;
        }
    }
    // 🔥 NEW: Find posts that can be reused (not already used by this user)
    static async findReusablePosts(userId, topicName, limit = 5) {
        try {
            const [rows] = await db_1.default.execute(`SELECT DISTINCT p.* 
         FROM posts p
         WHERE p.PostID NOT IN (
           SELECT t.PostID 
           FROM tasks t 
           WHERE t.UserId = ? AND t.PostID IS NOT NULL
         )
         AND p.PostID IN (
           SELECT t2.PostID 
           FROM tasks t2 
           WHERE t2.TopicName = ? AND t2.PostID IS NOT NULL
         )
         ORDER BY RAND()
         LIMIT ?`, [userId, topicName, limit]);
            return rows;
        }
        catch (error) {
            console.error('Error finding reusable posts:', error);
            return [];
        }
    }
    // Create a new post
    static async create(postData) {
        try {
            const [result] = await db_1.default.execute(`INSERT INTO posts 
         (PostID, PostContent, Picture, TaskId)
         VALUES (?, ?, ?, ?)`, [
                postData.PostID,
                postData.PostContent,
                postData.Picture || null,
                postData.TaskId || null // 🔥 Can be NULL now
            ]);
            if (result.affectedRows !== 1) {
                throw new Error('Failed to create post');
            }
            return postData.PostID;
        }
        catch (error) {
            console.error('Error creating post:', error);
            throw error;
        }
    }
    // Update post
    static async update(postId, updateData) {
        try {
            // Don't allow updating PostID
            delete updateData.PostID;
            // Build the SET part of the SQL query dynamically
            const updateFields = Object.keys(updateData)
                .map(field => `${field} = ?`)
                .join(', ');
            if (!updateFields) {
                return true; // Nothing to update
            }
            const values = [...Object.values(updateData), postId];
            const [result] = await db_1.default.execute(`UPDATE posts SET ${updateFields} WHERE PostID = ?`, values);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('Error updating post:', error);
            throw error;
        }
    }
}
exports.default = Post;
