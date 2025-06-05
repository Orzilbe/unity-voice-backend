// unity-voice-backend/src/routes/feedback.ts
import express from 'express';
import { AzureOpenAI } from 'openai';
import { authenticateToken } from '../middleware/authMiddleware';
const router = express.Router();

// OpenAI client setup (safely in backend)    
const openai = new AzureOpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY!,
  endpoint: process.env.AZURE_OPENAI_ENDPOINT!,
  deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME!,
  apiVersion: process.env.AZURE_OPENAI_API_VERSION!,
});

interface CommentFeedbackRequest {
  commentContent: string;
  postContent?: string;
  requiredWords: string[];
  topicName: string;
  level: string;
}

interface FeedbackScores {
  clarityScore: number;
  grammarScore: number;
  vocabularyScore: number;
  contentRelevanceScore: number;
  totalScore: number;
  clarityFeedback: string;
  grammarFeedback: string;
  vocabularyFeedback: string;
  contentRelevanceFeedback: string;
  overallFeedback: string;
  wordUsage: { word: string; used: boolean; context: string }[];
}

/**
 * Generate AI feedback for user comment - POST /api/feedback/comment
 */
router.post('/comment', authenticateToken, async (req, res) => {
  try {
    const { commentContent, postContent, requiredWords, topicName, level }: CommentFeedbackRequest = req.body;
    
    console.log('Generating AI feedback for comment:', {
      commentLength: commentContent?.length,
      requiredWordsCount: requiredWords?.length,
      topicName,
      level
    });
    
    if (!commentContent?.trim()) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    // Generate AI feedback using OpenAI
    const aiFeedback = await generateAIFeedback({
      commentContent,
      postContent,
      requiredWords: requiredWords || [],
      topicName: topicName || 'general',
      level: level || 'intermediate'
    });
    
    res.json(aiFeedback);

  } catch (error) {
    console.error('Error generating AI feedback:', error);
    
    // Return fallback feedback instead of error
    const fallbackFeedback = generateSimpleFeedback(
      req.body.commentContent || '', 
      req.body.requiredWords || []
    );
    
    res.json({
      ...fallbackFeedback,
      warning: 'Used fallback feedback due to AI service error'
    });
  }
});

/**
 * Generate AI-powered feedback using OpenAI
 */
async function generateAIFeedback(params: CommentFeedbackRequest): Promise<FeedbackScores> {
  const { commentContent, postContent, requiredWords, topicName, level } = params;
  
  try {
    // Create a comprehensive prompt for AI evaluation
    const prompt = createFeedbackPrompt(commentContent, postContent, requiredWords, topicName, level);
    
    console.log('Calling Azure OpenAI for comment feedback...');
    
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are an expert English language teacher and assessor. Your job is to evaluate user comments for clarity, grammar, vocabulary usage, and content relevance. You should provide constructive, encouraging feedback that helps students improve their English skills.

Always respond with a valid JSON object containing exactly these fields:
- clarityScore (0-50): How clear and well-structured the comment is
- grammarScore (0-50): Grammar and language mechanics
- vocabularyScore (0-50): Use of required vocabulary words
- contentRelevanceScore (0-50): How well the comment addresses the post
- clarityFeedback (string): Specific feedback on clarity
- grammarFeedback (string): Specific feedback on grammar
- vocabularyFeedback (string): Specific feedback on vocabulary
- contentRelevanceFeedback (string): Specific feedback on relevance
- overallFeedback (string): General encouraging feedback
- wordUsage (array): For each required word, whether it was used and context

Be encouraging and constructive in your feedback.`
        },
        {
          role: "user",
          content: prompt
        }
      ],
      max_tokens: 800,
      temperature: 0.3, // Lower temperature for more consistent evaluations
    });

    const responseText = completion.choices[0]?.message?.content?.trim();
    
    if (!responseText) {
      throw new Error('No response from AI');
    }
    
    // Try to parse AI response as JSON
    try {
      const aiResult = JSON.parse(responseText);
      
      // Validate and normalize the AI response
      const feedback = validateAndNormalizeFeedback(aiResult, requiredWords, commentContent);
      
      console.log('AI feedback generated successfully');
      return feedback;
      
    } catch (parseError) {
      console.error('Failed to parse AI response as JSON:', parseError);
      console.error('AI Response was:', responseText);
      
      // Try to extract information from text response
      return parseTextualFeedback(responseText, requiredWords, commentContent);
    }
    
  } catch (aiError) {
    console.error('Azure OpenAI error:', aiError);
    throw aiError;
  }
}

/**
 * Create prompt for AI feedback generation
 */
function createFeedbackPrompt(
  commentContent: string, 
  postContent: string | undefined, 
  requiredWords: string[], 
  topicName: string, 
  level: string
): string {
  return `Please evaluate this user comment for an English learning exercise about ${topicName} (${level} level):

POST CONTENT (what the user is responding to):
"${postContent || 'General discussion post'}"

USER'S COMMENT:
"${commentContent}"

REQUIRED VOCABULARY WORDS: ${requiredWords.join(', ')}

Please evaluate the comment on these criteria and provide scores (0-50 each) plus feedback:

1. CLARITY (0-50): Is the comment clear, well-structured, and easy to understand?
2. GRAMMAR (0-50): Are there grammar, spelling, or punctuation errors?
3. VOCABULARY (0-50): How well does the user incorporate the required words naturally?
4. CONTENT RELEVANCE (0-50): How well does the comment address the post content?

For each required word, indicate if it was used and provide context.

Respond with a JSON object with these exact fields:
{
  "clarityScore": number (0-50),
  "grammarScore": number (0-50),
  "vocabularyScore": number (0-50),
  "contentRelevanceScore": number (0-50),
  "clarityFeedback": "specific feedback on clarity",
  "grammarFeedback": "specific feedback on grammar",
  "vocabularyFeedback": "specific feedback on vocabulary usage",
  "contentRelevanceFeedback": "specific feedback on how well they addressed the post",
  "overallFeedback": "encouraging overall assessment",
  "wordUsage": [
    {"word": "required_word", "used": true/false, "context": "how it was used or empty string"}
  ]
}`;
}

/**
 * Validate and normalize AI feedback response
 */
function validateAndNormalizeFeedback(aiResult: any, requiredWords: string[], commentContent: string): FeedbackScores {
  // Ensure all scores are valid numbers between 0-50
  const clarityScore = Math.max(0, Math.min(50, Number(aiResult.clarityScore) || 0));
  const grammarScore = Math.max(0, Math.min(50, Number(aiResult.grammarScore) || 0));
  const vocabularyScore = Math.max(0, Math.min(50, Number(aiResult.vocabularyScore) || 0));
  const contentRelevanceScore = Math.max(0, Math.min(50, Number(aiResult.contentRelevanceScore) || 0));
  
  const totalScore = clarityScore + grammarScore + vocabularyScore + contentRelevanceScore;
  
  // Ensure wordUsage is properly formatted
  let wordUsage = aiResult.wordUsage || [];
  if (!Array.isArray(wordUsage)) {
    // Generate word usage analysis if AI didn't provide it
    wordUsage = requiredWords.map(word => ({
      word,
      used: commentContent.toLowerCase().includes(word.toLowerCase()),
      context: commentContent.toLowerCase().includes(word.toLowerCase()) ? 
        'Found in comment' : ''
    }));
  }
  
  return {
    clarityScore,
    grammarScore,
    vocabularyScore,
    contentRelevanceScore,
    totalScore,
    clarityFeedback: aiResult.clarityFeedback || 'Good effort on clarity.',
    grammarFeedback: aiResult.grammarFeedback || 'Keep working on grammar.',
    vocabularyFeedback: aiResult.vocabularyFeedback || 'Try to use more vocabulary words.',
    contentRelevanceFeedback: aiResult.contentRelevanceFeedback || 'Good response to the post.',
    overallFeedback: aiResult.overallFeedback || 'Keep practicing!',
    wordUsage
  };
}

/**
 * Parse textual AI feedback when JSON parsing fails
 */
function parseTextualFeedback(responseText: string, requiredWords: string[], commentContent: string): FeedbackScores {
  // Try to extract scores from text
  const clarityMatch = responseText.match(/clarity[:\s]*(\d+)/i);
  const grammarMatch = responseText.match(/grammar[:\s]*(\d+)/i);
  const vocabularyMatch = responseText.match(/vocabulary[:\s]*(\d+)/i);
  const relevanceMatch = responseText.match(/relevance[:\s]*(\d+)/i);
  
  const clarityScore = clarityMatch ? Math.min(50, Number(clarityMatch[1])) : 25;
  const grammarScore = grammarMatch ? Math.min(50, Number(grammarMatch[1])) : 25;
  const vocabularyScore = vocabularyMatch ? Math.min(50, Number(vocabularyMatch[1])) : 25;
  const contentRelevanceScore = relevanceMatch ? Math.min(50, Number(relevanceMatch[1])) : 25;
  
  const totalScore = clarityScore + grammarScore + vocabularyScore + contentRelevanceScore;
  
  // Generate word usage
  const wordUsage = requiredWords.map(word => ({
    word,
    used: commentContent.toLowerCase().includes(word.toLowerCase()),
    context: commentContent.toLowerCase().includes(word.toLowerCase()) ? 
      'Found in comment' : ''
  }));
  
  return {
    clarityScore,
    grammarScore,
    vocabularyScore,
    contentRelevanceScore,
    totalScore,
    clarityFeedback: "Good effort on expressing your ideas clearly.",
    grammarFeedback: "Keep working on grammar and sentence structure.",
    vocabularyFeedback: "Try to incorporate more of the required vocabulary.",
    contentRelevanceFeedback: "Good response to the discussion topic.",
    overallFeedback: "Keep practicing and you'll continue to improve!",
    wordUsage
  };
}

/**
 * Simple fallback feedback generation
 */
function generateSimpleFeedback(commentContent: string, requiredWords: string[]): FeedbackScores {
  const wordCount = commentContent.split(/\s+/).length;
  const sentences = commentContent.split(/[.!?]+/).filter(s => s.trim());
  
  // Simple scoring
  const clarityScore = Math.min(50, wordCount >= 20 ? 35 : 20);
  const grammarScore = Math.min(50, sentences.length >= 2 ? 35 : 20);
  
  let vocabularyScore = 0;
  const wordUsage = requiredWords.map(word => {
    const used = commentContent.toLowerCase().includes(word.toLowerCase());
    if (used) vocabularyScore += 8;
    return { word, used, context: used ? 'Found in comment' : '' };
  });
  
  const contentRelevanceScore = Math.min(50, wordCount >= 15 ? 30 : 20);
  const totalScore = clarityScore + grammarScore + vocabularyScore + contentRelevanceScore;
  
  return {
    clarityScore,
    grammarScore,
    vocabularyScore,
    contentRelevanceScore,
    totalScore,
    clarityFeedback: clarityScore >= 30 ? "Good clarity!" : "Try to express your ideas more clearly.",
    grammarFeedback: grammarScore >= 30 ? "Good grammar!" : "Pay attention to grammar and punctuation.",
    vocabularyFeedback: vocabularyScore >= 25 ? "Good vocabulary use!" : "Try to use more required words.",
    contentRelevanceFeedback: contentRelevanceScore >= 25 ? "Relevant response!" : "Try to address the topic more directly.",
    overallFeedback: totalScore >= 120 ? "Good work! Keep practicing!" : "Keep working on your English skills!",
    wordUsage
  };
}

export default router;