"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
//backend/src/routes/wordsRoutes.ts
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../models/db"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const wordGenerator_1 = require("../services/wordGenerator");
const requiredWordsController = __importStar(require("../controllers/requiredWordsController"));
const router = express_1.default.Router();
/**
 * קבלת מילים לפי נושא ורמת אנגלית - עם סינון מילים שנלמדו
 * GET /api/words?topic=topicName&level=level&randomLimit=5&filterLearned=true
 */
router.get('/', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        console.log('🚀 GET /api/words - Starting request');
        console.log('📥 Query params:', req.query);
        console.log('👤 User ID:', req.user?.id);
        const { topic, level, randomLimit, filterLearned } = req.query;
        const userId = req.user?.id;
        if (!userId) {
            console.log('❌ No user ID found');
            return res.status(401).json({ error: 'User ID not found in token' });
        }
        const connection = await db_1.default.getConnection();
        try {
            // 🔥 קודם כל - קבל את EnglishLevel של המשתמש מהDB
            const [userRows] = await connection.query('SELECT EnglishLevel FROM users WHERE UserId = ?', [userId]);
            const users = userRows;
            const userEnglishLevel = users[0]?.EnglishLevel || 'intermediate';
            console.log(`👤 User's English Level from DB: "${userEnglishLevel}"`);
            // השתמש ב-level מה-query (השלב) לחיפוש במילים
            let userLevel = level || '1';
            // 🔥 שאילתה מתוקנת לסינון מילים שנלמדו
            let query = `
        SELECT DISTINCT w.* 
        FROM words w 
        WHERE w.EnglishLevel = ?
      `;
            const params = [userEnglishLevel];
            // Add topic filter if provided
            if (topic) {
                query += ' AND (w.TopicName = ? OR LOWER(w.TopicName) = LOWER(?))';
                params.push(topic, topic);
            }
            // 🔥 סינון מילים שכבר נלמדו על ידי המשתמש
            query += ` 
        AND w.WordId NOT IN (
          SELECT DISTINCT wit.WordId
          FROM wordintask wit
          JOIN Tasks t ON wit.TaskId = t.TaskId
          WHERE t.UserId = ?
        )
      `;
            params.push(userId);
            // Add random ordering and limit
            const limit = randomLimit ? parseInt(randomLimit, 10) : 20;
            query += ' ORDER BY RAND() LIMIT ?';
            params.push(limit);
            console.log('🔍 Executing query:', query);
            console.log('📊 Query params:', params);
            const [words] = await connection.query(query, params);
            console.log(`🔍 Found ${words.length} unlearned words for EnglishLevel: "${userEnglishLevel}"`);
            if (words.length < 5) {
                console.log('🤖 Not enough unlearned words - starting AI generation');
                console.log(`Topic: "${topic}", User's EnglishLevel: "${userEnglishLevel}"`);
                try {
                    console.log('📞 Calling generateWords...');
                    // 🔥 העבר את EnglishLevel האמיתי מהDB
                    const generatedWords = await (0, wordGenerator_1.generateWords)(userEnglishLevel, topic);
                    console.log(`✅ Generated ${generatedWords.length} new words:`, generatedWords);
                    if (generatedWords.length > 0) {
                        console.log('💾 Saving to database...');
                        await saveNewWordsToDatabase(generatedWords, connection);
                        // 🔥 סנן מילים חדשות שלא נלמדו עדיין
                        const filteredNewWords = [];
                        for (const newWord of generatedWords) {
                            const [learned] = await connection.query(`SELECT 1 FROM wordintask wit
                 JOIN Tasks t ON wit.TaskId = t.TaskId
                 WHERE t.UserId = ? AND wit.WordId = ?`, [userId, newWord.WordId]);
                            if (!Array.isArray(learned) || learned.length === 0) {
                                filteredNewWords.push(newWord);
                            }
                        }
                        const allWords = [...words, ...filteredNewWords];
                        console.log(`📤 Returning ${allWords.length} total unlearned words`);
                        res.json(allWords);
                        return;
                    }
                }
                catch (error) {
                    console.error('❌ AI generation failed:', error);
                }
            }
            console.log(`📤 Returning ${words.length} existing unlearned words`);
            res.json(words);
        }
        finally {
            connection.release();
        }
    }
    catch (error) {
        console.error('💥 Route error:', error);
        res.status(500).json({ error: 'Failed to fetch words' });
    }
});
router.get('/required', requiredWordsController.getRequiredWords);
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
            if (topic) {
                query += ' AND (LOWER(w.TopicName) = LOWER(?) OR LOWER(w.TopicName) = LOWER(?))';
                params.push(topic, topic);
            }
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
/**
 * קבלת מילים של משימה ספציפית
 * GET /api/words/in-task?taskId=xxx
 */
router.get('/in-task', authMiddleware_1.authMiddleware, async (req, res) => {
    console.log("API Words - Getting words for task");
    try {
        const taskId = req.query.taskId;
        const userId = req.user?.id;
        if (!taskId) {
            console.error('Missing task ID');
            return res.status(400).json({ error: 'Task ID parameter is required' });
        }
        if (!userId) {
            return res.status(401).json({ error: 'User ID not found in token' });
        }
        const connection = await db_1.default.getConnection();
        try {
            // בדיקה אם המשימה שייכת למשתמש
            const [taskCheck] = await connection.query('SELECT 1 FROM Tasks WHERE TaskId = ? AND UserId = ?', [taskId, userId]);
            if (!Array.isArray(taskCheck) || taskCheck.length === 0) {
                console.error(`Task ${taskId} does not belong to user ${userId}`);
                return res.status(403).json({ error: 'You do not have permission to view this task' });
            }
            // בדיקה איזו טבלה קיימת
            const tableNames = ['wordintask', 'WordInTask'];
            let tableToUse = '';
            for (const tableName of tableNames) {
                const [result] = await connection.query('SHOW TABLES LIKE ?', [tableName]);
                if (Array.isArray(result) && result.length > 0) {
                    tableToUse = tableName;
                    break;
                }
            }
            if (!tableToUse) {
                console.error('No word-task relationship table found');
                return res.json({
                    success: false,
                    error: 'No word-task relationship table found',
                    data: []
                });
            }
            console.log(`Using table ${tableToUse} to get words for task ${taskId}`);
            // בדיקה אם יש עמודת AddedAt
            const [columns] = await connection.query(`SHOW COLUMNS FROM ${tableToUse} LIKE 'AddedAt'`);
            const hasAddedAt = Array.isArray(columns) && columns.length > 0;
            // שליפת המילים עם פרטים נוספים
            let query;
            if (hasAddedAt) {
                query = `
          SELECT wit.WordId, wit.AddedAt, w.Word, w.Translation, w.ExampleUsage, w.PartOfSpeech, w.TopicName
          FROM ${tableToUse} wit
          JOIN Words w ON wit.WordId = w.WordId
          WHERE wit.TaskId = ?
          ORDER BY wit.AddedAt DESC
        `;
            }
            else {
                query = `
          SELECT wit.WordId, NOW() as AddedAt, w.Word, w.Translation, w.ExampleUsage, w.PartOfSpeech, w.TopicName
          FROM ${tableToUse} wit
          JOIN Words w ON wit.WordId = w.WordId
          WHERE wit.TaskId = ?
        `;
            }
            const [rows] = await connection.query(query, [taskId]);
            console.log(`Retrieved ${Array.isArray(rows) ? rows.length : 0} words for task ${taskId}`);
            res.json({
                success: true,
                taskId,
                data: rows
            });
        }
        finally {
            connection.release();
        }
    }
    catch (error) {
        console.error('Error getting words for task:', error);
        res.status(500).json({
            error: 'An error occurred while getting words for task',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * 📝 שמירת מילים למשימה (הפונקציה הקיימת - לתאימות אחורה)
 * POST /api/words/word-to-task
 */
router.post('/word-to-task', authMiddleware_1.authMiddleware, async (req, res) => {
    console.log("🚀 API Words - Legacy word-to-task endpoint");
    console.log("📝 Request body:", JSON.stringify(req.body, null, 2));
    try {
        const { mappings } = req.body; // array של {WordId, TaskId}
        if (!Array.isArray(mappings)) {
            return res.status(400).json({ error: 'Mappings must be an array' });
        }
        const connection = await db_1.default.getConnection();
        try {
            for (const mapping of mappings) {
                await connection.query('INSERT IGNORE INTO wordintask (WordId, TaskId) VALUES (?, ?)', [mapping.WordId, mapping.TaskId]);
            }
            console.log(`Saved ${mappings.length} word-to-task mappings`);
            res.json({ success: true, count: mappings.length });
        }
        finally {
            connection.release();
        }
    }
    catch (error) {
        console.error('Error saving word-to-task mappings:', error);
        res.status(500).json({ error: 'Failed to save mappings' });
    }
});
async function saveNewWordsToDatabase(words, connection) {
    try {
        for (const word of words) {
            await connection.query('INSERT INTO words (WordId, Word, Translation, ExampleUsage, TopicName, EnglishLevel) VALUES (?, ?, ?, ?, ?, ?)', [word.WordId, word.Word, word.Translation, word.ExampleUsage, word.TopicName, word.EnglishLevel]);
        }
        console.log(`💾 Saved ${words.length} new words to database`);
    }
    catch (error) {
        console.error('❌ Error saving words to database:', error);
        throw error;
    }
}
/**
 * 📝 שמירת מילים למשימה - גרסה חדשה מתוקנת
 * POST /api/words/to-task
 */
router.post('/to-task', authMiddleware_1.authMiddleware, async (req, res) => {
    console.log("🚀 API Words - Adding words to task");
    console.log("📝 Request body:", JSON.stringify(req.body, null, 2));
    let dbConnection;
    try {
        const { taskId, wordIds } = req.body;
        const userId = req.user?.id;
        console.log('📋 Adding words to task:', { taskId, wordIdsCount: wordIds?.length, userId });
        if (!taskId || !Array.isArray(wordIds) || wordIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'taskId and wordIds array are required'
            });
        }
        dbConnection = await db_1.default.getConnection();
        await dbConnection.beginTransaction();
        // Verify task exists and belongs to user
        const [tasks] = await dbConnection.execute('SELECT * FROM Tasks WHERE TaskId = ? AND UserId = ?', [taskId, userId]);
        if (!Array.isArray(tasks) || tasks.length === 0) {
            await dbConnection.rollback();
            return res.status(404).json({
                success: false,
                error: 'Task not found or unauthorized'
            });
        }
        // Check if words already exist for this task
        const [existingWords] = await dbConnection.execute('SELECT WordId FROM wordintask WHERE TaskId = ?', [taskId]);
        if (Array.isArray(existingWords) && existingWords.length > 0) {
            console.log(`⚠️ Task ${taskId} already has ${existingWords.length} words, skipping duplicate save`);
            await dbConnection.rollback();
            return res.status(200).json({
                success: true,
                message: 'Words already exist for this task',
                existingCount: existingWords.length
            });
        }
        // Prepare values for batch insert
        const values = wordIds.map(wordId => [
            taskId,
            wordId,
            new Date().toISOString().slice(0, 19).replace('T', ' ')
        ]);
        // Insert word usage records - check if AddedAt column exists
        const [columns] = await dbConnection.query('SHOW COLUMNS FROM wordintask LIKE "AddedAt"');
        const hasAddedAt = Array.isArray(columns) && columns.length > 0;
        let insertQuery;
        let insertValues;
        if (hasAddedAt) {
            insertQuery = 'INSERT INTO wordintask (TaskId, WordId, AddedAt) VALUES ?';
            insertValues = [values];
        }
        else {
            insertQuery = 'INSERT INTO wordintask (TaskId, WordId) VALUES ?';
            insertValues = [wordIds.map(wordId => [taskId, wordId])];
        }
        const [result] = await dbConnection.query(insertQuery, insertValues);
        await dbConnection.commit();
        console.log(`✅ Successfully added ${wordIds.length} words to task ${taskId}`);
        res.json({
            success: true,
            message: `Successfully added ${wordIds.length} words to task`,
            wordsAdded: wordIds.length,
            result
        });
    }
    catch (error) {
        console.error('💥 Error adding words to task:', error);
        if (dbConnection)
            await dbConnection.rollback();
        res.status(500).json({
            success: false,
            error: 'Failed to add words to task',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
    finally {
        if (dbConnection)
            dbConnection.release();
    }
});
exports.default = router;
