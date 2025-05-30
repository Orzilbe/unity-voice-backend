"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// apps/api/src/routes/topicsRoutes.ts
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../models/db"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
/**
 * קבלת כל הנושאים
 * GET /api/topics
 */
router.get('/', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        console.log('Getting all topics');
        const connection = await db_1.default.getConnection();
        try {
            const [topics] = await connection.execute('SELECT TopicName, TopicHe, Icon FROM Topics ORDER BY TopicName');
            console.log(`Retrieved ${topics.length} topics`);
            return res.json(topics);
        }
        finally {
            connection.release();
        }
    }
    catch (error) {
        console.error('Error fetching topics:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
    }
});
exports.default = router;
