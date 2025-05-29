"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.topics = void 0;
exports.completeUserLevel = completeUserLevel;
exports.initializeUserLevels = initializeUserLevels;
// apps/api/src/services/userLevelService.ts
const database_1 = __importDefault(require("../config/database"));
/**
 * Updates user level completion based on all completed tasks
 * @param userId User ID
 * @param topicName Topic name
 * @param level Current level
 * @returns Success status and updated data
 */
async function completeUserLevel(userId, topicName, level) {
    const pool = database_1.default.getPool();
    try {
        // Begin transaction
        await pool.query('START TRANSACTION');
        // 1. Calculate the total score from all completed tasks for this topic and level
        const [tasksResult] = await pool.query(`
      SELECT AVG(TaskScore) as averageScore
      FROM Tasks
      WHERE UserId = ? AND TopicName = ? AND Level = ? AND CompletionDate IS NOT NULL
    `, [userId, topicName, level]);
        const tasks = tasksResult;
        const averageScore = tasks.length > 0 && tasks[0].averageScore ?
            Math.round(tasks[0].averageScore) : 60; // Default to 60 if no tasks found
        // 2. Update the userinlevel record with the calculated score and mark as completed
        await pool.query(`
      UPDATE UserINLevel
      SET EarnedScore = ?, CompletedAt = NOW()
      WHERE UserId = ? AND TopicName = ? AND Level = ?
    `, [averageScore, userId, topicName, level]);
        // 3. Check if next level record already exists
        const nextLevel = level + 1;
        const [existingNextLevel] = await pool.query(`
      SELECT * FROM UserINLevel
      WHERE UserId = ? AND TopicName = ? AND Level = ?
    `, [userId, topicName, nextLevel]);
        // 4. Create next level record if it doesn't exist
        if (existingNextLevel.length === 0) {
            await pool.query(`
        INSERT INTO UserINLevel
        (TopicName, Level, UserId, EarnedScore, CompletedAt)
        VALUES (?, ?, ?, 0, NULL)
      `, [topicName, nextLevel, userId]);
        }
        // Commit transaction
        await pool.query('COMMIT');
        return {
            success: true,
            data: {
                userId,
                topicName,
                completedLevel: level,
                earnedScore: averageScore,
                nextLevel
            }
        };
    }
    catch (error) {
        // Rollback transaction in case of error
        await pool.query('ROLLBACK');
        console.error('Error completing user level:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        };
    }
}
exports.topics = [
    {
        TopicName: 'Society and Multiculturalism',
        TopicHe: 'חברה ורב תרבותיות',
        Icon: '🌍'
    },
    {
        TopicName: 'Innovation and Technology',
        TopicHe: 'חדשנות וטכנולוגיה',
        Icon: '💡'
    },
    {
        TopicName: 'History and Heritage',
        TopicHe: 'הסטוריה ומורשת',
        Icon: '🏛️'
    },
    {
        TopicName: 'Holocaust and Revival',
        TopicHe: 'שואה ותקומה',
        Icon: '✡️'
    },
    {
        TopicName: 'Environment and Sustainability',
        TopicHe: 'סביבה וקיימות',
        Icon: '🌱'
    },
    {
        TopicName: 'Economy and Entrepreneurship',
        TopicHe: 'כלכלה ויזמות',
        Icon: '💰'
    },
    {
        TopicName: 'Diplomacy and International Relations',
        TopicHe: 'דיפלומטיה ויחסים בינלאומיים',
        Icon: '🤝'
    },
    {
        TopicName: 'Iron Swords War',
        TopicHe: 'מלחמת חרבות ברזל',
        Icon: '⚔️'
    }
];
async function initializeUserLevels(userId) {
    const pool = database_1.default.getPool();
    try {
        // Begin transaction
        await pool.query('START TRANSACTION');
        // קודם כל, נקבל את כל הרמות הקיימות ב-DB
        const [levels] = await pool.query(`
      SELECT TopicName, Level FROM Levels 
      WHERE Level = 1
    `);
        // ניצור רשומה לכל נושא ברמה 1
        for (const level of levels) {
            await pool.query(`
        INSERT INTO UserINLevel 
        (TopicName, Level, UserId, EarnedScore, CompletedAt) 
        VALUES (?, ?, ?, 0, NULL)
      `, [level.TopicName, level.Level, userId]);
        }
        // Commit transaction
        await pool.query('COMMIT');
        console.log(`Initialized levels for user ${userId}`);
    }
    catch (error) {
        // Rollback transaction in case of error
        await pool.query('ROLLBACK');
        console.error('Error initializing user levels:', error);
        throw error;
    }
}
