"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// apps/api/src/index.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const db_1 = require("./lib/db");
const errorHandler_1 = require("./middleware/errorHandler");
const userRoutes_1 = __importDefault(require("./routes/userRoutes")); // If this exists
const taskRoutes_1 = __importDefault(require("./routes/taskRoutes")); // If this exists
const interactiveSessionRoutes_1 = __importDefault(require("./routes/interactiveSessionRoutes"));
const questionRoutes_1 = __importDefault(require("./routes/questionRoutes"));
async function startServer() {
    try {
        // Connect to database before starting the server
        await (0, db_1.connectToDatabase)();
        const app = (0, express_1.default)();
        // Middleware
        app.use((0, cors_1.default)());
        app.use(express_1.default.json());
        // Routes
        // Only include routes that exist in your codebase
        if (typeof userRoutes_1.default === 'function') {
            app.use('/api/users', userRoutes_1.default);
        }
        if (typeof taskRoutes_1.default === 'function') {
            app.use('/api/tasks', taskRoutes_1.default);
        }
        // Add the new routes for interactive sessions
        app.use('/api/interactive-session', interactiveSessionRoutes_1.default);
        app.use('/api/question', questionRoutes_1.default);
        // Error handling middleware
        app.use(errorHandler_1.errorHandler);
        // Root route
        app.get('/', (req, res) => {
            res.send('English Speaking Practice API is running');
        });
        const PORT = process.env.PORT;
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT}`);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
