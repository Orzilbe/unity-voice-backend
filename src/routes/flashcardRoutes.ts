// unity-voice-backend/src/routes/flashcardRoutes.ts
import express from 'express';
import { IUserRequest } from '../types/auth';
import { getDbPool } from '../lib/db';
import { authMiddleware } from '../middleware/authMiddleware';
import { errorHandler } from '../middleware/errorHandler';
import { IUser } from '../models/User';
import { AzureOpenAI } from 'openai';
import { v4 as uuidv4 } from 'uuid';

const openai = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
  apiVersion: "2024-04-01-preview"
});

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
 * יוצר כרטיסיות פלאש חדשות באמצעות OpenAI לפי רמת האנגלית של המשתמש
 */
async function generateFlashcardsWithOpenAI(topicName: string, userId: string | number): Promise<any[]> {
  try {
    const userEnglishLevel = await getUserEnglishLevel(String(userId));
    console.log(`🎯 Generating words for level: ${userEnglishLevel}`);
    
    let prompt = '';
    
    // 🔥 עדכון כל הפרומפטים להבטיח 10 מילים
    if(topicName === "Diplomacy and International Relations") {
      prompt = `Generate EXACTLY 10 unique ENGLISH words related to diplomacy and international relations, appropriate for ${userEnglishLevel} level English learners.

CRITICAL REQUIREMENTS:
- You MUST generate exactly 10 words, no more, no less
- All words must be in ENGLISH only (never Hebrew)
- Each word must be unique and different
- Words should be progressively challenging for ${userEnglishLevel} level

Focus on these areas:
- Diplomatic negotiations and protocols
- International conflict resolution
- Geopolitical strategies and alliances  
- Cross-cultural diplomatic communication
- International law and treaties
- Multilateral organizations
- Foreign policy terminology
- Economic diplomacy
- Security cooperation
- Regional partnerships

For each ENGLISH word, provide:
1. The English word (not Hebrew!)
2. Hebrew translation 
3. Example sentence in English

Response format (JSON array with exactly 10 items):
[{
  "word": "English word here",
  "translation": "Hebrew translation here", 
  "example": "English example sentence here"
}, ...]

Generate exactly 10 words at ${userEnglishLevel} difficulty level.`;

    } else if(topicName === "Economy and Entrepreneurship") {
      prompt = `Generate EXACTLY 10 unique ENGLISH words related to economy and entrepreneurship, appropriate for ${userEnglishLevel} level English learners.

CRITICAL REQUIREMENTS:
- You MUST generate exactly 10 words, no more, no less
- All words must be in ENGLISH only (never Hebrew)
- Each word must be unique and different
- Words should be progressively challenging for ${userEnglishLevel} level

Focus on these areas:
- Startup ecosystem and venture capital
- Economic innovation and disruption
- Financial technologies and fintech
- Entrepreneurial strategies and methodologies
- Market analysis and business development
- Investment and funding mechanisms
- Economic indicators and metrics
- Business scalability and growth
- Digital transformation in business
- Global economic trends

For each ENGLISH word, provide:
1. The English word (not Hebrew!)
2. Hebrew translation
3. Example sentence in English

Response format (JSON array with exactly 10 items):
[{
  "word": "English word here",
  "translation": "Hebrew translation here",
  "example": "English example sentence here"
}, ...]

Generate exactly 10 words at ${userEnglishLevel} difficulty level.`;

    } else if(topicName === "Environment and Sustainability") {
      prompt = `Generate EXACTLY 10 unique ENGLISH words related to environment and sustainability, appropriate for ${userEnglishLevel} level English learners.

CRITICAL REQUIREMENTS:
- You MUST generate exactly 10 words, no more, no less
- All words must be in ENGLISH only (never Hebrew)
- Each word must be unique and different
- Words should be progressively challenging for ${userEnglishLevel} level

Focus on these areas:
- Environmental conservation
- Climate change initiatives
- Sustainable development
- Environmental policies
- Renewable energy
- Climate science
- Conservation biology
- Green technology
- Environmental economics
- Ecosystem management

For each ENGLISH word, provide:
1. The English word (not Hebrew!)
2. Hebrew translation
3. Example sentence in English

Response format (JSON array with exactly 10 items):
[{
  "word": "English word here",
  "translation": "Hebrew translation here",
  "example": "English example sentence here"
}, ...]

Generate exactly 10 words at ${userEnglishLevel} difficulty level.`;

    } else if(topicName === "Innovation and Technology") {
      prompt = `Generate EXACTLY 10 unique ENGLISH words related to innovation and technology, appropriate for ${userEnglishLevel} level English learners.

CRITICAL REQUIREMENTS:
- You MUST generate exactly 10 words, no more, no less
- All words must be in ENGLISH only (never Hebrew)
- Each word must be unique and different
- Words should be progressively challenging for ${userEnglishLevel} level

Focus on these areas:
- Artificial intelligence and machine learning
- Cybersecurity and digital protection
- Software development and programming
- Data science and analytics
- Cloud computing and infrastructure
- Internet of Things (IoT)
- Blockchain and cryptocurrency
- Biotechnology and medical innovation
- Robotics and automation
- Digital transformation

For each ENGLISH word, provide:
1. The English word (not Hebrew!)
2. Hebrew translation
3. Example sentence in English

Response format (JSON array with exactly 10 items):
[{
  "word": "English word here",
  "translation": "Hebrew translation here",
  "example": "English example sentence here"
}, ...]

Generate exactly 10 words at ${userEnglishLevel} difficulty level.`;

    } else if(topicName === "History and Heritage") {
      prompt = `Generate EXACTLY 10 unique ENGLISH words related to history and heritage, appropriate for ${userEnglishLevel} level English learners.

CRITICAL REQUIREMENTS:
- You MUST generate exactly 10 words, no more, no less
- All words must be in ENGLISH only (never Hebrew)
- Each word must be unique and different
- Words should be progressively challenging for ${userEnglishLevel} level

Focus on these areas:
- Historical milestones and events
- Cultural heritage preservation
- Archaeological discoveries
- Historical movements and revolutions
- Ancient civilizations
- Medieval and modern history
- Historical documentation
- Cultural traditions
- Historical analysis
- Heritage conservation

For each ENGLISH word, provide:
1. The English word (not Hebrew!)
2. Hebrew translation
3. Example sentence in English

Response format (JSON array with exactly 10 items):
[{
  "word": "English word here",
  "translation": "Hebrew translation here",
  "example": "English example sentence here"
}, ...]

Generate exactly 10 words at ${userEnglishLevel} difficulty level.`;

    } else if(topicName === "Holocaust and Revival") {
      prompt = `Generate EXACTLY 10 unique ENGLISH words related to Holocaust remembrance and revival, appropriate for ${userEnglishLevel} level English learners.

CRITICAL REQUIREMENTS:
- You MUST generate exactly 10 words, no more, no less
- All words must be in ENGLISH only (never Hebrew)
- Each word must be unique and different
- Words should be progressively challenging for ${userEnglishLevel} level

Focus on these areas:
- Holocaust remembrance and education
- Resilience and recovery
- Historical documentation and testimony
- Cultural preservation and revival
- Memory and commemoration
- Survivor narratives
- Historical justice
- Community rebuilding
- Cultural renaissance
- Hope and renewal

For each ENGLISH word, provide:
1. The English word (not Hebrew!)
2. Hebrew translation
3. Example sentence in English

Response format (JSON array with exactly 10 items):
[{
  "word": "English word here",
  "translation": "Hebrew translation here",
  "example": "English example sentence here"
}, ...]

Generate exactly 10 words at ${userEnglishLevel} difficulty level.`;

    } else if(topicName === "Iron Swords War") {
      prompt = `Generate EXACTLY 10 unique ENGLISH words related to recent conflicts and international relations, appropriate for ${userEnglishLevel} level English learners.

CRITICAL REQUIREMENTS:
- You MUST generate exactly 10 words, no more, no less
- All words must be in ENGLISH only (never Hebrew)
- Each word must be unique and different
- Words should be progressively challenging for ${userEnglishLevel} level

Focus on these areas:
- Military operations and strategy
- International response and diplomacy
- Humanitarian concerns and aid
- Geopolitical implications
- Conflict resolution and mediation
- Security cooperation
- Regional stability
- International law
- Peacekeeping efforts
- Crisis management

For each ENGLISH word, provide:
1. The English word (not Hebrew!)
2. Hebrew translation
3. Example sentence in English

Response format (JSON array with exactly 10 items):
[{
  "word": "English word here",
  "translation": "Hebrew translation here",
  "example": "English example sentence here"
}, ...]

Generate exactly 10 words at ${userEnglishLevel} difficulty level.`;

    } else if(topicName === "Society and Multiculturalism") {
      prompt = `Generate EXACTLY 10 unique ENGLISH words related to social dynamics and multicultural interactions, appropriate for ${userEnglishLevel} level English learners.

CRITICAL REQUIREMENTS:
- You MUST generate exactly 10 words, no more, no less
- All words must be in ENGLISH only (never Hebrew)
- Each word must be unique and different
- Words should be progressively challenging for ${userEnglishLevel} level

Focus on these areas:
- Social interaction and communication
- Multicultural communities
- Cultural diversity and inclusion
- Social integration and adaptation
- Community dynamics
- Cross-cultural understanding
- Social justice and equality
- Immigration and migration
- Cultural exchange
- Social cohesion

For each ENGLISH word, provide:
1. The English word (not Hebrew!)
2. Hebrew translation
3. Example sentence in English

Response format (JSON array with exactly 10 items):
[{
  "word": "English word here",
  "translation": "Hebrew translation here",
  "example": "English example sentence here"
}, ...]

Generate exactly 10 words at ${userEnglishLevel} difficulty level.`;

    } else {
      // פרומפט כללי מתוקן
      prompt = `Generate EXACTLY 10 unique ENGLISH words related to ${topicName}, appropriate for ${userEnglishLevel} level English learners.

CRITICAL REQUIREMENTS:
- You MUST generate exactly 10 words, no more, no less
- All words must be in ENGLISH only (never Hebrew)
- Each word must be unique and different
- Words should be progressively challenging for ${userEnglishLevel} level

For each ENGLISH word, provide:
1. The English word (not Hebrew!)
2. Hebrew translation
3. Example sentence in English

Response format (JSON array with exactly 10 items):
[{
  "word": "English word here",
  "translation": "Hebrew translation here",
  "example": "English example sentence here"
}, ...]

Generate exactly 10 words at ${userEnglishLevel} difficulty level related to ${topicName}.`;
    }

    // שליחת בקשה ל-OpenAI
    const completion = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4o",
      messages: [
        { 
          role: "system", 
          content: "You are an English vocabulary assistant. You MUST generate exactly 10 ENGLISH words with their Hebrew translations. Always count your words and ensure you provide exactly 10." 
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    // עיבוד התשובה
    const responseText = completion.choices[0].message.content?.trim() || '';
    console.log('🤖 AI Response preview:', responseText.substring(0, 300) + '...');
    
    let wordsData;

    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : responseText;
      
      wordsData = JSON.parse(jsonString);
      
      // וודא שקיבלנו מערך
      if (!Array.isArray(wordsData)) {
        throw new Error('Response is not an array');
      }
      
      // בדיקת תקינות: וודא שכל המילים באנגלית
      const validWords = wordsData.filter((item: any) => {
        const word = item.word || '';
        const isEnglish = /^[a-zA-Z\s\-']+$/.test(word);
        const hasHebrew = /[\u0590-\u05FF]/.test(word);
        
        if (!isEnglish || hasHebrew) {
          console.log(`❌ Rejecting non-English word: "${word}"`);
          return false;
        }
        return true;
      });
      
      console.log(`✅ Validated ${validWords.length} English words out of ${wordsData.length} generated`);
      wordsData = validWords;
      
    } catch (jsonError) {
      console.error('Error parsing OpenAI response as JSON:', jsonError);
      return [];
    }

    if (!Array.isArray(wordsData) || wordsData.length === 0) {
      console.error('❌ No valid English words generated');
      return [];
    }

    // שמירת המילים במסד הנתונים
    const pool = await getDbPool();
    const savedWords: any[] = [];

    for (const item of wordsData) {
      const wordId = uuidv4();
      const { word, translation, example = "" } = item;

      // בדיקה נוספת שהמילה באנגלית
      if (!/^[a-zA-Z\s\-']+$/.test(word) || /[\u0590-\u05FF]/.test(word)) {
        console.log(`⏭️ Skipping non-English word: "${word}"`);
        continue;
      }

      // בדיקה אם המילה כבר קיימת
      const [existingWords] = await pool.execute(
        'SELECT * FROM words WHERE Word = ? AND TopicName = ?',
        [word, topicName]
      );

      if (Array.isArray(existingWords) && existingWords.length > 0) {
        const existingWord = existingWords[0] as any;
        savedWords.push({
          WordId: existingWord.WordId,
          Word: word,
          Translation: translation,
          ExampleUsage: example,
          TopicName: topicName,
          EnglishLevel: existingWord.EnglishLevel || userEnglishLevel
        });
        continue;
      }

      // שמירת מילה חדשה
      console.log(`💾 Saving ENGLISH word: "${word}" with level: ${userEnglishLevel}`);
      await pool.execute(
        `INSERT INTO words 
         (WordId, Word, Translation, ExampleUsage, TopicName, EnglishLevel, createdAt, updatedAt)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [
          wordId,
          word,
          translation,
          example,
          topicName,
          userEnglishLevel
        ]
      );

      savedWords.push({
        WordId: wordId,
        Word: word,
        Translation: translation,
        ExampleUsage: example,
        TopicName: topicName,
        EnglishLevel: userEnglishLevel
      });
    }

    console.log(`✅ Generated and saved ${savedWords.length} ENGLISH words`);
    return savedWords;
    
  } catch (error) {
    console.error('Error generating flashcards with OpenAI:', error);
    return [];
  }
}

// 🔥 נתיב עיקרי מתוקן לקבלת כרטיסיות פלאש לפי נושא ורמה - עם הבטחה ל-5-7 מילים
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
        const wordsNeeded = REQUIRED_MAX_WORDS - availableWords.length;
        console.log(`📊 [${requestId}] Need to generate ${wordsNeeded} additional words`);
        
        const newWords = await generateFlashcardsWithOpenAI(topic, userId);
        console.log(`✅ [${requestId}] Generated ${newWords.length} new words with AI`);
        
        // סנן מילים חדשות שלא נלמדו עדיין ואין כפילויות
        const filteredNewWords = [];
        const existingWordIds = new Set(availableWords.map((w: any) => w.WordId));
        
        for (const newWord of newWords) {
          // בדוק שהמילה לא קיימת כבר ברשימה שלנו
          if (existingWordIds.has(newWord.WordId)) {
            console.log(`⏭️ [${requestId}] Skipping duplicate word: ${newWord.Word}`);
            continue;
          }
          
          // בדוק שהמילה לא נלמדה על ידי המשתמש
          const [learned] = await pool.execute(
            `SELECT 1 FROM wordintask wit
             JOIN tasks t ON wit.TaskId = t.TaskId
             WHERE t.UserId = ? AND t.TopicName = ? AND wit.WordId = ?`,
            [String(userId), topic, newWord.WordId]
          );
          
          if (!Array.isArray(learned) || learned.length === 0) {
            filteredNewWords.push(newWord);
            existingWordIds.add(newWord.WordId);
            
            // הפסק אם הגענו למספר המילים שאנחנו צריכים
            if (filteredNewWords.length >= wordsNeeded) {
              break;
            }
          } else {
            console.log(`⏭️ [${requestId}] Skipping already learned word: ${newWord.Word}`);
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
            minimumRequired: REQUIRED_MIN_WORDS
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
          userId: String(userId)
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
        topic: topic
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