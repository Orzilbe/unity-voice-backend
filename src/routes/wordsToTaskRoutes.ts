// apps/api/src/routes/wordsToTaskRoutes.ts
import express from 'express';
import { IUserRequest } from '../types/auth';
import { authMiddleware } from '../middleware/authMiddleware';
import { v4 as uuidv4 } from 'uuid';
import { addWordsToTask } from '../services/taskService';
import { getDbPool } from '../lib/db';
import DatabaseConnection from '../config/database';
import { errorHandler } from '../middleware/errorHandler';

const router = express.Router();

console.log('📝 wordsToTaskRoutes module loaded');

/**
 * הוספת מילים למשימה
 * POST /api/words/to-task
 */
router.post('/to-task', authMiddleware, async (req: IUserRequest, res) => {
  console.log('🚀 Backend POST /api/words/to-task - Processing request');
  console.log('📥 Request body:', JSON.stringify(req.body, null, 2));
  console.log('👤 User ID from token:', req.user?.id);

  try {
    const { taskId, wordIds } = req.body;
    const userId = req.user?.id;

    // Validation
    if (!userId) {
      console.log('❌ No user ID found in token');
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required - user ID not found in token' 
      });
    }

    if (!taskId) {
      console.log('❌ Missing taskId in request body');
      return res.status(400).json({ 
        success: false, 
        error: 'taskId is required' 
      });
    }

    if (!Array.isArray(wordIds) || wordIds.length === 0) {
      console.log('❌ Invalid or empty wordIds array');
      return res.status(400).json({ 
        success: false, 
        error: 'wordIds must be a non-empty array' 
      });
    }

    console.log(`📊 Processing: ${wordIds.length} words for task ${taskId}, user ${userId}`);

    // Get database connection
    const pool = await getDbPool();
    if (!pool) {
      console.error('❌ Database connection not available');
      return res.status(500).json({ 
        success: false, 
        error: 'Database connection failed' 
      });
    }

    const connection = await pool.getConnection();
    try {
      // Verify task belongs to user
      const [taskRows] = await connection.query(
        'SELECT TaskId, TopicName, Level FROM Tasks WHERE TaskId = ? AND UserId = ?',
        [taskId, userId]
      );

      if (!Array.isArray(taskRows) || taskRows.length === 0) {
        console.log(`❌ Task ${taskId} not found or doesn't belong to user ${userId}`);
        return res.status(403).json({ 
          success: false, 
          error: 'Task not found or access denied' 
        });
      }

      const task = taskRows[0] as any;
      console.log('✅ Task ownership verified:', {
        taskId: task.TaskId,
        topicName: task.TopicName,
        level: task.Level
      });

      // Use the taskService function to add words
      console.log('📝 Adding words to task using taskService...');
      const success = await addWordsToTask(taskId, wordIds);

      if (success) {
        console.log(`✅ Successfully added ${wordIds.length} words to task ${taskId}`);
        
        // Optional: Get updated word count for confirmation
        const [countResult] = await connection.query(
          'SELECT COUNT(*) as wordCount FROM wordintask WHERE TaskId = ?',
          [taskId]
        );
        const totalWordsInTask = (countResult as any[])[0]?.wordCount || 0;
        
        return res.status(200).json({ 
          success: true, 
          message: `Successfully added ${wordIds.length} words to task`,
          data: {
            taskId,
            wordsAdded: wordIds.length,
            totalWordsInTask
          }
        });
      } else {
        console.log('❌ Failed to add words to task - taskService returned false');
        return res.status(500).json({ 
          success: false, 
          error: 'Failed to add words to task' 
        });
      }

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('💥 Error in POST /api/words/to-task:', error);
    
    // Enhanced error response with details for development
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    const errorResponse: any = { 
      success: false, 
      error: 'An error occurred while adding words to task'
    };
    
    // Add details in development mode
    if (process.env.NODE_ENV === 'development') {
      errorResponse.details = errorMessage;
      errorResponse.stack = error instanceof Error ? error.stack : undefined;
    }
    
    return res.status(500).json(errorResponse);
  }
});

/**
 * קבלת מילים של משימה
 * GET /api/words/in-task?taskId=xxx
 */
router.get('/in-task', authMiddleware, async (req: IUserRequest, res) => {
  console.log('🚀 Backend GET /api/words/in-task - Getting words for task');
  
  try {
    const taskId = req.query.taskId as string;
    const userId = req.user?.id;

    if (!taskId) {
      return res.status(400).json({ 
        success: false, 
        error: 'taskId parameter is required' 
      });
    }

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'Authentication required' 
      });
    }

    console.log(`📝 Getting words for task ${taskId}, user ${userId}`);

    const pool = await getDbPool();
    if (!pool) {
      return res.status(500).json({ 
        success: false, 
        error: 'Database connection failed' 
      });
    }

    const connection = await pool.getConnection();
    try {
      // Verify task belongs to user
      const [taskCheck] = await connection.query(
        'SELECT TaskId FROM Tasks WHERE TaskId = ? AND UserId = ?',
        [taskId, userId]
      );

      if (!Array.isArray(taskCheck) || taskCheck.length === 0) {
        return res.status(403).json({ 
          success: false, 
          error: 'Task not found or access denied' 
        });
      }

      // Get words for task
      const [rows] = await connection.query(`
        SELECT 
          wit.WordId, 
          wit.TaskId,
          w.Word, 
          w.Translation, 
          w.ExampleUsage, 
          w.PartOfSpeech, 
          w.TopicName,
          w.EnglishLevel
        FROM wordintask wit
        JOIN Words w ON wit.WordId = w.WordId
        WHERE wit.TaskId = ?
        ORDER BY w.Word
      `, [taskId]);

      console.log(`✅ Retrieved ${Array.isArray(rows) ? rows.length : 0} words for task ${taskId}`);
      
      return res.status(200).json({ 
        success: true, 
        taskId,
        data: rows,
        count: Array.isArray(rows) ? rows.length : 0
      });

    } finally {
      connection.release();
    }

  } catch (error) {
    console.error('💥 Error in GET /api/words/in-task:', error);
    
    return res.status(500).json({ 
      success: false, 
      error: 'An error occurred while getting words for task',
      details: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : undefined
    });
  }
});

console.log('📝 wordsToTaskRoutes routes registered: POST /to-task, GET /in-task');

export default router;
