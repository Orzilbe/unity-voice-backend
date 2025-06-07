// unity-voice-backend/src/middleware/authMiddleware.ts - תיקון סופי
import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';
import { TokenPayload, IUserRequest } from '../types/auth';

export const authMiddleware = (req: IUserRequest, res: Response, next: NextFunction) => {
  let token: string | undefined;
  
  // ✅ 1. נסה לקרוא מ-Authorization header קודם (לproduction)
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
    console.log('🔑 Token found in Authorization header');
  }
  
  // ✅ 2. אם אין header, נסה cookies (לפיתוח מקומי)
  if (!token && req.cookies?.authToken) {
    token = req.cookies.authToken;
    console.log('🍪 Token found in cookies');
  }
  
  // ✅ 3. אם אין באף אחד, נסה גם מ-body (לvalidate endpoint)
  if (!token && req.body?.token) {
    token = req.body.token;
    console.log('📝 Token found in request body');
  }
  
  console.log('🔍 Auth middleware - checking token:', {
    hasCookies: !!req.cookies,
    hasAuthToken: !!token,
    cookieKeys: req.cookies ? Object.keys(req.cookies) : [],
    hasAuthHeader: !!req.headers.authorization,
    hasBodyToken: !!req.body?.token,
    environment: process.env.NODE_ENV
  });
  
  if (!token) {
    console.log('❌ No token found in Authorization header, cookies, or body');
    return next(new AppError('No token provided', 401));
  }
  
  try {
    const secret = process.env.JWT_SECRET;
    
    if (!secret) {
      throw new Error('JWT secret is not defined');
    }
    
    const decoded = jwt.verify(token, secret) as TokenPayload;
    
    console.log('✅ Token verified successfully:', {
      userId: decoded.id || decoded.userId,
      email: decoded.email
    });
    
    // Ensure we have userId in the request for the new APIs
    req.user = {
      ...decoded,
      userId: decoded.userId || decoded.id?.toString() || decoded.email
    };
    
    next();
  } catch (error) {
    console.log('❌ Token verification failed:', error);
    
    if (error instanceof jwt.TokenExpiredError) {
      return next(new AppError('Token expired', 401));
    }
    if (error instanceof jwt.JsonWebTokenError) {
      return next(new AppError('Invalid token', 401));
    }
    return next(new AppError('Authentication failed', 500));
  }
};

// Export with the name that the new route files expect
export const authenticateToken = authMiddleware;
