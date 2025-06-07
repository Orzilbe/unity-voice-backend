"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("./db"));
class Topic {
    // Get all topics
    static async findAll() {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM Topics ORDER BY `Order`');
            return rows;
        }
        catch (error) {
            console.error('Error finding all topics:', error);
            throw error;
        }
    }
    // Find topic by name
    static async findByName(topicName) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM Topics WHERE TopicName = ?', [topicName]);
            return rows.length ? rows[0] : null;
        }
        catch (error) {
            console.error('Error finding topic by name:', error);
            throw error;
        }
    }
    // Create a new topic
    static async create(topicData) {
        try {
            const [result] = await db_1.default.execute(`INSERT INTO Topics 
         (TopicName, TopicHe, Icon, \`Order\`, Difficulty, Description, DescriptionHe)
         VALUES (?, ?, ?, ?, ?, ?, ?)`, [
                topicData.TopicName,
                topicData.TopicHe,
                topicData.Icon,
                topicData.Order || 0,
                topicData.Difficulty || 'beginner',
                topicData.Description || '',
                topicData.DescriptionHe || ''
            ]);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('Error creating topic:', error);
            throw error;
        }
    }
    // Update topic
    static async update(topicName, updateData) {
        try {
            // Don't allow updating TopicName
            delete updateData.TopicName;
            // Build the SET part of the SQL query dynamically
            const updateFields = Object.keys(updateData)
                .map(field => {
                if (field === 'Order') {
                    return '`Order` = ?';
                }
                return `${field} = ?`;
            })
                .join(', ');
            if (!updateFields) {
                return true; // Nothing to update
            }
            const values = [...Object.values(updateData), topicName];
            const [result] = await db_1.default.execute(`UPDATE Topics SET ${updateFields} WHERE TopicName = ?`, values);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('Error updating topic:', error);
            throw error;
        }
    }
    // Initialize topics (used at startup)
    static async initializeTopics() {
        try {
            const topicData = [
                {
                    TopicName: 'History and Heritage',
                    TopicHe: 'הסטוריה ומורשת',
                    Icon: '🏛️'
                },
                {
                    TopicName: 'Diplomacy and International Relations',
                    TopicHe: 'דיפלומטיה ויחסים בינלאומיים',
                    Icon: '🤝'
                },
                {
                    TopicName: 'Iron Swords War',
                    TopicHe: 'מלחמת חרבות ברזל',
                    Icon: '⚔️'
                },
                {
                    TopicName: 'Innovation and Technology',
                    TopicHe: 'חדשנות וטכנולוגיה',
                    Icon: '💡'
                },
                {
                    TopicName: 'Society and Multiculturalism',
                    TopicHe: 'חברה ורב תרבותיות',
                    Icon: '🌍'
                },
                {
                    TopicName: 'Holocaust and Revival',
                    TopicHe: 'שואה ותקומה',
                    Icon: '✡️'
                },
                {
                    TopicName: 'Environment and Sustainability',
                    TopicHe: 'סביבה וקיימות',
                    Icon: '🌱'
                },
                {
                    TopicName: 'Economy and Entrepreneurship',
                    TopicHe: 'כלכלה ויזמות',
                    Icon: '💰'
                }
            ];
            // Insert topics with ON DUPLICATE KEY UPDATE
            for (const topic of topicData) {
                await db_1.default.execute(`INSERT INTO Topics (TopicName, TopicHe, Icon) 
           VALUES (?, ?, ?)
           ON DUPLICATE KEY UPDATE 
           TopicHe = VALUES(TopicHe), 
           Icon = VALUES(Icon)`, [topic.TopicName, topic.TopicHe, topic.Icon]);
            }
        }
        catch (error) {
            console.error('Error initializing topics:', error);
            throw error;
        }
    }
}
exports.default = Topic;
