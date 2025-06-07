"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getQuestionsBySessionId = exports.updateQuestion = exports.createQuestion = void 0;
const Question_1 = __importDefault(require("../models/Question"));
const InteractiveSession_1 = __importDefault(require("../models/InteractiveSession"));
// Create a new question
const createQuestion = async (req, res) => {
    try {
        const { QuestionId, SessionId, QuestionText } = req.body;
        // Validate required fields
        if (!QuestionId || !SessionId || !QuestionText) {
            return res.status(400).json({
                success: false,
                error: 'QuestionId, SessionId, and QuestionText are required'
            });
        }
        // Check if the session exists
        const session = await InteractiveSession_1.default.findById(SessionId);
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Interactive session not found'
            });
        }
        // Create new question
        const questionId = await Question_1.default.create({
            QuestionId,
            SessionId,
            QuestionText
        });
        res.status(201).json({
            success: true,
            QuestionId: questionId,
            SessionId,
            QuestionText
        });
    }
    catch (error) {
        console.error('Error creating question:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create question',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.createQuestion = createQuestion;
// Update a question with answer and feedback
const updateQuestion = async (req, res) => {
    try {
        const { questionId } = req.params;
        const { AnswerText, Feedback } = req.body;
        // Validate required fields
        if (!questionId) {
            return res.status(400).json({
                success: false,
                error: 'Question ID is required'
            });
        }
        if (!AnswerText && !Feedback) {
            return res.status(400).json({
                success: false,
                error: 'At least one update field (AnswerText or Feedback) is required'
            });
        }
        // Check if the question exists
        const question = await Question_1.default.findById(questionId);
        if (!question) {
            return res.status(404).json({
                success: false,
                error: 'Question not found'
            });
        }
        // Update the question
        const updateData = {};
        if (AnswerText !== undefined) {
            updateData.AnswerText = AnswerText;
        }
        if (Feedback !== undefined) {
            updateData.Feedback = Feedback;
        }
        const updated = await Question_1.default.update(questionId, updateData);
        if (!updated) {
            return res.status(500).json({
                success: false,
                error: 'Failed to update question'
            });
        }
        res.status(200).json({
            success: true,
            QuestionId: questionId,
            ...updateData
        });
    }
    catch (error) {
        console.error('Error updating question:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update question',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.updateQuestion = updateQuestion;
// Get all questions for a session
const getQuestionsBySessionId = async (req, res) => {
    try {
        const { sessionId } = req.params;
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Session ID is required'
            });
        }
        // Check if the session exists
        const session = await InteractiveSession_1.default.findById(sessionId);
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Interactive session not found'
            });
        }
        // Get all questions for the session
        const questions = await Question_1.default.findBySessionId(sessionId);
        res.status(200).json({
            success: true,
            questions
        });
    }
    catch (error) {
        console.error('Error retrieving questions:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve questions',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getQuestionsBySessionId = getQuestionsBySessionId;
