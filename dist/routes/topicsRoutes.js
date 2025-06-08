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
 * קבלת כל הנושאים - זמנית בלי authentication
 * GET /api/topics
 */
router.get('/', async (req, res) => {
    console.log('📝 Topics endpoint called - bypassing auth temporarily');
    try {
        console.log('Getting all topics');
        const connection = await db_1.default.getConnection();
        try {
            const [rows] = await connection.query('SELECT * FROM Topics ORDER BY TopicName');
            console.log(`✅ Found ${rows.length} topics`);
            res.json(rows);
        }
        finally {
            connection.release();
        }
    }
    catch (error) {
        console.error('Error getting topics:', error);
        res.status(500).json({ error: 'Failed to get topics' });
    }
});
exports.default = router;
