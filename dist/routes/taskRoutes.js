"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
//backend/src/routes/taskRoutes.ts - COMPLETE FIXED VERSION
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const uuid_1 = require("uuid");
const db_1 = require("../lib/db");
const router = express_1.default.Router();
/**
 * יצירת משימה חדשה - גרסה מתוקנת
 * POST /api/tasks
 */
router.post('/', authMiddleware_1.authMiddleware, async (req, res) => {
    let connection = null;
    try {
        console.log('🚀 Creating new task with data:', req.body);
        console.log('👤 Authenticated user:', req.user);
        const { UserId, TopicName, Level, TaskType, TaskScore = 0, StartDate } = req.body;
        // ✅ בדיקת הפרמטרים הנדרשים
        if (!UserId || !TopicName || !Level || !TaskType) {
            console.log('❌ Missing required fields');
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: UserId, TopicName, Level, TaskType',
                missingFields: [
                    !UserId ? 'UserId' : null,
                    !TopicName ? 'TopicName' : null,
                    !Level ? 'Level' : null,
                    !TaskType ? 'TaskType' : null
                ].filter(Boolean)
            });
        }
        // ✅ תיקון: ולידציה שהמשתמש בtoken תואם למשתמש בבקשה
        const authenticatedUserId = req.user?.id || req.user?.userId;
        if (!authenticatedUserId) {
            console.log('❌ No user ID found in token');
            return res.status(401).json({
                success: false,
                error: 'User not authenticated - no user ID in token'
            });
        }
        // המרה לstring לצורך השוואה עם הDB
        const tokenUserId = authenticatedUserId.toString();
        // השוואה עם UserId מהבקשה (שמגיע מהfrontend)
        if (tokenUserId !== UserId.toString()) {
            console.log(`❌ User ID mismatch: token=${tokenUserId}, request=${UserId}`);
            return res.status(403).json({
                success: false,
                error: 'UserId in request does not match authenticated user'
            });
        }
        console.log(`✅ User ID validated: ${UserId}`);
        // ✅ השתמש ב-UserId מהבקשה (שכבר אומת)
        const finalUserId = UserId.toString();
        // קבלת חיבור למסד הנתונים
        const dbPool = await (0, db_1.getDbPool)();
        if (!dbPool) {
            console.error('❌ Database pool not available');
            return res.status(500).json({
                success: false,
                error: 'Database connection not available'
            });
        }
        connection = await dbPool.getConnection();
        console.log('✅ Database connection established');
        // בדיקה שהנושא והרמה קיימים
        console.log(`🔍 Checking if topic "${TopicName}" with level ${Level} exists`);
        const [levelExists] = await connection.execute('SELECT 1 FROM Levels WHERE TopicName = ? AND Level = ?', [TopicName, Level]);
        if (!Array.isArray(levelExists) || levelExists.length === 0) {
            console.log(`❌ Topic "${TopicName}" with level ${Level} not found`);
            return res.status(404).json({
                success: false,
                error: `Topic '${TopicName}' with level ${Level} not found`
            });
        }
        console.log('✅ Topic and level validated');
        // בדיקה שהמשתמש קיים
        console.log(`🔍 Checking if user ${finalUserId} exists`);
        const [userExists] = await connection.execute('SELECT 1 FROM Users WHERE UserId = ?', [finalUserId]);
        if (!Array.isArray(userExists) || userExists.length === 0) {
            console.log(`❌ User ${finalUserId} not found in database`);
            return res.status(404).json({
                success: false,
                error: `User with ID ${finalUserId} not found`
            });
        }
        console.log('✅ User validated');
        // בדיקה אם כבר קיימת משימה פתוחה מאותו סוג
        console.log(`🔍 Checking for existing incomplete ${TaskType} task`);
        const [existingTasks] = await connection.execute(`SELECT TaskId FROM Tasks 
       WHERE UserId = ? AND TopicName = ? AND Level = ? AND TaskType = ? 
       AND CompletionDate IS NULL`, [finalUserId, TopicName, Level, TaskType]);
        if (Array.isArray(existingTasks) && existingTasks.length > 0) {
            const existingTaskId = existingTasks[0].TaskId;
            console.log(`✅ Found existing incomplete task: ${existingTaskId}`);
            return res.status(200).json({
                success: true,
                TaskId: existingTaskId,
                UserId: finalUserId,
                TopicName: TopicName,
                Level: Level,
                TaskType: TaskType,
                TaskScore: TaskScore,
                StartDate: StartDate || null,
                message: 'Using existing incomplete task'
            });
        }
        // יצירת משימה חדשה
        const TaskId = (0, uuid_1.v4)();
        console.log(`🆕 Creating new task with ID: ${TaskId}`);
        // SQL מפושט עם טיפול בתאריכים
        const currentTimestamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
        const taskStartDate = StartDate || currentTimestamp;
        const insertSql = `
      INSERT INTO Tasks (
        TaskId, 
        UserId, 
        TopicName, 
        Level, 
        TaskType, 
        TaskScore,
        StartDate
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
        const insertParams = [
            TaskId,
            finalUserId,
            TopicName,
            Level,
            TaskType,
            TaskScore,
            taskStartDate
        ];
        console.log('📝 Executing SQL:', insertSql);
        console.log('📋 With parameters:', insertParams);
        const [result] = await connection.execute(insertSql, insertParams);
        console.log('✅ Task created successfully:', result);
        // תגובה מוצלחת
        return res.status(201).json({
            success: true,
            TaskId: TaskId,
            UserId: finalUserId,
            TopicName: TopicName,
            Level: Level,
            TaskType: TaskType,
            TaskScore: TaskScore,
            StartDate: taskStartDate,
            message: 'Task created successfully'
        });
    }
    catch (error) {
        console.error('💥 Error creating task:', error);
        let errorMessage = 'Unknown error occurred';
        let statusCode = 500;
        if (error instanceof Error) {
            errorMessage = error.message;
            console.error('Error details:', {
                name: error.name,
                message: error.message,
                stack: error.stack?.substring(0, 500)
            });
            // בדיקת סוגי שגיאות ספציפיים
            if (error.message.includes('ECONNREFUSED')) {
                errorMessage = 'Database connection failed';
            }
            else if (error.message.includes('ER_NO_SUCH_TABLE')) {
                errorMessage = 'Database table not found';
            }
            else if (error.message.includes('ER_DUP_ENTRY')) {
                errorMessage = 'Duplicate entry detected';
            }
        }
        return res.status(statusCode).json({
            success: false,
            error: errorMessage,
            timestamp: new Date().toISOString(),
            ...(process.env.NODE_ENV === 'development' && {
                details: error instanceof Error ? error.stack : String(error)
            })
        });
    }
    finally {
        if (connection) {
            try {
                connection.release();
                console.log('🔌 Database connection released');
            }
            catch (releaseError) {
                console.error('❌ Error releasing database connection:', releaseError);
            }
        }
    }
});
/**
 * עדכון משימה קיימת
 * PATCH /api/tasks/:taskId
 */
router.patch('/:taskId', authMiddleware_1.authMiddleware, async (req, res) => {
    let connection = null;
    try {
        console.log(`🔄 Updating task ${req.params.taskId} with data:`, req.body);
        const { taskId } = req.params;
        const { TaskScore, DurationTask, CompletionDate } = req.body;
        const authenticatedUserId = req.user?.id || req.user?.userId;
        if (!authenticatedUserId) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated'
            });
        }
        const dbPool = await (0, db_1.getDbPool)();
        if (!dbPool) {
            return res.status(500).json({
                success: false,
                error: 'Database connection not available'
            });
        }
        connection = await dbPool.getConnection();
        // בדיקה שהמשימה קיימת ושייכת למשתמש
        const [tasks] = await connection.execute('SELECT UserId FROM Tasks WHERE TaskId = ?', [taskId]);
        if (!Array.isArray(tasks) || tasks.length === 0) {
            return res.status(404).json({
                success: false,
                error: `Task with ID ${taskId} not found`
            });
        }
        const task = tasks[0];
        if (task.UserId !== authenticatedUserId.toString()) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to update this task'
            });
        }
        // בניית שאילתת העדכון
        let updateSql = 'UPDATE Tasks SET ';
        const updateParams = [];
        if (TaskScore !== undefined) {
            updateSql += 'TaskScore = ?, ';
            updateParams.push(TaskScore);
        }
        if (DurationTask !== undefined) {
            updateSql += 'DurationTask = ?, ';
            updateParams.push(DurationTask);
        }
        if (CompletionDate !== undefined) {
            updateSql += 'CompletionDate = ?, ';
            const mysqlDate = new Date(CompletionDate).toISOString().slice(0, 19).replace('T', ' ');
            updateParams.push(mysqlDate);
            console.log(`🔄 Converting date from ${CompletionDate} to ${mysqlDate}`);
        }
        // הסרת הפסיק האחרון
        updateSql = updateSql.slice(0, -2);
        // הוספת תנאי ה-WHERE
        updateSql += ' WHERE TaskId = ?';
        updateParams.push(taskId);
        if (updateParams.length === 1) {
            return res.status(400).json({
                success: false,
                error: 'No fields to update provided'
            });
        }
        console.log('📝 Executing update SQL:', updateSql);
        console.log('📋 With parameters:', updateParams);
        const [result] = await connection.execute(updateSql, updateParams);
        if (result.affectedRows === 0) {
            return res.status(400).json({
                success: false,
                error: 'Task not updated'
            });
        }
        console.log('✅ Task updated successfully');
        return res.json({
            success: true,
            message: 'Task updated successfully',
            taskId: taskId
        });
    }
    catch (error) {
        console.error('💥 Error updating task:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
    }
    finally {
        if (connection) {
            connection.release();
        }
    }
});
/**
 * PUT /api/tasks/:taskId/complete - Complete a task and record word usage
 */
router.put('/:taskId/complete', authMiddleware_1.authMiddleware, async (req, res) => {
    let dbConnection;
    try {
        const dbPool = await (0, db_1.getDbPool)();
        dbConnection = await dbPool.getConnection();
        await dbConnection.beginTransaction();
        const { taskId } = req.params;
        const { wordIds, TaskScore = 100, DurationTask = 0 } = req.body;
        const authenticatedUserId = req.user?.id || req.user?.userId;
        // Verify task exists and belongs to user
        const [tasks] = await dbConnection.execute('SELECT * FROM Tasks WHERE TaskId = ? AND UserId = ?', [taskId, authenticatedUserId]);
        if (!Array.isArray(tasks) || tasks.length === 0) {
            await dbConnection.rollback();
            return res.status(404).json({
                success: false,
                error: 'Task not found or unauthorized'
            });
        }
        // Update task completion status
        await dbConnection.execute(`UPDATE Tasks 
       SET CompletionDate = NOW(),
           TaskScore = ?,
           DurationTask = ?
       WHERE TaskId = ?`, [TaskScore, DurationTask, taskId]);
        // Record word usage
        if (Array.isArray(wordIds) && wordIds.length > 0) {
            // Prepare values for batch insert
            const values = wordIds.map(wordId => [
                taskId,
                wordId,
                new Date().toISOString()
            ]);
            // Insert word usage records
            await dbConnection.query('INSERT INTO wordintask (TaskId, WordId, AddedAt) VALUES ?', [values]);
        }
        await dbConnection.commit();
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error completing task:', error);
        if (dbConnection)
            await dbConnection.rollback();
        res.status(500).json({
            success: false,
            error: 'Failed to complete task'
        });
    }
    finally {
        if (dbConnection)
            dbConnection.release();
    }
});
/**
 * POST /api/tasks/:taskId/words - Record word usage in a task
 */
router.post('/:taskId/words', authMiddleware_1.authMiddleware, async (req, res) => {
    let dbConnection;
    try {
        const dbPool = await (0, db_1.getDbPool)();
        dbConnection = await dbPool.getConnection();
        await dbConnection.beginTransaction();
        const { taskId } = req.params;
        const { wordIds } = req.body;
        const authenticatedUserId = req.user?.id || req.user?.userId;
        if (!Array.isArray(wordIds) || wordIds.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'No word IDs provided'
            });
        }
        // Verify task exists and belongs to user
        const [tasks] = await dbConnection.execute('SELECT * FROM Tasks WHERE TaskId = ? AND UserId = ?', [taskId, authenticatedUserId]);
        if (!Array.isArray(tasks) || tasks.length === 0) {
            await dbConnection.rollback();
            return res.status(404).json({
                success: false,
                error: 'Task not found or unauthorized'
            });
        }
        // Prepare values for batch insert
        const values = wordIds.map(wordId => [
            taskId,
            wordId,
            new Date().toISOString()
        ]);
        // Insert word usage records
        await dbConnection.query('INSERT INTO wordintask (TaskId, WordId, AddedAt) VALUES ?', [values]);
        await dbConnection.commit();
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error recording word usage:', error);
        if (dbConnection)
            await dbConnection.rollback();
        res.status(500).json({
            success: false,
            error: 'Failed to record word usage'
        });
    }
    finally {
        if (dbConnection)
            dbConnection.release();
    }
});
/**
 * קבלת משימות לפי משתמש
 * GET /api/tasks/user/:userId
 */
router.get('/user/:userId', authMiddleware_1.authMiddleware, async (req, res) => {
    let connection = null;
    try {
        const { userId } = req.params;
        const authenticatedUserId = req.user?.id || req.user?.userId;
        // בדיקה שהמשתמש מורשה לראות את המשימות האלו
        if (authenticatedUserId && authenticatedUserId.toString() !== userId) {
            return res.status(403).json({
                success: false,
                error: 'Not authorized to view these tasks'
            });
        }
        const dbPool = await (0, db_1.getDbPool)();
        connection = await dbPool.getConnection();
        // קבלת המשימות
        const [tasks] = await connection.execute(`SELECT * FROM Tasks 
       WHERE UserId = ? 
       ORDER BY 
         CASE WHEN CompletionDate IS NULL THEN 0 ELSE 1 END, 
         StartDate DESC`, [userId]);
        return res.json({
            success: true,
            tasks: tasks
        });
    }
    catch (error) {
        console.error('Error fetching tasks:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
    }
    finally {
        if (connection) {
            connection.release();
        }
    }
});
/**
 * קבלת משימות של המשתמש הנוכחי
 * GET /api/tasks
 */
router.get('/', authMiddleware_1.authMiddleware, async (req, res) => {
    let connection = null;
    try {
        console.log('GET /api/tasks - Fetching current user tasks');
        const authenticatedUserId = req.user?.id || req.user?.userId;
        if (!authenticatedUserId) {
            return res.status(401).json({ error: 'User ID not found in token' });
        }
        // קבלת פרמטרים מה-URL
        const { topicName } = req.query;
        const dbPool = await (0, db_1.getDbPool)();
        connection = await dbPool.getConnection();
        let query = `SELECT * FROM Tasks WHERE UserId = ?`;
        const params = [authenticatedUserId];
        // סינון לפי נושא אם נדרש
        if (topicName) {
            query += ` AND (TopicName = ? OR LOWER(TopicName) = LOWER(?))`;
            params.push(topicName, topicName);
        }
        query += ` ORDER BY 
      CASE WHEN CompletionDate IS NULL THEN 0 ELSE 1 END, 
      StartDate DESC`;
        const [tasks] = await connection.query(query, params);
        console.log(`Retrieved ${tasks.length} tasks for user ${authenticatedUserId}`);
        res.json(tasks);
    }
    catch (error) {
        console.error('Error fetching user tasks:', error);
        res.status(500).json({ error: 'Failed to fetch user tasks' });
    }
    finally {
        if (connection) {
            connection.release();
        }
    }
});
/**
 * מחפש את משימת הכרטיסיות האחרונה שהושלמה לנושא ורמה מסוימים
 * GET /api/tasks/completed-flashcard?topicName=xxx&level=xxx&userId=xxx
 */
router.get('/completed-flashcard', authMiddleware_1.authMiddleware, async (req, res) => {
    let connection = null;
    console.log('🔍 GET /api/tasks/completed-flashcard - Finding completed flashcard task');
    try {
        const { topicName, level, userId: queryUserId } = req.query;
        const authenticatedUserId = req.user?.id || req.user?.userId || queryUserId;
        if (!topicName || !level || !authenticatedUserId) {
            return res.status(400).json({
                success: false,
                error: 'topicName, level, and userId are required'
            });
        }
        console.log(`📋 Looking for completed flashcard task:`, {
            topicName,
            level,
            userId: authenticatedUserId
        });
        const dbPool = await (0, db_1.getDbPool)();
        if (!dbPool) {
            return res.status(500).json({
                success: false,
                error: 'Database connection failed'
            });
        }
        connection = await dbPool.getConnection();
        // חפש את משימת הכרטיסיות האחרונה שהושלמה לנושא ורמה הנתונים
        const [taskRows] = await connection.query(`
      SELECT TaskId, TopicName, Level, CompletionDate, TaskScore
      FROM Tasks 
      WHERE UserId = ? 
        AND TopicName = ? 
        AND Level = ? 
        AND TaskType = 'flashcard' 
        AND CompletionDate IS NOT NULL
      ORDER BY CompletionDate DESC
      LIMIT 1
    `, [authenticatedUserId, topicName, level]);
        if (!Array.isArray(taskRows) || taskRows.length === 0) {
            console.log(`❌ No completed flashcard task found for topic: ${topicName}, level: ${level}, user: ${authenticatedUserId}`);
            return res.status(404).json({
                success: false,
                error: 'No completed flashcard task found for this topic and level',
                debug: {
                    topicName,
                    level,
                    userId: authenticatedUserId,
                    searchCriteria: 'flashcard task with CompletionDate IS NOT NULL'
                }
            });
        }
        const task = taskRows[0];
        console.log(`✅ Found completed flashcard task:`, {
            taskId: task.TaskId,
            topicName: task.TopicName,
            level: task.Level,
            completionDate: task.CompletionDate,
            score: task.TaskScore
        });
        // בדוק שיש מילים במשימה זו
        const [wordRows] = await connection.query(`
      SELECT COUNT(*) as wordCount
      FROM wordintask wit
      WHERE wit.TaskId = ?
    `, [task.TaskId]);
        const wordCount = wordRows[0]?.wordCount || 0;
        console.log(`📝 Task ${task.TaskId} has ${wordCount} words`);
        if (wordCount === 0) {
            console.log(`⚠️ Task ${task.TaskId} has no words associated with it`);
            return res.status(404).json({
                success: false,
                error: 'Found completed flashcard task but it has no words associated',
                debug: {
                    taskId: task.TaskId,
                    wordCount: 0
                }
            });
        }
        return res.status(200).json({
            success: true,
            taskId: task.TaskId,
            topicName: task.TopicName,
            level: task.Level,
            completionDate: task.CompletionDate,
            score: task.TaskScore,
            wordCount: wordCount,
            message: `Found completed flashcard task with ${wordCount} words`
        });
    }
    catch (error) {
        console.error('💥 Error finding completed flashcard task:', error);
        return res.status(500).json({
            success: false,
            error: 'An error occurred while finding completed flashcard task',
            details: process.env.NODE_ENV === 'development' ?
                (error instanceof Error ? error.message : 'Unknown error') : undefined
        });
    }
    finally {
        if (connection) {
            connection.release();
        }
    }
});
exports.default = router;
