"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("./db"));
class Question {
    // Find question by ID
    static async findById(questionId) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM Questions WHERE QuestionId = ?', [questionId]);
            return rows.length ? rows[0] : null;
        }
        catch (error) {
            console.error('Error finding question by ID:', error);
            throw error;
        }
    }
    // Find questions by session ID
    static async findBySessionId(sessionId) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM Questions WHERE SessionId = ? ORDER BY CreatedAt', [sessionId]);
            return rows;
        }
        catch (error) {
            console.error('Error finding questions by session ID:', error);
            throw error;
        }
    }
    // Create a new question
    static async create(questionData) {
        try {
            const [result] = await db_1.default.execute(`INSERT INTO Questions 
         (QuestionId, SessionId, QuestionText, AnswerText, Feedback, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`, [
                questionData.QuestionId,
                questionData.SessionId,
                questionData.QuestionText,
                questionData.AnswerText || null,
                questionData.Feedback || null
            ]);
            if (result.affectedRows !== 1) {
                throw new Error('Failed to create question');
            }
            return questionData.QuestionId;
        }
        catch (error) {
            console.error('Error creating question:', error);
            throw error;
        }
    }
    // Update question answer and feedback
    static async update(questionId, updateData) {
        try {
            // Build update query dynamically based on provided fields
            const updateFields = [];
            const params = [];
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
            const [result] = await db_1.default.execute(`UPDATE Questions SET ${updateFields.join(', ')} WHERE QuestionId = ?`, params);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('Error updating question:', error);
            throw error;
        }
    }
}
exports.default = Question;
