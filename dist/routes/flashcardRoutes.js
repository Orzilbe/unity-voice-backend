"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// unity-voice-backend/src/routes/flashcardRoutes.ts
const express_1 = __importDefault(require("express"));
const db_1 = require("../lib/db");
const authMiddleware_1 = require("../middleware/authMiddleware");
const openai_1 = require("openai");
const uuid_1 = require("uuid");
const openai = new openai_1.AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    apiVersion: "2024-04-01-preview"
});
const router = express_1.default.Router();
/**
 * מקבל את רמת האנגלית של המשתמש לפי המזהה שלו
 */
async function getUserEnglishLevel(userId) {
    try {
        const pool = await (0, db_1.getDbPool)();
        const [users] = await pool.execute('SELECT EnglishLevel FROM Users WHERE UserId = ?', [userId]);
        if (Array.isArray(users) && users.length > 0) {
            return users[0].EnglishLevel || 'intermediate';
        }
        return 'intermediate';
    }
    catch (error) {
        console.error('Error getting user English level:', error);
        return 'intermediate';
    }
}
/**
 * יוצר כרטיסיות פלאש חדשות באמצעות OpenAI לפי רמת האנגלית של המשתמש
 */
// unity-voice-backend/src/routes/flashcardRoutes.ts
// תיקון ליצירת מילים חדשות עם EnglishLevel נכון
/**
 * יוצר כרטיסיות פלאש חדשות באמצעות OpenAI לפי רמת האנגלית של המשתמש
 */
async function generateFlashcardsWithOpenAI(topicName, userId) {
    try {
        const userEnglishLevel = await getUserEnglishLevel(String(userId));
        console.log(`🎯 Generating words for level: ${userEnglishLevel}`);
        let prompt = '';
        if (topicName === "Diplomacy and International Relations") {
            prompt = `Generate 7 unique ENGLISH words related to diplomacy and international relations, appropriate for ${userEnglishLevel} level English learners.

IMPORTANT: All words must be in ENGLISH only. Do not generate Hebrew words.

Focus on:
- Diplomatic negotiations
- International conflict resolution  
- Geopolitical strategies
- Cross-cultural communication
- Israeli diplomatic context

For each ENGLISH word, provide:
1. The English word (not Hebrew!)
2. Hebrew translation of that English word
3. Example sentence in English using the word

Response format (JSON array):
[{
  "word": "English word here",
  "translation": "Hebrew translation here", 
  "example": "English example sentence here"
}, ...]

Example of correct format:
{
  "word": "diplomacy",
  "translation": "דיפלומטיה",
  "example": "Modern diplomacy requires understanding cultural nuances."
}

Generate 7 words at ${userEnglishLevel} difficulty level.`;
        }
        else if (topicName === "Economy and Entrepreneurship") {
            prompt = `Generate 7 unique ENGLISH words related to economy and entrepreneurship, appropriate for ${userEnglishLevel} level English learners.

IMPORTANT: All words must be in ENGLISH only. Do not generate Hebrew words.

Focus on:
- Startup ecosystem
- Economic innovation
- Financial technologies
- Entrepreneurial strategies
- Global economic influence

For each ENGLISH word, provide:
1. The English word (not Hebrew!)
2. Hebrew translation of that English word
3. Example sentence in English using the word

Response format (JSON array):
[{
  "word": "English word here",
  "translation": "Hebrew translation here",
  "example": "English example sentence here"
}, ...]

Example of correct format:
{
  "word": "entrepreneur", 
  "translation": "יזם",
  "example": "The entrepreneur launched three successful startups."
}

Generate 7 words at ${userEnglishLevel} difficulty level.`;
        }
        else if (topicName === "Environment and Sustainability") {
            prompt = `Generate 7 unique ENGLISH words related to environment and sustainability, appropriate for ${userEnglishLevel} level English learners.

IMPORTANT: All words must be in ENGLISH only. Do not generate Hebrew words.

Focus on:
- Environmental conservation
- Climate change
- Sustainable development
- Environmental policies
- Global environmental issues

For each ENGLISH word, provide:
1. The English word (not Hebrew!)
2. Hebrew translation of that English word
3. Example sentence in English using the word

Response format (JSON array):
[{
  "word": "English word here",
  "translation": "Hebrew translation here",
  "example": "English example sentence here"
}, ...]

Example of correct format:
{
  "word": "sustainability",
  "translation": "קיימות",
  "example": "Sustainability is crucial for future generations."
}

Generate 7 words at ${userEnglishLevel} difficulty level.`;
        }
        else if (topicName === "Innovation and Technology") {
            prompt = `Generate 7 unique ENGLISH words related to innovation and technology, appropriate for ${userEnglishLevel} level English learners.

IMPORTANT: All words must be in ENGLISH only. Do not generate Hebrew words.

Focus on:
- Technological breakthroughs
- AI and machine learning
- Cybersecurity innovations
- Green tech and sustainability
- Startup ecosystem

For each ENGLISH word, provide:
1. The English word (not Hebrew!)
2. Hebrew translation of that English word
3. Example sentence in English using the word

Response format (JSON array):
[{
  "word": "English word here",
  "translation": "Hebrew translation here",
  "example": "English example sentence here"
}, ...]

Example of correct format:
{
  "word": "innovation",
  "translation": "חדשנות",
  "example": "Innovation drives technological progress."
}

Generate 7 words at ${userEnglishLevel} difficulty level.`;
        }
        else if (topicName === "History and Heritage") {
            prompt = `Generate 7 unique ENGLISH words related to history and heritage, appropriate for ${userEnglishLevel} level English learners.

IMPORTANT: All words must be in ENGLISH only. Do not generate Hebrew words.

Focus on:
- Historical milestones
- Cultural heritage
- Historical movements
- Historical resilience
- Heritage preservation

For each ENGLISH word, provide:
1. The English word (not Hebrew!)
2. Hebrew translation of that English word
3. Example sentence in English using the word

Response format (JSON array):
[{
  "word": "English word here",
  "translation": "Hebrew translation here",
  "example": "English example sentence here"
}, ...]

Example of correct format:
{
  "word": "heritage",
  "translation": "מורשת",
  "example": "Cultural heritage must be preserved for future generations."
}

Generate 7 words at ${userEnglishLevel} difficulty level.`;
        }
        else if (topicName === "Holocaust and Revival") {
            prompt = `Generate 7 unique ENGLISH words related to Holocaust remembrance and revival, appropriate for ${userEnglishLevel} level English learners.

IMPORTANT: All words must be in ENGLISH only. Do not generate Hebrew words.

Focus on:
- Holocaust remembrance
- Resilience and recovery
- Historical documentation
- Cultural preservation
- Hope and renewal

For each ENGLISH word, provide:
1. The English word (not Hebrew!)
2. Hebrew translation of that English word
3. Example sentence in English using the word

Response format (JSON array):
[{
  "word": "English word here",
  "translation": "Hebrew translation here",
  "example": "English example sentence here"
}, ...]

Example of correct format:
{
  "word": "resilience",
  "translation": "חוסן",
  "example": "The community showed remarkable resilience during difficult times."
}

Generate 7 words at ${userEnglishLevel} difficulty level.`;
        }
        else if (topicName === "Iron Swords War") {
            prompt = `Generate 7 unique ENGLISH words related to recent conflicts and international relations, appropriate for ${userEnglishLevel} level English learners.

IMPORTANT: All words must be in ENGLISH only. Do not generate Hebrew words.

Focus on:
- Military operations
- International response
- Humanitarian concerns
- Geopolitical implications
- Conflict resolution

For each ENGLISH word, provide:
1. The English word (not Hebrew!)
2. Hebrew translation of that English word
3. Example sentence in English using the word

Response format (JSON array):
[{
  "word": "English word here",
  "translation": "Hebrew translation here",
  "example": "English example sentence here"
}, ...]

Example of correct format:
{
  "word": "conflict",
  "translation": "עימות",
  "example": "International mediation can help resolve conflicts."
}

Generate 7 words at ${userEnglishLevel} difficulty level.`;
        }
        else if (topicName === "Society and Multiculturalism") {
            prompt = `Generate 7 unique ENGLISH words related to social dynamics and multicultural interactions, appropriate for ${userEnglishLevel} level English learners.

IMPORTANT: All words must be in ENGLISH only. Do not generate Hebrew words.

Focus on:
- Social interaction
- Multicultural communication
- Community dynamics
- Cultural diversity
- Social integration

For each ENGLISH word, provide:
1. The English word (not Hebrew!)
2. Hebrew translation of that English word
3. Example sentence in English using the word

Response format (JSON array):
[{
  "word": "English word here",
  "translation": "Hebrew translation here",
  "example": "English example sentence here"
}, ...]

Example of correct format:
{
  "word": "diversity",
  "translation": "גיווון",
  "example": "Cultural diversity enriches our society."
}

Generate 7 words at ${userEnglishLevel} difficulty level.`;
        }
        else {
            // פרומפט כללי לנושאים אחרים
            prompt = `Generate 7 unique ENGLISH words related to ${topicName}, appropriate for ${userEnglishLevel} level English learners.

IMPORTANT: All words must be in ENGLISH only. Do not generate Hebrew words.

For each ENGLISH word, provide:
1. The English word (not Hebrew!)
2. Hebrew translation of that English word
3. Example sentence in English using the word

Response format (JSON array):
[{
  "word": "English word here",
  "translation": "Hebrew translation here",
  "example": "English example sentence here"
}, ...]

Example of correct format:
{
  "word": "example",
  "translation": "דוגמה",
  "example": "This is an example sentence in English."
}

Generate 7 words at ${userEnglishLevel} difficulty level related to ${topicName}.`;
        }
        // שליחת בקשה ל-OpenAI עם הדגשה נוספת
        const completion = await openai.chat.completions.create({
            model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4o",
            messages: [
                {
                    role: "system",
                    content: "You are an English vocabulary assistant. You MUST generate only ENGLISH words, never Hebrew words. Always respond with English words and their Hebrew translations, not the other way around."
                },
                { role: "user", content: prompt }
            ],
            temperature: 0.7,
            max_tokens: 1200
        });
        // עיבוד התשובה עם בדיקת תקינות
        const responseText = completion.choices[0].message.content?.trim() || '';
        console.log('🤖 AI Response preview:', responseText.substring(0, 200) + '...');
        let wordsData;
        try {
            const jsonMatch = responseText.match(/\[[\s\S]*\]/);
            const jsonString = jsonMatch ? jsonMatch[0] : responseText;
            try {
                wordsData = JSON.parse(jsonString);
                // 🔥 בדיקת תקינות: וודא שכל המילים באנגלית
                const validWords = wordsData.filter((item) => {
                    const word = item.word || '';
                    // בדיקה שהמילה באנגלית (רק אותיות לטיניות)
                    const isEnglish = /^[a-zA-Z\s\-']+$/.test(word);
                    // בדיקה שהמילה לא מכילה אותיות עבריות
                    const hasHebrew = /[\u0590-\u05FF]/.test(word);
                    if (!isEnglish || hasHebrew) {
                        console.log(`❌ Rejecting non-English word: "${word}"`);
                        return false;
                    }
                    return true;
                });
                if (validWords.length < wordsData.length) {
                    console.log(`⚠️ Filtered out ${wordsData.length - validWords.length} non-English words`);
                }
                wordsData = validWords;
            }
            catch (jsonError) {
                console.error('Error parsing OpenAI response as JSON:', jsonError);
                // Fallback parsing logic כמו קודם...
                wordsData = [];
            }
        }
        catch (error) {
            console.error('Error processing OpenAI response:', error);
            console.log('Raw response:', responseText);
            return [];
        }
        if (!Array.isArray(wordsData) || wordsData.length === 0) {
            console.error('❌ No valid English words generated');
            return [];
        }
        // שמירת המילים במסד הנתונים
        const pool = await (0, db_1.getDbPool)();
        const savedWords = [];
        for (const item of wordsData) {
            const wordId = (0, uuid_1.v4)();
            const { word, translation, example = "" } = item;
            // בדיקה נוספת שהמילה באנגלית
            if (!/^[a-zA-Z\s\-']+$/.test(word) || /[\u0590-\u05FF]/.test(word)) {
                console.log(`⏭️ Skipping non-English word: "${word}"`);
                continue;
            }
            // בדיקה אם המילה כבר קיימת
            const [existingWords] = await pool.execute('SELECT * FROM Words WHERE Word = ? AND TopicName = ?', [word, topicName]);
            if (Array.isArray(existingWords) && existingWords.length > 0) {
                const existingWord = existingWords[0];
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
            // שמירת מילה חדשה עם EnglishLevel
            console.log(`💾 Saving ENGLISH word: "${word}" with level: ${userEnglishLevel}`);
            await pool.execute(`INSERT INTO Words 
         (WordId, Word, Translation, ExampleUsage, TopicName, EnglishLevel, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), NOW())`, [
                wordId,
                word,
                translation,
                example,
                topicName,
                userEnglishLevel
            ]);
            savedWords.push({
                WordId: wordId,
                Word: word,
                Translation: translation,
                ExampleUsage: example,
                TopicName: topicName,
                EnglishLevel: userEnglishLevel
            });
        }
        console.log(`✅ Generated and saved ${savedWords.length} ENGLISH words with EnglishLevel: ${userEnglishLevel}`);
        return savedWords;
    }
    catch (error) {
        console.error('Error generating flashcards with OpenAI:', error);
        return [];
    }
}
// 🔥 נתיב מתוקן לקבלת כרטיסיות פלאש לפי נושא ורמה - עם סינון מילים שנלמדו
router.get('/:topic/:level', authMiddleware_1.authMiddleware, async (req, res) => {
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
        const pool = await (0, db_1.getDbPool)();
        // בדיקה שהנושא קיים
        const [topics] = await pool.execute('SELECT * FROM Topics WHERE TopicName = ?', [topic]);
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
        // 🔥 שאילתה מתוקנת לקבלת מילים שלא נלמדו עדיין
        let query = `
      SELECT DISTINCT w.WordId, w.Word, w.Translation, w.ExampleUsage, w.TopicName, w.EnglishLevel
      FROM Words w
      WHERE w.TopicName = ? 
      AND w.EnglishLevel = ?
      AND w.WordId NOT IN (
        SELECT DISTINCT wit.WordId
        FROM wordintask wit
        JOIN Tasks t ON wit.TaskId = t.TaskId
        WHERE t.UserId = ?
      )
      ORDER BY RAND()
      LIMIT 20
    `;
        console.log(`🔍 [${requestId}] Executing query for unlearned words...`);
        console.log(`📋 [${requestId}] Query parameters:`, { topic, userEnglishLevel, userId });
        const [words] = await pool.execute(query, [topic, userEnglishLevel, String(userId)]);
        console.log(`📝 [${requestId}] Found ${Array.isArray(words) ? words.length : 0} unlearned words`);
        // 🔥 תמיד צור מילים חדשות אם יש פחות מ-10 מילים
        if (Array.isArray(words) && words.length < 10) {
            console.log(`🤖 [${requestId}] Need more words (${words.length}/10), generating with AI...`);
            try {
                const newWords = await generateFlashcardsWithOpenAI(topic, userId);
                console.log(`✅ [${requestId}] Generated ${newWords.length} new words with AI`);
                // סנן מילים חדשות שלא נלמדו עדיין
                const filteredNewWords = [];
                for (const newWord of newWords) {
                    const [learned] = await pool.execute(`SELECT 1 FROM wordintask wit
             JOIN Tasks t ON wit.TaskId = t.TaskId
             WHERE t.UserId = ? AND wit.WordId = ?`, [String(userId), newWord.WordId]);
                    if (!Array.isArray(learned) || learned.length === 0) {
                        filteredNewWords.push(newWord);
                    }
                    else {
                        console.log(`⏭️ [${requestId}] Skipping already learned word: ${newWord.Word}`);
                    }
                }
                console.log(`🔍 [${requestId}] Filtered to ${filteredNewWords.length} truly new words`);
                const allWords = [...words, ...filteredNewWords];
                console.log(`📤 [${requestId}] Returning ${allWords.length} total unlearned words`);
                return res.json({
                    success: true,
                    data: allWords,
                    requestId,
                    debug: {
                        existingWords: words.length,
                        newWordsGenerated: newWords.length,
                        newWordsFiltered: filteredNewWords.length,
                        totalReturned: allWords.length,
                        userLevel: userEnglishLevel,
                        topic: topic,
                        minWordsThreshold: 10
                    }
                });
            }
            catch (aiError) {
                console.error(`❌ [${requestId}] AI generation failed:`, aiError);
                // אם יצירת מילים חדשות נכשלה, החזר את המילים הקיימות
                console.log(`📤 [${requestId}] Returning ${words.length} existing words (AI failed)`);
                return res.json({
                    success: true,
                    data: words,
                    requestId,
                    warning: 'Could not generate additional words',
                    debug: {
                        existingWords: words.length,
                        aiGenerationFailed: true,
                        userLevel: userEnglishLevel,
                        topic: topic
                    }
                });
            }
        }
        console.log(`📤 [${requestId}] Returning ${words.length} existing unlearned words (enough words found)`);
        return res.json({
            success: true,
            data: words,
            requestId,
            debug: {
                existingWords: words.length,
                aiGenerationSkipped: 'Enough words found',
                userLevel: userEnglishLevel,
                topic: topic
            }
        });
    }
    catch (error) {
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
router.post('/', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const { Word, Translation, TopicName, Level = 1, ExampleUsage = "" } = req.body;
        if (!Word || !Translation || !TopicName) {
            return res.status(400).json({
                success: false,
                error: 'Word, translation, and topic are required'
            });
        }
        const pool = await (0, db_1.getDbPool)();
        // בדיקה שהנושא קיים
        const [topics] = await pool.execute('SELECT * FROM Topics WHERE TopicName = ?', [TopicName]);
        if (!Array.isArray(topics) || topics.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Topic not found'
            });
        }
        // יצירת מזהה ייחודי למילה
        const WordId = (0, uuid_1.v4)();
        // שמירת המילה החדשה
        await pool.execute(`INSERT INTO Words 
       (WordId, Word, Translation, ExampleUsage, TopicName, CreatedAt, UpdatedAt)
       VALUES (?, ?, ?, ?, ?, NOW(), NOW())`, [
            WordId,
            Word,
            Translation,
            ExampleUsage,
            TopicName
        ]);
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
    }
    catch (error) {
        console.error('Error creating flashcard:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to create flashcard'
        });
    }
});
// 🔥 נתיב מתוקן לקבלת כרטיסיות פלאש לפי נושא ורמה - עם סינון מילים שנלמדו
router.get('/:topic/:level', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const { topic, level } = req.params;
        const userId = req.user?.id;
        console.log('🚀 GET flashcards for:', { topic, level, userId });
        if (!userId) {
            return res.status(401).json({
                success: false,
                error: 'User not authenticated'
            });
        }
        const pool = await (0, db_1.getDbPool)();
        // בדיקה שהנושא קיים
        const [topics] = await pool.execute('SELECT * FROM Topics WHERE TopicName = ?', [topic]);
        if (!Array.isArray(topics) || topics.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Topic not found'
            });
        }
        // קבלת רמת האנגלית של המשתמש
        const userEnglishLevel = await getUserEnglishLevel(String(userId));
        console.log('📊 User English level:', userEnglishLevel);
        // 🔥 שאילתה מתוקנת לקבלת מילים שלא נלמדו עדיין
        let query = `
      SELECT DISTINCT w.WordId, w.Word, w.Translation, w.ExampleUsage, w.TopicName 
      FROM Words w
      WHERE w.TopicName = ? 
      AND w.EnglishLevel = ?
      AND w.WordId NOT IN (
        SELECT DISTINCT wit.WordId
        FROM wordintask wit
        JOIN Tasks t ON wit.TaskId = t.TaskId
        WHERE t.UserId = ?
      )
      ORDER BY RAND()
      LIMIT 20
    `;
        const [words] = await pool.execute(query, [topic, userEnglishLevel, String(userId)]);
        console.log('📝 Found existing words:', Array.isArray(words) ? words.length : 0);
        // אם אין מספיק מילים (פחות מ-5), צור מילים חדשות עם OpenAI
        if (Array.isArray(words) && words.length < 5) {
            console.log('🤖 Generating new words with AI...');
            const newWords = await generateFlashcardsWithOpenAI(topic, userId);
            // סנן מילים חדשות שלא נלמדו עדיין
            const filteredNewWords = [];
            for (const newWord of newWords) {
                const [learned] = await pool.execute(`SELECT 1 FROM wordintask wit
           JOIN Tasks t ON wit.TaskId = t.TaskId
           WHERE t.UserId = ? AND wit.WordId = ?`, [String(userId), newWord.WordId]);
                if (!Array.isArray(learned) || learned.length === 0) {
                    filteredNewWords.push(newWord);
                }
            }
            console.log('✅ Filtered new words:', filteredNewWords.length);
            return res.json({
                success: true,
                data: [...words, ...filteredNewWords]
            });
        }
        return res.json({
            success: true,
            data: words
        });
    }
    catch (error) {
        console.error('Error fetching flashcards:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch flashcards'
        });
    }
});
// נתיב לסימון מילה כנלמדה
router.post('/mark-learned', authMiddleware_1.authMiddleware, async (req, res) => {
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
        const pool = await (0, db_1.getDbPool)();
        // בדיקה שהמילה קיימת
        const [words] = await pool.execute('SELECT * FROM Words WHERE WordId = ?', [WordId]);
        if (!Array.isArray(words) || words.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Word not found'
            });
        }
        // בדיקה שהמשימה קיימת ושייכת למשתמש
        const [tasks] = await pool.execute('SELECT * FROM Tasks WHERE TaskId = ? AND UserId = ?', [TaskId, String(userId)]);
        if (!Array.isArray(tasks) || tasks.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Task not found or not authorized'
            });
        }
        // בדיקה אם המילה כבר נמצאת במשימה
        const [wordintask] = await pool.execute('SELECT * FROM wordintask WHERE TaskId = ? AND WordId = ?', [TaskId, WordId]);
        // אם המילה כבר במשימה, החזר הצלחה
        if (Array.isArray(wordintask) && wordintask.length > 0) {
            return res.json({
                success: true,
                message: 'Word already marked as learned'
            });
        }
        // הוספת המילה למשימה
        await pool.execute('INSERT INTO wordintask (TaskId, WordId) VALUES (?, ?)', [TaskId, WordId]);
        return res.json({
            success: true,
            message: 'Word marked as learned'
        });
    }
    catch (error) {
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
router.post('/words', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const pool = await (0, db_1.getDbPool)();
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
            // Save each word to the Words table if it doesn't exist
            for (const word of words) {
                // Check if the word already exists
                const [existingWords] = await connection.execute('SELECT WordId FROM Words WHERE Word = ? AND TopicName = ?', [word.Word, word.TopicName]);
                let wordId;
                if (Array.isArray(existingWords) && existingWords.length > 0) {
                    // Word already exists, use its ID
                    wordId = existingWords[0].WordId;
                }
                else {
                    // Word doesn't exist, insert it
                    const newWordId = word.WordId || (0, uuid_1.v4)();
                    await connection.execute(`INSERT INTO Words 
             (WordId, Word, Translation, ExampleUsage, TopicName, CreatedAt, UpdatedAt)
             VALUES (?, ?, ?, ?, ?, NOW(), NOW())`, [
                        newWordId,
                        word.Word,
                        word.Translation,
                        word.ExampleUsage,
                        word.TopicName
                    ]);
                    wordId = newWordId;
                }
                savedWordIds.push(wordId);
                // Create word-task association
                // Skip if association already exists
                const [existingAssoc] = await connection.execute('SELECT TaskId FROM wordintask WHERE TaskId = ? AND WordId = ?', [taskId, wordId]);
                if (!(Array.isArray(existingAssoc) && existingAssoc.length > 0)) {
                    await connection.execute(`INSERT INTO wordintask 
             (TaskId, WordId, IsCompleted, Score, Attempts, CreatedAt, UpdatedAt)
             VALUES (?, ?, TRUE, 100, 1, NOW(), NOW())`, [taskId, wordId]);
                }
            }
            // Commit the transaction
            await connection.commit();
            // Return success response
            return res.status(200).json({
                message: 'Words saved and associated with task successfully',
                wordIds: savedWordIds
            });
        }
        catch (error) {
            // Rollback the transaction if an error occurs
            await connection.rollback();
            throw error;
        }
        finally {
            // Release the connection
            connection.release();
        }
    }
    catch (error) {
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
router.put('/tasks/:taskId/complete', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const pool = await (0, db_1.getDbPool)();
        const taskId = req.params.taskId;
        const { wordIds, CompletionDate, TaskScore } = req.body;
        // Get the task to ensure it exists and belongs to the user
        const [tasks] = await pool.execute('SELECT * FROM Tasks WHERE TaskId = ?', [taskId]);
        if (!Array.isArray(tasks) || tasks.length === 0) {
            return res.status(404).json({ message: 'Task not found' });
        }
        const task = tasks[0];
        // Start a transaction
        const connection = await pool.getConnection();
        await connection.beginTransaction();
        try {
            // Associate words with the task if provided
            if (wordIds && Array.isArray(wordIds)) {
                for (const wordId of wordIds) {
                    // Skip if association already exists
                    const [existingAssoc] = await connection.execute('SELECT TaskId FROM wordintask WHERE TaskId = ? AND WordId = ?', [taskId, wordId]);
                    if (!(Array.isArray(existingAssoc) && existingAssoc.length > 0)) {
                        await connection.execute(`INSERT INTO wordintask 
               (TaskId, WordId, IsCompleted, Score, Attempts, CreatedAt, UpdatedAt)
               VALUES (?, ?, TRUE, 100, 1, NOW(), NOW())`, [taskId, wordId]);
                    }
                }
            }
            // Mark the task as completed
            await connection.execute(`UPDATE Tasks 
         SET TaskScore = ?, CompletionDate = ?, UpdatedAt = NOW() 
         WHERE TaskId = ?`, [TaskScore || 100, CompletionDate || new Date(), taskId]);
            // Commit the transaction
            await connection.commit();
            // Return success response
            return res.status(200).json({
                message: 'Task completed successfully',
                taskId
            });
        }
        catch (error) {
            // Rollback the transaction if an error occurs
            await connection.rollback();
            throw error;
        }
        finally {
            // Release the connection
            connection.release();
        }
    }
    catch (error) {
        console.error('Error completing task:', error);
        return res.status(500).json({
            message: 'Failed to complete task',
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
