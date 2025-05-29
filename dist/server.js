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
const app_1 = __importDefault(require("./app"));
const models_1 = require("./models");
// Import routes
const auth_1 = __importDefault(require("./routes/auth"));
const topicsRoutes_1 = __importDefault(require("./routes/topicsRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const diagnosticRoutes_1 = __importDefault(require("./routes/diagnosticRoutes"));
const taskRoutes_1 = __importDefault(require("./routes/taskRoutes")); // הוספת הראוטר החדש
// Import middleware
const errorHandler_1 = require("./middleware/errorHandler");
const db_1 = require("./lib/db");
// Load environment variables
dotenv_1.default.config();
const PORT = process.env.PORT || 3001;
// Middleware
app_1.default.use((0, helmet_1.default)()); // Adds security headers
app_1.default.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app_1.default.use(express_1.default.json());
app_1.default.use(express_1.default.urlencoded({ extended: true }));
// Routes
app_1.default.use('/api/auth', auth_1.default);
app_1.default.use('/api/topics', topicsRoutes_1.default);
app_1.default.use('/api/user', userRoutes_1.default);
app_1.default.use('/api/diagnostics', diagnosticRoutes_1.default);
app_1.default.use('/api/tasks', taskRoutes_1.default); // הוספת הנתיב החדש
// Enhanced health check with basic database status
app_1.default.get('/health', async (req, res) => {
    try {
        // Try to get a database connection
        const dbPool = await (0, db_1.connectToDatabase)();
        const connection = await dbPool.getConnection();
        connection.release();
        res.status(200).json({
            status: 'OK',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        // Database connection failed
        console.error('Health check detected database issue:', error);
        res.status(200).json({
            status: 'DEGRADED',
            database: 'disconnected',
            error: error instanceof Error ? error.message : 'Unknown database error',
            timestamp: new Date().toISOString()
        });
    }
});
// Error handling middleware (must be last)
app_1.default.use(errorHandler_1.errorHandler);
// Initialize database and start server
(0, models_1.initializeDatabase)().then(() => {
    app_1.default.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
    });
}).catch(error => {
    console.error('Failed to initialize database:', error);
    process.exit(1);
});
