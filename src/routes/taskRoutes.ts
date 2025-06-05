//backend/src/routes/taskRoutes.ts
import express, { Response } from 'express'; // ← הוסף Response לייבוא
import { IUserRequest } from '../types/auth';
import { Pool } from 'mysql2/promise';
import pool from '../models/db';
import { authMiddleware } from '../middleware/authMiddleware';
import { v4 as uuidv4 } from 'uuid';
import { TokenPayload } from '../types/auth';
import DatabaseConnection from '../config/database';
import Task from '../models/Task';
import Word from '../models/Word';
import { errorHandler } from '../middleware/errorHandler';

const router = express.Router();

/**
 * יצירת משימה חדשה
 * POST /api/tasks
 */
router.post('/', authMiddleware, async (req: IUserRequest, res: Response) => { // ← שינוי כאן
  try {
    console.log('Creating new task with data:', req.body);
    const { UserId, TopicName, Level, TaskType, TaskScore = 0, StartDate } = req.body;
    
    // בדיקת הפרמטרים הנדרשים
    if (!UserId || !TopicName || !Level || !TaskType) {
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
    
    // ודא שהמשתמש שמוטמע בטוכן תואם לשדה UserId
    if (req.user?.id && req.user.id.toString() !== UserId) {
      console.warn(`User ID mismatch: ${req.user.id} vs ${UserId}`);
      return res.status(403).json({
        success: false,
        error: 'UserId in request does not match authenticated user'
      });
    }
    
    // קבלת חיבור למסד הנתונים
    const connection = await pool.getConnection();
    
    // בדיקה אם הנושא והרמה קיימים
    const [levelExists] = await connection.execute(
      'SELECT 1 FROM Levels WHERE TopicName = ? AND Level = ?',
      [TopicName, Level]
    );
    
    if (!Array.isArray(levelExists) || levelExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Topic '${TopicName}' with level ${Level} not found`
      });
    }
    
    // בדיקה אם המשתמש קיים
    const [userExists] = await connection.execute(
      'SELECT 1 FROM Users WHERE UserId = ?',
      [UserId]
    );
    
    if (!Array.isArray(userExists) || userExists.length === 0) {
      return res.status(404).json({
        success: false,
        error: `User with ID ${UserId} not found`
      });
    }
    
    // יצירת מזהה למשימה
    const TaskId = uuidv4();
    console.log('Generated new TaskId:', TaskId);
    
    // SQL לצורך הכנסת המשימה
    const insertSql = `
      INSERT INTO Tasks (
        TaskId, 
        UserId, 
        TopicName, 
        Level, 
        TaskType, 
        TaskScore
        ${StartDate ? ', StartDate' : ''}
      ) VALUES (?, ?, ?, ?, ?, ?${StartDate ? ', ?' : ''})
    `;
    
    // הפרמטרים להכנסה
    const insertParams = [
      TaskId,
      UserId,
      TopicName,
      Level,
      TaskType,
      TaskScore,
    ];
    
    // הוספת StartDate אם קיים
    if (StartDate) {
      insertParams.push(StartDate);
    }
    
    // ביצוע השאילתה
    console.log('Executing SQL:', insertSql);
    console.log('With parameters:', insertParams);
    
    const [result] = await connection.execute(insertSql, insertParams);
    
    console.log('Task created successfully:', result);
    
    // החזרת תוצאה מוצלחת
    return res.status(201).json({
      success: true,
      TaskId: TaskId,
      UserId: UserId,
      TopicName: TopicName,
      Level: Level,
      TaskType: TaskType,
      TaskScore: TaskScore,
      StartDate: StartDate || null
    });
  } catch (error) {
    console.error('Error creating task:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * עדכון משימה קיימת
 * PATCH /api/tasks/:taskId
 */
router.patch('/:taskId', authMiddleware, async (req: IUserRequest, res: Response) => { // ← שינוי כאן
  try {
    console.log(`Updating task ${req.params.taskId} with data:`, req.body);
    const { taskId } = req.params;
    const { TaskScore, DurationTask, CompletionDate } = req.body;
    
    // קבלת חיבור למסד הנתונים
    const connection = await pool.getConnection();
    
    // בדיקה שהמשימה קיימת
    const [tasks] = await connection.execute(
      'SELECT UserId FROM Tasks WHERE TaskId = ?',
      [taskId]
    );
    
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(404).json({
        success: false,
        error: `Task with ID ${taskId} not found`
      });
    }
    
    // בדיקה שהמשתמש מורשה לעדכן את המשימה הזו
    const task = tasks[0] as any;
    if (req.user?.id && req.user.id.toString() !== task.UserId) {
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
      // 🔧 המר ISO string ל-MySQL format  
      const mysqlDate = new Date(CompletionDate).toISOString().slice(0, 19).replace('T', ' ');
      updateParams.push(mysqlDate);
      console.log(`🔄 Converting date from ${CompletionDate} to ${mysqlDate}`);
    }
    
    // הסרת הפסיק האחרון
    updateSql = updateSql.slice(0, -2);
    
    // הוספת תנאי ה-WHERE
    updateSql += ' WHERE TaskId = ?';
    updateParams.push(taskId);
    
    // אם אין שדות לעדכון, החזר שגיאה
    if (updateParams.length === 1) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update provided'
      });
    }
    
    // ביצוע העדכון
    console.log('Executing SQL:', updateSql);
    console.log('With parameters:', updateParams);
    
    const [result] = await connection.execute(updateSql, updateParams);
    
    // בדיקה שהעדכון הצליח
    if ((result as any).affectedRows === 0) {
      return res.status(400).json({
        success: false,
        error: 'Task not updated'
      });
    }
    
    console.log('Task updated successfully:', result);
    
    // החזרת תוצאה מוצלחת
    return res.json({
      success: true,
      message: 'Task updated successfully',
      taskId: taskId
    });
  } catch (error) {
    console.error('Error updating task:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * PUT /api/tasks/:taskId/complete - Complete a task and record word usage
 */
router.put('/:taskId/complete', authMiddleware, async (req: IUserRequest, res: Response) => { // ← שינוי כאן
  let dbConnection;
  try {
    dbConnection = await pool.getConnection();
    await dbConnection.beginTransaction();
    
    const { taskId } = req.params;
    const { wordIds, TaskScore = 100, DurationTask = 0 } = req.body;
    
    // Verify task exists and belongs to user
    const [tasks] = await dbConnection.execute(
      'SELECT * FROM Tasks WHERE TaskId = ? AND UserId = ?',
      [taskId, req.user?.id]
    );
    
    if (!Array.isArray(tasks) || tasks.length === 0) {
      await dbConnection.rollback();
      return res.status(404).json({ 
        success: false, 
        error: 'Task not found or unauthorized' 
      });
    }
    
    // Update task completion status
    await dbConnection.execute(
      `UPDATE Tasks 
       SET CompletionDate = NOW(),
           TaskScore = ?,
           DurationTask = ?
       WHERE TaskId = ?`,
      [TaskScore, DurationTask, taskId]
    );
    
    // Record word usage
    if (Array.isArray(wordIds) && wordIds.length > 0) {
      // Prepare values for batch insert
      const values = wordIds.map(wordId => [
        taskId,
        wordId,
        new Date().toISOString()
      ]);
      
      // Insert word usage records
      await dbConnection.query(
        'INSERT INTO wordintask (TaskId, WordId, AddedAt) VALUES ?',
        [values]
      );
    }
    
    await dbConnection.commit();
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error completing task:', error);
    if (dbConnection) await dbConnection.rollback();
    res.status(500).json({ 
      success: false, 
      error: 'Failed to complete task' 
    });
  } finally {
    if (dbConnection) dbConnection.release();
  }
});

/**
 * POST /api/tasks/:taskId/words - Record word usage in a task
 */
router.post('/:taskId/words', authMiddleware, async (req: IUserRequest, res: Response) => { // ← שינוי כאן
  let dbConnection;
  try {
    dbConnection = await pool.getConnection();
    await dbConnection.beginTransaction();
    
    const { taskId } = req.params;
    const { wordIds } = req.body;
    
    if (!Array.isArray(wordIds) || wordIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No word IDs provided'
      });
    }
    
    // Verify task exists and belongs to user
    const [tasks] = await dbConnection.execute(
      'SELECT * FROM Tasks WHERE TaskId = ? AND UserId = ?',
      [taskId, req.user?.id]
    );
    
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
    await dbConnection.query(
      'INSERT INTO wordintask (TaskId, WordId, AddedAt) VALUES ?',
      [values]
    );
    
    await dbConnection.commit();
    res.json({ success: true });
    
  } catch (error) {
    console.error('Error recording word usage:', error);
    if (dbConnection) await dbConnection.rollback();
    res.status(500).json({
      success: false,
      error: 'Failed to record word usage'
    });
  } finally {
    if (dbConnection) dbConnection.release();
  }
});

/**
 * קבלת משימות לפי משתמש
 * GET /api/tasks/user/:userId
 */
router.get('/user/:userId', authMiddleware, async (req: IUserRequest, res: Response) => { // ← שינוי כאן
  try {
    const { userId } = req.params;
    
    // בדיקה שהמשתמש מורשה לראות את המשימות האלו
    if (req.user?.id && req.user.id.toString() !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view these tasks'
      });
    }
    
    // קבלת חיבור למסד הנתונים
    const connection = await pool.getConnection();
    
    // קבלת המשימות
    const [tasks] = await connection.execute(
      `SELECT * FROM Tasks 
       WHERE UserId = ? 
       ORDER BY 
         CASE WHEN CompletionDate IS NULL THEN 0 ELSE 1 END, 
         StartDate DESC`,
      [userId]
    );
    
    return res.json({
      success: true,
      tasks: tasks
    });
  } catch (error) {
    console.error('Error fetching tasks:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * קבלת משימות של המשתמש הנוכחי
 * GET /api/tasks
 */
router.get('/', authMiddleware, async (req: IUserRequest, res: Response) => { // ← שינוי כאן
  try {
    console.log('GET /api/tasks - Fetching current user tasks');
    
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }
    
    // קבלת פרמטרים מה-URL
    const { topicName } = req.query;
    
    const connection = await pool.getConnection();
    try {
      let query = `SELECT * FROM Tasks WHERE UserId = ?`;
      const params: any[] = [userId];
      
      // סינון לפי נושא אם נדרש
      if (topicName) {
        query += ` AND (TopicName = ? OR LOWER(TopicName) = LOWER(?))`;
        params.push(topicName, topicName);
      }
      
      query += ` ORDER BY 
        CASE WHEN CompletionDate IS NULL THEN 0 ELSE 1 END, 
        StartDate DESC`;
      
      const [tasks] = await connection.query(query, params);
      
      console.log(`Retrieved ${(tasks as any[]).length} tasks for user ${userId}`);
      res.json(tasks);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching user tasks:', error);
    res.status(500).json({ error: 'Failed to fetch user tasks' });
  }
});

export default router;