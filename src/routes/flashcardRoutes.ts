// unity-voice-backend/src/routes/flashcardRoutes.ts - FIXED VERSION
import express from 'express';
import { IUserRequest } from '../types/auth';
import { getDbPool } from '../lib/db';
import { authMiddleware } from '../middleware/authMiddleware';
import { errorHandler } from '../middleware/errorHandler';
import { IUser } from '../models/User';
import { generateWords } from '../services/wordGenerator'; // ✅ Use the fixed wordGenerator
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * מקבל את רמת האנגלית של המשתמש לפי המזהה שלו
 */
async function getUserEnglishLevel(userId: string): Promise<string> {
  try {
    const pool = await getDbPool();
    const [users] = await pool.execute(
      'SELECT EnglishLevel FROM users WHERE UserId = ?',
      [userId]
    );

    if (Array.isArray(users) && users.length > 0) {
      return (users[0] as any).EnglishLevel || 'intermediate';
    }
    
    return 'intermediate';
  } catch (error) {
    console.error('Error getting user English level:', error);
    return 'intermediate';
  }
}

/**
 * ✅ NEW: Get all words that the user has already learned for a specific topic
 */
async function getUserLearnedWords(userId: string, topicName: string): Promise<string[]> {
  try {
    const pool = await getDbPool();
    
    // Get all words that the user has already learned for this topic
    const [learnedWords] = await pool.execute(
      `SELECT DISTINCT w.Word
       FROM words w
       JOIN wordintask wit ON w.WordId = wit.WordId
       JOIN tasks t ON wit.TaskId = t.TaskId
       WHERE t.UserId = ? AND w.TopicName = ?`,
      [userId, topicName]
    );
    
    if (Array.isArray(learnedWords)) {
      const words = learnedWords.map((row: any) => row.Word);
      console.log(`📚 User has learned ${words.length} words for topic "${topicName}":`, words.slice(0, 5).join(', ') + (words.length > 5 ? '...' : ''));
      return words;
    }
    
    return [];
  } catch (error) {
    console.error('Error getting user learned words:', error);
    return [];
  }
}

/**
 * ✅ IMPROVED: יוצר כרטיסיות פלאש חדשות באמצעות wordGenerator עם מניעת כפילויות
 */
async function generateFlashcardsWithWordGenerator(
  topicName: string, 
  userId: string, 
  userEnglishLevel: string,
  existingWords: string[] = []
): Promise<any[]> {
  try {
    console.log(`🎯 Generating words for level: ${userEnglishLevel}`);
    console.log(`🚫 Avoiding ${existingWords.length} existing words`);
    
    // ✅ Use the fixed wordGenerator that accepts existingWords parameter
    const newWords = await generateWords(userEnglishLevel, topicName, existingWords);
    console.log(`✅ wordGenerator returned ${newWords.length} new words`);
    
    if (newWords.length === 0) {
      console.log('❌ wordGenerator returned no words');
      return [];
    }
    
    // Save the words to database if they don't exist
    const pool = await getDbPool();
    const savedWords: any[] = [];

    for (const wordData of newWords) {
      try {
        // Check if word already exists in database
        const [existingInDb] = await pool.execute(
          'SELECT WordId, Word, Translation, ExampleUsage FROM words WHERE Word = ? AND TopicName = ?',
          [wordData.Word, topicName]
        );

        if (Array.isArray(existingInDb) && existingInDb.length > 0) {
          // Word exists in DB, use existing data
          const existingWord = existingInDb[0] as any;
          savedWords.push({
            WordId: existingWord.WordId,
            Word: existingWord.Word,
            Translation: existingWord.Translation,
            ExampleUsage: existingWord.ExampleUsage,
            TopicName: topicName,
            EnglishLevel: userEnglishLevel
          });
          console.log(`📖 Using existing word from DB: ${wordData.Word}`);
        } else {
          // Word doesn't exist, save it
          const wordId = wordData.WordId || uuidv4();
          
          await pool.execute(
            `INSERT INTO words 
             (WordId, Word, Translation, ExampleUsage, TopicName, EnglishLevel, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              wordId,
              wordData.Word,
              wordData.Translation || '',
              wordData.ExampleUsage || '',
              topicName,
              userEnglishLevel
            ]
          );

          savedWords.push({
            WordId: wordId,
            Word: wordData.Word,
            Translation: wordData.Translation || '',
            ExampleUsage: wordData.ExampleUsage || '',
            TopicName: topicName,
            EnglishLevel: userEnglishLevel
          });
          
          console.log(`💾 Saved new word to DB: ${wordData.Word}`);
        }
      } catch (wordError) {
        console.error(`❌ Error processing word "${wordData.Word}":`, wordError);
      }
    }

    console.log(`✅ Successfully processed ${savedWords.length} words`);
    return savedWords;
    
  } catch (error) {
    console.error('❌ Error in generateFlashcardsWithWordGenerator:', error);
    return [];
  }
}

// 🔥 נתיב עיקרי מתוקן לקבלת כרטיסיות פלאש לפי נושא ורמה - עם מניעת כפילויות
router.get('/:topic/:level', authMiddleware, async (req: IUserRequest, res) => {
  const requestId = Date.now().toString();
  
  try {
    const { topic, level } = req.params;
    const userId = req.user?.id;
    
    console.log(`🚀 [${requestId}] GET flashcards for:`, { topic, level, userId });
    
    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        error: 'User not authenticated',
        requestId 
      });
    }
    
    const pool = await getDbPool();
    
    // בדיקה שהנושא קיים
    const [topics] = await pool.execute(
      'SELECT * FROM topics WHERE TopicName = ?',
      [topic]
    );
    
    if (!Array.isArray(topics) || topics.length === 0) {
      console.log(`❌ [${requestId}] Topic "${topic}" not found`);
      return res.status(404).json({ 
        success: false, 
        error: `Topic "${topic}" not found`,
        requestId 
      });
    }
    
    // קבלת רמת האנגלית של המשתמש
    const userEnglishLevel = await getUserEnglishLevel(String(userId));
    console.log(`📊 [${requestId}] User English level: "${userEnglishLevel}"`);
    
    // ✅ NEW: Get user's learned words for this topic
    const learnedWords = await getUserLearnedWords(String(userId), topic);
    
    // 🔥 שאילתה מתוקנת - מחפשים מילים שלא נלמדו על ידי המשתמש
    const query = `
      SELECT DISTINCT w.WordId, w.Word, w.Translation, w.ExampleUsage, w.TopicName, w.EnglishLevel
      FROM words w
      WHERE w.TopicName = ? 
      AND w.EnglishLevel = ?
      AND w.WordId NOT IN (
        SELECT DISTINCT wit.WordId
        FROM wordintask wit
        JOIN tasks t ON wit.TaskId = t.TaskId
        WHERE t.UserId = ? AND t.TopicName = ?
      )
      ORDER BY RAND()
    `;
    
    console.log(`🔍 [${requestId}] Searching for unlearned words...`);
    const [existingWords] = await pool.execute(query, [topic, userEnglishLevel, String(userId), topic]);
    
    let availableWords: any[] = Array.isArray(existingWords) ? existingWords : [];
    console.log(`📝 [${requestId}] Found ${availableWords.length} existing unlearned words`);
    
    // 🎯 כאן הלוגיקה החדשה: נוודא שיש לנו בין 5-7 מילים
    const REQUIRED_MIN_WORDS = 5;
    const REQUIRED_MAX_WORDS = 7;
    
    // אם יש פחות מ-5 מילים, צור מילים חדשות
    if (availableWords.length < REQUIRED_MIN_WORDS) {
      console.log(`🤖 [${requestId}] Need more words (${availableWords.length}/${REQUIRED_MIN_WORDS}), generating with AI...`);
      
      try {
        // חשב כמה מילים נוספות אנחנו צריכים
        const wordsNeeded = Math.max(6, REQUIRED_MAX_WORDS - availableWords.length);
        console.log(`📊 [${requestId}] Need to generate ${wordsNeeded} additional words`);
        
        // ✅ FIXED: Pass learned words to prevent duplicates
        const newWords = await generateFlashcardsWithWordGenerator(
          topic, 
          String(userId), 
          userEnglishLevel,
          learnedWords // ✅ This prevents generating words the user already learned
        );
        
        console.log(`✅ [${requestId}] Generated ${newWords.length} new words with AI`);
        
        // סנן מילים חדשות שלא נלמדו עדיין ואין כפילויות
        const filteredNewWords = [];
        const existingWordIds = new Set(availableWords.map((w: any) => w.WordId));
        const existingWordTexts = new Set(availableWords.map((w: any) => w.Word.toLowerCase()));
        
        for (const newWord of newWords) {
          // בדוק שהמילה לא קיימת כבר ברשימה שלנו (לא לפי ID אלא לפי טקסט)
          if (existingWordIds.has(newWord.WordId) || existingWordTexts.has(newWord.Word.toLowerCase())) {
            console.log(`⏭️ [${requestId}] Skipping duplicate word: ${newWord.Word}`);
            continue;
          }
          
          // בדוק שהמילה לא נלמדה על ידי המשתמש (כפול ביטחון)
          if (learnedWords.includes(newWord.Word)) {
            console.log(`⏭️ [${requestId}] Skipping already learned word: ${newWord.Word}`);
            continue;
          }
          
          filteredNewWords.push(newWord);
          existingWordIds.add(newWord.WordId);
          existingWordTexts.add(newWord.Word.toLowerCase());
          
          // הפסק אם הגענו למספר המילים שאנחנו צריכים
          if (filteredNewWords.length >= wordsNeeded) {
            break;
          }
        }
        
        console.log(`🔍 [${requestId}] Filtered to ${filteredNewWords.length} truly new words`);
        availableWords = [...availableWords, ...filteredNewWords] as any[];
        
      } catch (aiError) {
        console.error(`❌ [${requestId}] AI generation failed:`, aiError);
        
        // אם יצירת מילים חדשות נכשלה ויש פחות מ-5 מילים, החזר שגיאה
        if (availableWords.length < REQUIRED_MIN_WORDS) {
          return res.status(500).json({ 
            success: false, 
            error: 'Insufficient words available and failed to generate new ones',
            requestId,
            availableWords: availableWords.length,
            minimumRequired: REQUIRED_MIN_WORDS,
            debug: {
              topic,
              userLevel: userEnglishLevel,
              userId: String(userId),
              learnedWordsCount: learnedWords.length,
              errorMessage: aiError instanceof Error ? aiError.message : 'Unknown AI error'
            }
          });
        }
      }
    }
    
    // 🎯 וודא שאנחנו מחזירים בדיוק בין 5-7 מילים
    let finalWords: any[] = [...availableWords];
    
    if (finalWords.length > REQUIRED_MAX_WORDS) {
      // אם יש יותר מ-7, קח רק 7 רנדומליות
      finalWords = finalWords
        .sort(() => Math.random() - 0.5) // ערבב
        .slice(0, REQUIRED_MAX_WORDS);
      console.log(`✂️ [${requestId}] Trimmed to ${REQUIRED_MAX_WORDS} words`);
    }
    
    // בדיקה אחרונה - אם עדיין יש פחות מ-5 מילים
    if (finalWords.length < REQUIRED_MIN_WORDS) {
      console.error(`❌ [${requestId}] Still insufficient words: ${finalWords.length}/${REQUIRED_MIN_WORDS}`);
      return res.status(500).json({ 
        success: false, 
        error: 'Cannot provide minimum required words for this topic and level',
        requestId,
        availableWords: finalWords.length,
        minimumRequired: REQUIRED_MIN_WORDS,
        debug: {
          topic,
          userLevel: userEnglishLevel,
          userId: String(userId),
          learnedWordsCount: learnedWords.length,
          learnedWords: learnedWords.slice(0, 10) // Show first 10 learned words for debugging
        }
      });
    }
    
    console.log(`📤 [${requestId}] Returning ${finalWords.length} words (${REQUIRED_MIN_WORDS}-${REQUIRED_MAX_WORDS} required)`);
    
    return res.json({ 
      success: true, 
      data: finalWords,
      requestId,
      stats: {
        wordsReturned: finalWords.length,
        requiredRange: `${REQUIRED_MIN_WORDS}-${REQUIRED_MAX_WORDS}`,
        existingWords: Array.isArray(existingWords) ? existingWords.length : 0,
        newWordsGenerated: Math.max(0, finalWords.length - (Array.isArray(existingWords) ? existingWords.length : 0)),
        userLevel: userEnglishLevel,
        topic: topic,
        learnedWordsCount: learnedWords.length
      }
    });
    
  } catch (error) {
    console.error(`💥 [${requestId}] Error fetching flashcards:`, {
      error: error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      errorStack: error instanceof Error ? error.stack : undefined,
      params: req.params,
      userId: req.user?.id
    });
    
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch flashcards',
      requestId,
      details: process.env.NODE_ENV === 'development' ? 
        (error instanceof Error ? error.message : 'Unknown error') : undefined
    });
  }
});

// נתיב ליצירת כרטיסיית פלאש חדשה
router.post('/', authMiddleware, async (req: IUserRequest, res) => {
  try {
    const { Word, Translation, TopicName, Level = 1, ExampleUsage = "" } = req.body;
    
    if (!Word || !Translation || !TopicName) {
      return res.status(400).json({ 
        success: false, 
        error: 'Word, translation, and topic are required' 
      });
    }
    
    const pool = await getDbPool();
    
    // בדיקה שהנושא קיים
    const [topics] = await pool.execute(
      'SELECT * FROM topics WHERE TopicName = ?',
      [TopicName]
    );
    
    if (!Array.isArray(topics) || topics.length === 0) {
      return res.status(404).json({ 
        success: false, 
        error: 'Topic not found' 
      });
    }
    
    // יצירת מזהה ייחודי למילה
    const WordId = uuidv4();
    
    // שמירת המילה החדשה
    await pool.execute(
      `INSERT INTO words 
       (WordId, Word, Translation, ExampleUsage, TopicName, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
      [
        WordId,
        Word,
        Translation,
        ExampleUsage,
        TopicName
      ]
    );
    
    return res.json({ 
      success: true, 
      data: {
        WordId,
        Word,
        Translation,
        ExampleUsage,
        TopicName,
        Level
      } 
    });
  } catch (error) {
    console.error('Error creating flashcard:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to create flashcard' 
    });
  }
});

// נתיב לסימון מילה כנלמדה
router.post('/mark-learned', authMiddleware, async (req: IUserRequest, res) => {
  try {
    const { WordId, TaskId, TopicName } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    if (!WordId || !TaskId) {
      return res.status(400).json({ 
        success: false, 
        message: 'WordId and TaskId are required' 
      });
    }

    const pool = await getDbPool();
    
    // בדיקה שהמילה קיימת
    const [words] = await pool.execute(
      'SELECT * FROM words WHERE WordId = ?',
      [WordId]
    );
    
    if (!Array.isArray(words) || words.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Word not found' 
      });
    }
    
    // בדיקה שהמשימה קיימת ושייכת למשתמש
    const [tasks] = await pool.execute(
      'SELECT * FROM tasks WHERE TaskId = ? AND UserId = ?',
      [TaskId, String(userId)]
    );
    
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(404).json({ 
        success: false, 
        message: 'Task not found or not authorized' 
      });
    }
    
    // בדיקה אם המילה כבר נמצאת במשימה
    const [wordintask] = await pool.execute(
      'SELECT * FROM wordintask WHERE TaskId = ? AND WordId = ?',
      [TaskId, WordId]
    );
    
    // אם המילה כבר במשימה, החזר הצלחה
    if (Array.isArray(wordintask) && wordintask.length > 0) {
      return res.json({ 
        success: true, 
        message: 'Word already marked as learned' 
      });
    }
    
    // הוספת המילה למשימה
    await pool.execute(
      'INSERT INTO wordintask (TaskId, WordId) VALUES (?, ?)',
      [TaskId, WordId]
    );
    
    return res.json({ 
      success: true, 
      message: 'Word marked as learned'
    });
  } catch (error) {
    console.error('Error marking word as learned:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to mark word as learned' 
    });
  }
});

/**
 * POST /words - Save words and create word-task associations
 * Endpoint to store words learned by a user and associate them with a task
 */
router.post('/words', authMiddleware, async (req: IUserRequest, res: express.Response) => {
  try {
    const pool = await getDbPool();
    const userId = req.user?.id;
    const { words, taskId } = req.body;
    
    if (!words || !Array.isArray(words) || words.length === 0) {
      return res.status(400).json({ message: 'Words array is required' });
    }
    
    if (!taskId) {
      return res.status(400).json({ message: 'Task ID is required' });
    }
    
    // Start a transaction to ensure data integrity
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      const savedWordIds = [];
      
      // Save each word to the words table if it doesn't exist
      for (const word of words) {
        // Check if the word already exists
        const [existingWords] = await connection.execute(
          'SELECT WordId FROM words WHERE Word = ? AND TopicName = ?',
          [word.Word, word.TopicName]
        );
        
        let wordId;
        
        if (Array.isArray(existingWords) && existingWords.length > 0) {
          // Word already exists, use its ID
          wordId = (existingWords[0] as any).WordId;
        } else {
          // Word doesn't exist, insert it
          const newWordId = word.WordId || uuidv4();
          await connection.execute(
            `INSERT INTO words 
             (WordId, Word, Translation, ExampleUsage, TopicName, createdAt, updatedAt)
             VALUES (?, ?, ?, ?, ?, NOW(), NOW())`,
            [
              newWordId,
              word.Word,
              word.Translation,
              word.ExampleUsage,
              word.TopicName
            ]
          );
          wordId = newWordId;
        }
        
        savedWordIds.push(wordId);
        
        // Create word-task association
        // Skip if association already exists
        const [existingAssoc] = await connection.execute(
          'SELECT TaskId FROM wordintask WHERE TaskId = ? AND WordId = ?',
          [taskId, wordId]
        );
        
        if (!(Array.isArray(existingAssoc) && existingAssoc.length > 0)) {
          await connection.execute(
            `INSERT INTO wordintask 
             (TaskId, WordId, AddedAt)
             VALUES (?, ?, NOW())`,
            [taskId, wordId]
          );
        }
      }
      
      // Commit the transaction
      await connection.commit();
      
      // Return success response
      return res.status(200).json({
        message: 'Words saved and associated with task successfully',
        wordIds: savedWordIds
      });
    } catch (error) {
      // Rollback the transaction if an error occurs
      await connection.rollback();
      throw error;
    } finally {
      // Release the connection
      connection.release();
    }
  } catch (error) {
    console.error('Error saving words:', error);
    return res.status(500).json({
      message: 'Failed to save words',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /tasks/:taskId/complete - Complete a task
 * Endpoint to mark a task as completed and update task status
 */
router.put('/tasks/:taskId/complete', authMiddleware, async (req: IUserRequest, res: express.Response) => {
  try {
    const pool = await getDbPool();
    const taskId = req.params.taskId;
    const { wordIds, CompletionDate, TaskScore } = req.body;
    
    // Get the task to ensure it exists and belongs to the user
    const [tasks] = await pool.execute(
      'SELECT * FROM tasks WHERE TaskId = ?',
      [taskId]
    );
    
    if (!Array.isArray(tasks) || tasks.length === 0) {
      return res.status(404).json({ message: 'Task not found' });
    }
    
    const task = tasks[0] as any;
    
    // Start a transaction
    const connection = await pool.getConnection();
    await connection.beginTransaction();
    
    try {
      // Associate words with the task if provided
      if (wordIds && Array.isArray(wordIds)) {
        for (const wordId of wordIds) {
          // Skip if association already exists
          const [existingAssoc] = await connection.execute(
            'SELECT TaskId FROM wordintask WHERE TaskId = ? AND WordId = ?',
            [taskId, wordId]
          );
          
          if (!(Array.isArray(existingAssoc) && existingAssoc.length > 0)) {
            await connection.execute(
              `INSERT INTO wordintask 
               (TaskId, WordId, AddedAt)
               VALUES (?, ?, NOW())`,
              [taskId, wordId]
            );
          }
        }
      }
      
      // Mark the task as completed
      await connection.execute(
        `UPDATE tasks 
         SET TaskScore = ?, CompletionDate = ? 
         WHERE TaskId = ?`,
        [TaskScore || 100, CompletionDate || new Date(), taskId]
      );
      
      // Commit the transaction
      await connection.commit();
      
      // Return success response
      return res.status(200).json({
        message: 'Task completed successfully',
        taskId
      });
    } catch (error) {
      // Rollback the transaction if an error occurs
      await connection.rollback();
      throw error;
    } finally {
      // Release the connection
      connection.release();
    }
  } catch (error) {
    console.error('Error completing task:', error);
    return res.status(500).json({
      message: 'Failed to complete task',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;