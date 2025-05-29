"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("./db"));
class Level {
    // Get all levels for a topic
    static async findByTopic(topicName) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM Levels WHERE TopicName = ? ORDER BY Level', [topicName]);
            return rows;
        }
        catch (error) {
            console.error('Error finding levels by topic:', error);
            throw error;
        }
    }
    // Find specific level
    static async findByTopicAndLevel(topicName, level) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM Levels WHERE TopicName = ? AND Level = ?', [topicName, level]);
            return rows.length ? rows[0] : null;
        }
        catch (error) {
            console.error('Error finding level:', error);
            throw error;
        }
    }
    // Create a new level
    static async create(levelData) {
        try {
            const [result] = await db_1.default.execute(`INSERT INTO Levels 
         (TopicName, Level, Title, Description, RequiredScore, IsLocked)
         VALUES (?, ?, ?, ?, ?, ?)`, [
                levelData.TopicName,
                levelData.Level,
                levelData.Title,
                levelData.Description,
                levelData.RequiredScore || 0,
                levelData.IsLocked || false
            ]);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('Error creating level:', error);
            throw error;
        }
    }
    // Update level
    static async update(topicName, level, updateData) {
        try {
            // Don't allow updating TopicName or Level
            delete updateData.TopicName;
            delete updateData.Level;
            // Build the SET part of the SQL query dynamically
            const updateFields = Object.keys(updateData)
                .map(field => `${field} = ?`)
                .join(', ');
            if (!updateFields) {
                return true; // Nothing to update
            }
            const values = [...Object.values(updateData), topicName, level];
            const [result] = await db_1.default.execute(`UPDATE Levels SET ${updateFields} WHERE TopicName = ? AND Level = ?`, values);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('Error updating level:', error);
            throw error;
        }
    }
}
exports.default = Level;
