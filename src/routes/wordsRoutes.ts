import express from 'express';
import { Pool } from 'mysql2/promise';
import pool from '../models/db';
import { authMiddleware } from '../middleware/authMiddleware';
import { TokenPayload } from '../types/auth';
import { generateWords } from '../services/wordGenerator'; 

interface IUserRequest extends express.Request {
  user?: TokenPayload;
}

const router = express.Router();

/**
 * קבלת מילים לפי נושא ורמת אנגלית
 * GET /api/words?topic=topicName&level=level&randomLimit=5&filterLearned=true
 */
router.get('/', authMiddleware, async (req: IUserRequest, res) => {
  try {
    console.log('🚀 GET /api/words - Starting request');
    console.log('📥 Query params:', req.query);
    console.log('👤 User ID:', req.user?.id);
    
    const { topic, level, randomLimit, filterLearned } = req.query;
    const userId = req.user?.id;
    
    if (!userId) {
      console.log('❌ No user ID found');
      return res.status(401).json({ error: 'User ID not found in token' });
    }
    
    const connection = await pool.getConnection();
    try {
      // 🔥 קודם כל - קבל את EnglishLevel של המשתמש מהDB
      const [userRows] = await connection.query(
        'SELECT EnglishLevel FROM users WHERE UserId = ?',
        [userId]
      );
      const users = userRows as any[];
      const userEnglishLevel = users[0]?.EnglishLevel || 'intermediate';
      
      console.log(`👤 User's English Level from DB: "${userEnglishLevel}"`);
      
      // השתמש ב-level מה-query (השלב) לחיפוש במילים
      let userLevel = level as string || '1';
      
      let query = 'SELECT * FROM words WHERE EnglishLevel = ?';
      const params: any[] = [userEnglishLevel]; // 🔥 השתמש ב-EnglishLevel מהDB!
      
      // Add topic filter if provided
      if (topic) {
        query += ' AND (TopicName = ? OR LOWER(TopicName) = LOWER(?))';
        params.push(topic, topic);
      }
      
      // Add random ordering and limit
      const limit = randomLimit ? parseInt(randomLimit as string, 10) : 20;
      query += ' ORDER BY RAND() LIMIT ?';
      params.push(limit);
      
      const [words] = await connection.query(query, params);
      
      console.log(`🔍 Found ${(words as any[]).length} existing words for EnglishLevel: "${userEnglishLevel}"`);
      
      if ((words as any[]).length < 5) {
        console.log('🤖 Not enough words - starting AI generation');
        console.log(`Topic: "${topic}", User's EnglishLevel: "${userEnglishLevel}"`);
        
        try {
          console.log('📞 Calling generateWords...');
          // 🔥 העבר את EnglishLevel האמיתי מהDB
          const generatedWords = await generateWords(userEnglishLevel, topic as string);
          console.log(`✅ Generated ${generatedWords.length} new words:`, generatedWords);
          
          if (generatedWords.length > 0) {
            console.log('💾 Saving to database...');
            await saveNewWordsToDatabase(generatedWords, connection);
            const allWords = [...(words as any[]), ...generatedWords];
            console.log(`📤 Returning ${allWords.length} total words`);
            res.json(allWords);
            return;
          }
        } catch (error) {
          console.error('❌ AI generation failed:', error);
        }
      }
      
      console.log(`📤 Returning ${(words as any[]).length} existing words`);
      res.json(words);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('💥 Route error:', error);
    res.status(500).json({ error: 'Failed to fetch words' });
  }
});

/**
 * קבלת מילים שנלמדו לפי משתמש ונושא
 * GET /api/words/learned?topic=topicName&level=1
 */
router.get('/learned', authMiddleware, async (req: IUserRequest, res) => {
  try {
    console.log('GET /api/words/learned - Fetching learned words');
    
    const { topic, level } = req.query;
    const userId = req.user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'User ID not found in token' });
    }
    
    const connection = await pool.getConnection();
    try {
      let query = `
        SELECT DISTINCT w.*
        FROM Words w
        JOIN wordintask wit ON w.WordId = wit.WordId
        JOIN Tasks t ON wit.TaskId = t.TaskId
        WHERE t.UserId = ? AND t.CompletionDate IS NOT NULL
      `;
      const params: any[] = [userId];
      
      if (topic) {
        query += ' AND (LOWER(w.TopicName) = LOWER(?) OR LOWER(w.TopicName) = LOWER(?))';
        params.push(topic, topic);
      }
      
      if (level) {
        query += ' AND t.Level = ?';
        params.push(level);
      }
      
      query += ' ORDER BY w.Word';
      
      const [learnedWords] = await connection.query(query, params);
      
      console.log(`Retrieved ${(learnedWords as any[]).length} learned words for user: ${userId}`);
      res.json(learnedWords);
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching learned words:', error);
    res.status(500).json({ error: 'Failed to fetch learned words' });
  }
});

async function saveNewWordsToDatabase(words: any[], connection: any) {
  try {
    for (const word of words) {
      await connection.query(
        'INSERT INTO words (WordId, Word, Translation, ExampleUsage, TopicName, EnglishLevel) VALUES (?, ?, ?, ?, ?, ?)',
        [word.WordId, word.Word, word.Translation, word.ExampleUsage, word.TopicName, word.EnglishLevel]
      );
    }
    console.log(`💾 Saved ${words.length} new words to database`);
  } catch (error) {
    console.error('❌ Error saving words to database:', error);
    throw error;
  }
}
/**
 * שמירת מילים למשימה
 * POST /api/word-to-task
 */
router.post('/word-to-task', authMiddleware, async (req: IUserRequest, res) => {
  try {
    const { mappings } = req.body; // array של {WordId, TaskId}
    
    if (!Array.isArray(mappings)) {
      return res.status(400).json({ error: 'Mappings must be an array' });
    }
    
    const connection = await pool.getConnection();
    try {
      for (const mapping of mappings) {
        await connection.query(
          'INSERT IGNORE INTO wordintask (WordId, TaskId) VALUES (?, ?)',
          [mapping.WordId, mapping.TaskId]
        );
      }
      
      console.log(`Saved ${mappings.length} word-to-task mappings`);
      res.json({ success: true, count: mappings.length });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error saving word-to-task mappings:', error);
    res.status(500).json({ error: 'Failed to save mappings' });
  }
});
export default router;