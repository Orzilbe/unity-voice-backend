"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRole = exports.AgeRange = exports.EnglishLevel = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const validator_1 = __importDefault(require("validator"));
const crypto_1 = __importDefault(require("crypto"));
const db_1 = __importDefault(require("./db"));
var EnglishLevel;
(function (EnglishLevel) {
    EnglishLevel["BEGINNER"] = "beginner";
    EnglishLevel["INTERMEDIATE"] = "intermediate";
    EnglishLevel["ADVANCED"] = "advanced";
})(EnglishLevel || (exports.EnglishLevel = EnglishLevel = {}));
var AgeRange;
(function (AgeRange) {
    AgeRange["AGE_0_17"] = "0-17";
    AgeRange["AGE_18_24"] = "18-24";
    AgeRange["AGE_25_34"] = "25-34";
    AgeRange["AGE_35_44"] = "35-44";
    AgeRange["AGE_45_54"] = "45-54";
    AgeRange["AGE_55_PLUS"] = "55+";
})(AgeRange || (exports.AgeRange = AgeRange = {}));
var UserRole;
(function (UserRole) {
    UserRole["USER"] = "user";
    UserRole["ADMIN"] = "admin";
})(UserRole || (exports.UserRole = UserRole = {}));
class User {
    static validateUserInput(userData) {
        // Email validation
        if (userData.Email && !validator_1.default.isEmail(userData.Email)) {
            throw new Error('Invalid email address');
        }
        // Phone number validation (optional, adjust regex as needed)
        if (userData.PhoneNumber && !validator_1.default.isMobilePhone(userData.PhoneNumber, 'any')) {
            throw new Error('Invalid phone number');
        }
        // Password strength validation (when creating/updating password)
        if (userData.Password && !validator_1.default.isStrongPassword(userData.Password, {
            minLength: 8,
            minLowercase: 1,
            minUppercase: 1,
            minNumbers: 1,
            minSymbols: 1
        })) {
            throw new Error('Password does not meet strength requirements');
        }
        // Validate enum values
        if (userData.UserRole && !Object.values(UserRole).includes(userData.UserRole)) {
            throw new Error('Invalid user role');
        }
        if (userData.AgeRange && !Object.values(AgeRange).includes(userData.AgeRange)) {
            throw new Error('Invalid age range');
        }
        if (userData.EnglishLevel && !Object.values(EnglishLevel).includes(userData.EnglishLevel)) {
            throw new Error('Invalid English level');
        }
    }
    // Generate a more robust unique user ID
    static generateUserId() {
        return `usr_${Date.now().toString(36)}_${crypto_1.default.randomUUID().slice(0, 8)}`;
    }
    // Find user by ID
    static async findById(userId) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM Users WHERE UserId = ?', [userId]);
            return rows.length ? rows[0] : null;
        }
        catch (error) {
            console.error('Error finding user by ID:', error);
            throw error;
        }
    }
    // Find user by email
    static async findByEmail(email) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM Users WHERE Email = ?', [email]);
            return rows.length ? rows[0] : null;
        }
        catch (error) {
            console.error('Error finding user by email:', error);
            throw error;
        }
    }
    // Create a new user
    // Create a new user
    static async create(userData) {
        try {
            console.log('Starting user creation with data:', {
                ...userData,
                Password: '***HIDDEN***' // מסתיר את הסיסמה מהלוג
            });
            // Hash password
            const salt = await bcryptjs_1.default.genSalt(10);
            const hashedPassword = await bcryptjs_1.default.hash(userData.Password, salt);
            // Generate unique ID for user
            const userId = this.generateUserId(); // השתמש בפונקציה הקיימת
            // Set default values
            const userRole = userData.UserRole || UserRole.USER;
            const creationDate = new Date();
            console.log('Executing SQL query for user creation');
            console.log('UserId:', userId);
            // בדוק את המבנה המדויק של הטבלה - ללא שדה Badge
            const [result] = await db_1.default.execute(`INSERT INTO Users 
       (UserId, Email, FirstName, LastName, Password, PhoneNumber, AgeRange, 
        EnglishLevel, ProfilePicture, Score, CreationDate, UserRole, IsActive)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
                userId,
                userData.Email,
                userData.FirstName,
                userData.LastName,
                hashedPassword,
                userData.PhoneNumber,
                userData.AgeRange,
                userData.EnglishLevel,
                userData.ProfilePicture || null,
                0, // Initial score
                creationDate,
                userRole,
                true // IsActive
            ]);
            console.log('SQL execution result:', result);
            if (result.affectedRows !== 1) {
                throw new Error('Failed to create user');
            }
            return userId;
        }
        catch (error) {
            console.error('Detailed error in user creation:', error);
            // פירוט נוסף על השגיאה
            if (error instanceof Error) {
                console.error('Error name:', error.name);
                console.error('Error message:', error.message);
                if ('code' in error) {
                    console.error('SQL error code:', error.code);
                }
                if ('errno' in error) {
                    console.error('SQL error number:', error.errno);
                }
                if ('sqlMessage' in error) {
                    console.error('SQL message:', error.sqlMessage);
                }
            }
            throw error;
        }
    }
    // Update password
    static async updatePassword(userId, newPassword) {
        try {
            const salt = await bcryptjs_1.default.genSalt(10);
            const hashedPassword = await bcryptjs_1.default.hash(newPassword, salt);
            const [result] = await db_1.default.execute('UPDATE Users SET Password = ? WHERE UserId = ?', [hashedPassword, userId]);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('Error updating password:', error);
            throw error;
        }
    }
    // Update last login
    static async updateLastLogin(userId) {
        try {
            const [result] = await db_1.default.execute('UPDATE Users SET LastLogin = NOW() WHERE UserId = ?', [userId]);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('Error updating last login:', error);
            throw error;
        }
    }
    // Compare password for authentication
    static async comparePassword(user, candidatePassword) {
        try {
            return await bcryptjs_1.default.compare(candidatePassword, user.Password);
        }
        catch (error) {
            console.error('Error comparing password:', error);
            throw error;
        }
    }
    // Delete user (soft delete)
    static async delete(userId) {
        try {
            const [result] = await db_1.default.execute('UPDATE Users SET IsActive = false WHERE UserId = ?', [userId]);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('Error deleting user:', error);
            throw error;
        }
    }
}
exports.default = User;
