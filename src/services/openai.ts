// src/services/openai.ts (Backend version - Fixed Azure OpenAI)
import { AzureOpenAI } from 'openai';
import { v4 as uuidv4 } from 'uuid';

// בדיקת משתני סביבה
console.log('AZURE_OPENAI_ENDPOINT:', process.env.AZURE_OPENAI_ENDPOINT ? '✅ set' : '❌ missing');
console.log('AZURE_OPENAI_API_KEY:', process.env.AZURE_OPENAI_API_KEY ? '✅ set' : '❌ missing');
console.log('AZURE_OPENAI_DEPLOYMENT_NAME:', process.env.AZURE_OPENAI_DEPLOYMENT_NAME);

// יצירת לקוח Azure OpenAI - תיקון להגדרות נכונות
const client = new AzureOpenAI({
  endpoint: process.env.AZURE_OPENAI_ENDPOINT || '',
  apiKey: process.env.AZURE_OPENAI_API_KEY || '',
  apiVersion: process.env.AZURE_OPENAI_API_VERSION || '2024-04-01-preview'
});

export interface GeneratedWord {
  WordId: string;
  Word: string;
  Translation: string;
  ExampleUsage: string;
}

export async function generateWords(englishLevel: string, topicName: string): Promise<GeneratedWord[]> {
  console.log(`generateWords() called for topic="${topicName}", englishLevel="${englishLevel}"`);

  // בדיקת משתני סביבה חיוניים
  if (!process.env.AZURE_OPENAI_ENDPOINT || !process.env.AZURE_OPENAI_API_KEY || !process.env.AZURE_OPENAI_DEPLOYMENT_NAME) {
    console.error('Missing Azure OpenAI environment variables');
    return [];
  }

  const basePrompt = createPromptForTopic(topicName, englishLevel);

  try {
    console.log('Calling Azure OpenAI...');
    
    const completion = await client.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
      messages: [
        { role: 'system', content: 'You are a precise language learning assistant creating vocabulary words.' },
        { role: 'user', content: basePrompt }
      ],
      temperature: 0.7,
      max_tokens: 1000
    });

    const responseText = completion.choices[0].message?.content?.trim() || '';
    console.log('OpenAI response received:', responseText.substring(0, 200) + '...');

    // חילוץ JSON מהתשובה
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    const jsonString = jsonMatch ? jsonMatch[0] : responseText;
    
    let wordsData;
    try {
      wordsData = JSON.parse(jsonString);
    } catch (err) {
      console.error('Failed to parse JSON from OpenAI response:', err);
      console.error('Raw response:', responseText);
      return [];
    }

    // המרה לפורמט GeneratedWord
    const generatedWords: GeneratedWord[] = wordsData.map((item: any) => ({
      WordId: uuidv4(),
      Word: item.word,
      Translation: item.translation,
      ExampleUsage: item.example || item.ExampleUsage || ''
    }));

    console.log(`generateWords() returning ${generatedWords.length} items`);
    return generatedWords;
    
  } catch (err: any) {
    console.error('Error calling OpenAI:', err);
    
    // פירוט שגיאות ספציפיות
    if (err.status === 401) {
      console.error('🔑 Authentication failed - check your API key and endpoint');
      console.error('Make sure your Azure OpenAI resource is active and the key is correct');
    } else if (err.status === 404) {
      console.error('🎯 Resource not found - check deployment name and endpoint');
      console.error('Deployment name should match exactly what is in Azure portal');
    } else if (err.status === 429) {
      console.error('⏱️ Rate limit exceeded');
    }
    
    return [];
  }
}

/**
 * יצירת prompt ספציפי לנושא
 */
function createPromptForTopic(topicName: string, englishLevel: string): string {
  const basePrompt = `Generate 7 unique English words related to "${topicName}", appropriate for ${englishLevel} level English learners.
For each word, provide:
1. The English word
2. Hebrew translation (accurate, in context)
3. A clear example sentence in English using the word

Respond as a JSON array with fields: 
[{ "word": "...", "translation": "...", "example": "..." }, ...]`;

  // הוספת הדרכה ספציפית לנושא
  switch (topicName.toLowerCase()) {
    case 'history and heritage':
      return `${basePrompt}

Focus on historical events, cultural heritage, and historical terminology suitable for ${englishLevel} learners.`;
    
    case 'economy and entrepreneurship':
      return `${basePrompt}

Focus on business, finance, startup, and economic terms suitable for ${englishLevel} learners.`;
    
    case 'diplomacy and international relations':
      return `${basePrompt}

Focus on diplomatic, political, and international relations terms suitable for ${englishLevel} learners.`;
    
    case 'environment and sustainability':
      return `${basePrompt}

Focus on environmental, climate, and sustainability terms suitable for ${englishLevel} learners.`;
    
    case 'innovation and technology':
      return `${basePrompt}

Focus on technology, innovation, and digital terms suitable for ${englishLevel} learners.`;
    
    case 'society and multiculturalism':
      return `${basePrompt}

Focus on social, cultural diversity, and community terms suitable for ${englishLevel} learners.`;
    
    default:
      return basePrompt;
  }
}