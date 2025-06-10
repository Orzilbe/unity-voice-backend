// /backend/src/services/wordGenerator.ts - FIXED VERSION

import { AzureOpenAI } from 'openai';
import { v4 as uuidv4 } from 'uuid';

// Log environment variables for debugging (redacted for security)
console.log('AZURE_OPENAI_ENDPOINT config:', process.env.AZURE_OPENAI_ENDPOINT ? 'Set (value hidden)' : 'Not set');
console.log('AZURE_OPENAI_API_KEY config:', process.env.AZURE_OPENAI_API_KEY ? 'Set (value hidden)' : 'Not set');
console.log('AZURE_OPENAI_DEPLOYMENT_NAME config:', process.env.AZURE_OPENAI_DEPLOYMENT_NAME);

// Create Azure OpenAI client - FIXED CONFIGURATION
const endpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
const apiKey = process.env.AZURE_OPENAI_API_KEY || '';
const deployment = process.env.AZURE_OPENAI_DEPLOYMENT_NAME || 'gpt-4o';
const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-02-01'; // ✅ Changed to stable version

// ✅ CORRECT CLIENT CONFIGURATION
const client = new AzureOpenAI({
  endpoint,
  apiKey,
  apiVersion
  // ❌ DON'T include deployment here - it goes in the model parameter
});

export interface GeneratedWord {
  WordId?: string;
  Word: string;
  Translation: string;
  ExampleUsage: string;
  TopicName?: string;
  EnglishLevel?: string;
}

export async function generateWords(
  englishLevel: string, 
  topicName: string, 
  existingWords: string[] = []
): Promise<GeneratedWord[]> {
  console.log(`🎯 Generating words for level: ${englishLevel}`);
  
  // ✅ Check required environment variables
  if (!endpoint || !apiKey || !deployment) {
    console.error('❌ Missing required Azure OpenAI environment variables:');
    console.error('- AZURE_OPENAI_ENDPOINT:', endpoint ? '✅' : '❌');
    console.error('- AZURE_OPENAI_API_KEY:', apiKey ? '✅' : '❌'); 
    console.error('- AZURE_OPENAI_DEPLOYMENT_NAME:', deployment ? '✅' : '❌');
    return [];
  }
  
  const prompt = createPromptForTopic(topicName, englishLevel, existingWords);
  
  try {
    console.log('🚀 Making Azure OpenAI API request...');
    console.log('- Endpoint:', endpoint);
    console.log('- Deployment:', deployment);
    console.log('- API Version:', apiVersion);
    
    // ✅ CORRECT API CALL
    const completion = await client.chat.completions.create({
      model: deployment, // ✅ Use deployment name here, not in client config
      messages: [
        { role: "system", content: "You are a precise language learning assistant creating vocabulary words." },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });
    
    // Process the response
    const responseText = completion.choices[0].message?.content?.trim() || '';
    console.log('✅ Azure OpenAI API response received successfully');
    
    // Parse the JSON response
    let wordsData;
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      const jsonString = jsonMatch ? jsonMatch[0] : responseText;
      wordsData = JSON.parse(jsonString);
    } catch (error) {
      console.error('❌ Error parsing OpenAI response:', error);
      console.error('Raw response text:', responseText);
      return [];
    }
    
    // Convert to GeneratedWord format
    const generatedWords: GeneratedWord[] = wordsData.map((item: any) => ({
      WordId: uuidv4(),
      Word: item.word,
      Translation: item.translation,
      ExampleUsage: item.example || '',
      TopicName: topicName,
      EnglishLevel: englishLevel
    }));
    
    console.log(`✅ Successfully generated ${generatedWords.length} words`);
    return generatedWords;
  } catch (error: any) {
    console.error('❌ Error generating words with Azure OpenAI:', error);
    
    // Detailed error logging
    if (error.status === 401) {
      console.error('🔑 Authentication Error: Invalid API key or endpoint');
      console.error('- Check your AZURE_OPENAI_API_KEY');
      console.error('- Verify AZURE_OPENAI_ENDPOINT format: https://yourresource.openai.azure.com/');
    } else if (error.status === 404) {
      console.error('🎯 Not Found Error: Invalid deployment or endpoint');
      console.error('- Check your AZURE_OPENAI_DEPLOYMENT_NAME matches Azure portal');
      console.error('- Verify endpoint URL is correct');
    } else if (error.status === 429) {
      console.error('⏱️ Rate Limit: Too many requests');
    }
    
    return [];
  }
}

/**
 * Create topic-specific prompt for OpenAI
 */
function createPromptForTopic(
  topicName: string, 
  englishLevel: string, 
  existingWords: string[]
): string {
  
  const existingWordsSection = existingWords.length > 0 
    ? `\nDO NOT use any of these existing words: ${existingWords.join(', ')}\n` 
    : '';

  const basePrompt = `Generate 7 unique words related to ${topicName}, appropriate for ${englishLevel} level English learners.
    ${existingWordsSection}
    For each word, provide:
    1. An English word appropriate for ${englishLevel} level
    2. Hebrew translation - Make sure your translation into Hebrew is correct, accurate, and in the appropriate context
    3. A clear example sentence showing usage
     
    Respond as a JSON array with these fields:
    [{
      "word": "English word",
      "translation": "Hebrew translation",
      "example": "A clear example sentence using the word"
    }, ...]
    
    IMPORTANT: 
    - Ensure the difficulty matches ${englishLevel} level English learners
    - Make sure your translation into Hebrew is correct, accurate, and in the appropriate context
    - Use natural, conversational example sentences
    - Use real, precise words (not phrases)
    - DO NOT use any words from the existing words list provided above`;
  
  // Add topic-specific guidance
  switch (topicName) {
    case "Society and Multiculturalism":
      return `${basePrompt}
        
        Focus on:
        - Cultural diversity terms
        - Social integration concepts
        - Community and identity words
        - Collective living vocabulary
        - Cross-cultural communication`;
        
    case "Diplomacy and International Relations":
      return `${basePrompt}
        
        Focus on:
        - Diplomatic negotiations
        - International conflict resolution
        - Geopolitical strategies
        - Cross-cultural communication
        - Israeli diplomatic roles`;
        
    case "Economy and Entrepreneurship":
      return `${basePrompt}
        
        Focus on:
        - Startup ecosystem
        - Economic innovation
        - Financial technologies
        - Entrepreneurial strategies
        - Business development`;
        
    case "Environment and Sustainability":
      return `${basePrompt}
        
        Focus on:
        - Environmental conservation
        - Climate change
        - Sustainable development
        - Environmental policies
        - Renewable energy`;
        
    case "Innovation and Technology":
      return `${basePrompt}
        
        Focus on:
        - Technological breakthroughs
        - Digital innovation
        - AI and computing
        - Tech startups
        - Israeli innovation ecosystem`;
        
    case "History and Heritage":
      return `${basePrompt}
        
        Focus on:
        - Historical events
        - Cultural heritage
        - Historical places
        - Historical figures
        - Jewish and Israeli history`;
        
    default:
      return basePrompt;
  }
}

export default {
  generateWords
};