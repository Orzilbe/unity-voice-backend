// unity-voice-backend/src/controllers/interactiveSessionController.ts - תיקון
import { Request, Response } from 'express';
import InteractiveSession, { SessionType } from '../models/InteractiveSession';
import Task from '../models/Task';

// Create a new interactive session
export const createInteractiveSession = async (req: Request, res: Response) => {
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
    const task = await Task.findById(TaskId);
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }
    
    // Check if a session already exists for this task
    const existingSession = await InteractiveSession.findByTaskId(TaskId);
    if (existingSession) {
      console.log('Session already exists:', existingSession.SessionID);
      return res.status(200).json({
        success: true,
        message: 'Session already exists',
        SessionId: existingSession.SessionID,  // שים לב לשם העמודה
        TaskId: existingSession.TaskId,
        SessionType: existingSession.SessionType
      });
    }
    
    // Create new session
    const sessionId = await InteractiveSession.create({
      SessionId,
      TaskId,
      SessionType: (SessionType as SessionType) || SessionType.CONVERSATION
    });
    
    console.log('Interactive session created successfully:', sessionId);
    
    res.status(201).json({
      success: true,
      SessionId: sessionId,
      TaskId,
      SessionType: SessionType || 'conversation'
    });
  } catch (error) {
    console.error('Error creating interactive session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to create interactive session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get an interactive session by ID
export const getInteractiveSessionById = async (req: Request, res: Response) => {
  try {
    const { sessionId } = req.params;
    
    if (!sessionId) {
      return res.status(400).json({
        success: false,
        error: 'Session ID is required'
      });
    }
    
    const session = await InteractiveSession.findById(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Interactive session not found'
      });
    }
    
    res.status(200).json({
      success: true,
      session: {
        SessionId: session.SessionID,  // המרה לפורמט צפוי
        TaskId: session.TaskId,
        SessionType: session.SessionType
      }
    });
  } catch (error) {
    console.error('Error retrieving interactive session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve interactive session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};

// Get session by task ID
export const getInteractiveSessionByTaskId = async (req: Request, res: Response) => {
  try {
    const { taskId } = req.params;
    
    if (!taskId) {
      return res.status(400).json({
        success: false,
        error: 'Task ID is required'
      });
    }
    
    const session = await InteractiveSession.findByTaskId(taskId);
    
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
  } catch (error) {
    console.error('Error retrieving interactive session by task ID:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve interactive session',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
};