"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// apps/api/src/routes/topicsRoutes.ts
const express_1 = __importDefault(require("express"));
const database_1 = __importDefault(require("../config/database"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
// Get all topics
router.get('/', authMiddleware_1.authMiddleware, async (req, res, next) => {
    try {
        const pool = database_1.default.getPool();
        const [topics] = await pool.query('SELECT TopicName, TopicHe, Icon FROM Topics');
        res.json(topics);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
