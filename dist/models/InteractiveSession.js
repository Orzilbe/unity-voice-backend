"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SessionType = void 0;
const db_1 = __importDefault(require("./db"));
var SessionType;
(function (SessionType) {
    SessionType["CONVERSATION"] = "conversation";
})(SessionType || (exports.SessionType = SessionType = {}));
class InteractiveSession {
    // Find session by ID
    static async findById(sessionId) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM interactivesessions WHERE SessionID = ?', // SessionID עם I גדולה
            [sessionId]);
            return rows.length ? rows[0] : null;
        }
        catch (error) {
            console.error('Error finding session by ID:', error);
            throw error;
        }
    }
    // Find session by task ID
    static async findByTaskId(taskId) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM interactivesessions WHERE TaskId = ?', [taskId]);
            return rows.length ? rows[0] : null;
        }
        catch (error) {
            console.error('Error finding session by task ID:', error);
            throw error;
        }
    }
    // Create a new session
    static async create(sessionData) {
        try {
            const [result] = await db_1.default.execute(`INSERT INTO interactivesessions 
         (SessionID, TaskId, SessionType)
         VALUES (?, ?, ?)`, // SessionID עם I גדולה בDB
            [
                sessionData.SessionId, // המרה אוטומטית
                sessionData.TaskId,
                sessionData.SessionType
            ]);
            if (result.affectedRows !== 1) {
                throw new Error('Failed to create interactive session');
            }
            return sessionData.SessionId;
        }
        catch (error) {
            console.error('Error creating interactive session:', error);
            throw error;
        }
    }
    // Update session (אם נדרש)
    static async update(sessionId, updateData) {
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
            const [result] = await db_1.default.execute(`UPDATE interactivesessions SET ${updateFields} WHERE SessionID = ?`, values);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('Error updating interactive session:', error);
            throw error;
        }
    }
}
exports.default = InteractiveSession;
