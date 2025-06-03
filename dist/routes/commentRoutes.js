"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// apps/api/src/routes/commentRoutes.ts
const express_1 = __importDefault(require("express"));
const db_1 = __importDefault(require("../models/db"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const uuid_1 = require("uuid");
const router = express_1.default.Router();
/**
 * יצירת תגובה חדשה
 * POST /api/comments
 */
router.post('/', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        console.log('Creating comment with data:', req.body);
        const { CommentID, PostID, commentContent, Feedback } = req.body;
        // בדיקת פרמטרים נדרשים
        if (!PostID) {
            return res.status(400).json({
                success: false,
                error: 'PostID is required'
            });
        }
        if (!commentContent) {
            return res.status(400).json({
                success: false,
                error: 'Comment content is required'
            });
        }
        // קבלת חיבור למסד הנתונים
        const connection = await db_1.default.getConnection();
        try {
            // בדיקה שהפוסט קיים
            const [posts] = await connection.execute('SELECT PostID FROM Posts WHERE PostID = ?', [PostID]);
            if (!Array.isArray(posts) || posts.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: `Post with ID ${PostID} not found`
                });
            }
            // יצירת מזהה לתגובה
            const commentId = CommentID || (0, uuid_1.v4)();
            console.log(`Creating new comment with ID: ${commentId}`);
            // הכנסת התגובה למסד הנתונים
            const insertSql = `
        INSERT INTO Comments (
          CommentID, 
          PostID, 
          CommentContent, 
          Feedback, 
          CreatedAt
        ) VALUES (?, ?, ?, ?, NOW())
      `;
            const [result] = await connection.execute(insertSql, [
                commentId,
                PostID,
                commentContent,
                Feedback || null
            ]);
            console.log('Comment created successfully:', result);
            return res.status(201).json({
                success: true,
                CommentID: commentId,
                PostID: PostID,
                message: 'Comment created successfully'
            });
        }
        finally {
            connection.release();
        }
    }
    catch (error) {
        console.error('Error creating comment:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
    }
});
/**
 * קבלת תגובות לפי PostID
 * GET /api/comments?postId=postId
 */
router.get('/', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const { postId, commentId } = req.query;
        console.log(`Getting comments with postId: ${postId}, commentId: ${commentId}`);
        if (!postId && !commentId) {
            return res.status(400).json({
                success: false,
                error: 'Post ID or Comment ID is required'
            });
        }
        const connection = await db_1.default.getConnection();
        try {
            if (postId) {
                // קבלת כל התגובות של הפוסט
                const [comments] = await connection.execute('SELECT * FROM Comments WHERE PostID = ? ORDER BY CreatedAt ASC', [postId]);
                console.log(`Retrieved ${comments.length} comments for postId: ${postId}`);
                return res.json(comments);
            }
            else if (commentId) {
                // קבלת תגובה בודדת לפי ID
                const [comments] = await connection.execute('SELECT * FROM Comments WHERE CommentID = ?', [commentId]);
                if (!Array.isArray(comments) || comments.length === 0) {
                    return res.status(404).json({
                        success: false,
                        error: 'Comment not found'
                    });
                }
                console.log(`Retrieved comment: ${commentId}`);
                return res.json(comments[0]);
            }
        }
        finally {
            connection.release();
        }
    }
    catch (error) {
        console.error('Error fetching comments:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
    }
});
/**
 * עדכון תגובה
 * PATCH /api/comments/:commentId
 */
router.patch('/:commentId', authMiddleware_1.authMiddleware, async (req, res) => {
    try {
        const { commentId } = req.params;
        const { commentContent, Feedback } = req.body;
        console.log(`Updating comment ${commentId} with data:`, req.body);
        if (!commentContent && Feedback === undefined) {
            return res.status(400).json({
                success: false,
                error: 'No fields to update provided'
            });
        }
        const connection = await db_1.default.getConnection();
        try {
            // בדיקה שהתגובה קיימת
            const [comments] = await connection.execute('SELECT CommentID FROM Comments WHERE CommentID = ?', [commentId]);
            if (!Array.isArray(comments) || comments.length === 0) {
                return res.status(404).json({
                    success: false,
                    error: `Comment with ID ${commentId} not found`
                });
            }
            // בניית שאילתת העדכון
            let updateSql = 'UPDATE Comments SET ';
            const updateParams = [];
            if (commentContent) {
                updateSql += 'CommentContent = ?, ';
                updateParams.push(commentContent);
            }
            if (Feedback !== undefined) {
                updateSql += 'Feedback = ?, ';
                updateParams.push(Feedback);
            }
            // הוספת UpdatedAt ותנאי WHERE
            updateSql += 'UpdatedAt = NOW() WHERE CommentID = ?';
            updateParams.push(commentId);
            // ביצוע העדכון
            const [result] = await connection.execute(updateSql, updateParams);
            if (result.affectedRows === 0) {
                return res.status(400).json({
                    success: false,
                    error: 'Comment not updated'
                });
            }
            console.log('Comment updated successfully:', result);
            return res.json({
                success: true,
                message: 'Comment updated successfully',
                commentId: commentId
            });
        }
        finally {
            connection.release();
        }
    }
    catch (error) {
        console.error('Error updating comment:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
    }
});
exports.default = router;
