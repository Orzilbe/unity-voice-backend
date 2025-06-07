"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// apps/api/src/routes/topicsRoutes.ts
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const db_1 = __importDefault(require("../models/db"));
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
            const [rows] = await connection.query('SELECT * FROM Topics ORDER BY TopicName');
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
