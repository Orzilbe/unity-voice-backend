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
            const [rows] = await db_1.default.execute('SELECT * FROM tasks WHERE TaskId = ?', [taskId]);
            return rows.length ? rows[0] : null;
        }
        catch (error) {
            console.error('Error finding task by ID:', error);
            throw error;
        }
    }
    // 🔥 NEW: Find task with its post data
    static async findByIdWithPost(taskId) {
        try {
            const [rows] = await db_1.default.execute(`SELECT t.*, p.PostContent, p.Picture 
         FROM tasks t 
         LEFT JOIN posts p ON t.PostID = p.PostID 
         WHERE t.TaskId = ?`, [taskId]);
            return rows.length ? rows[0] : null;
        }
        catch (error) {
            console.error('Error finding task with post:', error);
            throw error;
        }
    }
    // Find tasks by user ID
    static async findByUser(userId) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM tasks WHERE UserId = ? ORDER BY StartDate DESC', [userId]);
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
            const [rows] = await db_1.default.execute('SELECT * FROM tasks WHERE UserId = ? AND TopicName = ? ORDER BY Level, StartDate', [userId, topicName]);
            return rows;
        }
        catch (error) {
            console.error('Error finding tasks by user and topic:', error);
            throw error;
        }
    }
    // 🔥 MISSING FUNCTION: Find tasks by user, topic, level, and task type
    static async findByUserTopicAndLevel(userId, topicName, level, taskType) {
        try {
            let query = 'SELECT * FROM tasks WHERE UserId = ? AND TopicName = ? AND Level = ?';
            const params = [userId, topicName, level];
            if (taskType) {
                query += ' AND TaskType = ?';
                params.push(taskType);
            }
            query += ' ORDER BY StartDate DESC';
            const [rows] = await db_1.default.execute(query, params);
            return rows;
        }
        catch (error) {
            console.error('Error finding tasks by user, topic, and level:', error);
            throw error;
        }
    }
    // Create a new task
    static async create(taskData) {
        try {
            const [result] = await db_1.default.execute(`INSERT INTO tasks 
         (TaskId, UserId, TopicName, Level, TaskScore, TaskType, PostID, DurationTask, StartDate)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`, [
                taskData.TaskId,
                taskData.UserId,
                taskData.TopicName,
                taskData.Level,
                taskData.TaskScore || 0,
                taskData.TaskType,
                taskData.PostID || null, // 🔥 Explicitly handle null
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
    // 🔥 FIXED: Update task with proper type handling
    static async update(taskId, updateData) {
        try {
            // Don't allow updating TaskId, UserId
            delete updateData.TaskId;
            delete updateData.UserId;
            delete updateData.StartDate;
            // Build the SET part of the SQL query dynamically
            const updateFields = [];
            const values = [];
            // Handle each field explicitly to avoid TypeScript issues
            Object.keys(updateData).forEach(field => {
                if (field === 'PostID') {
                    updateFields.push('PostID = ?');
                    values.push(updateData.PostID); // This can be null
                }
                else if (field === 'TaskScore') {
                    updateFields.push('TaskScore = ?');
                    values.push(updateData.TaskScore);
                }
                else if (field === 'CompletionDate') {
                    updateFields.push('CompletionDate = ?');
                    values.push(updateData.CompletionDate);
                }
                else if (field === 'DurationTask') {
                    updateFields.push('DurationTask = ?');
                    values.push(updateData.DurationTask);
                }
                else if (field === 'TopicName') {
                    updateFields.push('TopicName = ?');
                    values.push(updateData.TopicName);
                }
                else if (field === 'Level') {
                    updateFields.push('Level = ?');
                    values.push(updateData.Level);
                }
                else if (field === 'TaskType') {
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
            const [result] = await db_1.default.execute(sql, values);
            console.log('🔄 Update result:', result.affectedRows > 0 ? 'Success' : 'No rows affected');
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
            const [result] = await db_1.default.execute(`UPDATE tasks 
         SET TaskScore = ?, CompletionDate = NOW(), DurationTask = ?
         WHERE TaskId = ?`, [score, duration || null, taskId]);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('Error completing task:', error);
            throw error;
        }
    }
    // 🔥 NEW: Link a post to a task
    static async linkPost(taskId, postId) {
        try {
            console.log(`🔗 Linking post ${postId} to task ${taskId}`);
            const [result] = await db_1.default.execute('UPDATE tasks SET PostID = ? WHERE TaskId = ? AND TaskType = ?', [postId, taskId, TaskType.POST]);
            const success = result.affectedRows > 0;
            console.log(`🔗 Link result: ${success ? 'Success' : 'Failed'}`);
            return success;
        }
        catch (error) {
            console.error('Error linking post to task:', error);
            throw error;
        }
    }
    // 🔥 NEW: Clear post link from task (for regeneration)
    static async clearPostLink(taskId) {
        try {
            console.log(`🗑️ Clearing post link for task ${taskId}`);
            const [result] = await db_1.default.execute('UPDATE tasks SET PostID = NULL WHERE TaskId = ? AND TaskType = ?', [taskId, TaskType.POST]);
            const success = result.affectedRows > 0;
            console.log(`🗑️ Clear result: ${success ? 'Success' : 'Failed'}`);
            return success;
        }
        catch (error) {
            console.error('Error clearing post link:', error);
            throw error;
        }
    }
    // 🔥 NEW: Check if task needs a new post
    static async needsNewPost(taskId) {
        try {
            const [rows] = await db_1.default.execute('SELECT TaskType, PostID FROM tasks WHERE TaskId = ?', [taskId]);
            if (rows.length === 0)
                return false;
            const task = rows[0];
            return task.TaskType === TaskType.POST && !task.PostID;
        }
        catch (error) {
            console.error('Error checking if task needs new post:', error);
            return false;
        }
    }
}
exports.default = Task;
