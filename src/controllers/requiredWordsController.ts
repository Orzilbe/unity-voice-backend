// unity-voice-backend/src/controllers/requiredWordsController.ts
import { Response } from 'express';
import Task from '../models/Task';
import User from '../models/User';
import Word from '../models/Word';
import WordInTask from '../models/WordInTask';
import { IUserRequest, TokenPayload } from '../types/auth';

// Get required words for conversation based on user's flashcard progress
export const getRequiredWords = async (req: IUserRequest, res: Response) => {
  try {
    const userId = req.user?.userId || req.user?.id?.toString() || req.query.userId as string;
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
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    const topicName = topic as string;
    const currentLevel = parseInt(level as string) || 1;

    // Strategy 1: Get words from user's completed flashcard tasks for this topic and level
    const learnedWords = await getLearnedWordsFromFlashcards(userId, topicName, currentLevel);
    
    // Strategy 2: Get additional words from the words database for this topic and user's English level
    const topicWords = await getTopicWords(topicName, user.EnglishLevel);
    
    // Strategy 3: Get words from previous levels if current level has few words
    let additionalWords: string[] = [];
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

  } catch (error) {
    console.error('Error getting required words:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to get required words',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Helper function to get words from user's flashcard tasks
async function getLearnedWordsFromFlashcards(userId: string, topicName: string, level: number): Promise<string[]> {
  try {
    // Find completed flashcard tasks for this user, topic, and level
    const flashcardTasks = await Task.findByUserTopicAndLevel(userId, topicName, level, 'flashcards');
    
    if (!flashcardTasks || flashcardTasks.length === 0) {
      console.log(`No flashcard tasks found for user ${userId}, topic ${topicName}, level ${level}`);
      return [];
    }

    const words: string[] = [];
    
    for (const task of flashcardTasks) {
      // Get words that were shown in this flashcard task
      const wordsInTask = await WordInTask.findByTaskId(task.TaskId);
      
      for (const wordInTask of wordsInTask) {
        const word = await Word.findById(wordInTask.WordId);
        if (word) {
          words.push(word.Word);
        }
      }
    }

    // Remove duplicates and return up to 6 words
    const uniqueWords = [...new Set(words)];
    console.log(`Found ${uniqueWords.length} learned words from flashcards:`, uniqueWords.slice(0, 6));
    
    return uniqueWords.slice(0, 6);
  } catch (error) {
    console.error('Error getting learned words from flashcards:', error);
    return [];
  }
}

// Helper function to get words from topic database
async function getTopicWords(topicName: string, englishLevel: string): Promise<string[]> {
  try {
    // First try to get words matching both topic and English level
    let words = await Word.findByTopicAndLevel(topicName, englishLevel);
    
    // If not enough words found, get any words from this topic
    if (words.length < 4) {
      const additionalWords = await Word.findByTopic(topicName);
      words = [...words, ...additionalWords];
    }
    
    // Extract just the word strings and remove duplicates
    const wordStrings: string[] = [...new Set(words.map((w: { Word: string }) => w.Word))];
    
    console.log(`Found ${wordStrings.length} topic words:`, wordStrings.slice(0, 4));
    return wordStrings.slice(0, 4);
  } catch (error) {
    console.error('Error getting topic words:', error);
    return [];
  }
}

// Helper function to get words from previous levels
async function getWordsFromPreviousLevels(userId: string, topicName: string, maxLevel: number): Promise<string[]> {
  try {
    const words: string[] = [];
    
    // Go through levels from 1 to maxLevel
    for (let level = 1; level <= maxLevel; level++) {
      const flashcardTasks = await Task.findByUserTopicAndLevel(userId, topicName, level, 'flashcards');
      
      for (const task of flashcardTasks) {
        const wordsInTask = await WordInTask.findByTaskId(task.TaskId);
        
        for (const wordInTask of wordsInTask) {
          const word = await Word.findById(wordInTask.WordId);
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
  } catch (error) {
    console.error('Error getting words from previous levels:', error);
    return [];
  }
}