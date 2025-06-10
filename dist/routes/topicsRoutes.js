"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// apps/api/src/routes/topicsRoutes.ts
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../models/db"));
const router = express_1.default.Router();
/**
 * קבלת כל הנושאים - עם timeout protection
 * GET /api/topics
 */
router.get('/', async (req, res) => {
    console.log('📝 Topics endpoint called');
    // Set response timeout
    req.setTimeout(8000, () => {
        console.error('❌ Request timeout - responding with fallback');
        if (!res.headersSent) {
            res.status(200).json(getFallbackTopics());
        }
    });
    try {
        console.log('🔄 Getting all topics...');
        // Create promise with timeout
        const queryPromise = executeTopicsQuery();
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('Database timeout')), 5000));
        const rows = await Promise.race([queryPromise, timeoutPromise]);
        console.log(`✅ Found ${rows.length} topics from database`);
        if (!res.headersSent) {
            res.json(rows);
        }
    }
    catch (error) {
        console.error('❌ Error getting topics:', error);
        console.log('🔄 Returning fallback topics');
        if (!res.headersSent) {
            // Return fallback topics instead of error
            res.status(200).json(getFallbackTopics());
        }
    }
});
/**
 * Execute the database query with proper connection handling
 */
async function executeTopicsQuery() {
    let connection;
    try {
        console.log('🔌 Getting database connection...');
        connection = await db_1.default.getConnection();
        console.log('✅ Database connection acquired');
        console.log('🔍 Executing query...');
        const [rows] = await connection.query('SELECT * FROM Topics ORDER BY TopicName');
        console.log('✅ Query executed successfully');
        return rows;
    }
    finally {
        if (connection) {
            console.log('🔌 Releasing database connection');
            connection.release();
        }
    }
}
/**
 * Fallback topics data
 */
function getFallbackTopics() {
    return [
        {
            TopicName: 'Diplomacy and International Relations',
            TopicHe: 'דיפלומטיה ויחסים בינלאומיים',
            Icon: '🤝'
        },
        {
            TopicName: 'Economy and Entrepreneurship',
            TopicHe: 'כלכלה ויזמות',
            Icon: '💰'
        },
        {
            TopicName: 'Environment and Sustainability',
            TopicHe: 'סביבה וקיימות',
            Icon: '🌱'
        },
        {
            TopicName: 'History and Heritage',
            TopicHe: 'הסטוריה ומורשת',
            Icon: '🏛️'
        },
        {
            TopicName: 'Holocaust and Revival',
            TopicHe: 'שואה ותקומה',
            Icon: '✡️'
        },
        {
            TopicName: 'Innovation and Technology',
            TopicHe: 'חדשנות וטכנולוגיה',
            Icon: '💡'
        },
        {
            TopicName: 'Iron Swords War',
            TopicHe: 'מלחמת חרבות ברזל',
            Icon: '⚔️'
        },
        {
            TopicName: 'Society and Multiculturalism',
            TopicHe: 'חברה ורב תרבותיות',
            Icon: '🌍'
        }
    ];
}
exports.default = router;
