// unity-voice-backend/src/routes/commentRoutes.ts
import express from 'express';
import { IUserRequest } from '../types/auth';
import { authenticateToken } from '../middleware/authMiddleware';
import { v4 as uuidv4 } from 'uuid';
import Comment from '../models/Comment';
import Task from '../models/Task';

const router = express.Router();

/**
 * 💬 Submit comment with advanced validation - POST /
 * Main endpoint for submitting comments to tasks
 */
router.post('/', authenticateToken, async (req: IUserRequest, res) => {
  try {
    console.log('📝 Creating comment with data:', req.body);
    const { 
      taskId,
      commentContent, 
      requiredWords = [],
      postContent = '',
      durationTask = 0
    } = req.body;
    
    const userId = req.user?.id || req.user?.userId;
    
    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'TaskId is required'
      });
    }
    
    if (!commentContent?.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Comment content is required'
      });
    }
    
    // Verify task exists and belongs to user
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }
    
    if (task.UserId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Task does not belong to current user'
      });
    }
    
    // 🔍 Advanced validation
    const validation = await validateComment(commentContent, postContent, taskId, requiredWords);
    
    if (!validation.isValid) {
      return res.status(400).json({
        success: false,
        error: 'Comment validation failed',
        issues: validation.issues,
        details: validation.details
      });
    }
    
    // Generate detailed feedback
    const feedback = generateDetailedFeedback(
      commentContent, 
      postContent,
      requiredWords, 
      task.TopicName
    );
    
    // Create comment
    const commentId = uuidv4();
    
    console.log('💬 Creating comment for TaskID:', taskId);
    
    await Comment.create({
      CommentID: commentId,
      TaskID: taskId,  // 🔥 Use TaskID (required)
      commentContent: commentContent.trim(),
      Feedback: JSON.stringify(feedback)
      // PostID is optional and will be handled automatically if needed
    });
    
    console.log('✅ Comment created successfully:', commentId);
    
    // Update task completion
    if (userId && durationTask !== undefined) {
      try {
        await Task.completeTask(taskId, feedback.totalScore, durationTask);
        console.log(`✅ Task ${taskId} completed with score: ${feedback.totalScore}`);
      } catch (taskError) {
        console.warn('⚠️ Failed to update task completion:', taskError);
      }
    }
    
    // Return response in expected format
    return res.status(201).json({
      success: true,
      message: 'Comment submitted successfully',
      commentId: commentId,
      feedback: {
        totalScore: feedback.totalScore,
        clarityScore: feedback.clarityScore,
        grammarScore: feedback.grammarScore,
        vocabularyScore: feedback.vocabularyScore,
        contentRelevanceScore: feedback.contentRelevanceScore,
        clarityFeedback: feedback.clarityFeedback,
        grammarFeedback: feedback.grammarFeedback,
        vocabularyFeedback: feedback.vocabularyFeedback,
        contentRelevanceFeedback: feedback.contentRelevanceFeedback,
        overallFeedback: feedback.overallFeedback,
        wordUsage: feedback.wordUsage
      },
      data: {
        commentId: commentId,
        commentContent: commentContent,
        feedback: feedback,
        taskUpdated: true
      }
    });
    
  } catch (error) {
    console.error('❌ Error creating comment:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * 📖 Get comments by task ID - GET /:taskId
 */
router.get('/:taskId', authenticateToken, async (req: IUserRequest, res) => {
  try {
    const { taskId } = req.params;
    const userId = req.user?.id || req.user?.userId;
    
    console.log(`📖 Getting comments for taskId: ${taskId}`);
    
    // Verify task exists and belongs to user
    const task = await Task.findById(taskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }
    
    if (task.UserId !== userId) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    
    // Get comments for this task
    const comments = await Comment.findByTaskId(taskId);
    
    console.log(`📖 Retrieved ${comments.length} comments for taskId: ${taskId}`);
    
    return res.json({
      success: true,
      taskId: taskId,
      comments: comments.map(comment => ({
        ...comment,
        Feedback: comment.Feedback ? JSON.parse(comment.Feedback) : null
      }))
    });
    
  } catch (error) {
    console.error('❌ Error fetching comments:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * 🧪 Test feedback generation - POST /test-feedback
 */
router.post('/test-feedback', authenticateToken, async (req: IUserRequest, res) => {
  try {
    const { commentContent, requiredWords, postContent, topicName } = req.body;
    
    console.log('🧪 Testing feedback generation');

    if (!commentContent?.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Comment content is required for testing' 
      });
    }

    // Validate comment
    const validation = await validateComment(
      commentContent, 
      postContent || '', 
      'test-task-id', 
      requiredWords || []
    );

    if (!validation.isValid) {
      return res.json({
        success: false,
        validation: validation,
        message: 'Comment failed validation'
      });
    }

    // Generate feedback
    const feedback = generateDetailedFeedback(
      commentContent, 
      postContent || '',
      requiredWords || [], 
      topicName || 'general'
    );

    return res.json({
      success: true,
      feedback: feedback,
      validation: validation,
      testMode: true,
      message: 'Feedback generated successfully (test mode)'
    });

  } catch (error) {
    console.error('🧪 Test feedback error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to generate test feedback',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// ================================================================
// Validation Functions
// ================================================================

/**
 * 🔍 Advanced comment validation
 */
async function validateComment(
  commentContent: string,
  postContent: string,
  taskId: string,
  requiredWords: string[]
): Promise<{
  isValid: boolean;
  issues: string[];
  details: any;
}> {
  const issues: string[] = [];
  const details: any = {};
  
  // Basic length check
  const words = commentContent.trim().split(/\s+/);
  if (words.length < 5) {
    issues.push('Comment must be at least 5 words long');
  }
  
  if (commentContent.length > 1000) {
    issues.push('Comment is too long (max 1000 characters)');
  }
  
  // Language validation
  const hebrewPattern = /[\u0590-\u05FF]/;
  if (hebrewPattern.test(commentContent)) {
    issues.push('Please write your comment in English only');
  }
  
  // Plagiarism check (advanced)
  const similarity = calculateSimilarity(commentContent.toLowerCase(), postContent.toLowerCase());
  details.similarity = similarity;
  
  if (similarity > 80) {
    issues.push('Comment appears to be copied from the post. Please write your own response');
  } else if (similarity > 60) {
    issues.push('Comment is too similar to the post content. Please write more original content');
  }
  
  // Content quality check
  const uniqueWords = new Set(words.map(w => w.toLowerCase()));
  const uniquenessRatio = uniqueWords.size / words.length;
  
  if (uniquenessRatio < 0.5) {
    issues.push('Comment contains too much repetition. Please use more varied vocabulary');
  }
  
  // Meaningful content check
  const alphaCount = (commentContent.match(/[a-zA-Z]/g) || []).length;
  const alphaRatio = alphaCount / commentContent.length;
  
  if (alphaRatio < 0.6) {
    issues.push('Comment should contain mostly letters and words');
  }
  
  // Single word/character spam check
  const mostCommonWord = findMostCommonWord(words);
  if (mostCommonWord.count > words.length * 0.3) {
    issues.push('Comment contains too much repetition of the same word');
  }
  
  details.wordCount = words.length;
  details.uniquenessRatio = uniquenessRatio;
  details.alphaRatio = alphaRatio;
  
  return {
    isValid: issues.length === 0,
    issues,
    details
  };
}

/**
 * 📊 Calculate text similarity percentage
 */
function calculateSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  
  const words1 = new Set(text1.split(/\s+/));
  const words2 = new Set(text2.split(/\s+/));
  
  const intersection = new Set([...words1].filter(x => words2.has(x)));
  const union = new Set([...words1, ...words2]);
  
  return Math.round((intersection.size / union.size) * 100);
}

/**
 * 🔤 Find most common word in array
 */
function findMostCommonWord(words: string[]): { word: string; count: number } {
  const frequency: Record<string, number> = {};
  
  for (const word of words) {
    const lowerWord = word.toLowerCase();
    frequency[lowerWord] = (frequency[lowerWord] || 0) + 1;
  }
  
  let maxCount = 0;
  let mostCommon = '';
  
  for (const [word, count] of Object.entries(frequency)) {
    if (count > maxCount) {
      maxCount = count;
      mostCommon = word;
    }
  }
  
  return { word: mostCommon, count: maxCount };
}

/**
 * 💬 Generate detailed feedback (improved version)
 */
function generateDetailedFeedback(
  commentContent: string,
  postContent: string,
  requiredWords: string[],
  topicName: string
): {
  totalScore: number;
  clarityScore: number;
  grammarScore: number;
  vocabularyScore: number;
  contentRelevanceScore: number;
  clarityFeedback: string;
  grammarFeedback: string;
  vocabularyFeedback: string;
  contentRelevanceFeedback: string;
  overallFeedback: string;
  wordUsage: { word: string; used: boolean; context: string }[];
} {
  
  const wordCount = commentContent.split(/\s+/).length;
  const sentences = commentContent.split(/[.!?]+/).filter(s => s.trim());
  
  // 1. Clarity Score (0-100)
  let clarityScore = 0;
  
  // Length assessment
  if (wordCount >= 40) clarityScore += 30;
  else if (wordCount >= 25) clarityScore += 25;
  else if (wordCount >= 15) clarityScore += 20;
  else if (wordCount >= 10) clarityScore += 15;
  
  // Sentence structure
  const avgSentenceLength = sentences.length > 0 ? wordCount / sentences.length : 0;
  if (avgSentenceLength >= 8 && avgSentenceLength <= 20) clarityScore += 30;
  else if (avgSentenceLength >= 5) clarityScore += 20;
  else if (avgSentenceLength >= 3) clarityScore += 10;
  
  // Multiple sentences bonus
  if (sentences.length >= 3) clarityScore += 25;
  else if (sentences.length >= 2) clarityScore += 15;
  
  // Connecting words bonus
  const connectingWords = ['however', 'therefore', 'because', 'although', 'moreover', 'furthermore'];
  const hasConnectors = connectingWords.some(word => 
    commentContent.toLowerCase().includes(word)
  );
  if (hasConnectors) clarityScore += 15;
  
  // 2. Grammar Score (0-100)
  let grammarScore = 30; // Base score
  
  // Capitalization
  const properlyCapitalized = sentences.filter(s => 
    s.trim().length > 0 && /^[A-Z]/.test(s.trim())
  ).length;
  
  if (sentences.length > 0) {
    grammarScore += Math.round((properlyCapitalized / sentences.length) * 30);
  }
  
  // Punctuation
  const hasPunctuation = /[.!?]$/.test(commentContent.trim());
  if (hasPunctuation) grammarScore += 25;
  
  // Basic grammar patterns (avoid common mistakes)
  if (!/\b(me are|me is|me have|i are)\b/i.test(commentContent)) grammarScore += 15;
  
  // 3. Vocabulary Score (0-100)
  let vocabularyScore = 0;
  const wordUsage = requiredWords.map(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    const used = regex.test(commentContent);
    
    let context = "";
    if (used) {
      const matches = commentContent.match(new RegExp(`.{0,30}\\b${word}\\b.{0,30}`, 'i'));
      context = matches ? `"...${matches[0].trim()}..."` : "Found in comment";
    }
    
    return { word, used, context };
  });
  
  // Calculate vocabulary score
  const usedWordsCount = wordUsage.filter(w => w.used).length;
  if (requiredWords.length > 0) {
    vocabularyScore = Math.round((usedWordsCount / requiredWords.length) * 70);
    
    // Bonus for using all words
    if (usedWordsCount === requiredWords.length) {
      vocabularyScore += 20;
    }
  } else {
    vocabularyScore = 70; // Base score when no required words
  }
  
  // Rich vocabulary bonus
  const uniqueWords = new Set(commentContent.toLowerCase().split(/\s+/));
  if (uniqueWords.size / wordCount > 0.8) vocabularyScore += 10;
  
  // 4. Content Relevance Score (0-100)
  let contentRelevanceScore = 25; // Base score
  
  // Check if responds to questions in post
  if (postContent.includes('?')) {
    const hasOpinion = /\b(think|believe|feel|opinion|agree|disagree|consider)\b/i.test(commentContent);
    if (hasOpinion) contentRelevanceScore += 20;
    
    const hasElaboration = wordCount > 20;
    if (hasElaboration) contentRelevanceScore += 15;
  }
  
  // Topic relevance
  const topicKeywords = extractTopicKeywords(topicName);
  const mentionedKeywords = topicKeywords.filter(keyword =>
    commentContent.toLowerCase().includes(keyword.toLowerCase())
  );
  
  contentRelevanceScore += Math.min(20, mentionedKeywords.length * 4);
  
  // Personal engagement indicators
  const personalIndicators = ['i think', 'i believe', 'in my opinion', 'i feel', 'my experience'];
  const hasPersonalTouch = personalIndicators.some(indicator =>
    commentContent.toLowerCase().includes(indicator)
  );
  if (hasPersonalTouch) contentRelevanceScore += 10;
  
  // Detail and depth bonus
  if (wordCount >= 50) contentRelevanceScore += 10;
  
  // Calculate total score
  const totalScore = Math.min(200, clarityScore + grammarScore + vocabularyScore + contentRelevanceScore);
  
  // Generate feedback messages
  const clarityFeedback = clarityScore >= 80 
    ? "Excellent clarity! Your message is well-structured and easy to follow."
    : clarityScore >= 60 
    ? "Good clarity. Try to organize your ideas with clear connecting words like 'however' or 'because'."
    : clarityScore >= 40
    ? "Your message has clear points. Work on connecting ideas and using multiple sentences."
    : "Focus on writing complete sentences and organizing your thoughts clearly.";
    
  const grammarFeedback = grammarScore >= 80 
    ? "Great grammar! Your sentences are well-constructed."
    : grammarScore >= 60 
    ? "Good grammar overall. Remember to capitalize the first word of sentences and end with punctuation."
    : grammarScore >= 40
    ? "Your grammar is developing. Focus on starting sentences with capital letters and ending with periods."
    : "Work on basic grammar: capital letters at the start and punctuation at the end of sentences.";
    
  const vocabularyFeedback = requiredWords.length === 0
    ? "Great job expressing your ideas with varied vocabulary!"
    : vocabularyScore >= 80 
    ? "Excellent vocabulary use! You incorporated the required words naturally."
    : vocabularyScore >= 60 
    ? "Good vocabulary. Try to include more of the required words in natural sentences."
    : vocabularyScore >= 40
    ? `You used ${usedWordsCount} out of ${requiredWords.length} required words. Try to include the missing ones.`
    : "Make sure to use the required vocabulary words in your comment.";
    
  const contentRelevanceFeedback = contentRelevanceScore >= 80 
    ? "Perfect! Your response directly addresses the topic with thoughtful insights and personal opinions."
    : contentRelevanceScore >= 60 
    ? "Good response to the topic. Try to share more of your personal thoughts and elaborate on your ideas."
    : contentRelevanceScore >= 40
    ? "Your response relates to the topic. Try to address specific questions and share your personal opinion."
    : "Make sure your response directly answers the questions in the post and shares your own thoughts.";
  
  const overallFeedback = totalScore >= 160 
    ? "Outstanding work! Your response shows excellent English skills and thoughtful engagement. 🌟"
    : totalScore >= 120 
    ? "Great job! You're making excellent progress in your English communication skills. Keep it up! 👍"
    : totalScore >= 80 
    ? "Good effort! Keep practicing to improve your clarity and vocabulary usage. You're on the right track! 💪"
    : "Keep practicing! Focus on using complete sentences, required vocabulary, and sharing your personal thoughts. You can do it! 🚀";
  
  return {
    totalScore: Math.round(totalScore),
    clarityScore: Math.min(100, clarityScore),
    grammarScore: Math.min(100, grammarScore),
    vocabularyScore: Math.min(100, vocabularyScore),
    contentRelevanceScore: Math.min(100, contentRelevanceScore),
    clarityFeedback,
    grammarFeedback,
    vocabularyFeedback,
    contentRelevanceFeedback,
    overallFeedback,
    wordUsage
  };
}

/**
 * 🏷️ Extract topic-relevant keywords
 */
function extractTopicKeywords(topicName: string): string[] {
  const lowerTopic = topicName.toLowerCase();
  
  const keywordMap: Record<string, string[]> = {
    'diplomacy': ['diplomacy', 'peace', 'agreement', 'negotiate', 'international', 'relations'],
    'economy': ['economy', 'business', 'startup', 'investment', 'growth', 'market'],
    'innovation': ['innovation', 'technology', 'research', 'development', 'science', 'creative'],
    'history': ['history', 'past', 'ancient', 'heritage', 'tradition', 'culture'],
    'holocaust': ['memorial', 'remember', 'survivor', 'history', 'tragedy', 'memory'],
    'society': ['society', 'community', 'people', 'culture', 'diversity', 'social'],
    'environment': ['environment', 'nature', 'green', 'sustainable', 'ecology', 'conservation']
  };
  
  // Find matching keywords
  for (const [key, keywords] of Object.entries(keywordMap)) {
    if (lowerTopic.includes(key)) {
      return keywords;
    }
  }
  
  // Default keywords
  return ['israel', 'israeli', 'society', 'culture', 'community', 'important'];
}

export default router;