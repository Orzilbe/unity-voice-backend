// apps/api/src/routes/topicsRoutes.ts
import express from 'express';
import { IUserRequest } from '../types/auth';
import { authMiddleware } from '../middleware/authMiddleware';
import pool from '../models/db';
import { errorHandler } from '../middleware/errorHandler';

const router = express.Router();

/**
 * קבלת כל הנושאים - זמנית בלי authentication
 * GET /api/topics
 */
router.get('/', async (req, res) => {
  console.log('📝 Topics endpoint called - bypassing auth temporarily');
  
  try {
    console.log('Getting all topics');
    
    const connection = await pool.getConnection();
    
    try {
      const [rows] = await connection.query(
        'SELECT * FROM Topics ORDER BY TopicName'
      );
      
      console.log(`✅ Found ${(rows as any[]).length} topics`);
      res.json(rows);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error getting topics:', error);
    res.status(500).json({ error: 'Failed to get topics' });
  }
});

export default router;
