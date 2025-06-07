// unity-voice-backend/src/models/Question.ts - תיקון שמות עמודות
import { RowDataPacket, ResultSetHeader } from 'mysql2';
import pool from './db';

export interface IQuestion extends RowDataPacket {
  QuestionID: string;  // עם ID גדולות כמו בDB
  SessionID: string;   // עם ID גדולות כמו בDB
  QuestionText: string;
  AnswerText: string | null;
  Feedback: string | null;
  CreatedAt: Date;
  UpdatedAt: Date;
}

class Question {
  // Find question by ID
  static async findById(questionId: string): Promise<IQuestion | null> {
    try {
      const [rows] = await pool.execute<IQuestion[]>(
        'SELECT * FROM questions WHERE QuestionID = ?',  // QuestionID עם ID גדולות
        [questionId]
      );
      
      return rows.length ? rows[0] : null;
    } catch (error) {
      console.error('Error finding question by ID:', error);
      throw error;
    }
  }

  // Find questions by session ID
  static async findBySessionId(sessionId: string): Promise<IQuestion[]> {
    try {
      const [rows] = await pool.execute<IQuestion[]>(
        'SELECT * FROM questions WHERE SessionID = ? ORDER BY CreatedAt',  // SessionID עם ID גדולות
        [sessionId]
      );
      
      return rows;
    } catch (error) {
      console.error('Error finding questions by session ID:', error);
      throw error;
    }
  }

  // Create a new question
  static async create(questionData: {
    QuestionId: string;  // קלט עם Id
    SessionId: string;   // קלט עם Id
    QuestionText: string;
    AnswerText?: string | null;
    Feedback?: string | null;
  }): Promise<string> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        `INSERT INTO questions 
         (QuestionID, SessionID, QuestionText, AnswerText, Feedback, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          questionData.QuestionId,  // המרה ל-QuestionID
          questionData.SessionId,   // המרה ל-SessionID
          questionData.QuestionText,
          questionData.AnswerText || null,
          questionData.Feedback || null
        ]
      );
      
      if (result.affectedRows !== 1) {
        throw new Error('Failed to create question');
      }
      
      return questionData.QuestionId;
    } catch (error) {
      console.error('Error creating question:', error);
      throw error;
    }
  }

  // Update question answer and feedback
  static async update(questionId: string, updateData: {
    AnswerText?: string;
    Feedback?: string;
  }): Promise<boolean> {
    try {
      // Build update query dynamically based on provided fields
      const updateFields: string[] = [];
      const params: any[] = [];
      
      if (updateData.AnswerText !== undefined) {
        updateFields.push('AnswerText = ?');
        params.push(updateData.AnswerText);
      }
      
      if (updateData.Feedback !== undefined) {
        updateFields.push('Feedback = ?');
        params.push(updateData.Feedback);
      }
      
      if (updateFields.length === 0) {
        return false; // Nothing to update
      }
      
      updateFields.push('UpdatedAt = NOW()');
      params.push(questionId); // For the WHERE clause
      
      const [result] = await pool.execute<ResultSetHeader>(
        `UPDATE questions SET ${updateFields.join(', ')} WHERE QuestionID = ?`,  // QuestionID עם ID גדולות
        params
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error updating question:', error);
      throw error;
    }
  }

  // Delete question
  static async delete(questionId: string): Promise<boolean> {
    try {
      const [result] = await pool.execute<ResultSetHeader>(
        'DELETE FROM questions WHERE QuestionID = ?',
        [questionId]
      );
      
      return result.affectedRows > 0;
    } catch (error) {
      console.error('Error deleting question:', error);
      throw error;
    }
  }
}

export default Question;