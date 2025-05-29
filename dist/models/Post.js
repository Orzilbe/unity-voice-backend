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
            const [rows] = await db_1.default.execute('SELECT * FROM Posts WHERE PostID = ?', [postId]);
            return rows.length ? rows[0] : null;
        }
        catch (error) {
            console.error('Error finding post by ID:', error);
            throw error;
        }
    }
    // Find post by task ID
    static async findByTaskId(taskId) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM Posts WHERE TaskId = ?', [taskId]);
            return rows.length ? rows[0] : null;
        }
        catch (error) {
            console.error('Error finding post by task ID:', error);
            throw error;
        }
    }
    // Create a new post
    static async create(postData) {
        try {
            const [result] = await db_1.default.execute(`INSERT INTO Posts 
         (PostID, TaskId, PostContent, Picture, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, ?, NOW(), NOW())`, [
                postData.PostID,
                postData.TaskId,
                postData.PostContent,
                postData.Picture || null
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
            // Don't allow updating PostID or TaskId
            delete updateData.PostID;
            delete updateData.TaskId;
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
            const values = [...Object.values(updateData), postId];
            const [result] = await db_1.default.execute(`UPDATE Posts SET ${updateFields} WHERE PostID = ?`, values);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('Error updating post:', error);
            throw error;
        }
    }
}
exports.default = Post;
