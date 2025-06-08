// unity-voice-backend/src/routes/userRoutes.ts 
import express, { Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/authMiddleware';
import DatabaseConnection from '../config/database';
import { IUserRequest } from '../types/auth';

const router = express.Router();

router.get('/profile', authMiddleware, async (req: IUserRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ message: 'User not authenticated' });
    }

    const pool = DatabaseConnection.getPool();
    
    // Fixed: Added Score field and using correct column name CreationDate
    const [users] = await pool.query(`
SELECT UserId, Score, CreationDate, EnglishLevel, FirstName, LastName, Email, PhoneNumber, AgeRange
      FROM Users 
      WHERE UserId = ?
    `, [req.user.id]);

    if (!users || (users as any[]).length === 0) {
      return res.status(404).json({ message: 'User profile not found' });
    }

    const user = (users as any[])[0];
    
    // Fixed: Return data in the format expected by frontend (PascalCase)
    res.json({
      UserId: user.UserId,
      Email: user.Email,
      FirstName: user.FirstName,
      LastName: user.LastName,
      PhoneNumber: user.PhoneNumber,
      AgeRange: user.AgeRange,
      EnglishLevel: user.EnglishLevel,
      UserRole: user.UserRole,
      CreationDate: user.CreationDate,  // Fixed: CreationDate instead of createdAt
      LastLogin: user.LastLogin,
      Score: user.Score  // Added missing Score field
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

// 🔥 זה הEndpoint שמחליף authentication זמנית
router.get('/data', async (req, res) => {
  console.log('📝 User data endpoint called - bypassing auth temporarily');
  
  try {
    // אם יש Authorization header, ננסה לקבל את המשתמש האמיתי
    const authHeader = req.headers.authorization;
    
    if (authHeader) {
      console.log('🔍 Found auth header, trying to get real user data...');
      
      try {
        const pool = DatabaseConnection.getPool();
        
        // נחפש משתמש לפי האימייל שבטוכן (או המשתמש הראשון)
        const [users] = await pool.query(`
          SELECT UserId, Score, CreationDate, EnglishLevel, FirstName, LastName, Email, PhoneNumber, AgeRange
          FROM Users 
          WHERE UserId = ? 
          LIMIT 1
        `);
        
        if (users && (users as any[]).length > 0) {
          const user = (users as any[])[0];
          const userId = user.UserId;
          
          console.log('✅ Found real user:', userId);
          
          // קבלת מספר המשימות שהושלמו
          const [taskResults] = await pool.query(`
            SELECT COUNT(*) as completedTasks 
            FROM Tasks 
            WHERE UserId = ? AND CompletionDate IS NOT NULL
          `, [userId]);

          const completedTasks = (taskResults as any[])[0]?.completedTasks || 0;

          // קבלת הרמה הנוכחית של המשתמש
          const [levelResults] = await pool.query(`
            SELECT TopicName, Level, EarnedScore 
            FROM UserInLevel 
            WHERE UserId = ? 
            ORDER BY CompletedAt DESC 
            LIMIT 1
          `, [userId]);

          const currentLevel = (levelResults as any[])[0];

          // חישוב הרמה הבאה
          const nextLevelNum = currentLevel ? currentLevel.Level + 1 : 2;
          const [nextLevelResults] = await pool.query(`
            SELECT Level, LevelScore 
            FROM Levels 
            WHERE TopicName = ? AND Level = ?
          `, [currentLevel?.TopicName || 'General', nextLevelNum]);

          const nextLevel = (nextLevelResults as any[])[0];

          const responseData = {
            UserId: user.UserId,
            Score: user.Score || 0,
            totalScore: user.Score || 0,
            CreationDate: user.CreationDate,
            EnglishLevel: user.EnglishLevel,
            FirstName: user.FirstName,
            LastName: user.LastName,
            Email: user.Email,               // ✅ כבר יש
            PhoneNumber: user.PhoneNumber,   // ✅ הוסף
            AgeRange: user.AgeRange,  
            completedTasksCount: completedTasks,
            
            // נתוני רמה נוכחית
            currentLevel: currentLevel ? `${currentLevel.TopicName} Level ${currentLevel.Level}` : user.EnglishLevel || 'Beginner',
            currentLevelPoints: currentLevel?.EarnedScore || 0,
            
            // נתוני רמה הבאה
            nextLevel: nextLevel ? `${currentLevel?.TopicName || 'General'} Level ${nextLevelNum}` : 'Advanced',
            pointsToNextLevel: nextLevel ? Math.max(0, nextLevel.LevelScore - (currentLevel?.EarnedScore || 0)) : 100,
            
            // סטטיסטיקות נוספות
            activeSince: user.CreationDate ? new Date(user.CreationDate).toLocaleDateString() : new Date().toLocaleDateString()
          };

          console.log('📤 Returning real user data:', responseData.UserId);
          return res.json(responseData);
        }
      } catch (dbError) {
        console.error('❌ Database error, falling back to mock data:', dbError);
      }
    }
    
    // נתונים פיקטיביים כפתרון זמני
    console.log('📤 Returning mock user data');
    res.json({
      UserId: 'usr_mas51g95_c0ab879a',
      Score: 100,
      totalScore: 100,
      CreationDate: new Date(),
      EnglishLevel: 'Intermediate',
      FirstName: 'Test',
      LastName: 'User',
      completedTasksCount: 3,
      currentLevel: 'Intermediate Level 2',
      currentLevelPoints: 75,
      nextLevel: 'Advanced Level 1',
      pointsToNextLevel: 25,
      activeSince: new Date().toLocaleDateString()
    });
    
  } catch (error) {
    console.error('Error in user data endpoint:', error);
    res.status(500).json({ 
      error: 'Server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
