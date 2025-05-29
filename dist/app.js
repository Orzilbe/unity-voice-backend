"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const taskRoutes_1 = __importDefault(require("./routes/taskRoutes"));
const userWordsRoutes_1 = __importDefault(require("./routes/userWordsRoutes"));
const app = (0, express_1.default)();
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Register routes
app.use('/api/tasks', taskRoutes_1.default);
app.use('/api/user-words', userWordsRoutes_1.default);
exports.default = app;
