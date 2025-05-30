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
 * קבלת מילים לפי נושא ורמת אנגלית
 * GET /api/words?topic=topicName&level=level&randomLimit=5&filterLearned=true
 */
router.get('/', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        console.log('GET /api/words - Fetching words');
        const { topic, level, randomLimit, filterLearned } = req.query;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'User ID not found in token' });
        }
        // Get user's English level from database if not provided
        let userLevel = level;
        if (!userLevel) {
            const connection = await db_1.default.getConnection();
            try {
                const [userRows] = await connection.query('SELECT EnglishLevel FROM Users WHERE UserId = ?', [userId]);
                const users = userRows;
                userLevel = users[0]?.EnglishLevel || 'intermediate';
            }
            finally {
                connection.release();
            }
        }
        const connection = await db_1.default.getConnection();
        try {
            let query = 'SELECT * FROM Words WHERE EnglishLevel = ?';
            const params = [userLevel];
            // Add topic filter if provided
            if (topic) {
                query += ' AND (TopicName = ? OR LOWER(TopicName) = LOWER(?))';
                params.push(topic, topic);
            }
            // Add random ordering and limit
            const limit = randomLimit ? parseInt(randomLimit, 10) : 20;
            query += ' ORDER BY RAND() LIMIT ?';
            params.push(limit);
            const [words] = await connection.query(query, params);
            console.log(`Retrieved ${words.length} words for topic: ${topic}, level: ${userLevel}`);
            res.json(words);
        }
        finally {
            connection.release();
        }
    }
    catch (error) {
        console.error('Error fetching words:', error);
        res.status(500).json({ error: 'Failed to fetch words' });
    }
});
/**
 * קבלת מילים שנלמדו לפי משתמש ונושא
 * GET /api/words/learned?topic=topicName&level=1
 */
router.get('/learned', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        console.log('GET /api/words/learned - Fetching learned words');
        const { topic, level } = req.query;
        const userId = req.user?.id;
        if (!userId) {
            return res.status(401).json({ error: 'User ID not found in token' });
        }
        const connection = await db_1.default.getConnection();
        try {
            let query = `
        SELECT DISTINCT w.*
        FROM Words w
        JOIN wordintask wit ON w.WordId = wit.WordId
        JOIN Tasks t ON wit.TaskId = t.TaskId
        WHERE t.UserId = ? AND t.CompletionDate IS NOT NULL
      `;
            const params = [userId];
            // Add topic filter if provided
            if (topic) {
                query += ' AND (LOWER(w.TopicName) = LOWER(?) OR LOWER(w.TopicName) = LOWER(?))';
                params.push(topic, topic);
            }
            // Add level filter if provided
            if (level) {
                query += ' AND t.Level = ?';
                params.push(level);
            }
            query += ' ORDER BY w.Word';
            const [learnedWords] = await connection.query(query, params);
            console.log(`Retrieved ${learnedWords.length} learned words for user: ${userId}`);
            res.json(learnedWords);
        }
        finally {
            connection.release();
        }
    }
    catch (error) {
        console.error('Error fetching learned words:', error);
        res.status(500).json({ error: 'Failed to fetch learned words' });
    }
});
exports.default = router;
