// unity-voice-backend/src/models/InteractiveSession.ts - תיקון שמות עמודות
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from './db';

export enum SessionType {
  CONVERSATION = 'conversation',
}

export interface IInteractiveSession extends RowDataPacket {
  SessionID: string;  // שים לב - עם I גדולה כמו בDB
  TaskId: string;
  SessionType: SessionType;
  // הוסרתי CreatedAt ו-UpdatedAt כי הם לא קיימים בטבלה
}

class InteractiveSession {
  // Find session by ID
  static async findById(sessionId: string): Promise<IInteractiveSession | null> {
    try {
      const [rows] = await pool.execute<IInteractiveSession[]>(
        'SELECT * FROM interactivesessions WHERE SessionID = ?',  // SessionID עם I גדולה
        [sessionId]
      );
      
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding session by ID:', error);
      throw error;
    }
  }

  // Find session by task ID
  static async findByTaskId(taskId: string): Promise<IInteractiveSession | null> {
    try {
      const [rows] = await pool.execute<IInteractiveSession[]>(
        'SELECT * FROM interactivesessions WHERE TaskId = ?',
        [taskId]
      );
      
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding session by task ID:', error);
      throw error;
    }
  }

  // Create a new session
  static async create(sessionData: {
    SessionId: string;  // קלט עם i קטנה
    TaskId: string;
    SessionType: SessionType;
  }): Promise<string> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO interactivesessions 
         (SessionID, TaskId, SessionType)
         VALUES (?, ?, ?)`,  // SessionID עם I גדולה בDB
        [
          sessionData.SessionId,  // המרה אוטומטית
          sessionData.TaskId,
          sessionData.SessionType
        ]
      );
      
      if (result.affectedRows !== 1) {
        throw new Error('Failed to create interactive session');
      }
      
      return sessionData.SessionId;
    } catch (error) {
      console.error('Error creating interactive session:', error);
      throw error;
    }
  }

  // Update session (אם נדרש)
  static async update(sessionId: string, updateData: Partial<IInteractiveSession>): Promise<boolean> {
    try {
      // Don't allow updating SessionID
      delete updateData.SessionID;
      
      // Build the SET part of the SQL query dynamically
      const updateFields = Object.keys(updateData)
        .map(field => `${field} = ?`)
        .join(', ');
      
      if (!updateFields) {
        return true; // Nothing to update
      }
      
      const values = [...Object.values(updateData), sessionId];
      
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE interactivesessions SET ${updateFields} WHERE SessionID = ?`,
        values
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating interactive session:', error);
      throw error;
    }
  }
}

export default InteractiveSession;