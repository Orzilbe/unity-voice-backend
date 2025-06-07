"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRequiredWords = void 0;
const Task_1 = __importDefault(require("../models/Task"));
const User_1 = __importDefault(require("../models/User"));
const Word_1 = __importDefault(require("../models/Word"));
const WordInTask_1 = __importDefault(require("../models/WordInTask"));
// Get required words for conversation based on user's flashcard progress
const getRequiredWords = async (req, res) => {
    try {
        const userId = req.user?.userId || req.user?.id?.toString() || req.query.userId;
        const { topic, level } = req.query;
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'User authentication required'
            });
        }
        if (!topic) {
            return res.status(400).json({
                success: false,
                error: 'Topic parameter is required'
            });
        }
        console.log(`Getting required words for user ${userId}, topic: ${topic}, level: ${level}`);
        // Get user information for English level
        const user = await User_1.default.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }
        const topicName = topic;
        const currentLevel = parseInt(level) || 1;
        // Strategy 1: Get words from user's completed flashcard tasks for this topic and level
        const learnedWords = await getLearnedWordsFromFlashcards(userId, topicName, currentLevel);
        // Strategy 2: Get additional words from the words database for this topic and user's English level
        const topicWords = await getTopicWords(topicName, user.EnglishLevel);
        // Strategy 3: Get words from previous levels if current level has few words
        let additionalWords = [];
        if (learnedWords.length + topicWords.length < 8 && currentLevel > 1) {
            additionalWords = await getWordsFromPreviousLevels(userId, topicName, currentLevel - 1);
        }
        // Combine and deduplicate words
        const allWords = [...new Set([...learnedWords, ...topicWords, ...additionalWords])];
        // Limit to 8-10 words for the conversation
        const requiredWords = allWords.slice(0, 10);
        console.log(`Found ${requiredWords.length} required words:`, requiredWords);
        return res.status(200).json({
            success: true,
            data: requiredWords,
            breakdown: {
                learnedFromFlashcards: learnedWords.length,
                fromTopicDatabase: topicWords.length,
                fromPreviousLevels: additionalWords.length,
                total: requiredWords.length
            }
        });
    }
    catch (error) {
        console.error('Error getting required words:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get required words',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getRequiredWords = getRequiredWords;
// Helper function to get words from user's flashcard tasks
async function getLearnedWordsFromFlashcards(userId, topicName, level) {
    try {
        // Find completed flashcard tasks for this user, topic, and level
        const flashcardTasks = await Task_1.default.findByUserTopicAndLevel(userId, topicName, level, 'flashcards');
        if (!flashcardTasks || flashcardTasks.length === 0) {
            console.log(`No flashcard tasks found for user ${userId}, topic ${topicName}, level ${level}`);
            return [];
        }
        const words = [];
        for (const task of flashcardTasks) {
            // Get words that were shown in this flashcard task
            const wordsInTask = await WordInTask_1.default.findByTaskId(task.TaskId);
            for (const wordInTask of wordsInTask) {
                const word = await Word_1.default.findById(wordInTask.WordId);
                if (word) {
                    words.push(word.Word);
                }
            }
        }
        // Remove duplicates and return up to 6 words
        const uniqueWords = [...new Set(words)];
        console.log(`Found ${uniqueWords.length} learned words from flashcards:`, uniqueWords.slice(0, 6));
        return uniqueWords.slice(0, 6);
    }
    catch (error) {
        console.error('Error getting learned words from flashcards:', error);
        return [];
    }
}
// Helper function to get words from topic database
async function getTopicWords(topicName, englishLevel) {
    try {
        // First try to get words matching both topic and English level
        let words = await Word_1.default.findByTopicAndLevel(topicName, englishLevel);
        // If not enough words found, get any words from this topic
        if (words.length < 4) {
            const additionalWords = await Word_1.default.findByTopic(topicName);
            words = [...words, ...additionalWords];
        }
        // Extract just the word strings and remove duplicates
        const wordStrings = [...new Set(words.map((w) => w.Word))];
        console.log(`Found ${wordStrings.length} topic words:`, wordStrings.slice(0, 4));
        return wordStrings.slice(0, 4);
    }
    catch (error) {
        console.error('Error getting topic words:', error);
        return [];
    }
}
// Helper function to get words from previous levels
async function getWordsFromPreviousLevels(userId, topicName, maxLevel) {
    try {
        const words = [];
        // Go through levels from 1 to maxLevel
        for (let level = 1; level <= maxLevel; level++) {
            const flashcardTasks = await Task_1.default.findByUserTopicAndLevel(userId, topicName, level, 'flashcards');
            for (const task of flashcardTasks) {
                const wordsInTask = await WordInTask_1.default.findByTaskId(task.TaskId);
                for (const wordInTask of wordsInTask) {
                    const word = await Word_1.default.findById(wordInTask.WordId);
                    if (word) {
                        words.push(word.Word);
                    }
                }
            }
        }
        // Remove duplicates and return up to 3 words
        const uniqueWords = [...new Set(words)];
        console.log(`Found ${uniqueWords.length} words from previous levels:`, uniqueWords.slice(0, 3));
        return uniqueWords.slice(0, 3);
    }
    catch (error) {
        console.error('Error getting words from previous levels:', error);
        return [];
    }
}
