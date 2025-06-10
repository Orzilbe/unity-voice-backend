"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserRole = exports.AgeRange = exports.EnglishLevel = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const validator_1 = __importDefault(require("validator"));
const crypto_1 = __importDefault(require("crypto"));
const database_1 = __importDefault(require("../config/database")); // תיקון: השתמש ב-DatabaseConnection
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
    AgeRange["AGE_55_64"] = "55-64";
    AgeRange["AGE_65_PLUS"] = "65+";
})(AgeRange || (exports.AgeRange = AgeRange = {}));
var UserRole;
(function (UserRole) {
    UserRole["USER"] = "user";
    UserRole["ADMIN"] = "admin";
})(UserRole || (exports.UserRole = UserRole = {}));
class User {
    static validateUserInput(userData) {
        if (userData.Email && !validator_1.default.isEmail(userData.Email)) {
            throw new Error('Invalid email address');
        }
        if (userData.PhoneNumber && !validator_1.default.isMobilePhone(userData.PhoneNumber, 'any')) {
            throw new Error('Invalid phone number');
        }
        if (userData.Password && !validator_1.default.isStrongPassword(userData.Password, {
            minLength: 8,
            minLowercase: 1,
            minUppercase: 1,
            minNumbers: 1,
            minSymbols: 1
        })) {
            throw new Error('Password does not meet strength requirements');
        }
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
    static generateUserId() {
        const timestamp = Date.now().toString(36);
        const randomPart = crypto_1.default.randomBytes(4).toString('hex');
        return `usr_${timestamp}_${randomPart}`;
    }
    // Find user by ID
    static async findById(userId) {
        try {
            const pool = database_1.default.getPool();
            const [rows] = await pool.execute('SELECT * FROM Users WHERE UserId = ? AND IsActive = 1', [userId]);
            return rows.length ? rows[0] : null;
        }
        catch (error) {
            console.error('❌ Error finding user by ID:', error);
            throw error;
        }
    }
    // Find user by email
    static async findByEmail(email) {
        try {
            const pool = database_1.default.getPool();
            const [rows] = await pool.execute('SELECT * FROM Users WHERE Email = ? AND IsActive = 1', [email]);
            return rows.length ? rows[0] : null;
        }
        catch (error) {
            console.error('❌ Error finding user by email:', error);
            throw error;
        }
    }
    // Create a new user
    static async create(userData) {
        try {
            console.log('📝 Starting user creation for:', userData.Email);
            // בדיקת validation
            this.validateUserInput(userData);
            // Hash password
            const salt = await bcryptjs_1.default.genSalt(12); // הגדלתי ל-12 לבטחון טוב יותר
            const hashedPassword = await bcryptjs_1.default.hash(userData.Password, salt);
            // Generate unique ID
            const userId = this.generateUserId();
            // Set defaults
            const userRole = userData.UserRole || UserRole.USER;
            const creationDate = new Date();
            console.log('📝 Creating user with ID:', userId);
            const pool = database_1.default.getPool();
            // בדיקה שהשדות תואמים למבנה הטבלה
            const [result] = await pool.execute(`INSERT INTO Users 
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
            console.log('✅ User creation result:', {
                userId,
                affectedRows: result.affectedRows,
                insertId: result.insertId
            });
            if (result.affectedRows !== 1) {
                throw new Error('Failed to create user - no rows affected');
            }
            console.log('✅ User created successfully:', userId);
            return userId;
        }
        catch (error) {
            console.error('❌ Detailed error in user creation:', error);
            // טיפול בשגיאות SQL ספציפיות
            if (error instanceof Error) {
                if ('code' in error) {
                    const sqlError = error;
                    switch (sqlError.code) {
                        case 'ER_DUP_ENTRY':
                            throw new Error('User with this email already exists');
                        case 'ER_NO_SUCH_TABLE':
                            throw new Error('Database table not found');
                        case 'ER_BAD_FIELD_ERROR':
                            throw new Error('Database column mismatch');
                        case 'ER_DATA_TOO_LONG':
                            throw new Error('One or more fields exceed maximum length');
                        default:
                            console.error('Unknown SQL error:', sqlError);
                    }
                }
            }
            throw error;
        }
    }
    // Update password
    static async updatePassword(userId, newPassword) {
        try {
            // Validate password
            if (!validator_1.default.isStrongPassword(newPassword, {
                minLength: 8,
                minLowercase: 1,
                minUppercase: 1,
                minNumbers: 1,
                minSymbols: 1
            })) {
                throw new Error('New password does not meet strength requirements');
            }
            const salt = await bcryptjs_1.default.genSalt(12);
            const hashedPassword = await bcryptjs_1.default.hash(newPassword, salt);
            const pool = database_1.default.getPool();
            const [result] = await pool.execute('UPDATE Users SET Password = ? WHERE UserId = ? AND IsActive = 1', [hashedPassword, userId]);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('❌ Error updating password:', error);
            throw error;
        }
    }
    // Update last login
    static async updateLastLogin(userId) {
        try {
            const pool = database_1.default.getPool();
            const [result] = await pool.execute('UPDATE Users SET LastLogin = NOW() WHERE UserId = ? AND IsActive = 1', [userId]);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('❌ Error updating last login:', error);
            throw error;
        }
    }
    // Compare password for authentication
    static async comparePassword(user, candidatePassword) {
        try {
            return await bcryptjs_1.default.compare(candidatePassword, user.Password);
        }
        catch (error) {
            console.error('❌ Error comparing password:', error);
            throw error;
        }
    }
    // Soft delete user
    static async delete(userId) {
        try {
            const pool = database_1.default.getPool();
            const [result] = await pool.execute('UPDATE Users SET IsActive = false WHERE UserId = ?', [userId]);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('❌ Error deleting user:', error);
            throw error;
        }
    }
    // Helper method to get user stats
    static async getUserStats(userId) {
        try {
            const pool = database_1.default.getPool();
            const [stats] = await pool.execute(`SELECT 
          u.Score,
          u.CreationDate,
          COUNT(DISTINCT s.SessionId) as totalSessions,
          COUNT(DISTINCT t.TaskId) as completedTasks
         FROM Users u
         LEFT JOIN Sessions s ON u.UserId = s.UserId
         LEFT JOIN Tasks t ON u.UserId = t.UserId AND t.CompletionDate IS NOT NULL
         WHERE u.UserId = ? AND u.IsActive = 1
         GROUP BY u.UserId`, [userId]);
            return stats[0] || null;
        }
        catch (error) {
            console.error('❌ Error getting user stats:', error);
            throw error;
        }
    }
}
exports.default = User;
