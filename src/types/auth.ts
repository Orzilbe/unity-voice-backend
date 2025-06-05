// unity-voice-backend/src/types/auth.ts
import { Request } from 'express';

export interface TokenPayload {
  id: number;           
  userId?: string;      
  email: string;        
  role?: string;        
  iat?: number;         
  exp?: number;         
}

export interface IUserRequest extends Request {
  user?: TokenPayload;
}

export type AuthenticatedRequest = IUserRequest;