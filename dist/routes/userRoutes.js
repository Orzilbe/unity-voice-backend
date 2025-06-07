"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// unity-voice-backend/src/routes/userRoutes.ts 
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const database_1 = __importDefault(require("../config/database"));
const router = express_1.default.Router();
router.get('/profile', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'User not authenticated' });
        }
        const pool = database_1.default.getPool();
        // Fixed: Added Score field and using correct column name CreationDate
        const [users] = await pool.query(`
      SELECT UserId, Email, FirstName, LastName, PhoneNumber, 
             AgeRange, EnglishLevel, UserRole, CreationDate, LastLogin, Score
      FROM Users 
      WHERE UserId = ?
    `, [req.user.id]);
        if (!users || users.length === 0) {
            return res.status(404).json({ message: 'User profile not found' });
        }
        const user = users[0];
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
            CreationDate: user.CreationDate, // Fixed: CreationDate instead of createdAt
            LastLogin: user.LastLogin,
            Score: user.Score // Added missing Score field
        });
    }
    catch (error) {
        console.error('Profile fetch error:', error);
        res.status(500).json({
            message: 'Server error fetching profile',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.put('/profile', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'User not authenticated' });
        }
        const { firstName, lastName, phoneNumber, ageRange, englishLevel } = req.body;
        const pool = database_1.default.getPool();
        const [result] = await pool.query(`
      UPDATE Users 
      SET FirstName = ?, LastName = ?, PhoneNumber = ?, AgeRange = ?, EnglishLevel = ?
      WHERE UserId = ?
    `, [firstName, lastName, phoneNumber, ageRange, englishLevel, req.user.id]);
        if (result.affectedRows === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.json({ message: 'Profile updated successfully' });
    }
    catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({
            message: 'Server error updating profile',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.get('/stats', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'User not authenticated' });
        }
        const pool = database_1.default.getPool();
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
            stats: sessionStats[0] || {
                totalSessions: 0,
                avgDuration: 0,
                lastSession: null
            }
        });
    }
    catch (error) {
        console.error('Stats fetch error:', error);
        res.status(500).json({
            message: 'Server error fetching stats',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// הוסף את זה ל-userRoutes.ts במקום ה-endpoint הקיים
router.get('/data', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'User not authenticated' });
        }
        const pool = database_1.default.getPool();
        const userId = req.user.id;
        // קבלת נתוני המשתמש הבסיסיים
        const [userResults] = await pool.query(`
      SELECT UserId, Score, CreationDate, EnglishLevel 
      FROM Users 
      WHERE UserId = ?
    `, [userId]);
        if (!userResults || userResults.length === 0) {
            return res.status(404).json({ message: 'User not found' });
        }
        const user = userResults[0];
        // חישוב מספר המשימות שהושלמו
        const [taskResults] = await pool.query(`
      SELECT COUNT(*) as completedTasks 
      FROM Tasks 
      WHERE UserId = ? AND CompletionDate IS NOT NULL
    `, [userId]);
        const completedTasks = taskResults[0]?.completedTasks || 0;
        // קבלת הרמה הנוכחית של המשתמש
        const [levelResults] = await pool.query(`
      SELECT TopicName, Level, EarnedScore 
      FROM UserInLevel 
      WHERE UserId = ? 
      ORDER BY CompletedAt DESC 
      LIMIT 1
    `, [userId]);
        const currentLevel = levelResults[0];
        // חישוב הרמה הבאה
        const nextLevelNum = currentLevel ? currentLevel.Level + 1 : 2;
        const [nextLevelResults] = await pool.query(`
      SELECT Level, LevelScore 
      FROM Levels 
      WHERE TopicName = ? AND Level = ?
    `, [currentLevel?.TopicName || 'General', nextLevelNum]);
        const nextLevel = nextLevelResults[0];
        // הכנת התגובה
        const responseData = {
            UserId: user.UserId,
            Score: user.Score || 0,
            totalScore: user.Score || 0,
            CreationDate: user.CreationDate,
            EnglishLevel: user.EnglishLevel,
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
        res.json(responseData);
    }
    catch (error) {
        console.error('User data fetch error:', error);
        res.status(500).json({
            message: 'Server error fetching user data',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
