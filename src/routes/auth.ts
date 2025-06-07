// unity-voice-backend/src/routes/auth.ts
import express, { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { UserRole, AgeRange, EnglishLevel } from '../models/User';
import validator from 'validator';
import bcrypt from 'bcryptjs';
import DatabaseConnection from '../config/database';
import { authMiddleware } from '../middleware/authMiddleware';
import { initializeUserLevels } from '../services/userLevelService';
import { IUserRequest } from '../types/auth';

const router = express.Router();

// ✅ הגדרת אפשרויות cookies
const cookieOptions = {
  httpOnly: true, // לא נגיש ל-JavaScript - מונע XSS
  secure: process.env.NODE_ENV === 'production', // HTTPS בלבד בפרודקשן
  sameSite: 'strict' as const, // מונע CSRF
  maxAge: 24 * 60 * 60 * 1000, // 24 שעות במילישניות
  path: '/' // זמין לכל המסלולים
};

router.post('/validate', authMiddleware, (req: IUserRequest, res) => {
  res.json({ 
    valid: true, 
    user: req.user || null
  });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const pool = DatabaseConnection.getPool();
    
    const [users] = await pool.query(
      'SELECT UserId, Email, Password FROM Users WHERE Email = ?', 
      [email]
    );

    if (!users || (users as any[]).length === 0) {
      return res.status(401).json({ 
        success: false,
        message: 'User not found',
        details: `No user found with email: ${email}`
      });
    }

    const user = (users as any[])[0];

    const isPasswordValid = await bcrypt.compare(password, user.Password);

    if (!isPasswordValid) {
      return res.status(401).json({ 
        success: false,
        message: 'Invalid password',
        details: 'The provided password does not match our records'
      });
    }

    const token = jwt.sign(
      { 
        id: user.UserId,
        userId: user.UserId,
        email: user.Email 
      }, 
      process.env.JWT_SECRET!, 
      { expiresIn: '24h' }
    );

    await pool.query(
      'UPDATE Users SET LastLogin = NOW() WHERE UserId = ?', 
      [user.UserId]
    );

    // ✅ הגדרת cookie במקום החזרת טוקן בגוף התגובה
    res.cookie('authToken', token, cookieOptions);

    // ✅ החזרת תגובה ללא טוקן
    res.json({
      success: true,
      user: {
        id: user.UserId,
        userId: user.UserId,
        email: user.Email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during login',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      email,
      firstName,
      lastName,
      phoneNumber,
      password,
      englishLevel,
      ageRange
    } = req.body;

    const errors = [];
    
    if (!email || !validator.isEmail(email)) {
      errors.push({ param: 'email', msg: 'Invalid email address' });
    }
    
    if (!firstName || !validator.isLength(firstName, { min: 2 })) {
      errors.push({ param: 'firstName', msg: 'First name must be at least 2 characters' });
    }
    
    if (!lastName || !validator.isLength(lastName, { min: 2 })) {
      errors.push({ param: 'lastName', msg: 'Last name must be at least 2 characters' });
    }
    
    if (!password || !validator.isLength(password, { min: 8 }) || 
        !password.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)) {
      errors.push({ param: 'password', msg: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character' });
    }
    
    if (!phoneNumber || !validator.isMobilePhone(phoneNumber, 'any')) {
      errors.push({ param: 'phoneNumber', msg: 'Invalid phone number' });
    }
    
    if (!englishLevel || !Object.values(EnglishLevel).includes(englishLevel as EnglishLevel)) {
      errors.push({ param: 'englishLevel', msg: 'Invalid English level' });
    }
    
    if (!ageRange || !Object.values(AgeRange).includes(ageRange as AgeRange)) {
      errors.push({ param: 'ageRange', msg: 'Invalid age range' });
    }
    
    if (errors.length > 0) {
      return res.status(400).json({ errors });
    }

    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({ message: 'User with this email already exists' });
    }

    const userId = await User.create({
      Email: email,
      FirstName: firstName,
      LastName: lastName,
      Password: password,
      PhoneNumber: phoneNumber,
      AgeRange: ageRange,
      EnglishLevel: englishLevel,
      UserRole: UserRole.USER
    });

    await initializeUserLevels(userId);

    const token = jwt.sign(
      { 
        id: parseInt(userId.toString()),
        userId: userId.toString(),
        email,
        role: UserRole.USER
      }, 
      process.env.JWT_SECRET || 'fallback_secret', 
      { expiresIn: '7d' }
    );

    // ✅ הגדרת cookie במקום החזרת טוקן בגוף התגובה
    res.cookie('authToken', token, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ימים לרישום
    });

    return res.status(201).json({ 
      success: true,
      message: 'User registered successfully', 
      user: {
        id: userId,
        userId: userId.toString(),
        email,
        firstName,
        lastName,
        englishLevel,
        role: UserRole.USER
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    next(error);
  }
});

// ✅ נתיב logout חדש
router.post('/logout', (req, res) => {
  // מחיקת ה-cookie
  res.clearCookie('authToken', { 
    path: '/',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  });
  
  res.json({ 
    success: true,
    message: 'Logged out successfully' 
  });
});

router.get('/register', (req: Request, res: Response) => {
  res.status(405).json({
    message: 'Method not allowed',
    details: 'Registration requires a POST request with user data. GET requests are not supported for registration.',
    expectedMethod: 'POST',
    expectedBody: {
      email: 'string',
      firstName: 'string',
      lastName: 'string',
      phoneNumber: 'string',
      password: 'string',
      englishLevel: 'beginner|intermediate|advanced',
      ageRange: 'string'
    }
  });
});

router.get('/debug-user', async (req, res) => {
  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const pool = DatabaseConnection.getPool();
    
    const [users] = await pool.query(
      'SELECT UserId, Email, Password FROM Users WHERE Email = ?', 
      [email as string]
    );

    if (!users || (users as any[]).length === 0) {
      return res.status(404).json({ 
        message: 'User not found',
        details: `No user found with email: ${email}`
      });
    }

    const user = (users as any[])[0];

    res.json({
      userId: user.UserId,
      email: user.Email,
      passwordHashLength: user.Password.length
    });
  } catch (error) {
    console.error('Debug user error:', error);
    res.status(500).json({ 
      message: 'Server error during user lookup',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;