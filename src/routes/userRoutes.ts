// unity-voice-backend/src/routes/userRoutes.ts - FIXED VERSION
import express, { Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import DatabaseConnection from '../config/database';
import { IUserRequest } from '../types/auth'; // ← ADD THIS IMPORT

const router = express.Router();

// Fix: Change Request to IUserRequest in all route handlers
router.get('/profile', authMiddleware, async (req: IUserRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const pool = DatabaseConnection.getPool();
    
    const [users] = await pool.query(`
      SELECT UserId, Email, FirstName, LastName, PhoneNumber, 
             AgeRange, EnglishLevel, UserRole, CreatedAt, LastLogin
      FROM Users 
      WHERE UserId = ?
    `, [req.user.id]);

    if (!users || (users as any[]).length === 0) {
      return res.status(404).json({ message: 'User profile not found' });
    }

    const user = (users as any[])[0];
    
    res.json({
      id: user.UserId,
      email: user.Email,
      firstName: user.FirstName,
      lastName: user.LastName,
      phoneNumber: user.PhoneNumber,
      ageRange: user.AgeRange,
      englishLevel: user.EnglishLevel,
      role: user.UserRole,
      createdAt: user.CreatedAt,
      lastLogin: user.LastLogin
    });
  } catch (error) {
    console.error('Profile fetch error:', error);
    res.status(500).json({ 
      message: 'Server error fetching profile',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.put('/profile', authMiddleware, async (req: IUserRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const { firstName, lastName, phoneNumber, ageRange, englishLevel } = req.body;
    
    const pool = DatabaseConnection.getPool();
    
    const [result] = await pool.query(`
      UPDATE Users 
      SET FirstName = ?, LastName = ?, PhoneNumber = ?, AgeRange = ?, EnglishLevel = ?
      WHERE UserId = ?
    `, [firstName, lastName, phoneNumber, ageRange, englishLevel, req.user.id]);

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ 
      message: 'Server error updating profile',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.get('/stats', authMiddleware, async (req: IUserRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const pool = DatabaseConnection.getPool();
    
    // Get user statistics - sessions, progress, etc.
    const [sessionStats] = await pool.query(`
      SELECT 
        COUNT(*) as totalSessions,
        AVG(SessionDuration) as avgDuration,
        MAX(CreatedAt) as lastSession
      FROM Sessions 
      WHERE UserId = ?
    `, [req.user.id]);

    res.json({
      userId: req.user.id,
      stats: (sessionStats as any[])[0] || {
        totalSessions: 0,
        avgDuration: 0,
        lastSession: null
      }
    });
  } catch (error) {
    console.error('Stats fetch error:', error);
    res.status(500).json({ 
      message: 'Server error fetching stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});
router.get('/data', authMiddleware, async (req: IUserRequest, res: Response) => {
  try {
    // הלוגיקה שלך כאן
    res.json({ message: 'User data endpoint' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

export default router;