"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// unity-voice-backend/src/routes/authRoutes.ts
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const User_2 = require("../models/User");
const validator_1 = __importDefault(require("validator"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = __importDefault(require("../config/database"));
const userLevelService_1 = require("../services/userLevelService");
const router = express_1.default.Router();
// ✅ הגדרת אפשרויות cookies לפיתוח מקומי בלבד
const cookieOptions = {
    httpOnly: true,
    secure: false, // false לפיתוח מקומי
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000,
    path: '/',
};
// ✅ תיקון validate endpoint עם debug מתקדם
router.post('/validate', async (req, res) => {
    console.log('🔍 Raw Authorization header:', req.headers.authorization);
    console.log('🔍 All headers:', Object.keys(req.headers));
    console.log('🔍 Body:', req.body);
    console.log('🔍 Cookies:', req.cookies);
    try {
        console.log('🔍 Token validation request received');
        console.log('📋 Headers:', JSON.stringify(req.headers, null, 2));
        console.log('📋 Body:', JSON.stringify(req.body, null, 2));
        console.log('🍪 Cookies:', JSON.stringify(req.cookies, null, 2));
        // קבל טוכן מה-header או מה-body
        let token = req.headers.authorization;
        if (token) {
            // אם יש Bearer, הסר אותו. אם אין, השאר כמו שזה
            token = token.replace(/^Bearer\s+/i, '');
        }
        if (!token && req.body.token) {
            token = req.body.token;
            console.log('📝 Token found in request body');
        }
        // 🆕 גם ננסה לחפש בcookies
        if (!token && req.cookies?.authToken) {
            token = req.cookies.authToken;
            console.log('🍪 Token found in cookies');
        }
        console.log('🔍 Token found:', token ? 'Yes' : 'No');
        console.log('🔍 Token preview:', token ? token.substring(0, 20) + '...' : 'None');
        if (!token) {
            console.log('❌ No token provided');
            return res.status(401).json({
                success: false,
                valid: false,
                message: 'No token provided',
                debug: {
                    hasAuthHeader: !!req.headers.authorization,
                    hasBodyToken: !!req.body.token,
                    hasCookieToken: !!req.cookies?.authToken,
                    cookieKeys: req.cookies ? Object.keys(req.cookies) : [],
                    headerKeys: Object.keys(req.headers)
                }
            });
        }
        // בדוק את הטוקן
        const decoded = jsonwebtoken_1.default.verify(token, process.env.JWT_SECRET);
        console.log('✅ Token validation successful:', {
            userId: decoded.userId || decoded.id,
            email: decoded.email,
            tokenType: typeof decoded
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
    }
    catch (error) {
        console.error('❌ Token validation failed:', error);
        res.status(401).json({
            success: false,
            valid: false,
            message: 'Invalid token',
            debug: {
                errorType: error instanceof Error ? error.name : 'Unknown',
                errorMessage: error instanceof Error ? error.message : 'Unknown error',
                hasJwtSecret: !!process.env.JWT_SECRET
            }
        });
    }
});
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        console.log('🔐 Login attempt for:', email);
        const pool = database_1.default.getPool();
        const [users] = await pool.query('SELECT UserId, Email, Password FROM Users WHERE Email = ?', [email]);
        if (!users || users.length === 0) {
            console.log('❌ User not found:', email);
            return res.status(401).json({
                success: false,
                message: 'User not found',
                details: `No user found with email: ${email}`
            });
        }
        const user = users[0];
        console.log('✅ User found:', user.UserId);
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.Password);
        if (!isPasswordValid) {
            console.log('❌ Invalid password for:', email);
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
        console.log('🍪 Login successful:', {
            email: user.Email,
            userId: user.UserId,
            environment: process.env.NODE_ENV,
            tokenLength: token.length,
            tokenPreview: token.substring(0, 20) + '...'
        });
        // ✅ גישה היברידית: cookies לפיתוח + token לproduction
        if (process.env.NODE_ENV === 'development') {
            // פיתוח מקומי - השתמש בcookies
            res.cookie('authToken', token, cookieOptions);
            console.log('🍪 Cookie set for development');
        }
        // ✅ תמיד החזר גם token לfrontend (לproduction)
        res.json({
            success: true,
            token: token, // ✅ החזרנו את זה לproduction
            user: {
                id: user.UserId,
                userId: user.UserId,
                email: user.Email
            },
            cookieSet: process.env.NODE_ENV === 'development',
            message: 'Login successful'
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
        console.log('📝 Registration attempt for:', email);
        // Validation
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
            console.log('❌ Validation errors:', errors);
            return res.status(400).json({ errors });
        }
        const existingUser = await User_1.default.findByEmail(email);
        if (existingUser) {
            console.log('❌ User already exists:', email);
            return res.status(409).json({
                success: false,
                message: 'User with this email already exists'
            });
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
        console.log('✅ User created:', userId);
        await (0, userLevelService_1.initializeUserLevels)(userId);
        const token = jsonwebtoken_1.default.sign({
            id: parseInt(userId.toString()),
            userId: userId.toString(),
            email,
            role: User_2.UserRole.USER
        }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });
        console.log('🍪 Registration successful:', {
            email,
            userId,
            environment: process.env.NODE_ENV,
            tokenPreview: token.substring(0, 20) + '...'
        });
        // ✅ גישה היברידית: cookies לפיתוח + token לproduction
        if (process.env.NODE_ENV === 'development') {
            res.cookie('authToken', token, {
                ...cookieOptions,
                maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ימים
            });
            console.log('🍪 Cookie set for development registration');
        }
        return res.status(201).json({
            success: true,
            message: 'User registered successfully',
            token: token, // ✅ החזרנו את זה לproduction
            user: {
                id: userId,
                userId: userId.toString(),
                email,
                firstName,
                lastName,
                englishLevel,
                role: User_2.UserRole.USER
            },
            cookieSet: process.env.NODE_ENV === 'development'
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        next(error);
    }
});
router.post('/logout', (req, res) => {
    console.log('🚪 Logout requested');
    // מחיקת cookie אם זה פיתוח מקומי
    if (process.env.NODE_ENV === 'development') {
        res.clearCookie('authToken', {
            path: '/',
            httpOnly: true,
            secure: false,
            sameSite: 'lax'
        });
        console.log('🍪 Cookie cleared for development');
    }
    res.json({
        success: true,
        message: 'Logged out successfully'
    });
});
router.get('/register', (req, res) => {
    res.status(405).json({
        message: 'Method not allowed',
        details: 'Registration requires a POST request with user data.',
        expectedMethod: 'POST'
    });
});
router.get('/debug-user', async (req, res) => {
    const { email } = req.query;
    if (!email) {
        return res.status(400).json({ message: 'Email is required' });
    }
    try {
        console.log('🔍 Debug user lookup for:', email);
        const pool = database_1.default.getPool();
        const [users] = await pool.query('SELECT UserId, Email, Password FROM Users WHERE Email = ?', [email]);
        if (!users || users.length === 0) {
            console.log('❌ Debug: User not found:', email);
            return res.status(404).json({
                message: 'User not found',
                details: `No user found with email: ${email}`
            });
        }
        const user = users[0];
        console.log('✅ Debug: User found:', user.UserId);
        res.json({
            userId: user.UserId,
            email: user.Email,
            passwordHashLength: user.Password.length,
            passwordHashPreview: user.Password.substring(0, 10) + '...'
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
