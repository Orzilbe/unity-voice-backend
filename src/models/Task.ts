// unity-voice-backend/src/models/Task.ts - תיקון לשימוש ב-StartDate
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from './db';

export enum TaskType {
  QUIZ = 'quiz',
  POST = 'post',
  CONVERSATION = 'conversation',
  FLASHCARD = 'flashcard'
}

export interface ITask extends RowDataPacket {
  TaskId: string;
  UserId: string;
  TopicName: string;
  Level: number;
  TaskScore: number;
  TaskType: TaskType;
  PostID?: string | null;    // 🔥 FIXED: Explicitly allow null
  CompletionDate?: Date | null;
  DurationTask?: number | null;
  StartDate?: Date;
  UpdatedAt?: Date;
}

class Task {
  // Find task by ID
  static async findById(taskId: string): Promise<ITask | null> {
    try {
      const [rows] = await pool.execute<ITask[]>(
        'SELECT * FROM tasks WHERE TaskId = ?',
        [taskId]
      );
      
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding task by ID:', error);
      throw error;
    }
  }

  // 🔥 NEW: Find task with its post data
  static async findByIdWithPost(taskId: string): Promise<(ITask & { PostContent?: string; Picture?: string }) | null> {
    try {
      const [rows] = await pool.execute<(ITask & { PostContent?: string; Picture?: string })[]>(
        `SELECT t.*, p.PostContent, p.Picture 
         FROM tasks t 
         LEFT JOIN posts p ON t.PostID = p.PostID 
         WHERE t.TaskId = ?`,
        [taskId]
      );
      
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding task with post:', error);
      throw error;
    }
  }

  // Find tasks by user ID
  static async findByUser(userId: string): Promise<ITask[]> {
    try {
      const [rows] = await pool.execute<ITask[]>(
        'SELECT * FROM tasks WHERE UserId = ? ORDER BY StartDate DESC',
        [userId]
      );
      
      return rows;
    } catch (error) {
      console.error('Error finding tasks by user:', error);
      throw error;
    }
  }

  // Find tasks by user ID and topic
  static async findByUserAndTopic(userId: string, topicName: string): Promise<ITask[]> {
    try {
      const [rows] = await pool.execute<ITask[]>(
        'SELECT * FROM tasks WHERE UserId = ? AND TopicName = ? ORDER BY Level, StartDate',
        [userId, topicName]
      );
      
      return rows;
    } catch (error) {
      console.error('Error finding tasks by user and topic:', error);
      throw error;
    }
  }

  // 🔥 MISSING FUNCTION: Find tasks by user, topic, level, and task type
  static async findByUserTopicAndLevel(
    userId: string, 
    topicName: string, 
    level: number, 
    taskType?: string
  ): Promise<ITask[]> {
    try {
      let query = 'SELECT * FROM tasks WHERE UserId = ? AND TopicName = ? AND Level = ?';
      const params: any[] = [userId, topicName, level];
      
      if (taskType) {
        query += ' AND TaskType = ?';
        params.push(taskType);
      }
      
      query += ' ORDER BY StartDate DESC';
      
      const [rows] = await pool.execute<ITask[]>(query, params);
      
      return rows;
    } catch (error) {
      console.error('Error finding tasks by user, topic, and level:', error);
      throw error;
    }
  }

  // Create a new task
  static async create(taskData: {
    TaskId: string;
    UserId: string;
    TopicName: string;
    Level: number;
    TaskScore?: number;
    TaskType: TaskType;
    PostID?: string | null;    // 🔥 FIXED: Explicitly allow null
    DurationTask?: number;
  }): Promise<string> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO tasks 
         (TaskId, UserId, TopicName, Level, TaskScore, TaskType, PostID, DurationTask, StartDate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          taskData.TaskId,
          taskData.UserId,
          taskData.TopicName,
          taskData.Level,
          taskData.TaskScore || 0,
          taskData.TaskType,
          taskData.PostID || null,  // 🔥 Explicitly handle null
          taskData.DurationTask || null
        ]
      );
      
      if (result.affectedRows !== 1) {
        throw new Error('Failed to create task');
      }
      
      return taskData.TaskId;
    } catch (error) {
      console.error('Error creating task:', error);
      throw error;
    }
  }

  // 🔥 FIXED: Update task with proper type handling
  static async update(taskId: string, updateData: Partial<ITask>): Promise<boolean> {
    try {
      // Don't allow updating TaskId, UserId
      delete updateData.TaskId;
      delete updateData.UserId;
      delete updateData.StartDate;
      
      // Build the SET part of the SQL query dynamically
      const updateFields: string[] = [];
      const values: any[] = [];
      
      // Handle each field explicitly to avoid TypeScript issues
      Object.keys(updateData).forEach(field => {
        if (field === 'PostID') {
          updateFields.push('PostID = ?');
          values.push(updateData.PostID); // This can be null
        } else if (field === 'TaskScore') {
          updateFields.push('TaskScore = ?');
          values.push(updateData.TaskScore);
        } else if (field === 'CompletionDate') {
          updateFields.push('CompletionDate = ?');
          values.push(updateData.CompletionDate);
        } else if (field === 'DurationTask') {
          updateFields.push('DurationTask = ?');
          values.push(updateData.DurationTask);
        } else if (field === 'TopicName') {
          updateFields.push('TopicName = ?');
          values.push(updateData.TopicName);
        } else if (field === 'Level') {
          updateFields.push('Level = ?');
          values.push(updateData.Level);
        } else if (field === 'TaskType') {
          updateFields.push('TaskType = ?');
          values.push(updateData.TaskType);
        }
        // Add other fields as needed
      });
      
      if (updateFields.length === 0) {
        console.log('No valid fields to update');
        return true; // Nothing to update
      }
      
      const sql = `UPDATE tasks SET ${updateFields.join(', ')} WHERE TaskId = ?`;
      values.push(taskId);
      
      console.log('🔄 Executing update:', sql);
      console.log('🔄 With values:', values);
      
      const [result] = await pool.execute<ResultSetHeader>(sql, values);
      
      console.log('🔄 Update result:', result.affectedRows > 0 ? 'Success' : 'No rows affected');
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating task:', error);
      throw error;
    }
  }

  // Complete task
  static async completeTask(taskId: string, score: number, duration?: number): Promise<boolean> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE tasks 
         SET TaskScore = ?, CompletionDate = NOW(), DurationTask = ?
         WHERE TaskId = ?`,
        [score, duration || null, taskId]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error completing task:', error);
      throw error;
    }
  }

  // 🔥 NEW: Link a post to a task
  static async linkPost(taskId: string, postId: string): Promise<boolean> {
    try {
      console.log(`🔗 Linking post ${postId} to task ${taskId}`);
      
      const [result] = await pool.execute<ResultSetHeader>(
        'UPDATE tasks SET PostID = ? WHERE TaskId = ? AND TaskType = ?',
        [postId, taskId, TaskType.POST]
      );
      
      const success = result.affectedRows > 0;
      console.log(`🔗 Link result: ${success ? 'Success' : 'Failed'}`);
      
      return success;
    } catch (error) {
      console.error('Error linking post to task:', error);
      throw error;
    }
  }

  // 🔥 NEW: Clear post link from task (for regeneration)
  static async clearPostLink(taskId: string): Promise<boolean> {
    try {
      console.log(`🗑️ Clearing post link for task ${taskId}`);
      
      const [result] = await pool.execute<ResultSetHeader>(
        'UPDATE tasks SET PostID = NULL WHERE TaskId = ? AND TaskType = ?',
        [taskId, TaskType.POST]
      );
      
      const success = result.affectedRows > 0;
      console.log(`🗑️ Clear result: ${success ? 'Success' : 'Failed'}`);
      
      return success;
    } catch (error) {
      console.error('Error clearing post link:', error);
      throw error;
    }
  }

  // 🔥 NEW: Check if task needs a new post
  static async needsNewPost(taskId: string): Promise<boolean> {
    try {
      const [rows] = await pool.execute<ITask[]>(
        'SELECT TaskType, PostID FROM tasks WHERE TaskId = ?',
        [taskId]
      );
      
      if (rows.length === 0) return false;
      
      const task = rows[0];
      return task.TaskType === TaskType.POST && !task.PostID;
    } catch (error) {
      console.error('Error checking if task needs new post:', error);
      return false;
    }
  }
}

export default Task;