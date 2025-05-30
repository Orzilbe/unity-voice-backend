"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../models/db"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
/**
 * קבלת פרופיל משתמש
 * GET /api/user-profile
 */
router.get('/', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        console.log('GET /api/user-profile - Fetching user profile');
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'User ID not found in token' });
        }
        const connection = await db_1.default.getConnection();
        try {
            const [rows] = await connection.query(`SELECT 
          UserId,
          FirstName,
          LastName,
          Email,
          PhoneNumber,
          EnglishLevel,
          AgeRange,
          ProfilePicture,
          CreationDate,
          LastLogin,
          Score
        FROM Users 
        WHERE UserId = ?`, [userId]);
            const users = rows;
            if (users.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }
            const userData = users[0];
            // Return user profile with all necessary fields
            res.json({
                FirstName: userData.FirstName || '',
                LastName: userData.LastName || '',
                Email: userData.Email || '',
                PhoneNumber: userData.PhoneNumber || '',
                EnglishLevel: userData.EnglishLevel || 'Not Set',
                AgeRange: userData.AgeRange || '',
                ProfilePicture: userData.ProfilePicture || null,
                CreationDate: userData.CreationDate || new Date(),
                LastLogin: userData.LastLogin || null,
                Score: userData.Score || 0
            });
        }
        finally {
            connection.release();
        }
    }
    catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ error: 'Failed to fetch user profile' });
    }
});
/**
 * עדכון פרופיל משתמש
 * PUT /api/user-profile
 */
router.put('/', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        console.log('PUT /api/user-profile - Updating user profile');
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'User ID not found in token' });
        }
        const { FirstName, LastName, PhoneNumber, EnglishLevel, AgeRange } = req.body;
        const connection = await db_1.default.getConnection();
        try {
            // Update user profile
            await connection.query(`UPDATE Users 
         SET FirstName = ?, LastName = ?, PhoneNumber = ?, EnglishLevel = ?, AgeRange = ?
         WHERE UserId = ?`, [FirstName, LastName, PhoneNumber, EnglishLevel, AgeRange, userId]);
            // Fetch updated profile
            const [rows] = await connection.query(`SELECT 
          FirstName,
          LastName,
          Email,
          PhoneNumber,
          EnglishLevel,
          AgeRange,
          ProfilePicture,
          CreationDate,
          LastLogin,
          Score
        FROM Users 
        WHERE UserId = ?`, [userId]);
            const users = rows;
            const userData = users[0];
            res.json({
                success: true,
                user: {
                    FirstName: userData.FirstName || '',
                    LastName: userData.LastName || '',
                    Email: userData.Email || '',
                    PhoneNumber: userData.PhoneNumber || '',
                    EnglishLevel: userData.EnglishLevel || 'Not Set',
                    AgeRange: userData.AgeRange || '',
                    ProfilePicture: userData.ProfilePicture || null,
                    CreationDate: userData.CreationDate || new Date(),
                    LastLogin: userData.LastLogin || null,
                    Score: userData.Score || 0
                }
            });
        }
        finally {
            connection.release();
        }
    }
    catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ error: 'Failed to update user profile' });
    }
});
/**
 * קבלת נתוני משתמש מורחבים (כולל סטטיסטיקות)
 * GET /api/user-profile/data
 */
router.get('/data', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        console.log('GET /api/user-profile/data - Fetching user data with statistics');
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'User ID not found in token' });
        }
        const connection = await db_1.default.getConnection();
        try {
            // Get user basic info
            const [userRows] = await connection.query(`SELECT FirstName, LastName, Email, Score, CreationDate
         FROM Users 
         WHERE UserId = ?`, [userId]);
            // Get completed tasks count
            const [completedTasksRows] = await connection.query(`SELECT COUNT(*) as completedTasksCount
         FROM Tasks 
         WHERE UserId = ? AND CompletionDate IS NOT NULL`, [userId]);
            // Get total activities count
            const [totalActivitiesRows] = await connection.query(`SELECT COUNT(*) as totalActivities
         FROM Tasks 
         WHERE UserId = ?`, [userId]);
            const users = userRows;
            const completedTasks = completedTasksRows[0]?.completedTasksCount || 0;
            const totalActivities = totalActivitiesRows[0]?.totalActivities || 0;
            if (users.length === 0) {
                return res.status(404).json({ message: 'User not found' });
            }
            const userData = users[0];
            const score = userData.Score || 0;
            // Calculate level based on score
            let currentLevel = "Beginner";
            let pointsToNextLevel = 100;
            let nextLevel = "Intermediate";
            if (score >= 1000) {
                currentLevel = "Expert";
                pointsToNextLevel = 0;
                nextLevel = "Expert";
            }
            else if (score >= 500) {
                currentLevel = "Advanced";
                pointsToNextLevel = 1000 - score;
                nextLevel = "Expert";
            }
            else if (score >= 100) {
                currentLevel = "Intermediate";
                pointsToNextLevel = 500 - score;
                nextLevel = "Advanced";
            }
            else {
                currentLevel = "Beginner";
                pointsToNextLevel = 100 - score;
                nextLevel = "Intermediate";
            }
            res.json({
                FirstName: userData.FirstName || '',
                LastName: userData.LastName || '',
                Email: userData.Email || '',
                Score: score,
                CreationDate: userData.CreationDate,
                currentLevel,
                currentLevelPoints: score % 100,
                nextLevel,
                pointsToNextLevel,
                completedTasksCount: completedTasks,
                totalActivities
            });
        }
        finally {
            connection.release();
        }
    }
    catch (error) {
        console.error('Error fetching user data:', error);
        res.status(500).json({ error: 'Failed to fetch user data' });
    }
});
exports.default = router;
