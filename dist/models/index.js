"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.closeDatabase = exports.initializeDatabase = exports.WordInTask = exports.UserInLevel = exports.Test = exports.Question = exports.InteractiveSession = exports.Comment = exports.Post = exports.Word = exports.Task = exports.Level = exports.Topic = exports.User = exports.pool = void 0;
// apps/api/src/models/index.ts
const db_1 = __importDefault(require("./db"));
exports.pool = db_1.default;
const User_1 = __importDefault(require("./User"));
exports.User = User_1.default;
const Topic_1 = __importDefault(require("./Topic"));
exports.Topic = Topic_1.default;
const Level_1 = __importDefault(require("./Level"));
exports.Level = Level_1.default;
const Task_1 = __importDefault(require("./Task"));
exports.Task = Task_1.default;
const Word_1 = __importDefault(require("./Word"));
exports.Word = Word_1.default;
const Post_1 = __importDefault(require("./Post"));
exports.Post = Post_1.default;
const Comment_1 = __importDefault(require("./Comment"));
exports.Comment = Comment_1.default;
const InteractiveSession_1 = __importDefault(require("./InteractiveSession"));
exports.InteractiveSession = InteractiveSession_1.default;
const Question_1 = __importDefault(require("./Question"));
exports.Question = Question_1.default;
const Test_1 = __importDefault(require("./Test"));
exports.Test = Test_1.default;
const UserInLevel_1 = __importDefault(require("./UserInLevel"));
exports.UserInLevel = UserInLevel_1.default;
const WordInTask_1 = __importDefault(require("./WordInTask"));
exports.WordInTask = WordInTask_1.default;
const migrations_1 = __importDefault(require("./migrations"));
// Initialize essential data at startup
const initializeDatabase = async () => {
    try {
        console.log('Initializing database...');
        // Run migrations first
        await (0, migrations_1.default)();
        console.log('Database migrations completed.');
        // Initialize topics
        await Topic_1.default.initializeTopics();
        console.log('Topics initialized.');
        console.log('Database initialization complete.');
    }
    catch (error) {
        console.error('Error initializing database:', error);
    }
};
exports.initializeDatabase = initializeDatabase;
// Close the database connection when the application shuts down
const closeDatabase = async () => {
    try {
        await db_1.default.end();
        console.log('Database connection closed.');
    }
    catch (error) {
        console.error('Error closing database connection:', error);
    }
};
exports.closeDatabase = closeDatabase;
