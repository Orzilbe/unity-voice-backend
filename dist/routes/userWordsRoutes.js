"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
//backend/src/routes/userWordsRoutes.ts
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../models/db"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const uuid_1 = require("uuid");
const router = express_1.default.Router();
/**
 * GET /api/user-words/known - Get user's known words through tasks
 */
router.get('/known', authMiddleware_1.authMiddleware, async (req, res) => {
    let dbConnection;
    try {
        dbConnection = await db_1.default.getConnection();
        // Get words that the user has marked as known through tasks
        const [words] = await dbConnection.execute(`SELECT DISTINCT w.* 
       FROM Words w
       INNER JOIN wordintask wit ON w.WordId = wit.WordId
       INNER JOIN Tasks t ON wit.TaskId = t.TaskId
       WHERE t.UserId = ?
       ORDER BY wit.AddedAt DESC`, [req.user?.id]);
        res.json(words);
    }
    catch (error) {
        console.error('Error fetching known words:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch known words'
        });
    }
    finally {
        if (dbConnection)
            dbConnection.release();
    }
});
/**
 * POST /api/user-words/known - Mark a word as known by creating a task
 */
router.post('/known', authMiddleware_1.authMiddleware, async (req, res) => {
    let dbConnection;
    try {
        dbConnection = await db_1.default.getConnection();
        await dbConnection.beginTransaction();
        const { wordId } = req.body;
        if (!wordId) {
            return res.status(400).json({
                success: false,
                error: 'Word ID is required'
            });
        }
        // Check if word exists
        const [words] = await dbConnection.execute('SELECT TopicName FROM Words WHERE WordId = ?', [wordId]);
        if (!Array.isArray(words) || words.length === 0) {
            await dbConnection.rollback();
            return res.status(404).json({
                success: false,
                error: 'Word not found'
            });
        }
        const word = words[0];
        // Create a task for this word if it doesn't exist
        const taskId = (0, uuid_1.v4)();
        await dbConnection.execute(`INSERT INTO Tasks (
        TaskId, 
        UserId, 
        TopicName, 
        Level, 
        TaskType, 
        TaskScore,
        CompletionDate
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())`, [
            taskId,
            req.user?.id,
            word.TopicName,
            'beginner', // Default level
            'word_known',
            100 // Default score for known words
        ]);
        // Add word to task
        await dbConnection.execute('INSERT INTO wordintask (TaskId, WordId, AddedAt) VALUES (?, ?, NOW())', [taskId, wordId]);
        await dbConnection.commit();
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error marking word as known:', error);
        if (dbConnection)
            await dbConnection.rollback();
        res.status(500).json({
            success: false,
            error: 'Failed to mark word as known'
        });
    }
    finally {
        if (dbConnection)
            dbConnection.release();
    }
});
/**
 * DELETE /api/user-words/known/:wordId - Remove a word from known words
 */
router.delete('/known/:wordId', authMiddleware_1.authMiddleware, async (req, res) => {
    let dbConnection;
    try {
        dbConnection = await db_1.default.getConnection();
        await dbConnection.beginTransaction();
        const { wordId } = req.params;
        // Delete the task and its word associations
        await dbConnection.execute(`DELETE t, wit 
       FROM Tasks t
       INNER JOIN wordintask wit ON t.TaskId = wit.TaskId
       WHERE t.UserId = ? 
       AND t.TaskType = 'word_known'
       AND wit.WordId = ?`, [req.user?.id, wordId]);
        await dbConnection.commit();
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error unmarking word as known:', error);
        if (dbConnection)
            await dbConnection.rollback();
        res.status(500).json({
            success: false,
            error: 'Failed to unmark word as known'
        });
    }
    finally {
        if (dbConnection)
            dbConnection.release();
    }
});
exports.default = router;
