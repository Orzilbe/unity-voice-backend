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
  
  // 🔥 Base prompt עם הדגשה על השימוש במילים הנדרשות
  let prompt = `Create a social media style post about a specific significant event, achievement, or milestone related to ${formattedTopic} in Israel.

CRITICAL REQUIREMENTS:
- The post MUST stay strictly within the topic of "${formattedTopic}"
- You MUST use ALL of these required words naturally in the text: ${requiredWords.join(', ')}
- Do NOT use these words as hashtags - integrate them into the actual sentences
- Be written in a social media-friendly tone (like Facebook)
- Focus on ONE specific event, achievement, or milestone
- Include specific dates, names, and factual details
- Include no more than 3 relevant emojis
- ${difficultyAdjustment}
- End with 1-2 engaging questions to spark conversation
- Be factually accurate and educational
- Avoid controversial political statements
- Keep it pro-Israeli and informative

REQUIRED WORDS TO USE: ${requiredWords.join(', ')}`;
  
  // 🔥 Topic-specific guidance מתוקן להיות יותר ממוקד
  const lowerTopic = topicName.toLowerCase();
  
  if (lowerTopic.includes('diplomacy') || lowerTopic.includes('international')) {
    prompt += `\n\nTOPIC FOCUS: Israeli diplomatic achievements, peace agreements, international relations, ambassadors, treaties, or diplomatic milestones. 
    EXAMPLES: Camp David Accords, Abraham Accords, UN speeches, diplomatic recognition, peace treaties.
    AVOID: Environmental projects, technology startups, military operations.`;
    
  } else if (lowerTopic.includes('economy') || lowerTopic.includes('entrepreneurship')) {
    prompt += `\n\nTOPIC FOCUS: Israel's startup ecosystem, economic innovations, entrepreneurial success stories, business achievements, IPOs, or economic milestones.
    EXAMPLES: Startup exits, unicorn companies, business innovations, economic policies, trade agreements.
    AVOID: Environmental projects, military technology, diplomatic events.`;
    
  } else if (lowerTopic.includes('environment') || lowerTopic.includes('sustainability')) {
    prompt += `\n\nTOPIC FOCUS: Israeli environmental initiatives, green technology, renewable energy, sustainability efforts, climate action, or ecological achievements.
    EXAMPLES: Solar farms, water desalination, green building, environmental policies, conservation efforts.
    AVOID: General technology, diplomatic events, military innovations.`;
    
  } else if (lowerTopic.includes('innovation') || lowerTopic.includes('technology')) {
    prompt += `\n\nTOPIC FOCUS: Israeli technological breakthroughs, scientific achievements, innovative solutions, tech companies, research discoveries, or technological milestones.
    EXAMPLES: Medical devices, AI breakthroughs, cybersecurity innovations, scientific research, tech IPOs, patent inventions.
    AVOID: Environmental sustainability projects, diplomatic achievements, general business news.`;
    
  } else if (lowerTopic.includes('history') || lowerTopic.includes('heritage')) {
    prompt += `\n\nTOPIC FOCUS: Significant historical events, cultural heritage, archaeological discoveries, historical figures, or heritage preservation in Israel.
    EXAMPLES: Archaeological finds, historical site discoveries, museum openings, cultural preservation, historical anniversaries.
    AVOID: Modern technology, current diplomatic events, environmental projects.`;
    
  } else if (lowerTopic.includes('holocaust') || lowerTopic.includes('revival')) {
    prompt += `\n\nTOPIC FOCUS: Holocaust remembrance, survival stories, memorial events, educational initiatives, or the journey toward establishing Israel.
    EXAMPLES: Yad Vashem events, survivor testimonies, memorial ceremonies, educational programs, remembrance initiatives.
    AVOID: Modern technology, environmental projects, current diplomatic events.`;
    
  } else if (lowerTopic.includes('iron') || lowerTopic.includes('sword')) {
    prompt += `\n\nTOPIC FOCUS: Israel's security challenges, defense innovations, resilience in times of conflict, military technology, or security achievements.
    EXAMPLES: Defense systems, security innovations, resilience stories, defense cooperation, security milestones.
    AVOID: Environmental projects, general technology, diplomatic negotiations.`;
    
  } else if (lowerTopic.includes('society') || lowerTopic.includes('multiculturalism')) {
    prompt += `\n\nTOPIC FOCUS: Israel's diverse society, multiculturalism, social integration, community initiatives, or unique social phenomena.
    EXAMPLES: Cultural festivals, integration programs, community projects, social initiatives, multicultural events.
    AVOID: Technology breakthroughs, environmental projects, military topics.`;
  }
  
  // 🔥 הדגשה נוספת
  prompt += `\n\nREMINDER: 
1. Stay strictly within the "${formattedTopic}" topic
2. Use ALL required words: ${requiredWords.join(', ')}
3. Focus on Israeli context only
4. Include specific factual details`;
  
  console.log(`🎯 Creating focused prompt for topic: "${topicName}"`);
  console.log(`📝 Required words to include: ${requiredWords.join(', ')}`);
  
  return prompt;
}

// 🔥 פונקציה נוספת לוודא שהתוכן רלוונטי לנושא
function validatePostContent(postContent: string, topicName: string, requiredWords: string[]): {
  isValid: boolean;
  issues: string[];
  suggestions: string[];
} {
  const issues: string[] = [];
  const suggestions: string[] = [];
  const lowerContent = postContent.toLowerCase();
  const lowerTopic = topicName.toLowerCase();
  
  // בדיקה שכל המילים הנדרשות מופיעות
  const missingWords = requiredWords.filter(word => 
    !lowerContent.includes(word.toLowerCase())
  );
  
  if (missingWords.length > 0) {
    issues.push(`Missing required words: ${missingWords.join(', ')}`);
    suggestions.push('Regenerate the post to include all required vocabulary words');
  }
  
  // בדיקות ספציפיות לנושא
  if (lowerTopic.includes('innovation') || lowerTopic.includes('technology')) {
    const hasEnvironmentWords = ['wind', 'solar', 'environmental', 'sustainability', 'green', 'eco'].some(word => 
      lowerContent.includes(word)
    );
    if (hasEnvironmentWords) {
      issues.push('Post contains environmental content instead of technology/innovation focus');
      suggestions.push('Focus on technological breakthroughs, AI, cybersecurity, or tech companies instead');
    }
    
    const hasTechWords = ['technology', 'innovation', 'startup', 'ai', 'cyber', 'research', 'development'].some(word => 
      lowerContent.includes(word)
    );
    if (!hasTechWords) {
      issues.push('Post lacks technology/innovation terminology');
      suggestions.push('Include words like: technology, innovation, startup, research, development');
    }
  }
  
  if (lowerTopic.includes('environment') || lowerTopic.includes('sustainability')) {
    const hasTechWords = ['startup', 'innovation', 'ai', 'cyber'].some(word => 
      lowerContent.includes(word) && !lowerContent.includes('green ' + word)
    );
    if (hasTechWords) {
      issues.push('Post contains technology content instead of environmental focus');
      suggestions.push('Focus on environmental initiatives, sustainability, renewable energy instead');
    }
  }
  
  if (lowerTopic.includes('diplomacy')) {
    const hasNonDiplomaticWords = ['startup', 'technology', 'environment'].some(word => 
      lowerContent.includes(word)
    );
    if (hasNonDiplomaticWords) {
      issues.push('Post contains non-diplomatic content');
      suggestions.push('Focus on diplomatic achievements, peace agreements, international relations');
    }
  }
  
  return {
    isValid: issues.length === 0,
    issues,
    suggestions
  };
}

// 🔥 עדכון הפונקציה generatePostWithAI לכלול validation
async function generatePostWithAIImproved(topicName: string, englishLevel: string, requiredWords: string[]): Promise<{text: string}> {
  let attempts = 0;
  const maxAttempts = 3;
  
  while (attempts < maxAttempts) {
    try {
      attempts++;
      console.log(`🔄 Attempt ${attempts}/${maxAttempts} to generate focused post`);
      
      const prompt = createTopicPrompt(topicName, englishLevel, requiredWords);
      
      const completion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo",
        messages: [
          {
            role: "system",
            content: `You are an educational assistant specializing in creating focused social media content about Israel. 
                     You MUST stay strictly within the specified topic and use ALL required vocabulary words.
                     Topic: ${topicName}
                     Required words: ${requiredWords.join(', ')}`
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
      
      // Validate the generated content
      const validation = validatePostContent(generatedText, topicName, requiredWords);
      
      if (validation.isValid) {
        console.log(`✅ Successfully generated valid post on attempt ${attempts}`);
        return { text: generatedText };
      } else {
        console.log(`❌ Attempt ${attempts} failed validation:`, validation.issues);
        if (attempts === maxAttempts) {
          console.log('⚠️ Max attempts reached, using last generated content with warning');
          return { 
            text: generatedText + '\n\n[Note: This content may not perfectly match the topic requirements]' 
          };
        }
      }
      
    } catch (error) {
      console.error(`💥 Attempt ${attempts} failed:`, error);
      if (attempts === maxAttempts) {
        throw error;
      }
    }
  }
  
  throw new Error('Failed to generate valid content after all attempts');
}

function generateRequiredWords(topicName: string, learnedWords: string[]): string[] {
  console.log(`🎯 Generating required words for topic: ${topicName}`);
  console.log(`📖 Available learned words from flashcard:`, learnedWords);
  
  if (learnedWords && learnedWords.length > 0) {
    // User has completed flashcard task - use their learned words
    const count = Math.min(learnedWords.length, 5);
    const selectedWords = learnedWords.slice(0, count);
    
    console.log(`✅ Using ${selectedWords.length} words from flashcard task:`, selectedWords);
    return selectedWords;
  }
  
  // Fallback: User hasn't completed flashcard task yet - use topic-specific words
  console.log(`⚠️ No flashcard task completed, using topic-specific words`);
  const topicWords = getTopicSpecificWords(topicName);
  const fallbackWords = topicWords.slice(0, 5);
  
  console.log(`📝 Using topic-specific words:`, fallbackWords);
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
    
    console.log(`🔍 [DEBUG] Getting learned words from flashcard tasks:`);
    console.log(`   UserId: "${userId}"`);
    console.log(`   TopicName: "${topicName}"`);
    
    // Step 1: Find the user's completed flashcard task for this topic
    const [flashcardTaskResult] = await pool.execute(`
      SELECT TaskId, Level, CompletionDate
      FROM Tasks 
      WHERE UserId = ? 
        AND TopicName = ? 
        AND TaskType = 'flashcard' 
        AND CompletionDate IS NOT NULL
      ORDER BY CompletionDate DESC
      LIMIT 1
    `, [userId, topicName]);
    
    if (!Array.isArray(flashcardTaskResult) || flashcardTaskResult.length === 0) {
      console.log(`❌ [DEBUG] No completed flashcard task found for user ${userId} in topic ${topicName}`);
      return [];
    }
    
    const flashcardTask = (flashcardTaskResult as any[])[0];
    console.log(`✅ [DEBUG] Found flashcard task: ${flashcardTask.TaskId}, Level: ${flashcardTask.Level}`);
    
    // Step 2: Get words from wordintask table for this task - FIXED QUERY
    const [wordsResult] = await pool.execute(`
      SELECT w.Word, w.Translation, w.EnglishLevel, wit.AddedAt
      FROM wordintask wit
      JOIN Words w ON wit.WordId = w.WordId
      WHERE wit.TaskId = ?
      ORDER BY wit.AddedAt DESC
      LIMIT 10
    `, [flashcardTask.TaskId]);
    
    const learnedWords = (wordsResult as any[]).map(row => row.Word);
    console.log(`📚 [DEBUG] Found ${learnedWords.length} words from flashcard task:`, learnedWords);
    
    return learnedWords;
    
  } catch (error) {
    console.error('❌ [ERROR] Error fetching learned words from flashcard task:', error);
    return [];
  }
}
export default router;