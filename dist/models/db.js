"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// apps/api/src/models/db.ts (או היכן שנמצא קובץ החיבור לבסיס הנתונים)
const promise_1 = __importDefault(require("mysql2/promise"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
// נתיב יחסי לקובץ התעודה
const sslCertPath = path_1.default.join(__dirname, '../config/DigiCertGlobalRootCA.crt.pem');
// הגדר אפשרויות SSL
const sslOptions = process.env.MYSQL_SSL === 'true' ? {
    rejectUnauthorized: false
} : undefined;
// יצירת מאגר חיבורים
const pool = promise_1.default.createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: parseInt(process.env.MYSQL_PORT || '3306'),
    ssl: sslOptions,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});
console.log('Database pool created with the following configuration:');
console.log(`Host: ${process.env.MYSQL_HOST}`);
console.log(`User: ${process.env.MYSQL_USER}`);
console.log(`Database: ${process.env.MYSQL_DATABASE}`);
console.log(`SSL enabled: ${process.env.MYSQL_SSL === 'true' ? 'Yes' : 'No'}`);
exports.default = pool;
