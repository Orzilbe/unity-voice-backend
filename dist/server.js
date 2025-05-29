"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// apps/api/src/server.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const dotenv_1 = __importDefault(require("dotenv"));
const models_1 = require("./models");
// Import routes
const auth_1 = __importDefault(require("./routes/auth"));
const topicsRoutes_1 = __importDefault(require("./routes/topicsRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const diagnosticRoutes_1 = __importDefault(require("./routes/diagnosticRoutes"));
const taskRoutes_1 = __importDefault(require("./routes/taskRoutes"));
const userWordsRoutes_1 = __importDefault(require("./routes/userWordsRoutes"));
const interactiveSessionRoutes_1 = __importDefault(require("./routes/interactiveSessionRoutes"));
const flashcardRoutes_1 = __importDefault(require("./routes/flashcardRoutes"));
const questionRoutes_1 = __importDefault(require("./routes/questionRoutes"));
// Import middleware
const errorHandler_1 = require("./middleware/errorHandler");
const db_1 = require("./lib/db");
// Load environment variables
dotenv_1.default.config();
// Create Express app
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
// Middleware
app.use((0, helmet_1.default)()); // Adds security headers
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Root route - Basic health check
app.get('/', (req, res) => {
    res.status(200).json({
        message: "Unity Voice API is running",
        status: "ok",
        timestamp: new Date().toISOString()
    });
});
// Basic health check
app.get('/health', async (req, res) => {
    try {
        // Try to get a database connection
        const dbPool = await (0, db_1.connectToDatabase)();
        const connection = await dbPool.getConnection();
        connection.release();
        res.status(200).json({
            status: 'healthy',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        // Database connection failed
        console.error('Health check detected database issue:', error);
        res.status(503).json({
            status: 'unhealthy',
            database: 'disconnected',
            error: error instanceof Error ? error.message : 'Unknown database error',
            timestamp: new Date().toISOString()
        });
    }
});
// API health check
app.get('/api/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        api: 'Unity Voice API',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});
// API Routes
app.use('/api/auth', auth_1.default);
app.use('/api/topics', topicsRoutes_1.default);
app.use('/api/user', userRoutes_1.default);
app.use('/api/diagnostics', diagnosticRoutes_1.default);
app.use('/api/tasks', taskRoutes_1.default);
app.use('/api/user-words', userWordsRoutes_1.default);
app.use('/api/interactive-sessions', interactiveSessionRoutes_1.default);
app.use('/api/flashcards', flashcardRoutes_1.default);
app.use('/api/questions', questionRoutes_1.default);
// 404 handler for unmatched routes
app.use('*', (req, res) => {
    res.status(404).json({
        message: 'Route not found',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
    });
});
// Error handling middleware (must be last)
app.use(errorHandler_1.errorHandler);
// Initialize database and start server
(0, models_1.initializeDatabase)().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 Unity Voice API server is running on port ${PORT}`);
        console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
        console.log(`📍 Available at: http://localhost:${PORT}`);
    });
}).catch(error => {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
});
exports.default = app;
