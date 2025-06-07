"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("./db"));
class UserInLevel {
    // Find by user ID
    static async findByUser(userId) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM UserInLevel WHERE UserId = ? ORDER BY TopicName, Level', [userId]);
            return rows;
        }
        catch (error) {
            console.error('Error finding user in level by user ID:', error);
            throw error;
        }
    }
    // Find by user ID and topic
    static async findByUserAndTopic(userId, topicName) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM UserInLevel WHERE UserId = ? AND TopicName = ? ORDER BY Level', [userId, topicName]);
            return rows;
        }
        catch (error) {
            console.error('Error finding user in level by user and topic:', error);
            throw error;
        }
    }
    // Find specific level
    static async findByUserTopicAndLevel(userId, topicName, level) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM UserInLevel WHERE UserId = ? AND TopicName = ? AND Level = ?', [userId, topicName, level]);
            return rows.length ? rows[0] : null;
        }
        catch (error) {
            console.error('Error finding specific user in level:', error);
            throw error;
        }
    }
    // Create or update user in level
    static async createOrUpdate(userInLevelData) {
        try {
            // Check if record exists
            const existingRecord = await UserInLevel.findByUserTopicAndLevel(userInLevelData.UserId, userInLevelData.TopicName, userInLevelData.Level);
            if (existingRecord) {
                // Update existing record
                let query = 'UPDATE UserInLevel SET EarnedScore = ?, IsCompleted = ?';
                const params = [
                    userInLevelData.EarnedScore !== undefined ? userInLevelData.EarnedScore : existingRecord.EarnedScore,
                    userInLevelData.IsCompleted !== undefined ? userInLevelData.IsCompleted : existingRecord.IsCompleted
                ];
                // Set CompletedAt if completing the level
                if (userInLevelData.IsCompleted && !existingRecord.IsCompleted) {
                    query += ', CompletedAt = NOW()';
                }
                query += ' WHERE UserId = ? AND TopicName = ? AND Level = ?';
                params.push(userInLevelData.UserId, userInLevelData.TopicName, userInLevelData.Level);
                const [result] = await db_1.default.execute(query, params);
                return result.affectedRows > 0;
            }
            else {
                // Create new record
                const [result] = await db_1.default.execute(`INSERT INTO UserInLevel 
           (UserId, TopicName, Level, EarnedScore, IsCompleted, CreatedAt, CompletedAt)
           VALUES (?, ?, ?, ?, ?, NOW(), ?)`, [
                    userInLevelData.UserId,
                    userInLevelData.TopicName,
                    userInLevelData.Level,
                    userInLevelData.EarnedScore || 0,
                    userInLevelData.IsCompleted || false,
                    userInLevelData.IsCompleted ? new Date() : null
                ]);
                return result.affectedRows > 0;
            }
        }
        catch (error) {
            console.error('Error creating or updating user in level:', error);
            throw error;
        }
    }
    // Get highest completed level for user in topic
    static async getHighestCompletedLevel(userId, topicName) {
        try {
            const [rows] = await db_1.default.execute('SELECT MAX(Level) as maxLevel FROM UserInLevel WHERE UserId = ? AND TopicName = ? AND IsCompleted = 1', [userId, topicName]);
            return rows.length && rows[0].maxLevel !== null ? rows[0].maxLevel : 0;
        }
        catch (error) {
            console.error('Error getting highest completed level:', error);
            throw error;
        }
    }
}
exports.default = UserInLevel;
