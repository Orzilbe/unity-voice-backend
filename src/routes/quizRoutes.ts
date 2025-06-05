// unity-voice-backend/src/routes/quizRoutes.ts
import express, { Response } from 'express';
import { IUserRequest } from '../types/auth';
import { authMiddleware } from '../middleware/authMiddleware';
import DatabaseConnection from '../config/database';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

interface CompleteQuizRequest {
  taskId: string;
  topicName: string;
  level: string;
  finalScore: number;
  duration: number;
  correctAnswers: number;
  totalQuestions: number;
}

/**
 * Complete quiz and prepare next task - POST /api/quiz/complete
 */
router.post('/complete', authMiddleware, async (req: IUserRequest, res: Response) => {
  console.group('POST /api/quiz/complete (Backend)');
  console.log('Request received at:', new Date().toISOString());
  
  try {
    const userId = req.user?.id;
    
    if (!userId) {
      console.error('User ID not found in token');
      console.groupEnd();
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { taskId, topicName, level, finalScore, duration, correctAnswers, totalQuestions }: CompleteQuizRequest = req.body;
    
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
    const pool = DatabaseConnection.getPool();

    try {
      // Start transaction - use query() for SQL commands
      await pool.query('START TRANSACTION');

      // 1. Update quiz task completion
      console.log('Updating quiz task completion...');
      const [updateResult] = await pool.execute(
        `UPDATE Tasks SET 
         TaskScore = ?, 
         DurationTask = ?, 
         CompletionDate = NOW()
         WHERE TaskId = ? AND UserId = ?`,
        [finalScore, duration, taskId, userId]
      );

      if ((updateResult as any).affectedRows === 0) {
        await pool.query('ROLLBACK');
        console.error('Task not found or unauthorized');
        console.groupEnd();
        return res.status(404).json({ error: 'Task not found or unauthorized' });
      }

      // 2. Update user score
      console.log('Updating user total score...');
      await pool.execute(
        'UPDATE Users SET Score = Score + ? WHERE UserId = ?',
        [finalScore, userId]
      );

      // 3. Get user's English level for post selection
      const [userResult] = await pool.execute(
        'SELECT EnglishLevel FROM Users WHERE UserId = ?',
        [userId]
      );
      const englishLevel = (userResult as any[])[0]?.EnglishLevel || 'intermediate';

      // 4. Get learned words for this topic - אופציה חלופית יותר יעילה
      const [learnedWordsResult] = await pool.execute(`
        SELECT w.Word, w.Translation 
        FROM userknownwords ukw
        JOIN Words w ON ukw.WordId = w.WordId
        WHERE ukw.UserId = ? AND w.TopicName = ?
        ORDER BY ukw.AddedAt DESC
        LIMIT 10
      `, [userId, dbTopicName]);
      
      const learnedWords = (learnedWordsResult as any[]).map(row => row.Word);

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
      const existingPosts = existingPostsResult as any[];

      if (existingPosts.length > 0) {
        // Score posts based on learned words usage
        const scoredPosts = existingPosts.map(post => {
          const postWords = post.PostContent.toLowerCase().split(/\s+/);
          const matchingWords = learnedWords.filter(word => 
            postWords.some((postWord: string) => postWord.includes(word.toLowerCase()))
          );
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
      const newTaskId = uuidv4();
      
      await pool.execute(
        `INSERT INTO Tasks (TaskId, UserId, TopicName, Level, TaskType, StartDate)
         VALUES (?, ?, ?, ?, 'post', NOW())`,
        [newTaskId, userId, dbTopicName, level]
      );

      let postData = null;

      if (selectedPost) {
        // Use existing post - update the TaskId
        await pool.execute(
          'UPDATE Posts SET TaskId = ? WHERE PostID = ?',
          [newTaskId, selectedPost.PostID]
        );
        
        postData = {
          PostID: selectedPost.PostID,
          PostContent: selectedPost.PostContent,
          Picture: selectedPost.Picture,
          RequiredWords: generateRequiredWords(dbTopicName, learnedWords)
        };
      } else {
        // Generate new post
        console.log('No suitable existing post found, will generate new one');
        const newPostId = `post_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
        
        // Create placeholder post record
        await pool.execute(
          `INSERT INTO Posts (PostID, TaskId, PostContent, Picture)
           VALUES (?, ?, ?, ?)`,
          [newPostId, newTaskId, 'Generated post content', selectTopicImage(dbTopicName)]
        );

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

    } catch (dbError) {
      // Rollback transaction - use query() for SQL commands
      await pool.query('ROLLBACK');
      console.error('Database error during quiz completion:', dbError);
      console.groupEnd();
      return res.status(500).json({
        error: 'Database error occurred',
        details: dbError instanceof Error ? dbError.message : 'Unknown database error'
      });
    }

  } catch (error) {
    console.error('Error completing quiz:', error);
    console.groupEnd();
    return res.status(500).json({
      error: 'An error occurred during quiz completion',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Helper functions
function convertTopicNameToDb(frontendTopicName: string): string {
  // Convert from URL format (history-and-heritage) to DB format (History And Heritage)
  const conversions: { [key: string]: string } = {
    'history-and-heritage': 'History And Heritage',
    'diplomacy-and-peace': 'Diplomacy And Peace',
    'economy-and-innovation': 'Economy And Innovation', 
    'technology-and-innovation': 'Technology And Innovation',
    'holocaust-remembrance': 'Holocaust Remembrance',
    'iron-swords-war': 'Iron Swords War',
    'society-and-culture': 'Society And Culture',
    'environment-and-sustainability': 'Environment And Sustainability' // ← הוספתי את זה!
  };
  
  return conversions[frontendTopicName] || frontendTopicName;
}

function generateRequiredWords(topicName: string, learnedWords: string[]): string[] {
  console.log(`🎯 Generating required words for topic: ${topicName}`);
  console.log(`📖 Available learned words:`, learnedWords);
  
  // If user has learned words, prioritize them
  if (learnedWords && learnedWords.length > 0) {
    // Use 3-5 random words from learned words
    const count = Math.min(Math.max(3, learnedWords.length), 5);
    const shuffled = [...learnedWords].sort(() => 0.5 - Math.random());
    const selectedWords = shuffled.slice(0, count);
    
    console.log(`✅ Selected ${selectedWords.length} learned words:`, selectedWords);
    return selectedWords;
  }
  
  // Fallback: if no learned words, use topic-specific words
  console.log(`⚠️ No learned words found, falling back to topic-specific words`);
  const topicWords = getTopicSpecificWords(topicName);
  const fallbackWords = topicWords.slice(0, 3);
  
  console.log(`📝 Using fallback words:`, fallbackWords);
  return fallbackWords;
}

function getTopicSpecificWords(topicName: string): string[] {
  const lowerTopic = topicName.toLowerCase();
  
  if (lowerTopic.includes('diplomacy')) {
    return ['diplomacy', 'peace', 'negotiation', 'agreement', 'international'];
  } else if (lowerTopic.includes('economy')) {
    return ['startup', 'innovation', 'entrepreneur', 'investment', 'technology'];
  } else if (lowerTopic.includes('innovation')) {
    return ['technology', 'startup', 'innovation', 'research', 'development'];
  } else if (lowerTopic.includes('history')) {
    return ['heritage', 'tradition', 'ancient', 'archaeological', 'civilization'];
  } else if (lowerTopic.includes('holocaust')) {
    return ['remembrance', 'survivor', 'memorial', 'testimony', 'resilience'];
  } else if (lowerTopic.includes('iron') || lowerTopic.includes('sword')) {
    return ['security', 'defense', 'protection', 'resilience', 'strength'];
  } else if (lowerTopic.includes('society')) {
    return ['diversity', 'culture', 'community', 'tradition', 'integration'];
  } else if (lowerTopic.includes('environment') || lowerTopic.includes('sustainability')) {
    return ['environment', 'sustainability', 'renewable', 'green', 'climate']; // ← הוספתי את זה!
  }
  
  return ['culture', 'heritage', 'history', 'innovation', 'community'];
}

function selectTopicImage(topicName: string): string {
  const lowerTopic = topicName.toLowerCase();
  
  if (lowerTopic.includes('diplomacy')) {
    return 'https://cdn.pixabay.com/photo/2017/08/05/12/08/network-2583270_1280.jpg';
  } else if (lowerTopic.includes('economy')) {
    return 'https://cdn.pixabay.com/photo/2017/09/07/08/54/money-2724241_1280.jpg';
  } else if (lowerTopic.includes('innovation')) {
    return 'https://cdn.pixabay.com/photo/2016/11/19/14/00/code-1839406_1280.jpg';
  } else if (lowerTopic.includes('history')) {
    return 'https://cdn.pixabay.com/photo/2018/07/20/14/02/israel-3550699_1280.jpg';
  } else if (lowerTopic.includes('holocaust')) {
    return 'https://cdn.pixabay.com/photo/2016/05/15/20/52/jerusalem-1394562_1280.jpg';
  } else if (lowerTopic.includes('iron') || lowerTopic.includes('sword')) {
    return 'https://cdn.pixabay.com/photo/2016/06/13/07/59/soldier-1453836_1280.jpg';
  } else if (lowerTopic.includes('society')) {
    return 'https://cdn.pixabay.com/photo/2020/01/10/11/36/jerusalem-4754666_1280.jpg';
  } else if (lowerTopic.includes('environment') || lowerTopic.includes('sustainability')) {
    return 'https://cdn.pixabay.com/photo/2013/07/18/20/26/sea-164989_1280.jpg'; // ← הוספתי את זה!
  }
  
  return 'https://cdn.pixabay.com/photo/2016/11/14/03/35/tel-aviv-1822624_1280.jpg';
}

export default router;