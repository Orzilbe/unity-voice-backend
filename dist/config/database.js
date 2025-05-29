"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const promise_1 = __importDefault(require("mysql2/promise"));
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
class DatabaseConnection {
    static createPool() {
        // Enhanced SSL configuration with more detailed logging
        const sslOptions = {
            rejectUnauthorized: process.env.NODE_ENV === 'development' ? false : true,
            // Optional: Add CA certificate if using specific SSL certificates
            // ca: fs.readFileSync(path.resolve(__dirname, './ca-certificate.pem'))
        };
        const connectionOptions = {
            host: process.env.MYSQL_HOST,
            user: process.env.MYSQL_USER,
            password: process.env.MYSQL_PASSWORD,
            database: process.env.MYSQL_DATABASE,
            port: parseInt(process.env.MYSQL_PORT || '3306'),
            ssl: sslOptions,
            // Enhanced connection pool settings
            waitForConnections: true,
            connectionLimit: 20, // Increased from 10
            queueLimit: 0,
            // Additional timeout configurations
            connectTimeout: 30000, // 30 seconds
            // Detailed connection logging
            debug: process.env.NODE_ENV === 'development' ? ['ComQueryPacket', 'RowDataPacket'] : false
        };
        console.log('DatabaseConnection: Creating pool with enhanced configuration', {
            host: connectionOptions.host,
            port: connectionOptions.port,
            database: connectionOptions.database,
            connectionLimit: connectionOptions.connectionLimit
        });
        return promise_1.default.createPool(connectionOptions);
    }
    static getPool() {
        if (!this.instance) {
            this.instance = this.createPool();
        }
        return this.instance;
    }
    static async testConnection() {
        try {
            console.time('Database Connection Test');
            const connection = await this.getPool().getConnection();
            try {
                // Comprehensive connection test
                const [rows] = await connection.query('SELECT 1');
                console.log('✅ Database Connection Successful');
                console.log('Connection details:', {
                    threadId: connection.threadId
                });
            }
            finally {
                connection.release();
            }
            console.timeEnd('Database Connection Test');
            return true;
        }
        catch (error) {
            console.error('❌ Database Connection Error:', {
                message: error instanceof Error ? error.message : 'Unknown error',
                stack: error instanceof Error ? error.stack : 'No stack trace',
                code: error.code,
                errno: error.errno
            });
            return false;
        }
    }
    // New method to get detailed connection error information
    static async getConnectionErrorDetails() {
        try {
            const pool = this.getPool();
            const connection = await pool.getConnection();
            connection.release();
            return 'Connection successful';
        }
        catch (error) {
            const errorDetails = {
                message: error instanceof Error ? error.message : 'Unknown error',
                code: error.code,
                errno: error.errno,
                sqlState: error.sqlState,
                sqlMessage: error.sqlMessage
            };
            return JSON.stringify(errorDetails, null, 2);
        }
    }
}
exports.default = DatabaseConnection;
