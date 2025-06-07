"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("./db"));
class Word {
    // Find word by ID
    static async findById(wordId) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM Words WHERE WordId = ?', [wordId]);
            return rows.length > 0 ? rows[0] : null;
        }
        catch (error) {
            console.error('Error finding word by ID:', error);
            throw error;
        }
    }
    // Find word by text
    static async findByWord(word) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM Words WHERE Word = ?', [word]);
            return rows.length ? rows[0] : null;
        }
        catch (error) {
            console.error('Error finding word by text:', error);
            throw error;
        }
    }
    // Find words by topic and English level
    static async findByTopicAndEnglishLevel(topicName, englishLevel) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM Words WHERE TopicName = ? AND EnglishLevel = ?', [topicName, englishLevel]);
            return rows;
        }
        catch (error) {
            console.error('Error finding words by topic and English level:', error);
            throw error;
        }
    }
    // Find words by topic and level - ADDED MISSING METHOD
    static async findByTopicAndLevel(topicName, level) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM Words WHERE TopicName = ? AND EnglishLevel = ?', [topicName, level]);
            return rows;
        }
        catch (error) {
            console.error('Error finding words by topic and level:', error);
            throw error;
        }
    }
    // Find words by topic - ADDED MISSING METHOD
    static async findByTopic(topicName) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM Words WHERE TopicName = ?', [topicName]);
            return rows;
        }
        catch (error) {
            console.error('Error finding words by topic:', error);
            throw error;
        }
    }
    // Create a new word
    static async create(wordData) {
        try {
            const [result] = await db_1.default.execute(`INSERT INTO Words 
         (WordId, Word, Translation, ExampleUsage, TopicName, EnglishLevel, PartOfSpeech, CreatedAt, UpdatedAt) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`, [
                wordData.WordId,
                wordData.Word,
                wordData.Translation,
                wordData.ExampleUsage,
                wordData.TopicName,
                wordData.EnglishLevel,
                wordData.PartOfSpeech || ''
            ]);
            if (result.affectedRows !== 1) {
                throw new Error('Failed to create word');
            }
            return wordData.WordId;
        }
        catch (error) {
            console.error('Error creating word:', error);
            throw error;
        }
    }
    // Update word
    static async update(wordId, updateData) {
        try {
            // Don't allow updating WordId
            delete updateData.WordId;
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
            const values = [...Object.values(updateData), wordId];
            const [result] = await db_1.default.execute(`UPDATE Words SET ${updateFields} WHERE WordId = ?`, values);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('Error updating word:', error);
            throw error;
        }
    }
    // Delete word
    static async delete(wordId) {
        try {
            const [result] = await db_1.default.execute('DELETE FROM Words WHERE WordId = ?', [wordId]);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('Error deleting word:', error);
            throw error;
        }
    }
}
exports.default = Word;
