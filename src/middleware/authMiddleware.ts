// unity-voice-backend/src/middleware/authMiddleware.ts - תיקון סופי
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { IUserRequest } from '../types/auth';

// הגדרת TokenPayload interface
interface TokenPayload {
  id?: string | number;
  userId?: string | number;
  email: string;
  role?: string;
  iat?: number;
  exp?: number;
}

export const authMiddleware = (req: IUserRequest, res: Response, next: NextFunction) => {
  console.log('🔍 Auth middleware activated for:', req.method, req.path);
  
  let token: string | undefined;
  
  // 1. נסה לקרוא מ-Authorization header קודם
  const authHeader = req.headers.authorization;
  if (authHeader) {
    if (authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
      console.log('🔑 Token found in Authorization header (with Bearer)');
    } else {
      token = authHeader;
      console.log('🔑 Token found in Authorization header (without Bearer)');
    }
  }
  
  // 2. אם אין header, נסה cookies (לפיתוח מקומי)
  if (!token && req.cookies?.authToken) {
    token = req.cookies.authToken;
    console.log('🍪 Token found in cookies');
  }
  
  // 3. אם אין באף אחד, נסה גם מ-body
  if (!token && req.body?.token) {
    token = req.body.token;
    console.log('📝 Token found in request body');
  }
  
  console.log('🔍 Auth middleware status:', {
    hasToken: !!token,
    tokenLength: token?.length || 0,
    hasAuthHeader: !!authHeader,
    hasCookies: !!req.cookies?.authToken,
    environment: process.env.NODE_ENV
  });
  
  if (!token) {
    console.log('❌ No token found anywhere');
    return res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.',
      debug: {
        hasAuthHeader: !!authHeader,
        hasCookies: !!req.cookies?.authToken,
        hasBodyToken: !!req.body?.token
      }
    });
  }
  
  try {
    const secret = process.env.JWT_SECRET;
    
    if (!secret) {
      console.error('❌ JWT_SECRET not defined');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error'
      });
    }
    
    const decoded = jwt.verify(token, secret) as TokenPayload;
    
    console.log('✅ Token verified successfully:', {
      userId: decoded.id || decoded.userId,
      email: decoded.email,
      tokenExp: decoded.exp ? new Date(decoded.exp * 1000) : 'Unknown'
    });
    
    // הוסף את המשתמש לrequest
    req.user = {
      id: decoded.id || decoded.userId,
      userId: (decoded.userId || decoded.id)?.toString(),
      email: decoded.email,
      role: decoded.role
    };
    
    next();
  } catch (error) {
    console.log('❌ Token verification failed:', error);
    
    let message = 'Invalid token';
    let statusCode = 401;
    
    if (error instanceof jwt.TokenExpiredError) {
      message = 'Token expired';
      console.log('🕐 Token expired at:', error.expiredAt);
    } else if (error instanceof jwt.JsonWebTokenError) {
      message = 'Malformed token';
    } else if (error instanceof jwt.NotBeforeError) {
      message = 'Token not active yet';
    } else {
      message = 'Authentication failed';
      statusCode = 500;
    }
    
    return res.status(statusCode).json({
      success: false,
      message,
      debug: {
        errorType: error.constructor.name,
        hasJwtSecret: !!process.env.JWT_SECRET
      }
    });
  }
};

// Export עם השם שהקבצים החדשים מצפים לו
export const authenticateToken = authMiddleware;