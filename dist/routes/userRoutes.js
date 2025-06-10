"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// החלף את כל הקובץ userRoutes.ts בזה:
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const database_1 = __importDefault(require("../config/database"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const router = express_1.default.Router();
router.get('/profile', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        if (!req.user) {
            return res.status(401).json({ message: 'User not authenticated' });
        }
        const pool = database_1.default.getPool();
        const [users] = await pool.query(`SELECT UserId, Score, CreationDate, EnglishLevel, FirstName, LastName, Email, PhoneNumber, AgeRange FROM Users WHERE UserId = ?`, [req.user.id]);
        if (!users || users.length === 0) {
            return res.status(404).json({ message: 'User profile not found' });
        }
        const user = users[0];
        res.json({
            UserId: user.UserId,
            Email: user.Email,
            FirstName: user.FirstName,
            LastName: user.LastName,
            PhoneNumber: user.PhoneNumber,
            AgeRange: user.AgeRange,
            EnglishLevel: user.EnglishLevel,
            UserRole: user.UserRole,
            CreationDate: user.CreationDate,
            LastLogin: user.LastLogin,
            Score: user.Score
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
        const [result] = await pool.query(`UPDATE Users SET FirstName = ?, LastName = ?, PhoneNumber = ?, AgeRange = ?, EnglishLevel = ? WHERE UserId = ?`, [firstName, lastName, phoneNumber, ageRange, englishLevel, req.user.id]);
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
        const [sessionStats] = await pool.query(`SELECT COUNT(*) as totalSessions, AVG(SessionDuration) as avgDuration, MAX(CreatedAt) as lastSession FROM Sessions WHERE UserId = ?`, [req.user.id]);
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
router.get('/data', async (req, res) => {
    console.log('📝 User data endpoint called');
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader) {
            console.log('❌ No auth header found');
            return res.status(401).json({ error: 'No authorization header' });
        }
        console.log('🔍 Found auth header, getting real user data...');
        const pool = database_1.default.getPool();
        const token = authHeader.replace('Bearer ', '').trim();
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        const userId = decoded.id || decoded.userId;
        console.log('🔍 Decoded user ID:', userId);
        console.log('🔍 Looking for user in DB with ID:', userId);
        console.log('🔍 SQL Query will be:', `SELECT UserId, Score, CreationDate, EnglishLevel, FirstName, LastName, Email, PhoneNumber, AgeRange FROM Users WHERE UserId = '${userId}' LIMIT 1`);
        // קבלת הנתונים הבסיסיים של המשתמש
        const [users] = await pool.query(`SELECT UserId, Score, CreationDate, EnglishLevel, FirstName, LastName, Email, PhoneNumber, AgeRange FROM Users WHERE UserId = ? LIMIT 1`, [userId]);
        if (!users || users.length === 0) {
            console.log('❌ User not found in database');
            return res.status(404).json({ error: 'User not found' });
        }
        const user = users[0];
        console.log('✅ Found user with Score:', user.Score);
        console.log('🔍 Found user details:', {
            foundUserId: user.UserId,
            expectedUserId: userId,
            match: user.UserId === userId,
            score: user.Score
        });
        // נתונים בסיסיים (תמיד יחזרו)
        const responseData = {
            UserId: user.UserId,
            Score: user.Score || 0,
            totalScore: user.Score || 0,
            CreationDate: user.CreationDate,
            EnglishLevel: user.EnglishLevel,
            FirstName: user.FirstName,
            LastName: user.LastName,
            Email: user.Email,
            PhoneNumber: user.PhoneNumber,
            AgeRange: user.AgeRange,
            activeSince: user.CreationDate ? new Date(user.CreationDate).toLocaleDateString() : new Date().toLocaleDateString()
        };
        // נתונים מורחבים
        try {
            // קבלת מספר המשימות שהושלמו
            const [taskResults] = await pool.query(`SELECT COUNT(*) as completedTasks FROM Tasks WHERE UserId = ? AND CompletionDate IS NOT NULL`, [user.UserId]);
            responseData.completedTasksCount = taskResults[0]?.completedTasks || 0;
            console.log('✅ Completed tasks:', responseData.completedTasksCount);
        }
        catch (taskError) {
            console.warn('⚠️ Error fetching tasks, using default:', taskError);
            responseData.completedTasksCount = 0;
        }
        try {
            // קבלת הרמה הנוכחית
            const [levelResults] = await pool.query(`SELECT TopicName, Level, EarnedScore FROM UserInLevel WHERE UserId = ? ORDER BY CompletedAt DESC LIMIT 1`, [user.UserId]);
            const currentLevel = levelResults[0];
            if (currentLevel) {
                responseData.currentLevel = `${currentLevel.TopicName} Level ${currentLevel.Level}`;
                responseData.currentLevelPoints = currentLevel.EarnedScore || 0;
                // חישוב הרמה הבאה
                const nextLevelNum = currentLevel.Level + 1;
                const [nextLevelResults] = await pool.query(`SELECT Level, LevelScore FROM Levels WHERE TopicName = ? AND Level = ?`, [currentLevel.TopicName, nextLevelNum]);
                const nextLevel = nextLevelResults[0];
                responseData.nextLevel = nextLevel ? `${currentLevel.TopicName} Level ${nextLevelNum}` : 'Advanced';
                responseData.pointsToNextLevel = nextLevel ? Math.max(0, nextLevel.LevelScore - currentLevel.EarnedScore) : 100;
                console.log('✅ Level data added');
            }
            else {
                // defaults אם אין רמה
                responseData.currentLevel = user.EnglishLevel || 'Beginner';
                responseData.currentLevelPoints = 0;
                responseData.nextLevel = 'Intermediate';
                responseData.pointsToNextLevel = 100;
                console.log('⚠️ No level data, using defaults');
            }
        }
        catch (levelError) {
            console.warn('⚠️ Error fetching level data, using defaults:', levelError);
            responseData.currentLevel = user.EnglishLevel || 'Beginner';
            responseData.currentLevelPoints = 0;
            responseData.nextLevel = 'Intermediate';
            responseData.pointsToNextLevel = 100;
        }
        console.log('📤 Returning user data with Score:', responseData.Score);
        return res.json(responseData);
    }
    catch (error) {
        console.error('❌ Fatal error in user data endpoint:', error);
        res.status(500).json({
            error: 'Server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
