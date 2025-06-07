// unity-voice-backend/src/server.ts 
import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser'; // ✅ הוספה חדשה
import dotenv from 'dotenv';
import { initializeDatabase } from './models';

// Import routes
import authRoutes from './routes/authRoutes';
import topicsRoutes from './routes/topicsRoutes';
import userRoutes from './routes/userRoutes';
import diagnosticRoutes from './routes/diagnosticRoutes';
import taskRoutes from './routes/taskRoutes';
import userWordsRoutes from './routes/userWordsRoutes';
import interactiveSessionRoutes from './routes/interactiveSessionRoutes';
import flashcardRoutes from './routes/flashcardRoutes';
import questionRoutes from './routes/questionRoutes';
import wordsRoutes from './routes/wordsRoutes';
import userProfileRoutes from './routes/userProfileRoutes';
import postRoutes from './routes/postRoutes';
import commentRoutes from './routes/commentRoutes';
import dashboardRoutes from './routes/dashboardRoutes';
import quizRoutes from './routes/quizRoutes';
import conversationAnalysisRoutes from './routes/conversationAnalysisRoutes';

// ✅ נסה לטעון את wordsToTaskRoutes - עם טיפול בשגיאות
let wordsToTaskRoutes: any = null;
try {
  wordsToTaskRoutes = require('./routes/wordsToTaskRoutes').default;
  console.log('✅ wordsToTaskRoutes loaded successfully');
} catch (error) {
  console.error('❌ Failed to load wordsToTaskRoutes:', error);
  console.log('⚠️ Server will continue without wordsToTaskRoutes');
}

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { connectToDatabase } from './lib/db';
import feedbackRoutes from './routes/feedbackRoutes';

// Load environment variables
dotenv.config();

// Create Express app
const app = express();
const PORT = process.env.PORT || 5000;

// ✅ Middleware - סדר חשוב!
app.use(helmet()); // Adds security headers

// ✅ CORS עודכן לתמיכה בcookies
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000', // כתובת הfrontend
  credentials: true, // ✅ חיוני לcookies!
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Set-Cookie'] // ✅ חשוב לcookies
}));

// ✅ Cookie parser - חייב להיות לפני הroutes!
app.use(cookieParser());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Root route - Basic health check
app.get('/', (req: Request, res: Response) => {
  res.status(200).json({ 
    message: "Unity Voice API is running", 
    status: "ok",
    timestamp: new Date().toISOString(),
    cookieSupport: "enabled" // ✅ אינדיקטור שcookies מופעלים
  });
});

// Basic health check
app.get('/health', async (req: Request, res: Response) => {
  try {
    // Try to get a database connection
    const dbPool = await connectToDatabase();
    const connection = await dbPool.getConnection();
    connection.release();
    
    res.status(200).json({ 
      status: 'healthy',
      database: 'connected',
      cookieParser: 'enabled',
      cors: 'configured for credentials',
      timestamp: new Date().toISOString() 
    });
  } catch (error) {
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
app.get('/api/health', (req: Request, res: Response) => {
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
app.get('/api/debug/auth', (req: Request, res: Response) => {
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
app.get('/api/debug/routes', (req: Request, res: Response) => {
  const routes: string[] = [];
  
  // איסוף כל ה-routes הרשומים
  function extractRoutes(stack: any[], prefix = '') {
    stack.forEach((layer: any) => {
      if (layer.route) {
        // Route ישיר
        const methods = Object.keys(layer.route.methods).join(', ').toUpperCase();
        routes.push(`${methods} ${prefix}${layer.route.path}`);
      } else if (layer.name === 'router' && layer.handle.stack) {
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
  
  const wordRoutes = routes.filter((route: string) => 
    route.toLowerCase().includes('words')
  );
  
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
app.use('/api/auth', authRoutes);
app.use('/api/topics', topicsRoutes);
app.use('/api/user', userRoutes);
app.use('/api/diagnostics', diagnosticRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/user-words', userWordsRoutes);
app.use('/api/interactive-sessions', interactiveSessionRoutes);
app.use('/api/flashcards', flashcardRoutes);
app.use('/api/questions', questionRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/quiz', quizRoutes);

// ✅ הוסף את conversation analysis routes במקום הנכון
app.use('/api/conversation-analysis', conversationAnalysisRoutes);

// ✅ Words routes - סדר חשוב! wordsToTaskRoutes לפני wordsRoutes
if (wordsToTaskRoutes) {
  console.log('📝 Registering wordsToTaskRoutes at /api/words');
  app.use('/api/words', wordsToTaskRoutes); // רק אם הקובץ קיים
} else {
  console.log('⚠️ wordsToTaskRoutes not available - skipping registration');
}

app.use('/api/words', wordsRoutes); // ✅ רק פעם אחת!
app.use('/api/user-profile', userProfileRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/post', postRoutes);

// 404 handler for unmatched routes
app.use('*', (req: Request, res: Response) => {
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
app.use(errorHandler);

// Initialize database and start server
initializeDatabase().then(() => {
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

export default app;