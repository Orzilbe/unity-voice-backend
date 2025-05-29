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
            const [rows] = await db_1.default.execute('SELECT * FROM InteractiveSessions WHERE SessionId = ?', [sessionId]);
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
            const [rows] = await db_1.default.execute('SELECT * FROM InteractiveSessions WHERE TaskId = ?', [taskId]);
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
            const [result] = await db_1.default.execute(`INSERT INTO InteractiveSessions 
         (SessionId, TaskId, SessionType, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, NOW(), NOW())`, [
                sessionData.SessionId,
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
}
exports.default = InteractiveSession;
