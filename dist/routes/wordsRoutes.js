"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/routes/wordsRoutes.ts
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../models/db"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const wordGenerator_1 = require("../services/wordGenerator");
const router = express_1.default.Router();
/**
 * קבלת מילים לפי נושא ורמת אנגלית
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
            let query = 'SELECT * FROM words WHERE EnglishLevel = ?';
            const params = [userEnglishLevel]; // 🔥 השתמש ב-EnglishLevel מהDB!
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
            console.log(`🔍 Found ${words.length} existing words for EnglishLevel: "${userEnglishLevel}"`);
            if (words.length < 5) {
                console.log('🤖 Not enough words - starting AI generation');
                console.log(`Topic: "${topic}", User's EnglishLevel: "${userEnglishLevel}"`);
                try {
                    console.log('📞 Calling generateWords...');
                    // 🔥 העבר את EnglishLevel האמיתי מהDB
                    const generatedWords = await (0, wordGenerator_1.generateWords)(userEnglishLevel, topic);
                    console.log(`✅ Generated ${generatedWords.length} new words:`, generatedWords);
                    if (generatedWords.length > 0) {
                        console.log('💾 Saving to database...');
                        await saveNewWordsToDatabase(generatedWords, connection);
                        const allWords = [...words, ...generatedWords];
                        console.log(`📤 Returning ${allWords.length} total words`);
                        res.json(allWords);
                        return;
                    }
                }
                catch (error) {
                    console.error('❌ AI generation failed:', error);
                }
            }
            console.log(`📤 Returning ${words.length} existing words`);
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
 * 🆕 הוספת מילים למשימה - עם batch insert מתוקן
 * POST /api/words/to-task
 */
router.post('/to-task', authMiddleware_1.authMiddleware, async (req, res) => {
    console.log("🚀 API Words - Adding words to task - START");
    console.log("📝 Request body:", JSON.stringify(req.body, null, 2));
    console.log("👤 User ID:", req.user?.id);
    try {
        const { taskId, wordIds } = req.body;
        const userId = req.user?.id;
        console.log("📋 Extracted data:");
        console.log("  - taskId:", taskId);
        console.log("  - wordIds:", wordIds);
        console.log("  - userId:", userId);
        if (!taskId) {
            console.error('❌ Missing task ID');
            return res.status(400).json({ error: 'Task ID is required' });
        }
        if (!Array.isArray(wordIds) || wordIds.length === 0) {
            console.error('❌ Missing or invalid word IDs');
            console.log("  - wordIds type:", typeof wordIds);
            console.log("  - wordIds value:", wordIds);
            return res.status(400).json({ error: 'Word IDs must be a non-empty array' });
        }
        if (!userId) {
            console.error('❌ Missing user ID');
            return res.status(401).json({ error: 'User ID not found in token' });
        }
        console.log("🔌 Getting database connection...");
        const connection = await db_1.default.getConnection();
        console.log("✅ Database connection established");
        try {
            await connection.beginTransaction();
            console.log("🔄 Transaction started");
            // בדיקה אם המשימה שייכת למשתמש
            console.log("🔍 Checking task ownership...");
            const [taskCheck] = await connection.query('SELECT TaskId, UserId FROM Tasks WHERE TaskId = ? AND UserId = ?', [taskId, userId]);
            console.log("📊 Task check result:", taskCheck);
            if (!Array.isArray(taskCheck) || taskCheck.length === 0) {
                await connection.rollback();
                console.error(`❌ Task ${taskId} does not belong to user ${userId}`);
                return res.status(403).json({ error: 'You do not have permission to modify this task' });
            }
            console.log("✅ Task ownership verified");
            // בדיקה ויצירת טבלה אם לא קיימת
            const tableToUse = 'wordintask';
            console.log(`🔍 Checking if table ${tableToUse} exists...`);
            const [tableExists] = await connection.query('SHOW TABLES LIKE ?', [tableToUse]);
            console.log("📊 Table exists check:", tableExists);
            if (!Array.isArray(tableExists) || tableExists.length === 0) {
                console.log(`🔨 Creating table ${tableToUse}...`);
                await connection.query(`
          CREATE TABLE ${tableToUse} (
            TaskId CHAR(36) NOT NULL,
            WordId CHAR(36) NOT NULL,
            AddedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
            PRIMARY KEY (TaskId, WordId)
          )
        `);
                console.log(`✅ Table ${tableToUse} created`);
            }
            else {
                console.log(`✅ Table ${tableToUse} exists`);
            }
            // בדיקה אם יש עמודת AddedAt
            console.log("🔍 Checking AddedAt column...");
            const [columns] = await connection.query(`SHOW COLUMNS FROM ${tableToUse} LIKE 'AddedAt'`);
            const hasAddedAt = Array.isArray(columns) && columns.length > 0;
            console.log("📊 Has AddedAt column:", hasAddedAt);
            // 🔧 בדוק אם כבר יש מילים במשימה הזו (מניעת duplicate)
            const [existingWords] = await connection.query('SELECT COUNT(*) as count FROM wordintask WHERE TaskId = ?', [taskId]);
            const wordCount = existingWords[0]?.count || 0;
            if (wordCount > 0) {
                console.log(`⚠️ Task ${taskId} already has ${wordCount} words, skipping duplicate insert`);
                await connection.commit();
                return res.json({
                    success: true,
                    message: 'Words already exist for this task',
                    wordsAdded: 0,
                    totalWords: wordIds.length,
                    taskId,
                    tableName: tableToUse
                });
            }
            // 🚀 Batch insert במקום לולאה
            console.log("💾 Starting batch insert of words...");
            let successCount = 0;
            const errors = [];
            try {
                if (hasAddedAt) {
                    // יצירת values array עבור batch insert עם AddedAt
                    const values = wordIds.map(wordId => [taskId, wordId, new Date()]);
                    await connection.query(`INSERT IGNORE INTO ${tableToUse} (TaskId, WordId, AddedAt) VALUES ?`, [values]);
                }
                else {
                    // יצירת values array עבור batch insert בלי AddedAt
                    const values = wordIds.map(wordId => [taskId, wordId]);
                    await connection.query(`INSERT IGNORE INTO ${tableToUse} (TaskId, WordId) VALUES ?`, [values]);
                }
                // בדיקה כמה מילים בפועל נוספו
                const [insertResult] = await connection.query('SELECT COUNT(*) as count FROM wordintask WHERE TaskId = ?', [taskId]);
                const finalWordCount = insertResult[0]?.count || 0;
                console.log(`✅ Batch insert completed: ${finalWordCount} words in task`);
                successCount = finalWordCount;
            }
            catch (batchError) {
                console.error('❌ Batch insert failed:', batchError);
                throw batchError;
            }
            await connection.commit();
            console.log("✅ Transaction committed");
            console.log("📊 Final results:");
            console.log(`  - Total words processed: ${wordIds.length}`);
            console.log(`  - Successfully added: ${successCount}`);
            console.log(`  - Errors: ${errors.length}`);
            const response = {
                success: true,
                taskId,
                wordsAdded: successCount,
                totalWords: wordIds.length,
                errors: errors.length > 0 ? errors : undefined,
                tableName: tableToUse
            };
            console.log("📤 Sending response:", response);
            res.json(response);
        }
        catch (error) {
            await connection.rollback();
            console.error("❌ Database error:", error);
            throw error;
        }
        finally {
            connection.release();
            console.log("🔌 Database connection released");
        }
    }
    catch (error) {
        console.error('💥 Fatal error adding words to task:', error);
        console.error('💥 Error details:', {
            name: error instanceof Error ? error.name : 'Unknown',
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : 'No stack trace'
        });
        res.status(500).json({
            error: 'An error occurred while adding words to task',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
    console.log("🏁 API Words - Adding words to task - END");
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
exports.default = router;
