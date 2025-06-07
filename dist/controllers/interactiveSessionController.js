"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInteractiveSessionByTaskId = exports.getInteractiveSessionById = exports.createInteractiveSession = void 0;
const InteractiveSession_1 = __importDefault(require("../models/InteractiveSession"));
const Task_1 = __importDefault(require("../models/Task"));
// Create a new interactive session
const createInteractiveSession = async (req, res) => {
    try {
        const { SessionId, TaskId, SessionType } = req.body;
        console.log('Creating interactive session:', { SessionId, TaskId, SessionType });
        // Validate required fields
        if (!SessionId || !TaskId) {
            return res.status(400).json({
                success: false,
                error: 'SessionId and TaskId are required'
            });
        }
        // Check if the task exists
        const task = await Task_1.default.findById(TaskId);
        if (!task) {
            return res.status(404).json({
                success: false,
                error: 'Task not found'
            });
        }
        // Check if a session already exists for this task
        const existingSession = await InteractiveSession_1.default.findByTaskId(TaskId);
        if (existingSession) {
            console.log('Session already exists:', existingSession.SessionID);
            return res.status(200).json({
                success: true,
                message: 'Session already exists',
                SessionId: existingSession.SessionID, // שים לב לשם העמודה
                TaskId: existingSession.TaskId,
                SessionType: existingSession.SessionType
            });
        }
        // Create new session
        const sessionId = await InteractiveSession_1.default.create({
            SessionId,
            TaskId,
            SessionType: SessionType || SessionType.CONVERSATION
        });
        console.log('Interactive session created successfully:', sessionId);
        res.status(201).json({
            success: true,
            SessionId: sessionId,
            TaskId,
            SessionType: SessionType || 'conversation'
        });
    }
    catch (error) {
        console.error('Error creating interactive session:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create interactive session',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.createInteractiveSession = createInteractiveSession;
// Get an interactive session by ID
const getInteractiveSessionById = async (req, res) => {
    try {
        const { sessionId } = req.params;
        if (!sessionId) {
            return res.status(400).json({
                success: false,
                error: 'Session ID is required'
            });
        }
        const session = await InteractiveSession_1.default.findById(sessionId);
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Interactive session not found'
            });
        }
        res.status(200).json({
            success: true,
            session: {
                SessionId: session.SessionID, // המרה לפורמט צפוי
                TaskId: session.TaskId,
                SessionType: session.SessionType
            }
        });
    }
    catch (error) {
        console.error('Error retrieving interactive session:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve interactive session',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getInteractiveSessionById = getInteractiveSessionById;
// Get session by task ID
const getInteractiveSessionByTaskId = async (req, res) => {
    try {
        const { taskId } = req.params;
        if (!taskId) {
            return res.status(400).json({
                success: false,
                error: 'Task ID is required'
            });
        }
        const session = await InteractiveSession_1.default.findByTaskId(taskId);
        if (!session) {
            return res.status(404).json({
                success: false,
                error: 'Interactive session not found for this task'
            });
        }
        res.status(200).json({
            success: true,
            session: {
                SessionId: session.SessionID,
                TaskId: session.TaskId,
                SessionType: session.SessionType
            }
        });
    }
    catch (error) {
        console.error('Error retrieving interactive session by task ID:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to retrieve interactive session',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
};
exports.getInteractiveSessionByTaskId = getInteractiveSessionByTaskId;
