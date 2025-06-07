// unity-voice-backend/src/controllers/conversationAnalysisController.ts
import { Request, Response } from 'express';
import { AzureOpenAI } from 'openai';
import Task from '../models/Task';
import User from '../models/User';
import Word from '../models/Word';
import WordInTask from '../models/WordInTask';

// Initialize Azure OpenAI
let openai: AzureOpenAI | null = null;

function initializeOpenAI() {
  console.log('🔥 Checking OpenAI environment variables:');
  console.log('- API Key exists:', !!process.env.AZURE_OPENAI_API_KEY);
  console.log('- API Key length:', process.env.AZURE_OPENAI_API_KEY?.length || 0);
  console.log('- Endpoint:', process.env.AZURE_OPENAI_ENDPOINT);
  console.log('- Deployment:', process.env.AZURE_OPENAI_DEPLOYMENT_NAME);
  console.log('- Version:', process.env.OPENAI_API_VERSION);

  if (!process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_ENDPOINT || 
      !process.env.AZURE_OPENAI_DEPLOYMENT_NAME || !process.env.OPENAI_API_VERSION) {
    console.log('❌ Missing environment variables for Azure OpenAI');
    return null;
  }

  try {
    const openaiInstance = new AzureOpenAI({
      apiKey: process.env.AZURE_OPENAI_API_KEY,
      endpoint: process.env.AZURE_OPENAI_ENDPOINT,
      deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
      apiVersion: process.env.OPENAI_API_VERSION
    });
    
    console.log('✅ Azure OpenAI instance created successfully');
    return openaiInstance;
  } catch (error) {
    console.error('❌ Error creating Azure OpenAI instance:', error);
    return null;
  }
}

interface ConversationAnalysisRequest {
  text: string;
  topicName: string;
  level: number;
  previousMessages?: Array<{
    role: 'user' | 'assistant';
    content: string;
  }>;
}

interface WordUsage {
  word: string;
  used: boolean;
  context?: string;
}

interface ConversationAnalysisResponse {
  text: string;
  feedback: string;
  usedWords: WordUsage[];
  nextQuestion: string;
  score: number;
  pronunciationTips?: string[];
  grammarTips?: string[];
  suggestions?: string[];
}

// Analyze conversation response
export const analyzeConversationResponse = async (req: Request, res: Response) => {
  try {
    console.log('🔥 CONVERSATION ANALYSIS STARTED');
    console.log('🔥 Request body:', JSON.stringify(req.body, null, 2));
    
    // ✅ בדוק משתני סביבה
    console.log('🔥 Environment check:');
    console.log('- AZURE_OPENAI_API_KEY:', !!process.env.AZURE_OPENAI_API_KEY);
    console.log('- AZURE_OPENAI_ENDPOINT:', process.env.AZURE_OPENAI_ENDPOINT);
    console.log('- AZURE_OPENAI_DEPLOYMENT_NAME:', process.env.AZURE_OPENAI_DEPLOYMENT_NAME);
    console.log('- OPENAI_API_VERSION:', process.env.OPENAI_API_VERSION);

    // ✅ תיקון TypeScript - cast to any פשוט
    const userId = (req as any).user?.userId || (req as any).user?.id;
    if (!userId) {
      console.log('❌ No user ID found');
      return res.status(401).json({
        success: false,
        error: 'User authentication required'
      });
    }

    const { text, topicName, level, previousMessages = [] }: ConversationAnalysisRequest = req.body;

    if (!text || !topicName) {
      console.log('❌ Missing required fields');
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: text and topicName'
      });
    }

    console.log('🔥 Initializing OpenAI...');
    
    // Initialize OpenAI if needed
    if (!openai) {
      openai = initializeOpenAI();
      if (!openai) {
        console.log('❌ OpenAI initialization failed');
        return res.status(500).json({
          success: false,
          error: 'Azure OpenAI configuration is missing',
          debug: {
            hasApiKey: !!process.env.AZURE_OPENAI_API_KEY,
            hasEndpoint: !!process.env.AZURE_OPENAI_ENDPOINT,
            hasDeployment: !!process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
            hasVersion: !!process.env.OPENAI_API_VERSION
          }
        });
      }
    }

    console.log('✅ OpenAI initialized successfully');

    // Get user and words data
    const user = await User.findById(userId);
    if (!user) {
      console.log('❌ User not found');
      return res.status(404).json({
        success: false,
        error: 'User not found'
      });
    }

    console.log('🔥 Getting words data...');
    const learnedWords = await getLearnedWordsForTopicAndLevel(userId, topicName, level);
    const requiredWords = await getRequiredWordsForTopicAndLevel(topicName, level, user.EnglishLevel);

    console.log('🔥 Learned words:', learnedWords);
    console.log('🔥 Required words:', requiredWords);

    // Generate system prompt
    const systemPrompt = generateConversationAnalysisPrompt(
      user.EnglishLevel,
      topicName,
      level,
      learnedWords,
      requiredWords
    );

    // Prepare messages
    const messages = [
      { role: "system", content: systemPrompt },
      ...previousMessages.map(msg => ({ role: msg.role, content: msg.content })),
      { role: "user", content: text }
    ];

    console.log('🔥 Calling Azure OpenAI...');
    console.log('🔥 Messages:', JSON.stringify(messages, null, 2));

    try {
      // Call Azure OpenAI
      const completion = await openai.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4o",
        messages: messages as any,
        temperature: 0.7,
        max_tokens: 800,
        response_format: { type: "json_object" }
      });

      console.log('✅ Azure OpenAI response received');
      console.log('🔥 Response:', JSON.stringify(completion, null, 2));

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        throw new Error("Empty response from Azure OpenAI");
      }

      let analysisResult: ConversationAnalysisResponse;
      try {
        analysisResult = JSON.parse(responseContent);
        console.log('✅ Parsed OpenAI response:', analysisResult);

        // Ensure required fields
        analysisResult.text = analysisResult.text || "I understand what you're saying.";
        analysisResult.feedback = analysisResult.feedback || "Good effort! Keep practicing.";
        analysisResult.nextQuestion = analysisResult.nextQuestion || generateNextQuestion(topicName, user.EnglishLevel);
        analysisResult.score = Math.min(400, Math.max(0, analysisResult.score || 200));
        analysisResult.usedWords = analyzeWordUsage(text, requiredWords);

      } catch (parseError) {
        console.error("❌ Error parsing OpenAI response:", parseError);
        console.log("🔥 Raw response content:", responseContent);
        
        // Fallback response
        analysisResult = {
          text: "I understand what you're saying.",
          feedback: "Good effort! Keep practicing your English.",
          usedWords: analyzeWordUsage(text, requiredWords),
          nextQuestion: generateNextQuestion(topicName, user.EnglishLevel),
          score: 200,
          pronunciationTips: [],
          grammarTips: [],
          suggestions: []
        };
      }

      console.log('✅ Sending response:', analysisResult);
      return res.status(200).json({
        success: true,
        data: analysisResult
      });

    } catch (openaiError) {
      console.error('❌ Azure OpenAI API Error:', openaiError);
      
      // Fallback response for OpenAI errors
      const fallbackResult = {
        text: "I understand what you're saying.",
        feedback: "Good effort! Keep practicing your English.",
        usedWords: analyzeWordUsage(text, requiredWords),
        nextQuestion: generateNextQuestion(topicName, user.EnglishLevel),
        score: 200,
        pronunciationTips: [],
        grammarTips: [],
        suggestions: []
      };

      return res.status(200).json({
        success: true,
        data: fallbackResult,
        debug: {
          openaiError: openaiError instanceof Error ? openaiError.message : 'Unknown OpenAI error',
          fallbackUsed: true
        }
      });
    }

  } catch (error) {
    console.error('❌ Error in conversation analysis:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to analyze conversation',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Helper function to get learned words for topic and level
async function getLearnedWordsForTopicAndLevel(userId: string, topicName: string, level: number): Promise<string[]> {
  try {
    // Find flashcard tasks for this user, topic, and level
    const flashcardTasks = await Task.findByUserTopicAndLevel(userId, topicName, level, 'flashcards');
    
    if (!flashcardTasks || flashcardTasks.length === 0) {
      return [];
    }

    const words: string[] = [];
    for (const task of flashcardTasks) {
      // Get words from this flashcard task
      const wordsInTask = await WordInTask.findByTaskId(task.TaskId);
      for (const wordInTask of wordsInTask) {
        const word = await Word.findById(wordInTask.WordId);
        if (word) {
          words.push(word.Word);
        }
      }
    }

    return [...new Set(words)]; // Remove duplicates
  } catch (error) {
    console.error('Error getting learned words:', error);
    return [];
  }
}

// Helper function to get required words for topic and level
async function getRequiredWordsForTopicAndLevel(topicName: string, level: number, englishLevel: string): Promise<string[]> {
  try {
    // Get words that match the topic, level, and English proficiency
    const words = await Word.findByTopicAndLevel(topicName, englishLevel);
    
    // Return up to 8 words randomly selected
    const shuffled = words.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 8).map(word => word.Word);
  } catch (error) {
    console.error('Error getting required words:', error);
    return [];
  }
}

// Generate system prompt for conversation analysis
function generateConversationAnalysisPrompt(
  englishLevel: string,
  topicName: string,
  level: number,
  learnedWords: string[],
  requiredWords: string[]
): string {
  let difficultyInstructions = "";
  
  switch(englishLevel.toLowerCase()) {
    case "beginner":
      difficultyInstructions = "Use simple vocabulary and short sentences. Focus on basic grammar and pronunciation. Be very encouraging and patient.";
      break;
    case "advanced":
      difficultyInstructions = "Use sophisticated vocabulary and varied sentence structures. Include idiomatic expressions. Provide detailed feedback on nuanced language use.";
      break;
    case "intermediate":
    default:
      difficultyInstructions = "Balance simple and complex sentences. Introduce some advanced vocabulary with context. Provide moderate feedback on language use.";
      break;
  }

  const wordsList = [...new Set([...requiredWords, ...learnedWords.slice(0, 5)])].join(", ");

  return `You are an AI English conversation partner helping a user practice English about ${topicName}.

User Details:
- English Level: ${englishLevel}
- Topic: ${topicName} (Level ${level})
- ${difficultyInstructions}

Important Words to Encourage: ${wordsList}

Your task is to:
1. Analyze the user's response for:
   - Grammar accuracy
   - Pronunciation patterns (based on common mistakes)
   - Vocabulary usage (especially required words)
   - Content relevance to the topic
   - Fluency and coherence

2. Provide a supportive conversational response
3. Give constructive feedback focusing on improvement
4. Generate a follow-up question to continue the conversation
5. Score the response from 0-400 based on:
   - Grammar and syntax (0-100 points)
   - Vocabulary usage (0-100 points)
   - Topic relevance (0-100 points)
   - Fluency and pronunciation (0-100 points)

Response format (JSON):
{
  "text": "Your natural conversational response",
  "feedback": "Constructive feedback focusing on what they did well and one area to improve",
  "usedWords": [
    {
      "word": "required word",
      "used": true/false,
      "context": "sentence where word was used (if applicable)"
    }
  ],
  "nextQuestion": "Engaging follow-up question related to ${topicName}",
  "score": 250,
  "pronunciationTips": ["tip about pronunciation if needed"],
  "grammarTips": ["tip about grammar if needed"],
  "suggestions": ["suggestion for improvement"]
}

Be encouraging, supportive, and focused on helping the user improve their English conversation skills.`;
}

// Analyze word usage in user's response
function analyzeWordUsage(text: string, requiredWords: string[]): WordUsage[] {
  const lowerText = text.toLowerCase();
  
  return requiredWords.map(word => {
    const wordLower = word.toLowerCase();
    const used = lowerText.includes(wordLower);
    
    let context = '';
    if (used) {
      // Find the sentence containing the word
      const sentences = text.split(/[.!?]+/);
      const containingSentence = sentences.find(sentence => 
        sentence.toLowerCase().includes(wordLower)
      );
      context = containingSentence ? containingSentence.trim() : `Used "${word}" in response`;
    }
    
    return {
      word,
      used,
      context: used ? context : undefined
    };
  });
}

// Generate next question based on topic and level
function generateNextQuestion(topicName: string, englishLevel: string): string {
  const questionsByTopic: Record<string, string[]> = {
    'History and Heritage': [
      "What historical period interests you most and why?",
      "How do you think studying history helps us today?",
      "Can you describe a historical figure you admire?"
    ],
    'Innovation and Technology': [
      "What technological innovation has changed your life the most?",
      "How do you see technology evolving in the next decade?",
      "What are the benefits and challenges of rapid technological change?"
    ],
    'Economy and Entrepreneurship': [
      "What makes a successful entrepreneur in your opinion?",
      "How important is innovation for economic growth?",
      "What economic challenges do you think your generation will face?"
    ],
    'Diplomacy and International Relations': [
      "Why is international cooperation important?",
      "How can countries build better relationships?",
      "What role should diplomacy play in solving global issues?"
    ]
  };

  const questions = questionsByTopic[topicName] || [
    "What aspects of this topic interest you most?",
    "Can you share your thoughts on this subject?",
    "How does this topic relate to your personal experience?"
  ];

  // Adjust question complexity based on English level
  if (englishLevel === 'beginner') {
    return questions[0] || "What do you think about this topic?";
  } else if (englishLevel === 'advanced') {
    return questions[questions.length - 1] || "How would you analyze the broader implications of this topic?";
  } else {
    return questions[Math.floor(questions.length / 2)] || "Can you elaborate on your thoughts about this topic?";
  }
}