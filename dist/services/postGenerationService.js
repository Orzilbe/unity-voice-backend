"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPostForTask = getPostForTask;
// unity-voice-backend/src/services/postGenerationService.ts
const openai_1 = require("openai");
const uuid_1 = require("uuid");
const Task_1 = __importDefault(require("../models/Task"));
const Post_1 = __importDefault(require("../models/Post"));
const database_1 = __importDefault(require("../config/database"));
// OpenAI client setup
const openai = new openai_1.AzureOpenAI({
    apiKey: process.env.AZURE_OPENAI_API_KEY,
    endpoint: process.env.AZURE_OPENAI_ENDPOINT,
    deployment: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
    apiVersion: process.env.AZURE_OPENAI_API_VERSION,
});
/**
 * 🎯 Main function: Generate or retrieve post for a task
 */
async function getPostForTask(taskId, userId, topicName, englishLevel = 'intermediate') {
    console.group(`🎯 Getting post for task ${taskId}`);
    console.log(`User: ${userId}, Topic: ${topicName}, Level: ${englishLevel}`);
    try {
        // Step 1: Check if task already has a post linked
        const task = await Task_1.default.findByIdWithPost(taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found`);
        }
        if (task.PostID && task.PostContent) {
            console.log(`✅ Task already has linked post: ${task.PostID}`);
            const requiredWords = await getUserLearnedWords(userId, topicName);
            console.groupEnd();
            return {
                postId: task.PostID,
                postContent: task.PostContent,
                picture: task.Picture || selectTopicImage(topicName),
                requiredWords,
                source: 'existing',
                isNewlyGenerated: false
            };
        }
        // Step 2: Try to reuse an existing post (but not too often)
        if (await shouldReuseExistingPost(userId, topicName)) {
            console.log(`♻️ Looking for reusable post...`);
            const reusablePost = await findAndLinkReusablePost(taskId, userId, topicName);
            if (reusablePost) {
                console.log(`♻️ Successfully reused post: ${reusablePost.postId}`);
                console.groupEnd();
                return reusablePost;
            }
        }
        // Step 3: Generate new post with OpenAI
        console.log(`🤖 Generating new post with OpenAI...`);
        const newPost = await generateAndLinkNewPost(taskId, userId, topicName, englishLevel);
        console.log(`✅ Successfully generated new post: ${newPost.postId}`);
        console.groupEnd();
        return newPost;
    }
    catch (error) {
        console.error('❌ Error in getPostForTask:', error);
        console.groupEnd();
        // Fallback: Create simple post
        return await createAndLinkFallbackPost(taskId, userId, topicName);
    }
}
/**
 * ♻️ Find and link a reusable post
 */
async function findAndLinkReusablePost(taskId, userId, topicName) {
    try {
        const reusablePosts = await Post_1.default.findReusablePosts(userId, topicName, 3);
        if (reusablePosts.length === 0) {
            console.log('No reusable posts found');
            return null;
        }
        // Pick a random post from available ones
        const selectedPost = reusablePosts[Math.floor(Math.random() * reusablePosts.length)];
        // Link this post to the task
        const linkSuccess = await Task_1.default.linkPost(taskId, selectedPost.PostID);
        if (!linkSuccess) {
            console.warn('Failed to link reusable post to task');
            return null;
        }
        const requiredWords = await getUserLearnedWords(userId, topicName);
        return {
            postId: selectedPost.PostID,
            postContent: selectedPost.PostContent,
            picture: selectedPost.Picture || selectTopicImage(topicName),
            requiredWords,
            source: 'reused',
            isNewlyGenerated: false
        };
    }
    catch (error) {
        console.error('Error finding reusable post:', error);
        return null;
    }
}
/**
 * 🤖 Generate and link a new post using OpenAI
 */
async function generateAndLinkNewPost(taskId, userId, topicName, englishLevel) {
    try {
        // Get learned words for this user/topic
        const learnedWords = await getUserLearnedWords(userId, topicName);
        const requiredWords = learnedWords.length > 0
            ? learnedWords.slice(0, 5)
            : getTopicSpecificWords(topicName).slice(0, 5);
        console.log(`📚 Using required words:`, requiredWords);
        // Generate post content with OpenAI
        const postContent = await generatePostContentWithOpenAI(topicName, englishLevel, requiredWords);
        // Create post in database
        const postId = (0, uuid_1.v4)();
        const picture = selectTopicImage(topicName);
        await Post_1.default.create({
            PostID: postId,
            PostContent: postContent,
            Picture: picture
            // Note: No TaskId - using new relationship model
        });
        // Link post to task
        const linkSuccess = await Task_1.default.linkPost(taskId, postId);
        if (!linkSuccess) {
            console.warn('Post created but failed to link to task');
        }
        console.log(`✅ Generated and linked new post: ${postId}`);
        return {
            postId,
            postContent,
            picture,
            requiredWords,
            source: 'generated',
            isNewlyGenerated: true
        };
    }
    catch (error) {
        console.error('Error generating new post:', error);
        throw error;
    }
}
/**
 * 🎨 Generate post content using OpenAI
 */
async function generatePostContentWithOpenAI(topicName, englishLevel, requiredWords) {
    const prompt = createEnhancedTopicPrompt(topicName, englishLevel, requiredWords);
    console.log(`🎨 Calling OpenAI for topic: ${topicName}`);
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-3.5-turbo",
            messages: [
                {
                    role: "system",
                    content: `You are an expert content creator specializing in educational social media posts about Israel. 
                   Create engaging, authentic content that helps English learners practice vocabulary while learning about Israeli topics.
                   
                   CRITICAL REQUIREMENTS:
                   - Stay STRICTLY within the topic "${topicName}"
                   - Use ALL required words naturally: ${requiredWords.join(', ')}
                   - Write at ${englishLevel} English level
                   - Create authentic social media content
                   - Include 2-3 engaging questions
                   - Be factual and educational
                   - Add 1-2 appropriate emojis
                   - Write factual information that is reliable
                   - Everything you write should be pro-Israel.`
                },
                {
                    role: "user",
                    content: prompt
                }
            ],
            max_tokens: 400,
            temperature: 0.7,
        });
        const generatedText = completion.choices[0]?.message?.content?.trim() || '';
        if (!generatedText) {
            throw new Error('No content generated from OpenAI');
        }
        console.log('✅ Successfully generated post content');
        return generatedText;
    }
    catch (error) {
        console.error('❌ OpenAI error:', error);
        throw error;
    }
}
/**
 * 📝 Create enhanced topic-specific prompt
 */
function createEnhancedTopicPrompt(topicName, englishLevel, requiredWords) {
    let difficultyInstructions = '';
    switch (englishLevel.toLowerCase()) {
        case 'beginner':
            difficultyInstructions = 'Use simple sentences (8-12 words). Avoid complex grammar. Max 80 words total.';
            break;
        case 'intermediate':
            difficultyInstructions = 'Mix simple and complex sentences. Use varied vocabulary. Max 120 words total.';
            break;
        case 'advanced':
            difficultyInstructions = 'Use sophisticated vocabulary and varied sentence structures. Max 150 words total.';
            break;
        default:
            difficultyInstructions = 'Use clear, well-structured sentences. Max 120 words total.';
    }
    const basePrompt = `Create a social media post about "${topicName}" in Israel.

REQUIRED WORDS TO USE: ${requiredWords.join(', ')}
- You MUST use ALL of these words naturally in your post
- Do not use them as hashtags - integrate them into sentences

REQUIREMENTS:
- Focus on ONE specific event, achievement, or fact about ${topicName}
- Include specific details (dates, names, numbers when possible)
- Sound like authentic social media content
- End with 2-3 engaging questions for discussion
- Add 1-2 relevant emojis
- ${difficultyInstructions}

TOPIC FOCUS: ${getTopicFocusInstructions(topicName)}

Make it educational and engaging for English learners!`;
    return basePrompt;
}
/**
 * 🎯 Get topic-specific focus instructions
 */
function getTopicFocusInstructions(topicName) {
    const lowerTopic = topicName.toLowerCase();
    if (lowerTopic.includes('diplomacy') || lowerTopic.includes('international')) {
        return "Focus on Israeli diplomatic achievements, peace agreements, or international partnerships.";
    }
    else if (lowerTopic.includes('economy') || lowerTopic.includes('entrepreneur')) {
        return "Focus on Israeli startup successes, business innovations, or economic achievements.";
    }
    else if (lowerTopic.includes('innovation') || lowerTopic.includes('technology')) {
        return "Focus on Israeli technological breakthroughs, scientific discoveries, or tech innovations.";
    }
    else if (lowerTopic.includes('history') || lowerTopic.includes('heritage')) {
        return "Focus on Israeli historical events, archaeological discoveries, or cultural heritage.";
    }
    else if (lowerTopic.includes('holocaust') || lowerTopic.includes('revival')) {
        return "Focus on Holocaust remembrance, survival stories, or Israel's establishment journey.";
    }
    else if (lowerTopic.includes('iron') || lowerTopic.includes('sword')) {
        return "Focus on Israeli defense innovations, security achievements, or resilience stories.";
    }
    else if (lowerTopic.includes('society') || lowerTopic.includes('multicultural')) {
        return "Focus on Israeli social diversity, multicultural events, or community initiatives.";
    }
    else if (lowerTopic.includes('environment') || lowerTopic.includes('sustainability')) {
        return "Focus on Israeli environmental initiatives, green technologies, or sustainability projects.";
    }
    else {
        return "Focus on specific, factual aspects of this topic related to Israeli society or achievements.";
    }
}
/**
 * 🔄 Check if we should reuse existing posts (not too often)
 */
async function shouldReuseExistingPost(userId, topicName) {
    try {
        const pool = database_1.default.getPool();
        // Check how many posts this user has seen for this topic
        const [rows] = await pool.execute(`
      SELECT COUNT(*) as post_count
      FROM tasks t
      WHERE t.UserId = ? 
        AND t.TopicName = ? 
        AND t.TaskType = 'post' 
        AND t.PostID IS NOT NULL
    `, [userId, topicName]);
        const postCount = rows[0]?.post_count || 0;
        // Only reuse if user has seen fewer than 2 posts for this topic
        if (postCount < 2) {
            const reusablePosts = await Post_1.default.findReusablePosts(userId, topicName, 1);
            return reusablePosts.length > 0;
        }
        return false;
    }
    catch (error) {
        console.error('Error checking reuse condition:', error);
        return false;
    }
}
/**
 * 🆘 Create fallback post when all else fails
 */
async function createAndLinkFallbackPost(taskId, userId, topicName) {
    console.log(`🆘 Creating fallback post for ${topicName}`);
    try {
        const requiredWords = await getUserLearnedWords(userId, topicName);
        const fallbackContent = createFallbackContent(topicName, requiredWords);
        const postId = (0, uuid_1.v4)();
        const picture = selectTopicImage(topicName);
        await Post_1.default.create({
            PostID: postId,
            PostContent: fallbackContent,
            Picture: picture
        });
        await Task_1.default.linkPost(taskId, postId);
        return {
            postId,
            postContent: fallbackContent,
            picture,
            requiredWords: requiredWords.slice(0, 5),
            source: 'fallback',
            isNewlyGenerated: true
        };
    }
    catch (error) {
        console.error('Error creating fallback post:', error);
        // Return minimal fallback
        return {
            postId: (0, uuid_1.v4)(),
            postContent: `Let's discuss ${formatTopicName(topicName)}! This is an important topic in Israeli society. What are your thoughts on this subject? How does it affect our daily lives?`,
            picture: selectTopicImage(topicName),
            requiredWords: getTopicSpecificWords(topicName).slice(0, 5),
            source: 'fallback',
            isNewlyGenerated: true
        };
    }
}
// ================================================================
// Helper Functions
// ================================================================
function createFallbackContent(topicName, requiredWords) {
    const formattedTopic = formatTopicName(topicName);
    const wordsToUse = requiredWords.slice(0, 3);
    return `🇮🇱 Let's explore ${formattedTopic}! 

This topic involves many important aspects like ${wordsToUse.join(', ')} that shape Israeli society today. 

What are your thoughts on this subject? How do you think these elements impact our daily lives? Share your perspective! 💭`;
}
function formatTopicName(topicName) {
    return topicName
        .split(/[-_\s]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}
function selectTopicImage(topicName) {
    const lowerTopic = topicName.toLowerCase();
    // More reliable image URLs using placeholder services
    const imageMap = {
        'diplomacy': 'https://via.placeholder.com/800x600/2563eb/ffffff?text=Diplomacy',
        'international': 'https://via.placeholder.com/800x600/0ea5e9/ffffff?text=International+Relations',
        'economy': 'https://via.placeholder.com/800x600/059669/ffffff?text=Economy',
        'entrepreneur': 'https://via.placeholder.com/800x600/16a34a/ffffff?text=Entrepreneurship',
        'innovation': 'https://via.placeholder.com/800x600/7c3aed/ffffff?text=Innovation',
        'technology': 'https://via.placeholder.com/800x600/6366f1/ffffff?text=Technology',
        'history': 'https://via.placeholder.com/800x600/92400e/ffffff?text=History',
        'heritage': 'https://via.placeholder.com/800x600/a16207/ffffff?text=Heritage',
        'holocaust': 'https://via.placeholder.com/800x600/374151/ffffff?text=Memorial',
        'revival': 'https://via.placeholder.com/800x600/065f46/ffffff?text=Revival',
        'iron': 'https://via.placeholder.com/800x600/991b1b/ffffff?text=Defense',
        'sword': 'https://via.placeholder.com/800x600/991b1b/ffffff?text=Security',
        'society': 'https://via.placeholder.com/800x600/dc2626/ffffff?text=Society',
        'multicultural': 'https://via.placeholder.com/800x600/ea580c/ffffff?text=Multiculturalism',
        'environment': 'https://via.placeholder.com/800x600/16a34a/ffffff?text=Environment',
        'sustainability': 'https://via.placeholder.com/800x600/15803d/ffffff?text=Sustainability'
    };
    // Find best match
    for (const [key, url] of Object.entries(imageMap)) {
        if (lowerTopic.includes(key)) {
            return url;
        }
    }
    // Default fallback
    return 'https://via.placeholder.com/800x600/3b82f6/ffffff?text=Israeli+Culture';
}
async function getUserLearnedWords(userId, topicName) {
    try {
        const pool = database_1.default.getPool();
        console.log(`🔍 Getting learned words for user ${userId}, topic: ${topicName}`);
        // Find the user's completed flashcard task for this topic
        const [flashcardTaskResult] = await pool.execute(`
      SELECT TaskId, Level, CompletionDate
      FROM tasks 
      WHERE UserId = ? 
        AND TopicName = ? 
        AND TaskType = 'flashcard' 
        AND CompletionDate IS NOT NULL
      ORDER BY CompletionDate DESC
      LIMIT 1
    `, [userId, topicName]);
        if (!Array.isArray(flashcardTaskResult) || flashcardTaskResult.length === 0) {
            console.log(`❌ No completed flashcard task found for user ${userId} in topic ${topicName}`);
            return [];
        }
        const flashcardTask = flashcardTaskResult[0];
        console.log(`✅ Found flashcard task: ${flashcardTask.TaskId}`);
        // Get words from wordintask table for this task
        const [wordsResult] = await pool.execute(`
      SELECT w.Word, w.Translation, w.EnglishLevel
      FROM wordintask wit
      JOIN words w ON wit.WordId = w.WordId
      WHERE wit.TaskId = ?
      ORDER BY wit.AddedAt DESC
      LIMIT 10
    `, [flashcardTask.TaskId]);
        const learnedWords = wordsResult.map(row => row.Word);
        console.log(`📚 Found ${learnedWords.length} learned words:`, learnedWords);
        return learnedWords;
    }
    catch (error) {
        console.error('❌ Error fetching learned words:', error);
        return [];
    }
}
function getTopicSpecificWords(topicName) {
    const lowerTopic = topicName.toLowerCase();
    if (lowerTopic.includes('diplomacy') || lowerTopic.includes('international')) {
        return ['diplomacy', 'peace', 'negotiation', 'agreement', 'international', 'relations', 'ambassador'];
    }
    else if (lowerTopic.includes('economy') || lowerTopic.includes('entrepreneur')) {
        return ['startup', 'innovation', 'entrepreneur', 'investment', 'technology', 'business', 'economy'];
    }
    else if (lowerTopic.includes('innovation') || lowerTopic.includes('technology')) {
        return ['technology', 'startup', 'innovation', 'research', 'development', 'digital', 'science'];
    }
    else if (lowerTopic.includes('history') || lowerTopic.includes('heritage')) {
        return ['heritage', 'tradition', 'ancient', 'archaeological', 'civilization', 'culture', 'history'];
    }
    else if (lowerTopic.includes('holocaust') || lowerTopic.includes('revival')) {
        return ['remembrance', 'survivor', 'memorial', 'testimony', 'resilience', 'memory', 'heritage'];
    }
    else if (lowerTopic.includes('iron') || lowerTopic.includes('sword')) {
        return ['security', 'defense', 'protection', 'resilience', 'strength', 'safety', 'courage'];
    }
    else if (lowerTopic.includes('society') || lowerTopic.includes('multicultural')) {
        return ['diversity', 'culture', 'community', 'tradition', 'integration', 'society', 'unity'];
    }
    else if (lowerTopic.includes('environment') || lowerTopic.includes('sustainability')) {
        return ['environment', 'sustainability', 'renewable', 'green', 'conservation', 'ecology', 'nature'];
    }
    return ['culture', 'heritage', 'history', 'innovation', 'community', 'society', 'tradition'];
}
