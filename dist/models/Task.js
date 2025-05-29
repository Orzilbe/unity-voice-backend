"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TaskType = void 0;
const db_1 = __importDefault(require("./db"));
var TaskType;
(function (TaskType) {
    TaskType["QUIZ"] = "quiz";
    TaskType["POST"] = "post";
    TaskType["CONVERSATION"] = "conversation";
    TaskType["FLASHCARD"] = "flashcard";
})(TaskType || (exports.TaskType = TaskType = {}));
class Task {
    // Find task by ID
    static async findById(taskId) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM Tasks WHERE TaskId = ?', [taskId]);
            return rows.length ? rows[0] : null;
        }
        catch (error) {
            console.error('Error finding task by ID:', error);
            throw error;
        }
    }
    // Find tasks by user ID
    static async findByUser(userId) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM Tasks WHERE UserId = ? ORDER BY CreatedAt DESC', [userId]);
            return rows;
        }
        catch (error) {
            console.error('Error finding tasks by user:', error);
            throw error;
        }
    }
    // Find tasks by user ID and topic
    static async findByUserAndTopic(userId, topicName) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM Tasks WHERE UserId = ? AND TopicName = ? ORDER BY Level, CreatedAt', [userId, topicName]);
            return rows;
        }
        catch (error) {
            console.error('Error finding tasks by user and topic:', error);
            throw error;
        }
    }
    // Create a new task
    static async create(taskData) {
        try {
            const [result] = await db_1.default.execute(`INSERT INTO Tasks 
         (TaskId, UserId, TopicName, Level, TaskScore, TaskType, DurationTask, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`, [
                taskData.TaskId,
                taskData.UserId,
                taskData.TopicName,
                taskData.Level,
                taskData.TaskScore || 0,
                taskData.TaskType,
                taskData.DurationTask || null
            ]);
            if (result.affectedRows !== 1) {
                throw new Error('Failed to create task');
            }
            return taskData.TaskId;
        }
        catch (error) {
            console.error('Error creating task:', error);
            throw error;
        }
    }
    // Update task
    static async update(taskId, updateData) {
        try {
            // Don't allow updating TaskId, UserId
            delete updateData.TaskId;
            delete updateData.UserId;
            delete updateData.CreatedAt;
            // Add UpdatedAt
            updateData.UpdatedAt = new Date();
            // Build the SET part of the SQL query dynamically
            const updateFields = Object.keys(updateData)
                .map(field => `${field} = ?`)
                .join(', ');
            if (!updateFields) {
                return true; // Nothing to update
            }
            const values = [...Object.values(updateData), taskId];
            const [result] = await db_1.default.execute(`UPDATE Tasks SET ${updateFields} WHERE TaskId = ?`, values);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('Error updating task:', error);
            throw error;
        }
    }
    // Complete task
    static async completeTask(taskId, score, duration) {
        try {
            const [result] = await db_1.default.execute(`UPDATE Tasks 
         SET TaskScore = ?, CompletionDate = NOW(), DurationTask = ?, UpdatedAt = NOW() 
         WHERE TaskId = ?`, [score, duration || null, taskId]);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('Error completing task:', error);
            throw error;
        }
    }
}
exports.default = Task;
