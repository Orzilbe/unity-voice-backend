"use strict";
// unity-voice-backend/src/routes/postRoutes.ts
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// ================================================================
// 📁 unity-voice-backend/src/routes/postRoutes.ts - FIXED VERSION
// ================================================================
const express_1 = __importDefault(require("express"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const postGenerationService_1 = require("../services/postGenerationService");
const Task_1 = __importDefault(require("../models/Task"));
const router = express_1.default.Router();
/**
 * 🎯 Get post task data - GET /:taskId
 * Main endpoint for getting post content for a task
 */
router.get('/:taskId', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user?.id || req.user?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        console.log(`🎯 Getting post data for taskId: ${taskId}, userId: ${userId}`);
        // Get task details
        const task = await Task_1.default.findById(taskId);
        if (!task) {
            return res.status(404).json({
                error: 'Task not found',
                message: 'No task found for the given ID'
            });
        }
        // Verify task belongs to user
        if (task.UserId !== userId) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'Task does not belong to the current user'
            });
        }
        // Verify it's a post task
        if (task.TaskType !== 'post') {
            return res.status(400).json({
                error: 'Invalid task type',
                message: 'This endpoint is only for post tasks'
            });
        }
        console.log(`✅ Task verified: ${task.TopicName}, Level: ${task.Level}`);
        // Get or generate post for this task
        const postResult = await (0, postGenerationService_1.getPostForTask)(taskId, userId, task.TopicName, await getUserEnglishLevel(userId));
        console.log(`📄 Post result: ${postResult.source}, PostID: ${postResult.postId}`);
        return res.json({
            success: true,
            taskId: task.TaskId,
            postData: {
                PostID: postResult.postId,
                PostContent: postResult.postContent,
                Picture: postResult.picture,
                RequiredWords: postResult.requiredWords
            },
            topicName: task.TopicName,
            level: task.Level,
            meta: {
                source: postResult.source,
                isNewlyGenerated: postResult.isNewlyGenerated
            }
        });
    }
    catch (error) {
        console.error('❌ Error getting post task:', error);
        return res.status(500).json({
            error: 'Failed to get post task',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * 🔄 Force regenerate post for task - POST /regenerate/:taskId
 * Force create a new post even if one exists
 */
router.post('/regenerate/:taskId', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        const userId = req.user?.id || req.user?.userId;
        if (!userId) {
            return res.status(401).json({ error: 'User not authenticated' });
        }
        console.log(`🔄 Force regenerating post for taskId: ${taskId}`);
        // Get task details
        const task = await Task_1.default.findById(taskId);
        if (!task) {
            return res.status(404).json({ error: 'Task not found' });
        }
        // Verify task belongs to user
        if (task.UserId !== userId) {
            return res.status(403).json({ error: 'Access denied' });
        }
        // Verify it's a post task
        if (task.TaskType !== 'post') {
            return res.status(400).json({ error: 'This endpoint is only for post tasks' });
        }
        // 🔥 FIXED: Use the specific clearPostLink method
        const cleared = await Task_1.default.clearPostLink(taskId);
        if (!cleared) {
            console.warn(`⚠️ Failed to clear post link for task ${taskId}, but continuing...`);
        }
        // Generate new post
        const postResult = await (0, postGenerationService_1.getPostForTask)(taskId, userId, task.TopicName, await getUserEnglishLevel(userId));
        console.log(`🆕 Generated new post: ${postResult.postId}`);
        return res.json({
            success: true,
            message: 'Post regenerated successfully',
            taskId: task.TaskId,
            postData: {
                PostID: postResult.postId,
                PostContent: postResult.postContent,
                Picture: postResult.picture,
                RequiredWords: postResult.requiredWords
            },
            meta: {
                source: postResult.source,
                isNewlyGenerated: true
            }
        });
    }
    catch (error) {
        console.error('❌ Error regenerating post:', error);
        return res.status(500).json({
            error: 'Failed to regenerate post',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
/**
 * 🔍 Get post statistics - GET /stats/:userId
 * Get statistics about user's post interactions
 */
router.get('/stats/:userId', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { userId: targetUserId } = req.params;
        const currentUserId = req.user?.id || req.user?.userId;
        // Users can only see their own stats (or admins can see all)
        if (currentUserId !== targetUserId && req.user?.role !== 'admin') {
            return res.status(403).json({ error: 'Access denied' });
        }
        const pool = require('../config/database').default.getPool();
        // Get post task statistics
        const [statsResult] = await pool.execute(`
      SELECT 
        COUNT(*) as total_post_tasks,
        COUNT(t.PostID) as tasks_with_posts,
        COUNT(t.CompletionDate) as completed_tasks,
        AVG(t.TaskScore) as avg_score,
        COUNT(DISTINCT t.TopicName) as topics_attempted
      FROM tasks t
      WHERE t.UserId = ? AND t.TaskType = 'post'
    `, [targetUserId]);
        // Get topic breakdown
        const [topicStats] = await pool.execute(`
      SELECT 
        t.TopicName,
        COUNT(*) as task_count,
        COUNT(t.CompletionDate) as completed_count,
        AVG(t.TaskScore) as avg_score
      FROM tasks t
      WHERE t.UserId = ? AND t.TaskType = 'post'
      GROUP BY t.TopicName
      ORDER BY task_count DESC
    `, [targetUserId]);
        const stats = statsResult[0];
        const topics = topicStats;
        return res.json({
            success: true,
            userId: targetUserId,
            stats: {
                totalPostTasks: stats.total_post_tasks || 0,
                tasksWithPosts: stats.tasks_with_posts || 0,
                completedTasks: stats.completed_tasks || 0,
                averageScore: Math.round(stats.avg_score || 0),
                topicsAttempted: stats.topics_attempted || 0,
                completionRate: stats.total_post_tasks > 0
                    ? Math.round((stats.completed_tasks / stats.total_post_tasks) * 100)
                    : 0
            },
            topicBreakdown: topics.map(topic => ({
                topicName: topic.TopicName,
                taskCount: topic.task_count,
                completedCount: topic.completed_count,
                averageScore: Math.round(topic.avg_score || 0),
                completionRate: topic.task_count > 0
                    ? Math.round((topic.completed_count / topic.task_count) * 100)
                    : 0
            }))
        });
    }
    catch (error) {
        console.error('❌ Error getting post stats:', error);
        return res.status(500).json({
            error: 'Failed to get post statistics',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
// ================================================================
// Helper Functions
// ================================================================
async function getUserEnglishLevel(userId) {
    try {
        const pool = require('../config/database').default.getPool();
        const [result] = await pool.execute('SELECT EnglishLevel FROM users WHERE UserId = ?', [userId]);
        return result[0]?.EnglishLevel || 'intermediate';
    }
    catch (error) {
        console.error('Error fetching user English level:', error);
        return 'intermediate';
    }
}
exports.default = router;
