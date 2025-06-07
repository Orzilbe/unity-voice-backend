"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// unity-voice-backend/src/routes/auth.ts
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const User_2 = require("../models/User");
const validator_1 = __importDefault(require("validator"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = __importDefault(require("../config/database"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const userLevelService_1 = require("../services/userLevelService");
const router = express_1.default.Router();
// ✅ הגדרת אפשרויות cookies
const cookieOptions = {
    httpOnly: true, // לא נגיש ל-JavaScript - מונע XSS
    secure: process.env.NODE_ENV === 'production', // HTTPS בלבד בפרודקשן
    sameSite: 'strict', // מונע CSRF
    maxAge: 24 * 60 * 60 * 1000, // 24 שעות במילישניות
    path: '/' // זמין לכל המסלולים
};
router.post('/validate', authMiddleware_1.authMiddleware, (req, res) => {
    res.json({
        valid: true,
        user: req.user || null
    });
});
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const pool = database_1.default.getPool();
        const [users] = await pool.query('SELECT UserId, Email, Password FROM Users WHERE Email = ?', [email]);
        if (!users || users.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'User not found',
                details: `No user found with email: ${email}`
            });
        }
        const user = users[0];
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.Password);
        if (!isPasswordValid) {
            return res.status(401).json({
                success: false,
                message: 'Invalid password',
                details: 'The provided password does not match our records'
            });
        }
        const token = jsonwebtoken_1.default.sign({
            id: user.UserId,
            userId: user.UserId,
            email: user.Email
        }, process.env.JWT_SECRET, { expiresIn: '24h' });
        await pool.query('UPDATE Users SET LastLogin = NOW() WHERE UserId = ?', [user.UserId]);
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
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error during login',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/register', async (req, res, next) => {
    try {
        const { email, firstName, lastName, phoneNumber, password, englishLevel, ageRange } = req.body;
        const errors = [];
        if (!email || !validator_1.default.isEmail(email)) {
            errors.push({ param: 'email', msg: 'Invalid email address' });
        }
        if (!firstName || !validator_1.default.isLength(firstName, { min: 2 })) {
            errors.push({ param: 'firstName', msg: 'First name must be at least 2 characters' });
        }
        if (!lastName || !validator_1.default.isLength(lastName, { min: 2 })) {
            errors.push({ param: 'lastName', msg: 'Last name must be at least 2 characters' });
        }
        if (!password || !validator_1.default.isLength(password, { min: 8 }) ||
            !password.match(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)) {
            errors.push({ param: 'password', msg: 'Password must be at least 8 characters and include uppercase, lowercase, number, and special character' });
        }
        if (!phoneNumber || !validator_1.default.isMobilePhone(phoneNumber, 'any')) {
            errors.push({ param: 'phoneNumber', msg: 'Invalid phone number' });
        }
        if (!englishLevel || !Object.values(User_2.EnglishLevel).includes(englishLevel)) {
            errors.push({ param: 'englishLevel', msg: 'Invalid English level' });
        }
        if (!ageRange || !Object.values(User_2.AgeRange).includes(ageRange)) {
            errors.push({ param: 'ageRange', msg: 'Invalid age range' });
        }
        if (errors.length > 0) {
            return res.status(400).json({ errors });
        }
        const existingUser = await User_1.default.findByEmail(email);
        if (existingUser) {
            return res.status(409).json({ message: 'User with this email already exists' });
        }
        const userId = await User_1.default.create({
            Email: email,
            FirstName: firstName,
            LastName: lastName,
            Password: password,
            PhoneNumber: phoneNumber,
            AgeRange: ageRange,
            EnglishLevel: englishLevel,
            UserRole: User_2.UserRole.USER
        });
        await (0, userLevelService_1.initializeUserLevels)(userId);
        const token = jsonwebtoken_1.default.sign({
            id: parseInt(userId.toString()),
            userId: userId.toString(),
            email,
            role: User_2.UserRole.USER
        }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });
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
                role: User_2.UserRole.USER
            }
        });
    }
    catch (error) {
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
router.get('/register', (req, res) => {
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
        const pool = database_1.default.getPool();
        const [users] = await pool.query('SELECT UserId, Email, Password FROM Users WHERE Email = ?', [email]);
        if (!users || users.length === 0) {
            return res.status(404).json({
                message: 'User not found',
                details: `No user found with email: ${email}`
            });
        }
        const user = users[0];
        res.json({
            userId: user.UserId,
            email: user.Email,
            passwordHashLength: user.Password.length
        });
    }
    catch (error) {
        console.error('Debug user error:', error);
        res.status(500).json({
            message: 'Server error during user lookup',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
exports.default = router;
