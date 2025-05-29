"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// apps/api/src/routes/userRoutes.ts
const express_1 = __importDefault(require("express"));
const database_1 = __importDefault(require("../config/database"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const errorHandler_1 = require("../middleware/errorHandler");
const router = express_1.default.Router();
// Get user profile
router.get('/profile', authMiddleware_1.authMiddleware, async (req, res, next) => {
    try {
        // Ensure user is authenticated
        if (!req.user) {
            throw new errorHandler_1.AppError('User not authenticated', 401);
        }
        const pool = database_1.default.getPool();
        // Fetch user profile 
        const [users] = await pool.query(`SELECT 
        UserId, 
        FirstName, 
        LastName, 
        Email, 
        PhoneNumber, 
        EnglishLevel, 
        AgeRange, 
        ProfilePicture, 
        CreationDate, 
        LastLogin 
      FROM Users 
      WHERE UserId = ?`, [req.user.id]);
        // Check if user exists
        if (!users || users.length === 0) {
            throw new errorHandler_1.AppError('User profile not found', 404);
        }
        // Return user profile
        res.json(users[0]);
    }
    catch (error) {
        next(error);
    }
});
// Get user gamification data
router.get('/data', authMiddleware_1.authMiddleware, async (req, res, next) => {
    try {
        // Ensure user is authenticated
        if (!req.user) {
            throw new errorHandler_1.AppError('User not authenticated', 401);
        }
        const pool = database_1.default.getPool();
        // Complex query to fetch user gamification data
        const [userData] = await pool.query(`
      SELECT 
        u.Score as totalScore,
        u.CreationDate,
        (SELECT COUNT(*) FROM Tasks t WHERE t.UserId = u.UserId AND t.CompletionDate IS NOT NULL) as completedTasksCount,
        ul.Level as currentLevel,
ul.EarnedScore as currentLevelPoints,
        (SELECT Level FROM UserINLevel 
         WHERE UserId = u.UserId 
         ORDER BY EarnedScore DESC 
         LIMIT 1) as nextLevel,
        (SELECT LevelScore FROM Levels 
         WHERE TopicName = (
           SELECT TopicName FROM UserINLevel 
           WHERE UserId = u.UserId 
           ORDER BY EarnedScore DESC 
           LIMIT 1
         ) 
         AND Level = (
           SELECT Level FROM UserINLevel 
           WHERE UserId = u.UserId 
           ORDER BY EarnedScore DESC 
           LIMIT 1
         )
        ) as pointsToNextLevel
      FROM 
        Users u
      LEFT JOIN 
        UserINLevel ul ON u.UserId = ul.UserId
      WHERE 
        u.UserId = ?
    `, [req.user.id]);
        // Check if user data exists
        if (!userData || userData.length === 0) {
            throw new errorHandler_1.AppError('User data not found', 404);
        }
        // Return user gamification data
        res.json(userData[0]);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
