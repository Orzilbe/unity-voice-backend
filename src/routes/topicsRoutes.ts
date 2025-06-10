// unity-voice-backend/src/routes/topicsRoutes.ts - SIMPLE FIX ONLY
import express from 'express';
import { getDbPool } from '../lib/db';

const router = express.Router();

// ✅ Cache פשוט בזיכרון
let cachedTopics: any[] | null = null;
let cacheTime: number = 0;
const CACHE_DURATION = 5 * 60 * 1000; // 5 דקות

// ✅ Fallback topics תואמים למבנה שלך
const FALLBACK_TOPICS = [
  { TopicName: 'History and Heritage', TopicHe: 'היסטוריה ומורשת', Icon: '🏛️' },
  { TopicName: 'Innovation and Technology', TopicHe: 'חדשנות וטכנולוגיה', Icon: '💡' },
  { TopicName: 'Economy and Entrepreneurship', TopicHe: 'כלכלה ויזמות', Icon: '💼' },
  { TopicName: 'Diplomacy and International Relations', TopicHe: 'דיפלומטיה ויחסים בינלאומיים', Icon: '🌍' },
  { TopicName: 'Environment and Sustainability', TopicHe: 'סביבה וקיימות', Icon: '🌱' },
  { TopicName: 'Society and Multiculturalism', TopicHe: 'חברה ורב-תרבותיות', Icon: '🤝' },
  { TopicName: 'Holocaust and Revival', TopicHe: 'שואה ותקומה', Icon: '🕯️' },
  { TopicName: 'Iron Swords War', TopicHe: 'מלחמת חרבות ברזל', Icon: '⚔️' }
];

/**
 * ✅ Get all topics with cache and timeout
 */
router.get('/', async (req, res) => {
  console.log('📝 Topics endpoint called');
  
  try {
    // ✅ בדוק cache קודם
    const now = Date.now();
    if (cachedTopics && (now - cacheTime) < CACHE_DURATION) {
      console.log('🎯 Returning cached topics');
      return res.json(cachedTopics);
    }

    console.log('🔄 Getting all topics...');
    console.log('🔌 Getting database connection...');

    // ✅ נסה לקבל מהמסד נתונים עם timeout קצר
    try {
      const pool = await getDbPool();
      if (!pool) {
        console.log('❌ No database pool, using fallback');
        return res.json(FALLBACK_TOPICS);
      }

      // ✅ Promise עם timeout של 5 שניות בלבד
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Database timeout')), 5000);
      });

      const queryPromise = pool.execute('SELECT TopicName, TopicHe, Icon FROM topics ORDER BY TopicName');

      const [rows] = await Promise.race([queryPromise, timeoutPromise]) as any;
      
      if (Array.isArray(rows) && rows.length > 0) {
        // ✅ שמור בcache
        cachedTopics = rows;
        cacheTime = now;
        console.log(`✅ Found ${rows.length} topics from database, cached for 5 minutes`);
        return res.json(rows);
      } else {
        console.log('⚠️ No topics found in database, using fallback');
        return res.json(FALLBACK_TOPICS);
      }

    } catch (dbError) {
      console.log('⚠️ Database query failed, using fallback:', dbError);
      return res.json(FALLBACK_TOPICS);
    }

  } catch (error) {
    console.error('❌ Error getting topics:', error);
    console.log('🔄 Returning fallback topics');
    return res.json(FALLBACK_TOPICS);
  }
});

/**
 * ✅ Get specific topic by name
 */
router.get('/:topicName', async (req, res) => {
  const { topicName } = req.params;
  console.log(`📝 Getting topic: ${topicName}`);
  
  try {
    // ✅ חפש בcache קודם
    if (cachedTopics) {
      const topic = cachedTopics.find(t => 
        t.TopicName.toLowerCase() === topicName.toLowerCase()
      );
      if (topic) {
        console.log(`✅ Found topic in cache: ${topicName}`);
        return res.json(topic);
      }
    }

    // ✅ חפש בfallback
    const fallbackTopic = FALLBACK_TOPICS.find(t => 
      t.TopicName.toLowerCase() === topicName.toLowerCase()
    );
    
    if (fallbackTopic) {
      console.log(`✅ Found topic in fallback: ${topicName}`);
      return res.json(fallbackTopic);
    }

    console.log(`❌ Topic not found: ${topicName}`);
    return res.status(404).json({ 
      error: 'Topic not found',
      availableTopics: FALLBACK_TOPICS.map(t => t.TopicName)
    });

  } catch (error) {
    console.error('❌ Error getting topic:', error);
    
    // נסה fallback
    const fallbackTopic = FALLBACK_TOPICS.find(t => 
      t.TopicName.toLowerCase() === topicName.toLowerCase()
    );
    
    if (fallbackTopic) {
      console.log(`✅ Using fallback topic: ${topicName}`);
      return res.json(fallbackTopic);
    }

    res.status(500).json({ 
      error: 'Failed to fetch topic',
      availableTopics: FALLBACK_TOPICS.map(t => t.TopicName)
    });
  }
});

export default router;