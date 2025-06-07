"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = exports.authMiddleware = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const errorHandler_1 = require("./errorHandler");
const authMiddleware = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
        return next(new errorHandler_1.AppError('No token provided', 401));
    }
    const [bearer, token] = authHeader.split(' ');
    if (bearer !== 'Bearer' || !token) {
        return next(new errorHandler_1.AppError('Invalid token format', 401));
    }
    try {
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            throw new Error('JWT secret is not defined');
        }
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        // Ensure we have userId in the request for the new APIs
        req.user = {
            ...decoded,
            userId: decoded.userId || decoded.id?.toString() || decoded.email
        };
        next();
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            return next(new errorHandler_1.AppError('Token expired', 401));
        }
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
            return next(new errorHandler_1.AppError('Invalid token', 401));
        }
        return next(new errorHandler_1.AppError('Authentication failed', 500));
    }
};
exports.authMiddleware = authMiddleware;
// Export with the name that the new route files expect
exports.authenticateToken = exports.authMiddleware;
