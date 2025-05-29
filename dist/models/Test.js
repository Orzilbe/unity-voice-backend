"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.TestType = void 0;
const db_1 = __importDefault(require("./db"));
var TestType;
(function (TestType) {
    TestType["PLACEMENT"] = "placement";
    TestType["TOPIC"] = "topic";
    TestType["LEVEL"] = "level";
})(TestType || (exports.TestType = TestType = {}));
class Test {
    // Find test by ID
    static async findById(testId) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM Tests WHERE TestId = ?', [testId]);
            return rows.length ? rows[0] : null;
        }
        catch (error) {
            console.error('Error finding test by ID:', error);
            throw error;
        }
    }
    // Find tests by user ID
    static async findByUser(userId) {
        try {
            const [rows] = await db_1.default.execute('SELECT * FROM Tests WHERE UserId = ? ORDER BY CreatedAt DESC', [userId]);
            return rows;
        }
        catch (error) {
            console.error('Error finding tests by user:', error);
            throw error;
        }
    }
    // Create a new test
    static async create(testData) {
        try {
            const [result] = await db_1.default.execute(`INSERT INTO Tests 
         (TestId, UserId, TestScore, TestType, DurationTest, CreatedAt, UpdatedAt)
         VALUES (?, ?, ?, ?, ?, NOW(), NOW())`, [
                testData.TestId,
                testData.UserId,
                testData.TestScore,
                testData.TestType,
                testData.DurationTest || null
            ]);
            if (result.affectedRows !== 1) {
                throw new Error('Failed to create test');
            }
            return testData.TestId;
        }
        catch (error) {
            console.error('Error creating test:', error);
            throw error;
        }
    }
    // Complete test
    static async completeTest(testId, score, duration) {
        try {
            const [result] = await db_1.default.execute(`UPDATE Tests 
         SET TestScore = ?, CompletionDate = NOW(), DurationTest = ?, UpdatedAt = NOW() 
         WHERE TestId = ?`, [score, duration || null, testId]);
            return result.affectedRows > 0;
        }
        catch (error) {
            console.error('Error completing test:', error);
            throw error;
        }
    }
}
exports.default = Test;
