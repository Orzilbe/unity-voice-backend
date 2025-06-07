"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const db_1 = __importDefault(require("../models/db"));
const router = express_1.default.Router();
/**
 * קבלת סטטיסטיקות משתמשים
 * GET /api/dashboard/user-stats
 */
router.get('/user-stats', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        console.log('Getting user statistics');
        const connection = await db_1.default.getConnection();
        try {
            // סה"כ משתמשים פעילים
            const [totalUsersResult] = await connection.execute('SELECT COUNT(*) as totalUsers FROM Users WHERE IsActive = 1');
            // משתמשים פעילים (שהתחברו ב-30 הימים האחרונים)
            const [activeUsersResult] = await connection.execute(`SELECT COUNT(*) as activeUsers 
         FROM Users 
         WHERE LastLogin > DATE_SUB(NOW(), INTERVAL 30 DAY) AND IsActive = 1`);
            // משתמשים חדשים החודש
            const [newUsersThisMonthResult] = await connection.execute(`SELECT COUNT(*) as newUsersThisMonth
         FROM Users 
         WHERE DATE_FORMAT(CreationDate, '%Y-%m') = DATE_FORMAT(NOW(), '%Y-%m')`);
            // משתמשים חדשים החודש הקודם
            const [newUsersLastMonthResult] = await connection.execute(`SELECT COUNT(*) as newUsersLastMonth
         FROM Users 
         WHERE DATE_FORMAT(CreationDate, '%Y-%m') = DATE_FORMAT(DATE_SUB(NOW(), INTERVAL 1 MONTH), '%Y-%m')`);
            // ציון ממוצע
            const [averageScoreResult] = await connection.execute(`SELECT AVG(TaskScore) as averageScore 
         FROM Tasks 
         WHERE CompletionDate IS NOT NULL AND TaskScore > 0`);
            const stats = {
                totalUsers: totalUsersResult[0]?.totalUsers || 0,
                activeUsers: activeUsersResult[0]?.activeUsers || 0,
                newUsersThisMonth: newUsersThisMonthResult[0]?.newUsersThisMonth || 0,
                newUsersLastMonth: newUsersLastMonthResult[0]?.newUsersLastMonth || 0,
                averageScore: Math.round(averageScoreResult[0]?.averageScore || 0)
            };
            console.log('User statistics retrieved:', stats);
            return res.json(stats);
        }
        finally {
            connection.release();
        }
    }
    catch (error) {
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
router.get('/user-activity', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        console.log('Getting user activity data');
        const connection = await db_1.default.getConnection();
        try {
            // פעילות יומית ב-30 הימים האחרונים
            const [dailyActivityResult] = await connection.execute(`SELECT 
           DATE(LastLogin) as date,
           COUNT(DISTINCT UserId) as activeUsers
         FROM Users 
         WHERE LastLogin > DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY DATE(LastLogin)
         ORDER BY date DESC`);
            // משימות שהושלמו ב-30 הימים האחרונים
            const [completedTasksResult] = await connection.execute(`SELECT 
           DATE(CompletionDate) as date,
           COUNT(*) as completedTasks
         FROM Tasks 
         WHERE CompletionDate > DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY DATE(CompletionDate)
         ORDER BY date DESC`);
            // פעילות לפי רמות
            const [levelActivityResult] = await connection.execute(`SELECT 
           Level,
           COUNT(*) as taskCount,
           AVG(TaskScore) as avgScore
         FROM Tasks 
         WHERE CompletionDate > DATE_SUB(NOW(), INTERVAL 30 DAY)
         GROUP BY Level
         ORDER BY Level`);
            const activity = {
                dailyActivity: dailyActivityResult,
                completedTasks: completedTasksResult,
                levelActivity: levelActivityResult
            };
            console.log('User activity data retrieved');
            return res.json(activity);
        }
        finally {
            connection.release();
        }
    }
    catch (error) {
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
router.get('/export', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'User ID not found in token' });
        }
        console.log(`Exporting data for user: ${userId}`);
        const connection = await db_1.default.getConnection();
        try {
            // נתוני משתמש
            const [userResult] = await connection.execute('SELECT * FROM Users WHERE UserId = ?', [userId]);
            // משימות המשתמש
            const [tasksResult] = await connection.execute('SELECT * FROM Tasks WHERE UserId = ? ORDER BY StartDate DESC', [userId]);
            // מילים שהמשתמש למד
            const [wordsResult] = await connection.execute(`SELECT w.*, uw.LearningStreak, uw.LastReviewed 
         FROM Words w
         JOIN UserWords uw ON w.WordId = uw.WordId
         WHERE uw.UserId = ?
         ORDER BY uw.LastReviewed DESC`, [userId]);
            const exportData = {
                user: userResult[0],
                tasks: tasksResult,
                words: wordsResult,
                exportDate: new Date().toISOString()
            };
            console.log(`Data export completed for user ${userId}`);
            return res.json(exportData);
        }
        finally {
            connection.release();
        }
    }
    catch (error) {
        console.error('Error exporting user data:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
    }
});
exports.default = router;
