// החלף את כל הקובץ unity-voice-backend/src/routes/postRoutes.ts בזה:

import express, { Response } from 'express'; // ← תיקנתי את הרווח
import { AzureOpenAI } from 'openai';
import { authenticateToken } from '../middleware/authMiddleware';
import { IUserRequest } from '../types/auth';
import DatabaseConnection from '../config/database';

const router = express.Router();

// OpenAI client setup (safely in backend)
const openai = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME!,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION!,
});

interface PostGenerationRequest {
  topicName: string;
  englishLevel: string;
  learnedWords: string[];
  requiredWords: string[];
}

/**
 * Generate post content - POST /api/post/generate
 */
router.post('/generate', authenticateToken, async (req: IUserRequest, res: Response) => {
  try {
    const { topicName, englishLevel, learnedWords, requiredWords }: PostGenerationRequest = req.body;
    const userId = req.user?.userId;
    
    console.log('Generating post for:', { topicName, englishLevel, userId });
    
    if (!topicName || !englishLevel) {
      return res.status(400).json({ error: 'Missing required fields: topicName and englishLevel' });
    }

    let finalRequiredWords = requiredWords || [];
    if (!finalRequiredWords.length) {
      finalRequiredWords = generateRequiredWords(topicName, learnedWords || []);
    }

    const generatedPost = await generatePostWithAI(topicName, englishLevel, finalRequiredWords);
    
    res.json({
      success: true,
      text: generatedPost.text,
      requiredWords: finalRequiredWords,
      postContent: generatedPost.text
    });

  } catch (error) {
    console.error('Error generating post:', error);
    
    const fallbackPost = createFallbackPost(req.body.topicName || 'general');
    res.json({
      success: true,
      text: fallbackPost.text,
      requiredWords: fallbackPost.requiredWords,
      warning: 'Used fallback content due to generation error'
    });
  }
});

/**
 * Create post for topic - POST /api/post/create/:topicName
 */
router.post('/create/:topicName', authenticateToken, async (req: IUserRequest, res: Response) => {
  try {
    const { topicName } = req.params;
    const { level, englishLevel, learnedWords } = req.body;
    const userId = req.user?.userId;
    
    console.log('Creating post for topic:', topicName);
    
    let finalEnglishLevel = englishLevel;
    if (!finalEnglishLevel && userId) {
      finalEnglishLevel = await getUserEnglishLevel(userId);
    }
    finalEnglishLevel = finalEnglishLevel || 'intermediate';

    let finalLearnedWords = learnedWords || [];
    if (!finalLearnedWords.length && userId) {
      finalLearnedWords = await getUserLearnedWords(userId, topicName);
    }

    const requiredWords = generateRequiredWords(topicName, finalLearnedWords);
    const generatedPost = await generatePostWithAI(topicName, finalEnglishLevel, requiredWords);
    
    res.json({
      text: generatedPost.text,
      requiredWords: requiredWords
    });

  } catch (error) {
    console.error('Error creating post:', error);
    
    const fallbackPost = createFallbackPost(req.params.topicName || 'general');
    res.json(fallbackPost);
  }
});

/**
 * Get post task data - GET /:taskId (works for /api/post-task/:taskId)
 */
router.get('/:taskId', authenticateToken, async (req: IUserRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const userId = req.user?.id || req.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    console.log(`Getting post task data for taskId: ${taskId}, userId: ${userId}`);

    const pool = DatabaseConnection.getPool();

    const [taskResult] = await pool.execute(`
      SELECT 
        t.TaskId, t.TopicName, t.Level, t.TaskType,
        p.PostID, p.PostContent, p.Picture
      FROM Tasks t
      LEFT JOIN Posts p ON t.TaskId = p.TaskId
      WHERE t.TaskId = ? AND t.UserId = ? AND t.TaskType = 'post'
    `, [taskId, userId]);

    if (!Array.isArray(taskResult) || taskResult.length === 0) {
      return res.status(404).json({ 
        error: 'Post task not found',
        message: 'No post task found for the given ID'
      });
    }

    const task = (taskResult as any[])[0];

    if (task.PostID && task.PostContent) {
      console.log(`Found existing post: ${task.PostID}`);
      
      const requiredWords = generateRequiredWords(task.TopicName, []);
      
      return res.json({
        success: true,
        taskId: task.TaskId,
        postData: {
          PostID: task.PostID,
          PostContent: task.PostContent,
          Picture: task.Picture,
          RequiredWords: requiredWords
        },
        topicName: task.TopicName,
        level: task.Level
      });
    }

    console.log('No existing post found, needs generation');
    
    const englishLevel = await getUserEnglishLevel(userId.toString());
    const learnedWords = await getUserLearnedWords(userId.toString(), task.TopicName);
    const requiredWords = generateRequiredWords(task.TopicName, learnedWords);

    return res.json({
      success: true,
      taskId: task.TaskId,
      postData: {
        needsGeneration: true,
        RequiredWords: requiredWords,
        englishLevel: englishLevel,
        topicName: task.TopicName, // ← השתמש בשם מהדטאבייס!
        dbTopicName: task.TopicName // ← הוסף גם את זה לבדיקה
      },
      topicName: task.TopicName,
      level: task.Level
    });

  } catch (error) {
    console.error('Error getting post task:', error);
    return res.status(500).json({
      error: 'Failed to get post task',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// AI Generation function
async function generatePostWithAI(topicName: string, englishLevel: string, requiredWords: string[]): Promise<{text: string}> {
  try {
    const prompt = createTopicPrompt(topicName, englishLevel, requiredWords);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are an educational assistant specializing in creating engaging social media content about Israel, 
                   tailored for ${englishLevel} English level learners. Create content that is informative, engaging, 
                   and helps practice English vocabulary.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 500,
      temperature: 0.7,
    });

    const generatedText = completion.choices[0]?.message?.content?.trim() || '';
    
    if (!generatedText) {
      throw new Error('No content generated from AI');
    }
    
    console.log('Successfully generated post with Azure OpenAI');
    
    return { text: generatedText };
    
  } catch (error) {
    console.error('Azure OpenAI generation error:', error);
    throw error;
  }
}

function createTopicPrompt(topicName: string, englishLevel: string, requiredWords: string[]): string {
  // Use the DB topic name directly (it's already properly formatted)
  const formattedTopic = topicName;
  
  let difficultyAdjustment = '';
  
  switch (englishLevel.toLowerCase()) {
    case 'beginner':
      difficultyAdjustment = 'Use simple sentence structures and common vocabulary. Avoid complex grammar, use up to 80 words';
      break;
    case 'intermediate':
      difficultyAdjustment = 'Balance simple and complex sentences. Introduce some advanced vocabulary with context, use up to 120 words.';
      break;
    case 'advanced':
      difficultyAdjustment = 'Use sophisticated vocabulary and varied sentence structures. Include idiomatic expressions, use up to 150 words.';
      break;
    default:
      difficultyAdjustment = 'Balance simple and complex sentences. Use up to 120 words.';
  }
  
  let prompt = `Create a social media style post about a specific significant event, achievement, or milestone related to ${formattedTopic} in Israel.
               The post should:
               - Be written in a social media-friendly tone (like Facebook)
               - Focus on ONE specific event, achievement, or milestone
               - Include specific dates, names, and factual details
               - Include no more than 3 relevant emojis
               - ${difficultyAdjustment}
               - Naturally incorporate these words: ${requiredWords.join(', ')}
               - End with 1-2 engaging questions to spark conversation
               - Be factually accurate and educational
               - Avoid controversial political statements
               - Keep it pro-Israeli and informative`;
  
  // Use the exact topic name from DB for better matching
  const lowerTopic = topicName.toLowerCase();
  
  if (lowerTopic.includes('diplomacy') || lowerTopic.includes('international')) {
    prompt += `\n\nFocus on Israeli diplomatic achievements, peace agreements, or international relations.`;
  } else if (lowerTopic.includes('economy') || lowerTopic.includes('entrepreneurship')) {
    prompt += `\n\nFocus on Israel's startup ecosystem, economic innovations, or entrepreneurial success stories.`;
  } else if (lowerTopic.includes('environment') || lowerTopic.includes('sustainability')) {
    prompt += `\n\nFocus on Israeli environmental initiatives, green technology, renewable energy, or sustainability efforts.`;
  } else if (lowerTopic.includes('history') || lowerTopic.includes('heritage')) {
    prompt += `\n\nFocus on significant historical events, cultural heritage, or archaeological discoveries in Israel.`;
  } else if (lowerTopic.includes('holocaust') || lowerTopic.includes('revival')) {
    prompt += `\n\nFocus on Holocaust remembrance, survival stories, or the journey toward establishing Israel.`;
  } else if (lowerTopic.includes('innovation') || lowerTopic.includes('technology')) {
    prompt += `\n\nFocus on Israeli technological breakthroughs, scientific achievements, or innovative solutions.`;
  } else if (lowerTopic.includes('iron') || lowerTopic.includes('sword')) {
    prompt += `\n\nFocus on Israel's security challenges, defense innovations, or resilience in times of conflict.`;
  } else if (lowerTopic.includes('society') || lowerTopic.includes('multiculturalism')) {
    prompt += `\n\nFocus on Israel's diverse society, multiculturalism, or unique social phenomena.`;
  }
  
  console.log(`🎯 Creating prompt for topic: "${topicName}" with focus area detected`);
  return prompt;
}

function generateRequiredWords(topicName: string, learnedWords: string[]): string[] {
  console.log(`🎯 Generating required words for topic: ${topicName}`);
  console.log(`📖 Available learned words:`, learnedWords);
  
  // If user has learned words, use them as required words
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
  }
  
  return ['culture', 'heritage', 'history', 'innovation', 'community'];
}

function createFallbackPost(topicName: string): {text: string, requiredWords: string[]} {
  const formattedTopic = topicName
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  
  const requiredWords = generateRequiredWords(topicName, []);
  
  return {
    text: `Let's discuss ${formattedTopic}! This is an important topic that affects many aspects of Israeli society and culture. What are your thoughts on this subject? I'd love to hear different perspectives on this.`,
    requiredWords: requiredWords
  };
}

async function getUserEnglishLevel(userId: string): Promise<string> {
  try {
    const pool = DatabaseConnection.getPool();
    const [result] = await pool.execute(
      'SELECT EnglishLevel FROM Users WHERE UserId = ?',
      [userId]
    );
    return (result as any[])[0]?.EnglishLevel || 'intermediate';
  } catch (error) {
    console.error('Error fetching user English level:', error);
    return 'intermediate';
  }
}

async function getUserLearnedWords(userId: string, topicName: string): Promise<string[]> {
  try {
    const pool = DatabaseConnection.getPool();
    
    // Get words that the user has learned in this specific topic
    const [result] = await pool.execute(`
      SELECT DISTINCT w.Word 
      FROM userknownwords ukw
      JOIN Words w ON ukw.WordId = w.WordId
      WHERE ukw.UserId = ? AND w.TopicName = ?
      ORDER BY ukw.AddedAt DESC
      LIMIT 10
    `, [userId, topicName]);
    
    const learnedWords = (result as any[]).map(row => row.Word);
    console.log(`📚 Found ${learnedWords.length} learned words for user ${userId} in topic ${topicName}:`, learnedWords);
    
    return learnedWords;
  } catch (error) {
    console.error('Error fetching learned words:', error);
    return [];
  }
}

export default router;