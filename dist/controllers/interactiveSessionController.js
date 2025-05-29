"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getInteractiveSessionById = exports.createInteractiveSession = void 0;
const InteractiveSession_1 = __importDefault(require("../models/InteractiveSession"));
const Task_1 = __importDefault(require("../models/Task"));
// Create a new interactive session
const createInteractiveSession = async (req, res) => {
    try {
        const { SessionId, TaskId, SessionType } = req.body;
        // Validate required fields
        if (!SessionId || !TaskId || !SessionType) {
            return res.status(400).json({
                success: false,
                error: 'SessionId, TaskId, and SessionType are required'
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
            return res.status(200).json({
                success: true,
                message: 'Session already exists',
                SessionId: existingSession.SessionId,
                TaskId: existingSession.TaskId,
                SessionType: existingSession.SessionType
            });
        }
        // Create new session
        const sessionId = await InteractiveSession_1.default.create({
            SessionId,
            TaskId,
            SessionType: SessionType
        });
        res.status(201).json({
            success: true,
            SessionId: sessionId,
            TaskId,
            SessionType
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
            session
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
