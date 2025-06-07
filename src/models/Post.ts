// unity-voice-backend/src/models/Post.ts
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from './db';

export interface IPost extends RowDataPacket {
  PostID: string;
  TaskId?: string;        // 🔥 LEGACY - will be phased out
  PostContent: string;
  Picture?: string;
}

class Post {
  // Find post by ID
  static async findById(postId: string): Promise<IPost | null> {
    try {
      const [rows] = await pool.execute<IPost[]>(
        'SELECT * FROM posts WHERE PostID = ?',
        [postId]
      );
      
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding post by ID:', error);
      throw error;
    }
  }

  // 🔥 NEW: Find posts that can be reused (not already used by this user)
  static async findReusablePosts(userId: string, topicName: string, limit: number = 5): Promise<IPost[]> {
    try {
      const [rows] = await pool.execute<IPost[]>(
        `SELECT DISTINCT p.* 
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
         LIMIT ?`,
        [userId, topicName, limit]
      );
      
      return rows;
    } catch (error) {
      console.error('Error finding reusable posts:', error);
      return [];
    }
  }

  // Create a new post
  static async create(postData: {
    PostID: string;
    PostContent: string;
    Picture?: string;
    TaskId?: string;        // 🔥 LEGACY - optional for backward compatibility
  }): Promise<string> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO posts 
         (PostID, PostContent, Picture, TaskId)
         VALUES (?, ?, ?, ?)`,
        [
          postData.PostID,
          postData.PostContent,
          postData.Picture || null,
          postData.TaskId || null    // 🔥 Can be NULL now
        ]
      );
      
      if (result.affectedRows !== 1) {
        throw new Error('Failed to create post');
      }
      
      return postData.PostID;
    } catch (error) {
      console.error('Error creating post:', error);
      throw error;
    }
  }

  // Update post
  static async update(postId: string, updateData: Partial<IPost>): Promise<boolean> {
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
      
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE posts SET ${updateFields} WHERE PostID = ?`,
        values
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating post:', error);
      throw error;
    }
  }
}

export default Post;
