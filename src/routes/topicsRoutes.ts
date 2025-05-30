// apps/api/src/routes/topicsRoutes.ts
import express from 'express';
import pool from '../models/db';
import { authMiddleware } from '../middleware/authMiddleware';
import { TokenPayload } from '../types/auth';

// Define the user request interface
interface IUserRequest extends express.Request {
  user?: TokenPayload;
}

const router = express.Router();

/**
 * קבלת כל הנושאים
 * GET /api/topics
 */
router.get('/', authMiddleware, async (req: IUserRequest, res) => {
  try {
    console.log('Getting all topics');
    
    const connection = await pool.getConnection();
    
    try {
      const [topics] = await connection.execute(
        'SELECT TopicName, TopicHe, Icon FROM Topics ORDER BY TopicName'
      );
      
      console.log(`Retrieved ${(topics as any[]).length} topics`);
      return res.json(topics);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching topics:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

export default router;