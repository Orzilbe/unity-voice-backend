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
 * קבלת סטטיסטיקות משתמשים
 * GET /api/dashboard/user-stats
 */
router.get('/user-stats', authMiddleware, async (req: IUserRequest, res) => {
  try {
    console.log('Getting user statistics');
    
    const connection = await pool.getConnection();
    
    try {
      // סה"כ משתמשים פעילים
      const [totalUsersResult] = await connection.execute(
        'SELECT COUNT(*) as totalUsers FROM Users WHERE IsActive = 1'
      );
      
      // משתמשים פעילים (שהתחברו ב-30 הימים האחרונים)
      const [activeUsersResult] = await connection.execute(
        `SELECT COUNT(*) as activeUsers 
         FROM Users 
         WHERE LastLogin > DATE_SUB(NOW(), INTERVAL 30 DAY) AND IsActive = 1`
      );
      
      // משתמשים חדשים החודש
      const [newUsersThisMonthResult] = await connection.execute(
        `SELECT COUNT(*) as newUsersThisMonth
         FROM Users 
         WHERE DATE_FORMAT(CreationDate, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')`
      );
      
      // משתמשים חדשים החודש הקודם
      const [newUsersLastMonthResult] = await connection.execute(
        `SELECT COUNT(*) as newUsersLastMonth
         FROM Users 
         WHERE DATE_FORMAT(CreationDate, '%Y-%m') = DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m')`
      );
      
      // ציון ממוצע
      const [averageScoreResult] = await connection.execute(
        `SELECT AVG(TaskScore) as averageScore 
         FROM Tasks 
         WHERE CompletionDate IS NOT NULL AND TaskScore > 0`
      );
      
      const stats = {
        totalUsers: (totalUsersResult as any[])[0]?.totalUsers || 0,
        activeUsers: (activeUsersResult as any[])[0]?.activeUsers || 0,
        newUsersThisMonth: (newUsersThisMonthResult as any[])[0]?.newUsersThisMonth || 0,
        newUsersLastMonth: (newUsersLastMonthResult as any[])[0]?.newUsersLastMonth || 0,
        averageScore: Math.round((averageScoreResult as any[])[0]?.averageScore || 0)
      };
      
      console.log('User statistics retrieved:', stats);
      return res.json(stats);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error getting user statistics:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * קבלת פעילות משתמשים
 * GET /api/dashboard/user-activity
 */
router.get('/user-activity', authMiddleware, async (req: IUserRequest, res) => {
  try {
    console.log('Getting user activity data');
    
    const connection = await pool.getConnection();
    
    try {
      // פעילות יומית ב-30 הימים האחרונים
      const [dailyActivityResult] = await connection.execute(
        `SELECT 
           DATE(LastLogin) as date,
           COUNT(DISTINCT UserId) as activeUsers
         FROM Users 
         WHERE LastLogin > DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY DATE(LastLogin)
         ORDER BY date DESC`
      );
      
      // משימות שהושלמו ב-30 הימים האחרונים
      const [completedTasksResult] = await connection.execute(
        `SELECT 
           DATE(CompletionDate) as date,
           COUNT(*) as completedTasks
         FROM Tasks 
         WHERE CompletionDate > DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY DATE(CompletionDate)
         ORDER BY date DESC`
      );
      
      // פעילות לפי רמות
      const [levelActivityResult] = await connection.execute(
        `SELECT 
           Level,
           COUNT(*) as taskCount,
           AVG(TaskScore) as avgScore
         FROM Tasks 
         WHERE CompletionDate > DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY Level
         ORDER BY Level`
      );
      
      const activity = {
        dailyActivity: dailyActivityResult,
        completedTasks: completedTasksResult,
        levelActivity: levelActivityResult
      };
      
      console.log('User activity data retrieved');
      return res.json(activity);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error getting user activity:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * ייצוא נתונים למשתמש
 * GET /api/dashboard/export
 */
router.get('/export', authMiddleware, async (req: IUserRequest, res) => {
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }
    
    console.log(`Exporting data for user: ${userId}`);
    
    const connection = await pool.getConnection();
    
    try {
      // נתוני משתמש
      const [userResult] = await connection.execute(
        'SELECT * FROM Users WHERE UserId = ?',
        [userId]
      ) as any[];
      
      // משימות המשתמש
      const [tasksResult] = await connection.execute(
        'SELECT * FROM Tasks WHERE UserId = ? ORDER BY StartDate DESC',
        [userId]
      ) as any[];
      
      // מילים שהמשתמש למד
      const [wordsResult] = await connection.execute(
        `SELECT w.*, uw.LearningStreak, uw.LastReviewed 
         FROM Words w
         JOIN UserWords uw ON w.WordId = uw.WordId
         WHERE uw.UserId = ?
         ORDER BY uw.LastReviewed DESC`,
        [userId]
      ) as any[];
      
      const exportData = {
        user: (userResult as any[])[0],
        tasks: tasksResult,
        words: wordsResult,
        exportDate: new Date().toISOString()
      };
      
      console.log(`Data export completed for user ${userId}`);
      return res.json(exportData);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error exporting user data:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

export default router; 