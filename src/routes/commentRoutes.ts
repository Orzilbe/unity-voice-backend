// apps/api/src/routes/commentRoutes.ts - מותאם למבנה DB הקיים
import express from 'express';
import { IUserRequest } from '../types/auth';
import { authMiddleware } from '../middleware/authMiddleware';
import pool from '../models/db';
import { errorHandler } from '../middleware/errorHandler';
import { v4 as uuidv4 } from 'uuid';

const router = express.Router();

/**
 * 🔥 הגשת תגובה עם feedback מפורט - מותאם למבנה הקיים
 * POST /api/comments/submit
 */
// עדכון הפונקציה POST / בקובץ commentRoutes.ts

/**
 * יצירת תגובה חדשה (הפונקציה המקורית) - עם עדכון task
 * POST /api/comments
 */
router.post('/', authMiddleware, async (req: IUserRequest, res) => {
  try {
    console.log('Creating comment with data:', req.body);
    const { 
      CommentID, 
      PostID, 
      commentContent, 
      Feedback,
      requiredWords = [],
      postContent = '',
      durationTask = 0,
      taskId  // 🔥 הוסף את זה
    } = req.body;
    
    const userId = req.user?.id; // 🔥 קבל את ה-userId
    
    if (!PostID) {
      return res.status(400).json({
        success: false,
        error: 'PostID is required'
      });
    }
    
    if (!commentContent) {
      return res.status(400).json({
        success: false,
        error: 'Comment content is required'
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      // בדיקה שהפוסט קיים
      const [posts] = await connection.execute(
        'SELECT PostID FROM posts WHERE PostID = ?',
        [PostID]
      );
      
      if (!Array.isArray(posts) || posts.length === 0) {
        return res.status(404).json({
          success: false,
          error: `Post with ID ${PostID} not found`
        });
      }
      
      const commentId = CommentID || uuidv4();
      console.log(`Creating new comment with ID: ${commentId}`);
      
      // יצירת feedback מפורט במקום הפשוט
      const feedback = generateDetailedFeedback(commentContent, requiredWords, postContent);
      
      // 🔥 הוסף metadata לfeedback
      const feedbackWithMeta = {
        ...feedback,
        userId: userId,
        taskId: taskId,
        submittedAt: new Date().toISOString(),
        requiredWords: requiredWords
      };
      
      const insertSql = `
        INSERT INTO comments (
          CommentID, 
          PostID, 
          commentContent, 
          Feedback
        ) VALUES (?, ?, ?, ?)
      `;
      
      const [result] = await connection.execute(insertSql, [
        commentId,
        PostID,
        commentContent,
        JSON.stringify(feedbackWithMeta) // 🔥 שמור עם metadata
      ]);
      
      console.log('Comment created successfully:', result);
      
      // 🔥 עדכון המשימה אם יש taskId ו-userId
      if (taskId && userId && durationTask !== undefined) {
        try {
          console.log(`🎯 Updating task ${taskId} for user ${userId} with score ${feedback.totalScore}`);
          
          const [taskUpdateResult] = await connection.execute(`
            UPDATE tasks 
            SET TaskScore = ?, DurationTask = ?, CompletionDate = NOW()
            WHERE TaskId = ? AND UserId = ?
          `, [feedback.totalScore, durationTask, taskId, userId]);
          
          console.log('✅ Task update result:', taskUpdateResult);
          
          if ((taskUpdateResult as any).affectedRows === 0) {
            console.warn(`⚠️ No task updated. TaskId: ${taskId}, UserId: ${userId} - task may not exist or belong to user`);
          } else {
            console.log(`✅ Task ${taskId} completed successfully with score: ${feedback.totalScore}`);
          }
          
        } catch (taskError) {
          console.error('💥 Failed to update task:', taskError);
          // Don't fail the comment creation if task update fails
        }
      } else {
        console.log(`ℹ️ Task update skipped. TaskId: ${taskId}, UserId: ${userId}, DurationTask: ${durationTask}`);
      }
      
      // 🔥 החזר feedback בפורמט שהקדמי מצפה לו
      return res.status(201).json({
        success: true,
        message: 'Comment submitted successfully',
        commentId: commentId,
        feedback: {
          // ציונים
          totalScore: feedback.totalScore,
          clarityScore: feedback.clarityScore,
          grammarScore: feedback.grammarScore,
          vocabularyScore: feedback.vocabularyScore,
          contentRelevanceScore: feedback.contentRelevanceScore,
          
          // משוב טקסטואלי
          clarityFeedback: feedback.clarityFeedback,
          grammarFeedback: feedback.grammarFeedback,
          vocabularyFeedback: feedback.vocabularyFeedback,
          contentRelevanceFeedback: feedback.contentRelevanceFeedback,
          overallFeedback: feedback.overallFeedback,
          
          // שימוש במילים
          wordUsage: feedback.wordUsage
        },
        data: {
          commentId: commentId,
          commentContent: commentContent,
          feedback: feedback,
          requiredWords: requiredWords,
          wordCount: commentContent.split(' ').length,
          duration: durationTask,
          taskUpdated: !!(taskId && userId) // האם המשימה עודכנה
        }
      });
      
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating comment:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * 🔥 פונקציה ליצירת feedback מפורט שתואם לקדמי
 */
function generateDetailedFeedback(
  commentContent: string, 
  requiredWords: string[], 
  postContent: string
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
  
  // 1. Clarity Score (0-50)
  let clarityScore = 0;
  
  // Length assessment
  if (wordCount >= 50) clarityScore += 20;
  else if (wordCount >= 30) clarityScore += 15;
  else if (wordCount >= 20) clarityScore += 10;
  else if (wordCount >= 10) clarityScore += 5;
  
  // Sentence structure
  const avgSentenceLength = sentences.length > 0 ? wordCount / sentences.length : 0;
  if (avgSentenceLength >= 8 && avgSentenceLength <= 15) clarityScore += 20;
  else if (avgSentenceLength >= 5) clarityScore += 15;
  else if (avgSentenceLength >= 3) clarityScore += 10;
  
  // Multiple sentences bonus
  if (sentences.length >= 3) clarityScore += 10;
  else if (sentences.length >= 2) clarityScore += 5;
  
  // 2. Grammar Score (0-50)
  let grammarScore = 25; // Base score
  
  // Capitalization check
  const properCapitalization = sentences.filter(s => 
    s.trim().length > 0 && s.trim()[0] === s.trim()[0].toUpperCase()
  ).length;
  
  if (sentences.length > 0) {
    grammarScore += Math.round((properCapitalization / sentences.length) * 15);
  }
  
  // Punctuation check
  const hasPunctuation = /[.!?]$/.test(commentContent.trim());
  if (hasPunctuation) grammarScore += 10;
  
  // 3. Vocabulary Score (0-50)
  let vocabularyScore = 0;
  const wordUsage = requiredWords.map(word => {
    const regex = new RegExp(`\\b${word}\\b`, 'i');
    const used = regex.test(commentContent);
    
    let context = "";
    if (used) {
      // Extract context around the word
      const matches = commentContent.match(new RegExp(`.{0,30}\\b${word}\\b.{0,30}`, 'i'));
      context = matches ? `"...${matches[0].trim()}..."` : "Found in comment";
      vocabularyScore += Math.floor(50 / Math.max(1, requiredWords.length)); // Distribute points evenly
    }
    
    return { word, used, context };
  });
  
  // Bonus for using all words
  const usedWordsCount = wordUsage.filter(w => w.used).length;
  if (requiredWords.length > 0 && usedWordsCount === requiredWords.length) {
    vocabularyScore += 10; // Bonus for using all words
  }
  
  // 4. Content Relevance Score (0-50)
  let contentRelevanceScore = 20; // Base score
  
  // Check if addresses questions in post
  if (postContent) {
    const hasQuestions = postContent.includes('?');
    if (hasQuestions) {
      const addressesQuestions = 
        commentContent.toLowerCase().includes('think') || 
        commentContent.toLowerCase().includes('believe') ||
        commentContent.toLowerCase().includes('opinion') ||
        commentContent.toLowerCase().includes('feel') ||
        commentContent.toLowerCase().includes('agree') ||
        commentContent.toLowerCase().includes('disagree');
      
      if (addressesQuestions) contentRelevanceScore += 15;
    }
    
    // Check for topic relevance
    const topicWords = extractTopicWords(postContent);
    const relevantWords = topicWords.filter(word => 
      commentContent.toLowerCase().includes(word.toLowerCase())
    );
    
    if (relevantWords.length > 0) {
      contentRelevanceScore += Math.min(15, relevantWords.length * 3);
    }
  }
  
  // Length bonus for detailed response
  if (wordCount >= 40) contentRelevanceScore += 15;
  else if (wordCount >= 25) contentRelevanceScore += 10;
  
  // Calculate total score
  const totalScore = Math.min(200, clarityScore + grammarScore + vocabularyScore + contentRelevanceScore);
  
  // Generate feedback messages
  const clarityFeedback = clarityScore >= 40 
    ? "Excellent clarity! Your message is well-structured and easy to follow."
    : clarityScore >= 25 
    ? "Good job on clarity. Try to organize your ideas with clear topic sentences."
    : clarityScore >= 15
    ? "Your message has some clear points. Work on connecting your ideas better."
    : "Try to organize your thoughts more clearly. Use more complete sentences.";
    
  const grammarFeedback = grammarScore >= 40 
    ? "Great grammar! Your sentences are well-constructed."
    : grammarScore >= 30 
    ? "Good grammar overall. Pay attention to punctuation and sentence structure."
    : grammarScore >= 20
    ? "Your grammar is developing. Focus on capitalizing the first word of sentences."
    : "Work on basic grammar: capital letters at the start of sentences and punctuation at the end.";
    
  const vocabularyFeedback = requiredWords.length === 0
    ? "Great job expressing your ideas!"
    : vocabularyScore >= 40 
    ? "Excellent use of vocabulary! You incorporated the required words naturally."
    : vocabularyScore >= 25 
    ? "Good vocabulary use. Try to include more of the required words in your response."
    : vocabularyScore >= 10
    ? `You used ${usedWordsCount} out of ${requiredWords.length} required words. Try to include the missing ones.`
    : "Work on using the required vocabulary words in your response.";
    
  const contentRelevanceFeedback = contentRelevanceScore >= 40 
    ? "Perfect! Your response directly addresses the discussion topic and shows good engagement."
    : contentRelevanceScore >= 30 
    ? "Good response to the topic. Try to engage more specifically with the questions asked."
    : contentRelevanceScore >= 20
    ? "Your response is somewhat related to the topic. Try to address the specific points raised in the post."
    : "Make sure your response directly answers the questions or addresses the main points in the post.";
    
  const overallFeedback = totalScore >= 160 
    ? "Outstanding work! Your response shows excellent English skills and thoughtful engagement. 🌟"
    : totalScore >= 120 
    ? "Great job! You're showing good progress in your English communication skills. Keep it up! 👍"
    : totalScore >= 80 
    ? "Good effort! Keep practicing to improve your clarity and vocabulary usage. You're on the right track! 💪"
    : "Keep practicing! Focus on using complete sentences, required vocabulary, and directly answering the questions. You can do it! 🚀";
  
  return {
    totalScore,
    clarityScore,
    grammarScore,
    vocabularyScore,
    contentRelevanceScore,
    clarityFeedback,
    grammarFeedback,
    vocabularyFeedback,
    contentRelevanceFeedback,
    overallFeedback,
    wordUsage
  };
}

/**
 * Extract topic-relevant words from post content
 */
function extractTopicWords(postContent: string): string[] {
  // Simple extraction of meaningful words (exclude common words)
  const commonWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'can', 'this', 'that', 'these', 'those'];
  
  return postContent
    .toLowerCase()
    .split(/\s+/)
    .filter(word => 
      word.length > 3 && 
      !commonWords.includes(word) &&
      /^[a-zA-Z]+$/.test(word)
    )
    .slice(0, 10); // Take up to 10 relevant words
}

/**
 * 🧪 TEST endpoint לבדיקת feedback ללא שמירה
 * POST /api/comments/test-feedback
 */
router.post('/test-feedback', authMiddleware, async (req: IUserRequest, res) => {
  try {
    const { commentContent, requiredWords, postContent } = req.body;
    
    console.log('🧪 Testing feedback generation:', {
      commentLength: commentContent?.length,
      requiredWordsCount: requiredWords?.length,
      hasPostContent: !!postContent
    });

    if (!commentContent?.trim()) {
      return res.status(400).json({ 
        success: false, 
        error: 'Comment content is required for testing' 
      });
    }

    // יצירת feedback מפורט
    const feedback = generateDetailedFeedback(
      commentContent, 
      requiredWords || [], 
      postContent || ''
    );

    console.log('🧪 Test feedback generated:', feedback);

    // החזרת הfeedback בלי שמירה
    return res.json({
      success: true,
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
      testMode: true,
      message: 'Feedback generated successfully (test mode - not saved)'
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

/**
 * יצירת תגובה חדשה (הפונקציה המקורית)
 * POST /api/comments
 */
router.post('/', authMiddleware, async (req: IUserRequest, res) => {
  try {
    console.log('Creating comment with data:', req.body);
    const { 
      CommentID, 
      PostID, 
      commentContent, 
      Feedback,
      requiredWords = [],
      postContent = '',
      durationTask = 0
    } = req.body;
    
    if (!PostID) {
      return res.status(400).json({
        success: false,
        error: 'PostID is required'
      });
    }
    
    if (!commentContent) {
      return res.status(400).json({
        success: false,
        error: 'Comment content is required'
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      // בדיקה שהפוסט קיים
      const [posts] = await connection.execute(
        'SELECT PostID FROM posts WHERE PostID = ?',
        [PostID]
      );
      
      if (!Array.isArray(posts) || posts.length === 0) {
        return res.status(404).json({
          success: false,
          error: `Post with ID ${PostID} not found`
        });
      }
      
      const commentId = CommentID || uuidv4();
      console.log(`Creating new comment with ID: ${commentId}`);
      
      // יצירת feedback מפורט במקום הפשוט
      const feedback = generateDetailedFeedback(commentContent, requiredWords, postContent);
      
      const insertSql = `
        INSERT INTO comments (
          CommentID, 
          PostID, 
          commentContent, 
          Feedback
        ) VALUES (?, ?, ?, ?)
      `;
      
      const [result] = await connection.execute(insertSql, [
        commentId,
        PostID,
        commentContent,
        JSON.stringify(feedback)
      ]);
      
      console.log('Comment created successfully:', result);
      
      return res.status(201).json({
        success: true,
        message: 'Comment submitted successfully',
        commentId: commentId,
        feedback: feedback,
        data: {
          commentId: commentId,
          commentContent: commentContent,
          feedback: feedback,
          requiredWords: requiredWords,
          wordCount: commentContent.split(' ').length,
          duration: durationTask
        }
      });
      
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error creating comment:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * קבלת תגובות לפי PostID
 * GET /api/comments?postId=postId
 */
router.get('/', authMiddleware, async (req: IUserRequest, res) => {
  try {
    const { postId, commentId } = req.query;
    
    console.log(`Getting comments with postId: ${postId}, commentId: ${commentId}`);
    
    if (!postId && !commentId) {
      return res.status(400).json({
        success: false,
        error: 'Post ID or Comment ID is required'
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      if (postId) {
        const [comments] = await connection.execute(
          'SELECT * FROM comments WHERE PostID = ? ORDER BY CommentID DESC',
          [postId]
        );
        
        console.log(`Retrieved ${(comments as any[]).length} comments for postId: ${postId}`);
        return res.json(comments);
      } else if (commentId) {
        const [comments] = await connection.execute(
          'SELECT * FROM comments WHERE CommentID = ?',
          [commentId]
        );
        
        if (!Array.isArray(comments) || comments.length === 0) {
          return res.status(404).json({
            success: false,
            error: 'Comment not found'
          });
        }
        
        console.log(`Retrieved comment: ${commentId}`);
        return res.json(comments[0]);
      }
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error fetching comments:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

/**
 * עדכון תגובה
 * PATCH /api/comments/:commentId
 */
router.patch('/:commentId', authMiddleware, async (req: IUserRequest, res) => {
  try {
    const { commentId } = req.params;
    const { commentContent, Feedback } = req.body;
    
    console.log(`Updating comment ${commentId} with data:`, req.body);
    
    if (!commentContent && Feedback === undefined) {
      return res.status(400).json({
        success: false,
        error: 'No fields to update provided'
      });
    }
    
    const connection = await pool.getConnection();
    
    try {
      const [comments] = await connection.execute(
        'SELECT CommentID FROM comments WHERE CommentID = ?',
        [commentId]
      );
      
      if (!Array.isArray(comments) || comments.length === 0) {
        return res.status(404).json({
          success: false,
          error: `Comment with ID ${commentId} not found`
        });
      }
      
      let updateSql = 'UPDATE comments SET ';
      const updateParams = [];
      
      if (commentContent) {
        updateSql += 'commentContent = ?, ';
        updateParams.push(commentContent);
      }
      
      if (Feedback !== undefined) {
        updateSql += 'Feedback = ?, ';
        updateParams.push(Feedback);
      }
      
      // Remove the trailing comma and space, add WHERE clause
      updateSql = updateSql.slice(0, -2) + ' WHERE CommentID = ?';
      updateParams.push(commentId);
      
      const [result] = await connection.execute(updateSql, updateParams);
      
      if ((result as any).affectedRows === 0) {
        return res.status(400).json({
          success: false,
          error: 'Comment not updated'
        });
      }
      
      console.log('Comment updated successfully:', result);
      
      return res.json({
        success: true,
        message: 'Comment updated successfully',
        commentId: commentId
      });
    } finally {
      connection.release();
    }
  } catch (error) {
    console.error('Error updating comment:', error);
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
});

export default router;