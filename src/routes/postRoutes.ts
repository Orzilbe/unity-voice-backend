// apps/api/src/routes/postRoutes.ts
import express from 'express';
import pool from '../models/db';
import { authMiddleware } from '../middleware/authMiddleware';
import { v4 as uuidv4 } from 'uuid';
import { TokenPayload } from '../types/auth';

// Define the user request interface
interface IUserRequest extends express.Request {
  user?: TokenPayload;
}

const router = express.Router();

/**
 * יצירת או עדכון פוסט
 * POST /api/posts
 */
router.post('/', authMiddleware, async (req: IUserRequest, res) => {
  try {
    console.log('Creating/updating post with data:', req.body);
    const { PostID, TaskId, PostContent, Picture } = req.body;
    
    // בדיקת פרמטרים נדרשים
    if (!PostContent) {
      return res.status(400).json({
        success: false,
        error: 'PostContent is required'
      });
    }
    
    // קבלת חיבור למסד הנתונים
    const connection = await pool.getConnection();
    
    try {
      let postId = PostID;
      
      if (postId) {
        // עדכון פוסט קיים
        console.log(`Updating existing post with ID: ${postId}`);
        
        const updateSql = `
          UPDATE Posts 
          SET PostContent = ?, Picture = ?, UpdatedAt = NOW() 
          WHERE PostID = ?
        `;
        
        const [result] = await connection.execute(updateSql, [
          PostContent,
          Picture || null,
          postId
        ]);
        
        if ((result as any).affectedRows === 0) {
          // אם הפוסט לא נמצא, ניצור חדש עם אותו ID
          console.log(`Post with ID ${postId} not found, creating new post`);
          const insertSql = `
            INSERT INTO Posts (PostID, TaskId, PostContent, Picture, CreatedAt) 
            VALUES (?, ?, ?, ?, NOW())
          `;
          
          await connection.execute(insertSql, [
            postId,
            TaskId || null,
            PostContent,
            Picture || null
          ]);
        }
      } else {
        // יצירת פוסט חדש
        postId = uuidv4();
        console.log(`Creating new post with ID: ${postId}`);
        
        const insertSql = `
          INSERT INTO Posts (PostID, TaskId, PostContent, Picture, CreatedAt) 
          VALUES (?, ?, ?, ?, NOW())
        `;
        
        await connection.execute(insertSql, [
          postId,
          TaskId || null,
          PostContent,
          Picture || null
        ]);
      }
      
      console.log('Post created/updated successfully:', postId);
      
      return res.json({
        success: true,
        PostID: postId,
        message: 'Post created/updated successfully'
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating/updating post:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * קבלת פוסטים לפי TaskId
 * GET /api/posts?taskId=taskId
 */
router.get('/', authMiddleware, async (req: IUserRequest, res) => {
  try {
    const { taskId, postId } = req.query;
    
    console.log(`Getting posts with taskId: ${taskId}, postId: ${postId}`);
    
    if (!taskId && !postId) {
      return res.status(400).json({
        success: false,
        error: 'Post ID or Task ID is required'
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      if (taskId) {
        // קבלת כל הפוסטים של המשימה
        const [posts] = await connection.execute(
          'SELECT * FROM Posts WHERE TaskId = ? ORDER BY CreatedAt DESC',
          [taskId]
        );
        
        console.log(`Retrieved ${(posts as any[]).length} posts for taskId: ${taskId}`);
        return res.json(posts);
      } else if (postId) {
        // קבלת פוסט בודד לפי ID
        const [posts] = await connection.execute(
          'SELECT * FROM Posts WHERE PostID = ?',
          [postId]
        );
        
        if (!Array.isArray(posts) || posts.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Post not found'
          });
        }
        
        console.log(`Retrieved post: ${postId}`);
        return res.json(posts[0]);
      }
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching posts:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

export default router; 