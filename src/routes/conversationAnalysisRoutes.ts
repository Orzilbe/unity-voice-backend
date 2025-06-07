//unity-voice-backend/src/routes/conversationAnalysisRoutes.ts
import express from 'express';
import * as conversationAnalysisController from '../controllers/conversationAnalysisController';
import { authMiddleware } from '../middleware/authMiddleware';

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Analyze conversation response
router.get('/test', (req, res) => {
    res.json({ message: 'Conversation analysis route is working!' });
  });
router.post('/analyze', conversationAnalysisController.analyzeConversationResponse as any);

export default router;