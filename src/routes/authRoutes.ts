// unity-voice-backend/src/routes/authRoutes.ts - תיקון בעיות
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
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production', // true רק לproduction
  sameSite: 'lax' as const,
  maxAge: 24 * 60 * 60 * 1000,
  path: '/',
};

// ✅ Token validation endpoint - ללא authMiddleware!
router.post('/validate', async (req, res) => {
  console.log('🔍 Token validation request received');
  
  try {
    let token = req.headers.authorization;
    if (token && token.startsWith('Bearer ')) {
      token = token.substring(7); // הסר "Bearer "
    }
    
    if (!token && req.body.token) {
      token = req.body.token;
    }
    
    if (!token && req.cookies?.authToken) {
      token = req.cookies.authToken;
    }
    
    console.log('🔍 Token found:', token ? 'Yes' : 'No');
    
    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ 
        success: false,
        valid: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    
    console.log('✅ Token validation successful:', { 
      userId: decoded.userId || decoded.id,
      email: decoded.email
    });
    
    res.json({ 
      success: true,
      valid: true,
      user: {
        id: decoded.id || decoded.userId,
        userId: decoded.userId || decoded.id,
        email: decoded.email
      }
    });
  } catch (error) {
    console.error('❌ Token validation failed:', error);
    
    let errorMessage = 'Invalid token';
    if (error instanceof jwt.TokenExpiredError) {
      errorMessage = 'Token expired';
    } else if (error instanceof jwt.JsonWebTokenError) {
      errorMessage = 'Malformed token';
    }
    
    res.status(401).json({ 
      success: false,
      valid: false,
      message: errorMessage
    });
  }
});

// ✅ Login endpoint - תיקון הטיפול בשגיאות
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    console.log('🔐 Login attempt for:', email);
    
    // בדיקת קלט בסיסית
    if (!email || !password) {
      return res.status(400).json({ 
        success: false,
        message: 'Email and password are required'
      });
    }

    const pool = DatabaseConnection.getPool();
    
    const [users] = await pool.query(
      'SELECT UserId, Email, Password FROM Users WHERE Email = ? AND IsActive = 1', 
      [email]
    );

    if (!users || (users as any[]).length === 0) {
      console.log('❌ User not found:', email);
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password'
      });
    }

    const user = (users as any[])[0];
    console.log('✅ User found:', user.UserId);

    const isPasswordValid = await bcrypt.compare(password, user.Password);

    if (!isPasswordValid) {
      console.log('❌ Invalid password for:', email);
      return res.status(401).json({ 
        success: false,
        message: 'Invalid email or password'
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

    // עדכון זמן התחברות אחרון
    await pool.query(
      'UPDATE Users SET LastLogin = NOW() WHERE UserId = ?', 
      [user.UserId]
    );

    console.log('✅ Login successful:', {
      email: user.Email,
      userId: user.UserId
    });
    
    // הגדרת cookie בפיתוח
    if (process.env.NODE_ENV === 'development') {
      res.cookie('authToken', token, cookieOptions);
    }

    res.json({
      success: true,
      token: token,
      user: {
        id: user.UserId,
        userId: user.UserId,
        email: user.Email
      },
      message: 'Login successful'
    });
  } catch (error) {
    console.error('❌ Login error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error during login'
    });
  }
});

// ✅ Registration endpoint - הוסרנו authMiddleware והוספנו בדיקות validation
router.post('/register', async (req: Request, res: Response) => {
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

    console.log('📝 Registration attempt for:', email);

    // בדיקת שדות נדרשים
    const requiredFields = ['email', 'firstName', 'lastName', 'phoneNumber', 'password', 'englishLevel', 'ageRange'];
    const missingFields = requiredFields.filter(field => !req.body[field]);
    
    if (missingFields.length > 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Missing required fields',
        missingFields
      });
    }

    // Validation
    const errors = [];
    
    if (!validator.isEmail(email)) {
      errors.push({ param: 'email', msg: 'Invalid email address' });
    }
    
    if (!validator.isLength(firstName, { min: 2 })) {
      errors.push({ param: 'firstName', msg: 'First name must be at least 2 characters' });
    }
    
    if (!validator.isLength(lastName, { min: 2 })) {
      errors.push({ param: 'lastName', msg: 'Last name must be at least 2 characters' });
    }
    
    // בדיקת סיסמה מחמירה יותר
    if (!password || password.length < 8) {
      errors.push({ param: 'password', msg: 'Password must be at least 8 characters' });
    } else if (!password.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)) {
      errors.push({ param: 'password', msg: 'Password must include uppercase, lowercase, number, and special character' });
    }
    
    if (!validator.isMobilePhone(phoneNumber, 'any')) {
      errors.push({ param: 'phoneNumber', msg: 'Invalid phone number' });
    }
    
    if (!Object.values(EnglishLevel).includes(englishLevel as EnglishLevel)) {
      errors.push({ param: 'englishLevel', msg: 'Invalid English level' });
    }
    
    if (!Object.values(AgeRange).includes(ageRange as AgeRange)) {
      errors.push({ param: 'ageRange', msg: 'Invalid age range' });
    }
    
    if (errors.length > 0) {
      console.log('❌ Validation errors:', errors);
      return res.status(400).json({ 
        success: false,
        message: 'Validation failed',
        errors 
      });
    }

    // בדיקה שהמשתמש לא קיים כבר
    const existingUser = await User.findByEmail(email);
    if (existingUser) {
      console.log('❌ User already exists:', email);
      return res.status(409).json({ 
        success: false,
        message: 'User with this email already exists' 
      });
    }

    console.log('📝 Creating new user...');
    
    // יצירת משתמש חדש
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

    console.log('✅ User created successfully:', userId);

    // אתחול רמות המשתמש
    try {
      await initializeUserLevels(userId);
      console.log('✅ User levels initialized');
    } catch (levelError) {
      console.warn('⚠️ Warning: Failed to initialize user levels:', levelError);
      // לא נעצור את התהליך בגלל זה
    }

    // יצירת JWT token
    const token = jwt.sign(
      { 
        id: userId,
        userId: userId,
        email,
        role: UserRole.USER
      }, 
      process.env.JWT_SECRET!, 
      { expiresIn: '7d' }
    );

    console.log('✅ Registration successful for:', email);

    // הגדרת cookie בפיתוח
    if (process.env.NODE_ENV === 'development') {
      res.cookie('authToken', token, {
        ...cookieOptions,
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ימים
      });
    }

    return res.status(201).json({ 
      success: true,
      message: 'User registered successfully',
      token: token,
      user: {
        id: userId,
        userId: userId,
        email,
        firstName,
        lastName,
        englishLevel,
        role: UserRole.USER
      }
    });
  } catch (error) {
    console.error('❌ Registration error:', error);
    
    // בדיקה אם זו שגיאת DB
    if (error instanceof Error) {
      if (error.message.includes('Duplicate entry')) {
        return res.status(409).json({
          success: false,
          message: 'User with this email already exists'
        });
      }
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Server error during registration'
    });
  }
});

// ✅ Logout endpoint
router.post('/logout', (req, res) => {
  console.log('🚪 Logout requested');
  
  if (process.env.NODE_ENV === 'development') {
    res.clearCookie('authToken', { 
      path: '/',
      httpOnly: true,
      secure: false,
      sameSite: 'lax'
    });
  }
  
  res.json({ 
    success: true,
    message: 'Logged out successfully' 
  });
});

// ✅ Debug endpoint - עם הגנה נוספת
router.get('/debug-user', async (req, res) => {
  // רק בפיתוח
  if (process.env.NODE_ENV !== 'development') {
    return res.status(404).json({ message: 'Not found' });
  }

  const { email } = req.query;

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    console.log('🔍 Debug user lookup for:', email);
    
    const pool = DatabaseConnection.getPool();
    
    const [users] = await pool.query(
      'SELECT UserId, Email, FirstName, LastName, CreationDate, IsActive FROM Users WHERE Email = ?', 
      [email as string]
    );

    if (!users || (users as any[]).length === 0) {
      return res.status(404).json({ 
        message: 'User not found',
        email: email
      });
    }

    const user = (users as any[])[0];

    res.json({
      userId: user.UserId,
      email: user.Email,
      name: `${user.FirstName} ${user.LastName}`,
      creationDate: user.CreationDate,
      isActive: user.IsActive
    });
  } catch (error) {
    console.error('❌ Debug user error:', error);
    res.status(500).json({ 
      message: 'Server error during user lookup'
    });
  }
});

export default router;