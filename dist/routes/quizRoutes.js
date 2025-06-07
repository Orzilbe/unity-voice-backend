"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// unity-voice-backend/src/routes/quizRoutes.ts
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const database_1 = __importDefault(require("../config/database"));
const uuid_1 = require("uuid");
const router = express_1.default.Router();
/**
 * Complete quiz and prepare next task - POST /api/quiz/complete
 */
router.post('/complete', authMiddleware_1.authMiddleware, async (req, res) => {
    console.group('POST /api/quiz/complete (Backend)');
    console.log('Request received at:', new Date().toISOString());
    try {
        const userId = req.user?.id;
        if (!userId) {
            console.error('User ID not found in token');
            console.groupEnd();
            return res.status(401).json({ error: 'User not authenticated' });
        }
        const { taskId, topicName, level, finalScore, duration, correctAnswers, totalQuestions } = req.body;
        // Convert topic name from URL format to database format
        const dbTopicName = convertTopicNameToDb(topicName);
        console.log(`Converting topic name: ${topicName} -> ${dbTopicName}`);
        // Validate required fields
        if (!taskId || !dbTopicName || !level || finalScore === undefined) {
            console.error('Missing required fields');
            console.groupEnd();
            return res.status(400).json({ error: 'Missing required fields' });
        }
        // Check if passing score (60%)
        const passingPercentage = (correctAnswers / totalQuestions) * 100;
        const isPassing = passingPercentage >= 60;
        if (!isPassing) {
            console.log(`Quiz not passed: ${passingPercentage}% (need 60%)`);
            console.groupEnd();
            return res.status(400).json({
                success: false,
                error: 'Quiz not passed',
                percentage: passingPercentage,
                message: 'Need at least 60% to continue'
            });
        }
        // Get DB connection
        const pool = database_1.default.getPool();
        try {
            // Start transaction - use query() for SQL commands
            await pool.query('START TRANSACTION');
            // 1. Update quiz task completion
            console.log('Updating quiz task completion...');
            const [updateResult] = await pool.execute(`UPDATE Tasks SET 
         TaskScore = ?, 
         DurationTask = ?, 
         CompletionDate = NOW()
         WHERE TaskId = ? AND UserId = ?`, [finalScore, duration, taskId, userId]);
            if (updateResult.affectedRows === 0) {
                await pool.query('ROLLBACK');
                console.error('Task not found or unauthorized');
                console.groupEnd();
                return res.status(404).json({ error: 'Task not found or unauthorized' });
            }
            // 2. Update user score
            console.log('Updating user total score...');
            await pool.execute('UPDATE Users SET Score = Score + ? WHERE UserId = ?', [finalScore, userId]);
            // 3. Get user's English level for post selection
            const [userResult] = await pool.execute('SELECT EnglishLevel FROM Users WHERE UserId = ?', [userId]);
            const englishLevel = userResult[0]?.EnglishLevel || 'intermediate';
            console.log('Getting learned words from flashcard task...');
            const [flashcardTaskResult] = await pool.execute(`
        SELECT TaskId, Level, CompletionDate
        FROM Tasks 
        WHERE UserId = ? 
          AND TopicName = ? 
          AND TaskType = 'flashcard' 
          AND CompletionDate IS NOT NULL
        ORDER BY CompletionDate DESC
        LIMIT 1
      `, [userId, dbTopicName]);
            let learnedWords = [];
            if (Array.isArray(flashcardTaskResult) && flashcardTaskResult.length > 0) {
                const flashcardTask = flashcardTaskResult[0];
                console.log(`Found flashcard task: ${flashcardTask.TaskId}`);
                // Get words from wordintask table for this task
                const [wordsResult] = await pool.execute(`
          SELECT w.Word, w.Translation, wit.AddedAt
          FROM wordintask wit
          JOIN Words w ON wit.WordId = w.WordId
          WHERE wit.TaskId = ?
          ORDER BY wit.AddedAt DESC
          LIMIT 10
        `, [flashcardTask.TaskId]);
                learnedWords = wordsResult.map(row => row.Word);
                console.log(`📚 Found ${learnedWords.length} learned words:`, learnedWords);
            }
            else {
                console.log('❌ No completed flashcard task found for this topic');
            }
            // 5. Find suitable existing post that user hasn't seen
            console.log('Looking for suitable existing post...');
            const [existingPostsResult] = await pool.execute(`
        SELECT p.PostID, p.PostContent, p.Picture
        FROM Posts p
        WHERE p.PostID NOT IN (
          SELECT DISTINCT p2.PostID 
          FROM Posts p2
          JOIN Tasks t ON p2.TaskId = t.TaskId
          WHERE t.UserId = ? AND p2.PostID IS NOT NULL
        )
        ORDER BY RAND()
        LIMIT 5
      `, [userId]);
            let selectedPost = null;
            const existingPosts = existingPostsResult;
            if (existingPosts.length > 0) {
                // Score posts based on learned words usage
                const scoredPosts = existingPosts.map(post => {
                    const postWords = post.PostContent.toLowerCase().split(/\s+/);
                    const matchingWords = learnedWords.filter(word => postWords.some((postWord) => postWord.includes(word.toLowerCase())));
                    return {
                        ...post,
                        score: matchingWords.length
                    };
                });
                // Select best matching post
                selectedPost = scoredPosts.sort((a, b) => b.score - a.score)[0];
                console.log(`Selected existing post: ${selectedPost.PostID}`);
            }
            // 6. Create new post task
            console.log('Creating new post task...');
            const newTaskId = (0, uuid_1.v4)();
            await pool.execute(`INSERT INTO Tasks (TaskId, UserId, TopicName, Level, TaskType, StartDate)
         VALUES (?, ?, ?, ?, 'post', NOW())`, [newTaskId, userId, dbTopicName, level]);
            let postData = null;
            if (selectedPost) {
                // Use existing post - update the TaskId
                await pool.execute('UPDATE Posts SET TaskId = ? WHERE PostID = ?', [newTaskId, selectedPost.PostID]);
                postData = {
                    PostID: selectedPost.PostID,
                    PostContent: selectedPost.PostContent,
                    Picture: selectedPost.Picture,
                    RequiredWords: generateRequiredWords(dbTopicName, learnedWords)
                };
            }
            else {
                // Generate new post
                console.log('No suitable existing post found, will generate new one');
                const newPostId = `post_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
                // Create placeholder post record
                await pool.execute(`INSERT INTO Posts (PostID, TaskId, PostContent, Picture)
           VALUES (?, ?, ?, ?)`, [newPostId, newTaskId, 'Generated post content', selectTopicImage(dbTopicName)]);
                postData = {
                    PostID: newPostId,
                    needsGeneration: true,
                    RequiredWords: generateRequiredWords(dbTopicName, learnedWords)
                };
            }
            // Commit transaction - use query() for SQL commands
            await pool.query('COMMIT');
            console.log('Quiz completion successful');
            console.groupEnd();
            return res.json({
                success: true,
                newTaskId,
                postData,
                scoreAdded: finalScore,
                message: 'Quiz completed successfully'
            });
        }
        catch (dbError) {
            // Rollback transaction - use query() for SQL commands
            await pool.query('ROLLBACK');
            console.error('Database error during quiz completion:', dbError);
            console.groupEnd();
            return res.status(500).json({
                error: 'Database error occurred',
                details: dbError instanceof Error ? dbError.message : 'Unknown database error'
            });
        }
    }
    catch (error) {
        console.error('Error completing quiz:', error);
        console.groupEnd();
        return res.status(500).json({
            error: 'An error occurred during quiz completion',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// Helper functions
function convertTopicNameToDb(frontendTopicName) {
    // Convert from URL format to exact DB format as it appears in Levels table
    const conversions = {
        'history-and-heritage': 'History and Heritage',
        'diplomacy-and-peace': 'Diplomacy and International Relations',
        'diplomacy-and-international-relations': 'Diplomacy and International Relations',
        'economy-and-innovation': 'Economy and Entrepreneurship',
        'economy-and-entrepreneurship': 'Economy and Entrepreneurship',
        'technology-and-innovation': 'Innovation and Technology',
        'innovation-and-technology': 'Innovation and Technology',
        'holocaust-remembrance': 'Holocaust and Revival',
        'holocaust-and-revival': 'Holocaust and Revival',
        'iron-swords-war': 'Iron Swords War',
        'society-and-culture': 'Society and Multiculturalism',
        'society-and-multiculturalism': 'Society and Multiculturalism',
        'environment-and-sustainability': 'Environment and Sustainability'
    };
    return conversions[frontendTopicName] || frontendTopicName;
}
function generateRequiredWords(topicName, learnedWords) {
    const topicWords = getTopicSpecificWords(topicName);
    const combined = [...new Set([...learnedWords.slice(0, 3), ...topicWords])];
    return combined.slice(0, 5);
}
function getTopicSpecificWords(topicName) {
    const lowerTopic = topicName.toLowerCase();
    if (lowerTopic.includes('diplomacy')) {
        return ['diplomacy', 'peace', 'negotiation', 'agreement', 'international'];
    }
    else if (lowerTopic.includes('economy')) {
        return ['startup', 'innovation', 'entrepreneur', 'investment', 'technology'];
    }
    else if (lowerTopic.includes('innovation')) {
        return ['technology', 'startup', 'innovation', 'research', 'development'];
    }
    else if (lowerTopic.includes('history')) {
        return ['heritage', 'tradition', 'ancient', 'archaeological', 'civilization'];
    }
    else if (lowerTopic.includes('holocaust')) {
        return ['remembrance', 'survivor', 'memorial', 'testimony', 'resilience'];
    }
    else if (lowerTopic.includes('iron') || lowerTopic.includes('sword')) {
        return ['security', 'defense', 'protection', 'resilience', 'strength'];
    }
    else if (lowerTopic.includes('society')) {
        return ['diversity', 'culture', 'community', 'tradition', 'integration'];
    }
    else if (lowerTopic.includes('environment') || lowerTopic.includes('sustainability')) {
        return ['environment', 'sustainability', 'renewable', 'green', 'climate']; // ← הוספתי את זה!
    }
    return ['culture', 'heritage', 'history', 'innovation', 'community'];
}
function selectTopicImage(topicName) {
    const lowerTopic = topicName.toLowerCase();
    if (lowerTopic.includes('diplomacy')) {
        return 'https://cdn.pixabay.com/photo/2017/08/05/12/08/network-2583270_1280.jpg';
    }
    else if (lowerTopic.includes('economy')) {
        return 'https://cdn.pixabay.com/photo/2017/09/07/08/54/money-2724241_1280.jpg';
    }
    else if (lowerTopic.includes('innovation')) {
        return 'https://cdn.pixabay.com/photo/2016/11/19/14/00/code-1839406_1280.jpg';
    }
    else if (lowerTopic.includes('history')) {
        return 'https://cdn.pixabay.com/photo/2018/07/20/14/02/israel-3550699_1280.jpg';
    }
    else if (lowerTopic.includes('holocaust')) {
        return 'https://cdn.pixabay.com/photo/2016/05/15/20/52/jerusalem-1394562_1280.jpg';
    }
    else if (lowerTopic.includes('iron') || lowerTopic.includes('sword')) {
        return 'https://cdn.pixabay.com/photo/2016/06/13/07/59/soldier-1453836_1280.jpg';
    }
    else if (lowerTopic.includes('society')) {
        return 'https://cdn.pixabay.com/photo/2020/01/10/11/36/jerusalem-4754666_1280.jpg';
    }
    else if (lowerTopic.includes('environment') || lowerTopic.includes('sustainability')) {
        return 'https://cdn.pixabay.com/photo/2013/07/18/20/26/sea-164989_1280.jpg'; // ← הוספתי את זה!
    }
    return 'https://cdn.pixabay.com/photo/2016/11/14/03/35/tel-aviv-1822624_1280.jpg';
}
exports.default = router;
