"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("./db"));
class Comment {
    // Find comment by ID
    static async findById(commentId) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM Comments WHERE CommentID = ?', // Changed from CommentId to CommentID
            [commentId]);
            return rows.length ? rows[0] : null;
        }
        catch (error) {
            console.error('Error finding comment by ID:', error);
            throw error;
        }
    }
    // Find comments by post ID
    static async findByPostId(postId) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM Comments WHERE PostID = ? ORDER BY CreatedAt', // Changed from PostId to PostID
            [postId]);
            return rows;
        }
        catch (error) {
            console.error('Error finding comments by post ID:', error);
            throw error;
        }
    }
    // Create a new comment
    static async create(commentData) {
        try {
            const [result] = await db_1.default.execute(`INSERT INTO Comments 
         (CommentID, PostID, commentContent, Feedback, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, ?, NOW(), NOW())`, [
                commentData.CommentID,
                commentData.PostID,
                commentData.commentContent,
                commentData.Feedback || null
            ]);
            if (result.affectedRows !== 1) {
                throw new Error('Failed to create comment');
            }
            return commentData.CommentID;
        }
        catch (error) {
            console.error('Error creating comment:', error);
            throw error;
        }
    }
    // Update comment
    static async update(commentId, updateData) {
        try {
            // Don't allow updating CommentID or PostID
            delete updateData.CommentID;
            delete updateData.PostID;
            delete updateData.CreatedAt;
            // Add UpdatedAt
            updateData.UpdatedAt = new Date();
            // Build the SET part of the SQL query dynamically
            const updateFields = Object.keys(updateData)
                .map(field => `${field} = ?`)
                .join(', ');
            if (!updateFields) {
                return true; // Nothing to update
            }
            const values = [...Object.values(updateData), commentId];
            const [result] = await db_1.default.execute(`UPDATE Comments SET ${updateFields} WHERE CommentID = ?`, // Changed from CommentId to CommentID
            values);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('Error updating comment:', error);
            throw error;
        }
    }
}
exports.default = Comment;
