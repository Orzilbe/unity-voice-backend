"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const User_1 = __importDefault(require("../models/User"));
const User_2 = require("../models/User");
const validator_1 = __importDefault(require("validator"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = __importDefault(require("../config/database"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const userLevelService_1 = require("../services/userLevelService");
// Create router
const router = express_1.default.Router();
router.post('/validate', authMiddleware_1.authMiddleware, (req, res) => {
    // If the middleware passes, the token is valid
    res.json({
        valid: true,
        user: req.user || null
    });
});
router.post('/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        const pool = database_1.default.getPool();
        // Find user by email
        const [users] = await pool.query('SELECT UserId, Email, Password FROM Users WHERE Email = ?', [email]);
        // Check if user exists
        if (!users || users.length === 0) {
            return res.status(401).json({
                message: 'User not found',
                details: `No user found with email: ${email}`
            });
        }
        const user = users[0];
        // Verify password
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.Password);
        if (!isPasswordValid) {
            return res.status(401).json({
                message: 'Invalid password',
                details: 'The provided password does not match our records'
            });
        }
        // Generate JWT token
        const token = jsonwebtoken_1.default.sign({
            id: user.UserId,
            email: user.Email
        }, process.env.JWT_SECRET, { expiresIn: '24h' });
        // Update last login
        await pool.query('UPDATE Users SET LastLogin = NOW() WHERE UserId = ?', [user.UserId]);
        res.json({
            token,
            user: {
                id: user.UserId,
                email: user.Email
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            message: 'Server error during login',
            details: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/register', async (req, res, next) => {
    try {
        const { email, firstName, lastName, phoneNumber, password, englishLevel, ageRange } = req.body;
        // Manual validation
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
        // Check if user already exists
        const existingUser = await User_1.default.findByEmail(email);
        if (existingUser) {
            return res.status(409).json({ message: 'User with this email already exists' });
        }
        // Create user
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
        // Initialize user levels across all topics
        await (0, userLevelService_1.initializeUserLevels)(userId);
        // Generate JWT token
        const token = jsonwebtoken_1.default.sign({
            userId,
            email,
            role: User_2.UserRole.USER
        }, process.env.JWT_SECRET || 'fallback_secret', { expiresIn: '7d' });
        return res.status(201).json({
            message: 'User registered successfully',
            token,
            user: {
                userId,
                email,
                firstName,
                lastName,
                englishLevel
            }
        });
    }
    catch (error) {
        console.error('Registration error:', error);
        next(error);
    }
});
// Add GET handler for register endpoint to provide helpful error message
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
