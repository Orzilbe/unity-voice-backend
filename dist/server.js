"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// unity-voice-backend/src/server.ts 
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const cookie_parser_1 = __importDefault(require("cookie-parser")); // ✅ הוספה חדשה
const dotenv_1 = __importDefault(require("dotenv"));
const models_1 = require("./models");
// Import routes
const authRoutes_1 = __importDefault(require("./routes/authRoutes"));
const topicsRoutes_1 = __importDefault(require("./routes/topicsRoutes"));
const userRoutes_1 = __importDefault(require("./routes/userRoutes"));
const diagnosticRoutes_1 = __importDefault(require("./routes/diagnosticRoutes"));
const taskRoutes_1 = __importDefault(require("./routes/taskRoutes"));
const userWordsRoutes_1 = __importDefault(require("./routes/userWordsRoutes"));
const interactiveSessionRoutes_1 = __importDefault(require("./routes/interactiveSessionRoutes"));
const flashcardRoutes_1 = __importDefault(require("./routes/flashcardRoutes"));
const questionRoutes_1 = __importDefault(require("./routes/questionRoutes"));
const wordsRoutes_1 = __importDefault(require("./routes/wordsRoutes"));
const userProfileRoutes_1 = __importDefault(require("./routes/userProfileRoutes"));
const postRoutes_1 = __importDefault(require("./routes/postRoutes"));
const commentRoutes_1 = __importDefault(require("./routes/commentRoutes"));
const dashboardRoutes_1 = __importDefault(require("./routes/dashboardRoutes"));
const quizRoutes_1 = __importDefault(require("./routes/quizRoutes"));
const conversationAnalysisRoutes_1 = __importDefault(require("./routes/conversationAnalysisRoutes"));
// ✅ נסה לטעון את wordsToTaskRoutes - עם טיפול בשגיאות
let wordsToTaskRoutes = null;
try {
    wordsToTaskRoutes = require('./routes/wordsToTaskRoutes').default;
    console.log('✅ wordsToTaskRoutes loaded successfully');
}
catch (error) {
    console.error('❌ Failed to load wordsToTaskRoutes:', error);
    console.log('⚠️ Server will continue without wordsToTaskRoutes');
}
// Import middleware
const errorHandler_1 = require("./middleware/errorHandler");
const db_1 = require("./lib/db");
const feedbackRoutes_1 = __importDefault(require("./routes/feedbackRoutes"));
// Load environment variables
dotenv_1.default.config();
// Create Express app
const app = (0, express_1.default)();
const PORT = process.env.PORT || 5000;
// ✅ Middleware - סדר חשוב!
app.use((0, helmet_1.default)()); // Adds security headers
// ✅ CORS עודכן לתמיכה בcookies
app.use((0, cors_1.default)({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000', // כתובת הfrontend
    credentials: true, // ✅ חיוני לcookies!
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    exposedHeaders: ['Set-Cookie'] // ✅ חשוב לcookies
}));
// ✅ Cookie parser - חייב להיות לפני הroutes!
app.use((0, cookie_parser_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
// Root route - Basic health check
app.get('/', (req, res) => {
    res.status(200).json({
        message: "Unity Voice API is running",
        status: "ok",
        timestamp: new Date().toISOString(),
        cookieSupport: "enabled" // ✅ אינדיקטור שcookies מופעלים
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
            cookieParser: 'enabled',
            cors: 'configured for credentials',
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
        features: {
            cookieAuth: true,
            cors: true,
            helmet: true
        },
        timestamp: new Date().toISOString()
    });
});
// ✅ Debug route עם מידע על cookies
app.get('/api/debug/auth', (req, res) => {
    res.json({
        message: 'Auth Debug Information',
        headers: {
            authorization: req.headers.authorization ? 'Present' : 'Missing',
            cookie: req.headers.cookie ? 'Present' : 'Missing'
        },
        cookies: {
            available: Object.keys(req.cookies || {}),
            authToken: req.cookies?.authToken ? 'Present' : 'Missing'
        },
        corsOrigin: process.env.CORS_ORIGIN,
        timestamp: new Date().toISOString()
    });
});
// Debug route - הוסף לפני כל ה-routes כדי שיעבוד
app.get('/api/debug/routes', (req, res) => {
    const routes = [];
    // איסוף כל ה-routes הרשומים
    function extractRoutes(stack, prefix = '') {
        stack.forEach((layer) => {
            if (layer.route) {
                // Route ישיר
                const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
                routes.push(`${methods} ${prefix}${layer.route.path}`);
            }
            else if (layer.name === 'router' && layer.handle.stack) {
                // Router נוסף
                const routerPrefix = layer.regexp.source
                    .replace('^\\\/', '')
                    .replace('\\/?(?=\\\\/|$)', '')
                    .replace(/\\\//g, '/');
                extractRoutes(layer.handle.stack, prefix + '/' + routerPrefix);
            }
        });
    }
    extractRoutes(app._router.stack);
    const wordRoutes = routes.filter((route) => route.toLowerCase().includes('words'));
    res.json({
        message: 'Unity Voice API Routes Debug',
        totalRoutes: routes.length,
        routes: routes.sort(),
        wordRoutes: wordRoutes,
        wordsToTaskRoutesLoaded: !!wordsToTaskRoutes,
        conversationAnalysisRoutes: routes.filter(r => r.includes('conversation')),
        serverInfo: {
            timestamp: new Date().toISOString(),
            nodeEnv: process.env.NODE_ENV,
            port: PORT,
            cookieParserEnabled: true,
            corsCredentials: true
        }
    });
});
// API Routes - ✅ סדר נכון וללא כפילויות
app.use('/api/auth', authRoutes_1.default);
app.use('/api/topics', topicsRoutes_1.default);
app.use('/api/user', userRoutes_1.default);
app.use('/api/diagnostics', diagnosticRoutes_1.default);
app.use('/api/tasks', taskRoutes_1.default);
app.use('/api/user-words', userWordsRoutes_1.default);
app.use('/api/interactive-sessions', interactiveSessionRoutes_1.default);
app.use('/api/flashcards', flashcardRoutes_1.default);
app.use('/api/questions', questionRoutes_1.default);
app.use('/api/feedback', feedbackRoutes_1.default);
app.use('/api/quiz', quizRoutes_1.default);
// ✅ הוסף את conversation analysis routes במקום הנכון
app.use('/api/conversation-analysis', conversationAnalysisRoutes_1.default);
// ✅ Words routes - סדר חשוב! wordsToTaskRoutes לפני wordsRoutes
if (wordsToTaskRoutes) {
    console.log('📝 Registering wordsToTaskRoutes at /api/words');
    app.use('/api/words', wordsToTaskRoutes); // רק אם הקובץ קיים
}
else {
    console.log('⚠️ wordsToTaskRoutes not available - skipping registration');
}
app.use('/api/words', wordsRoutes_1.default); // ✅ רק פעם אחת!
app.use('/api/user-profile', userProfileRoutes_1.default);
app.use('/api/comments', commentRoutes_1.default);
app.use('/api/dashboard', dashboardRoutes_1.default);
app.use('/api/post', postRoutes_1.default);
// 404 handler for unmatched routes
app.use('*', (req, res) => {
    console.log(`❌ 404 - Route not found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        message: 'Route not found',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
        availableDebugInfo: 'Visit /api/debug/routes for available routes'
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
        console.log(`🔍 Debug routes at: http://localhost:${PORT}/api/debug/routes`);
        console.log(`🔐 Debug auth at: http://localhost:${PORT}/api/debug/auth`);
        console.log(`📝 wordsToTaskRoutes loaded: ${!!wordsToTaskRoutes ? 'Yes' : 'No'}`);
        console.log(`🔥 Conversation analysis routes registered`);
        console.log(`🍪 Cookie parser enabled for authentication`);
        console.log(`🌐 CORS configured for: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
    });
}).catch(error => {
    console.error('❌ Failed to initialize database:', error);
    process.exit(1);
});
exports.default = app;
