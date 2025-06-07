// unity-voice-backend/src/models/Comment.ts
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from './db';

export interface IComment extends RowDataPacket {
  CommentID: string;
  TaskID: string;        // 🔥 PRIMARY: Comments belong to tasks now
  PostID?: string;       // 🔥 LEGACY: Keep for transition period but make optional
  commentContent: string;
  Feedback?: string;
}

class Comment {
  // Find comment by ID
  static async findById(commentId: string): Promise<IComment | null> {
    try {
      const [rows] = await pool.execute<IComment[]>(
        'SELECT * FROM comments WHERE CommentID = ?',
        [commentId]
      );
      
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding comment by ID:', error);
      throw error;
    }
  }

  // 🔥 NEW: Find comments by task ID (main method)
  static async findByTaskId(taskId: string): Promise<IComment[]> {
    try {
      const [rows] = await pool.execute<IComment[]>(
        'SELECT * FROM comments WHERE TaskID = ? ORDER BY CommentID',
        [taskId]
      );
      
      return rows;
    } catch (error) {
      console.error('Error finding comments by task ID:', error);
      throw error;
    }
  }

  // 🔥 LEGACY: Find comments by post ID (for backward compatibility)
  static async findByPostId(postId: string): Promise<IComment[]> {
    try {
      const [rows] = await pool.execute<IComment[]>(
        'SELECT * FROM comments WHERE PostID = ? ORDER BY CommentID',
        [postId]
      );
      
      return rows;
    } catch (error) {
      console.error('Error finding comments by post ID:', error);
      throw error;
    }
  }

  // 🔥 FIXED: Create comment with proper column handling
  static async create(commentData: {
    CommentID: string;
    TaskID: string;        // 🔥 Required field
    commentContent: string;
    Feedback?: string;
    PostID?: string;       // 🔥 Optional legacy field
  }): Promise<string> {
    try {
      console.log('💬 Creating comment with TaskID:', commentData.TaskID);
      
      // Check if we have both TaskID and PostID columns in the table
      const [tableInfo] = await pool.execute(`
        SELECT COLUMN_NAME 
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'comments' 
        AND COLUMN_NAME IN ('TaskID', 'PostID')
      `);
      
      const columns = (tableInfo as any[]).map(row => row.COLUMN_NAME);
      const hasTaskID = columns.includes('TaskID');
      const hasPostID = columns.includes('PostID');
      
      console.log('📊 Table columns check:', { hasTaskID, hasPostID, columns });
      
      if (hasTaskID && hasPostID) {
        // Both columns exist - use new schema
        console.log('✅ Using new schema (TaskID + PostID)');
        
        const [result] = await pool.execute<ResultSetHeader>(
          `INSERT INTO comments 
           (CommentID, TaskID, commentContent, Feedback, PostID)
           VALUES (?, ?, ?, ?, ?)`,
          [
            commentData.CommentID,
            commentData.TaskID,
            commentData.commentContent,
            commentData.Feedback || null,
            commentData.PostID || null // Can be null
          ]
        );
        
        if (result.affectedRows !== 1) {
          throw new Error('Failed to create comment');
        }
        
        console.log('💬 Comment created successfully with new schema');
        return commentData.CommentID;
        
      } else if (hasTaskID && !hasPostID) {
        // Only TaskID exists - pure new schema
        console.log('✅ Using pure new schema (TaskID only)');
        
        const [result] = await pool.execute<ResultSetHeader>(
          `INSERT INTO comments 
           (CommentID, TaskID, commentContent, Feedback)
           VALUES (?, ?, ?, ?)`,
          [
            commentData.CommentID,
            commentData.TaskID,
            commentData.commentContent,
            commentData.Feedback || null
          ]
        );
        
        if (result.affectedRows !== 1) {
          throw new Error('Failed to create comment');
        }
        
        console.log('💬 Comment created successfully with TaskID only');
        return commentData.CommentID;
        
      } else if (!hasTaskID && hasPostID) {
        // Only PostID exists - legacy schema
        console.log('⚠️ Using legacy schema (PostID only)');
        
        // Need to get PostID from TaskID
        let postIdToUse = commentData.PostID;
        
        if (!postIdToUse) {
          // Get PostID from task
          const [taskRows] = await pool.execute(`
            SELECT PostID FROM tasks WHERE TaskId = ?
          `, [commentData.TaskID]);
          
          const taskData = taskRows as any[];
          if (taskData.length > 0 && taskData[0].PostID) {
            postIdToUse = taskData[0].PostID;
            console.log('📎 Found PostID from task:', postIdToUse);
          } else {
            throw new Error('Cannot create comment: No PostID found for task and legacy schema requires PostID');
          }
        }
        
        const [result] = await pool.execute<ResultSetHeader>(
          `INSERT INTO comments 
           (CommentID, PostID, commentContent, Feedback)
           VALUES (?, ?, ?, ?)`,
          [
            commentData.CommentID,
            postIdToUse,
            commentData.commentContent,
            commentData.Feedback || null
          ]
        );
        
        if (result.affectedRows !== 1) {
          throw new Error('Failed to create comment');
        }
        
        console.log('💬 Comment created successfully with legacy schema');
        return commentData.CommentID;
        
      } else {
        throw new Error('Invalid table schema: neither TaskID nor PostID columns found');
      }
      
    } catch (error) {
      console.error('❌ Error creating comment:', error);
      throw error;
    }
  }

  // Update comment
  static async update(commentId: string, updateData: Partial<IComment>): Promise<boolean> {
    try {
      // Don't allow updating CommentID or TaskID
      delete updateData.CommentID;
      delete updateData.TaskID;
      delete updateData.PostID; // Don't allow updating PostID either
      
      // Build the SET part of the SQL query dynamically
      const updateFields = Object.keys(updateData)
        .map(field => `${field} = ?`)
        .join(', ');
      
      if (!updateFields) {
        return true; // Nothing to update
      }
      
      const values = [...Object.values(updateData), commentId];
      
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE comments SET ${updateFields} WHERE CommentID = ?`,
        values
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating comment:', error);
      throw error;
    }
  }
}

export default Comment;