"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectToDatabase = connectToDatabase;
exports.getDbPool = getDbPool;
exports.getSafeDbPool = getSafeDbPool;
exports.diagnoseDbConnection = diagnoseDbConnection;
exports.generateDbDiagnosticReport = generateDbDiagnosticReport;
// apps/api/src/lib/db.ts
const promise_1 = __importDefault(require("mysql2/promise"));
const database_1 = __importDefault(require("../config/database"));
const util_1 = require("util");
const dns_1 = __importDefault(require("dns"));
const net_1 = __importDefault(require("net"));
// Global variable to hold the connection pool
let pool = null;
// Counter for connection attempts
let connectionAttempts = 0;
const MAX_CONNECTION_ATTEMPTS = 3;
// Helper to safely get database configuration
function getDbConfigOptions() {
    // Get connection options via reflection or from environment variables
    const connectionOptions = {
        host: process.env.MYSQL_HOST,
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD,
        database: process.env.MYSQL_DATABASE,
        port: parseInt(process.env.MYSQL_PORT || '3306'),
        ssl: process.env.MYSQL_SSL === 'true' ? {
            rejectUnauthorized: process.env.NODE_ENV === 'development' ? false : true
        } : undefined,
        // Add connection retry logic
        connectTimeout: 10000, // 10 seconds
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
    };
    return connectionOptions;
}
/**
 * Connect to the database with retry logic
 */
async function connectToDatabase() {
    // If pool already exists, return it
    if (pool) {
        return pool;
    }
    try {
        connectionAttempts++;
        const options = getDbConfigOptions();
        console.log(`[${new Date().toISOString()}] Attempting to connect to MySQL database (attempt ${connectionAttempts}/${MAX_CONNECTION_ATTEMPTS}) with config:`, {
            host: options.host,
            user: options.user,
            database: options.database,
            port: options.port,
            ssl: !!options.ssl
        });
        // Create pool and store it in global variable
        pool = promise_1.default.createPool(options);
        // Test the connection to verify it works
        const connection = await pool.getConnection();
        console.log(`[${new Date().toISOString()}] Successfully connected to MySQL database`);
        connection.release();
        // Reset connection attempts counter after successful connection
        connectionAttempts = 0;
        return pool;
    }
    catch (error) {
        console.error(`[${new Date().toISOString()}] Failed to connect to MySQL database:`, error);
        // If we haven't reached the maximum number of attempts, try again after a delay
        if (connectionAttempts < MAX_CONNECTION_ATTEMPTS) {
            console.log(`Retrying database connection in 3 seconds...`);
            await new Promise(resolve => setTimeout(resolve, 3000));
            return connectToDatabase();
        }
        // Reset connection attempts counter if we've reached the maximum
        connectionAttempts = 0;
        throw error;
    }
}
/**
 * Get database pool with proper initialization check and auto-connection
 */
async function getDbPool() {
    if (!pool) {
        try {
            // Try to establish connection if not already connected
            return await connectToDatabase();
        }
        catch (error) {
            console.error('Failed to establish database connection:', error);
            throw new Error('Database connection could not be established');
        }
    }
    return pool;
}
/**
 * Safe version of getDbPool that doesn't throw if connection fails
 * Returns null instead, allowing the caller to implement fallbacks
 */
async function getSafeDbPool() {
    try {
        return await getDbPool();
    }
    catch (error) {
        console.error('Database connection failed, returning null:', error);
        return null;
    }
}
/**
 * Test if host is reachable via DNS lookup and socket connection
 */
async function testHostConnection(host) {
    if (!host)
        return false;
    try {
        console.log(`Testing connection to host: ${host}`);
        // If host is an IP address, test direct connection
        if (net_1.default.isIP(host)) {
            const socket = new net_1.default.Socket();
            const port = parseInt(process.env.MYSQL_PORT || '3306');
            const connectPromise = new Promise((resolve) => {
                socket.connect(port, host, () => {
                    console.log(`Socket connected to ${host}:${port}`);
                    socket.end();
                    resolve(true);
                });
                socket.on('error', (err) => {
                    console.error(`Socket connection error: ${err.message}`);
                    resolve(false);
                });
            });
            return await connectPromise;
        }
        // If hostname, try DNS lookup first
        const lookup = (0, util_1.promisify)(dns_1.default.lookup);
        const result = await lookup(host);
        console.log(`DNS lookup resolved ${host} to ${result.address}`);
        return true;
    }
    catch (error) {
        console.error(`Host connection test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return false;
    }
}
/**
 * Test if credentials are valid by attempting a minimal connection
 */
async function testCredentials() {
    try {
        const options = getDbConfigOptions();
        const tempPool = promise_1.default.createPool({
            host: options.host,
            user: options.user,
            password: options.password,
            port: options.port,
            ssl: undefined, // No SSL for basic credential test
            connectTimeout: 5000 // Short timeout
        });
        const connection = await tempPool.getConnection();
        console.log('Credentials test: Valid login credentials');
        connection.release();
        await tempPool.end();
        return true;
    }
    catch (error) {
        console.error(`Credentials test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return false;
    }
}
/**
 * Test if SSL configuration is correct
 */
async function testSSLConfiguration() {
    const options = getDbConfigOptions();
    if (!options.ssl) {
        console.log('SSL configuration test: SSL not enabled');
        return true; // Not using SSL is valid if not required
    }
    try {
        const tempPool = promise_1.default.createPool({
            host: options.host,
            user: options.user,
            password: options.password,
            port: options.port,
            ssl: options.ssl,
            connectTimeout: 5000
        });
        const connection = await tempPool.getConnection();
        console.log('SSL configuration test: Valid SSL configuration');
        connection.release();
        await tempPool.end();
        return true;
    }
    catch (error) {
        console.error(`SSL configuration test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return false;
    }
}
/**
 * Test if connection pool can be created
 */
async function testConnectionPool() {
    try {
        // Use the same connection mechanism that the app uses
        const pool = database_1.default.getPool();
        console.log('Connection pool test: Pool created successfully');
        return true;
    }
    catch (error) {
        console.error(`Connection pool test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return false;
    }
}
/**
 * Test if a simple query can be executed
 */
async function testSampleQuery() {
    try {
        const pool = database_1.default.getPool();
        const [result] = await pool.query('SELECT 1 as test');
        console.log('Sample query test: Query executed successfully', result);
        return true;
    }
    catch (error) {
        console.error(`Sample query test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        return false;
    }
}
/**
 * Comprehensive diagnostic function that tests all connection components
 */
async function diagnoseDbConnection() {
    const options = getDbConfigOptions();
    const diagnostics = {
        timestamp: new Date().toISOString(),
        environmentVars: {
            host: options.host,
            user: options.user,
            database: options.database,
            port: String(options.port),
            sslEnabled: !!options.ssl
        },
        hostReachable: false,
        credentialsValid: false,
        sslConfigurationCorrect: false,
        connectionPoolCreated: false,
        sampleQueryExecutable: false
    };
    try {
        console.group('DATABASE CONNECTION DIAGNOSTICS');
        console.time('Total Diagnostic Time');
        // Test host connectivity
        console.time('Host Connection Test');
        diagnostics.hostReachable = await testHostConnection(options.host);
        console.timeEnd('Host Connection Test');
        // If host is unreachable, stop further tests
        if (!diagnostics.hostReachable) {
            console.log('Host unreachable, skipping remaining tests');
            console.timeEnd('Total Diagnostic Time');
            console.groupEnd();
            return diagnostics;
        }
        // Validate credentials
        console.time('Credentials Test');
        diagnostics.credentialsValid = await testCredentials();
        console.timeEnd('Credentials Test');
        // If credentials are invalid, stop further tests
        if (!diagnostics.credentialsValid) {
            console.log('Invalid credentials, skipping remaining tests');
            console.timeEnd('Total Diagnostic Time');
            console.groupEnd();
            return diagnostics;
        }
        // SSL Configuration check
        console.time('SSL Configuration Test');
        diagnostics.sslConfigurationCorrect = await testSSLConfiguration();
        console.timeEnd('SSL Configuration Test');
        // Connection Pool Test
        console.time('Connection Pool Test');
        diagnostics.connectionPoolCreated = await testConnectionPool();
        console.timeEnd('Connection Pool Test');
        // Sample Query Test
        console.time('Sample Query Test');
        diagnostics.sampleQueryExecutable = await testSampleQuery();
        console.timeEnd('Sample Query Test');
        console.timeEnd('Total Diagnostic Time');
        console.groupEnd();
        return diagnostics;
    }
    catch (error) {
        console.error('Comprehensive DB Diagnostic Failed', error);
        diagnostics.errorDetails = {
            message: error instanceof Error ? error.message : 'Unknown error',
            stack: error instanceof Error ? error.stack : undefined,
            code: error?.code,
            errno: error?.errno
        };
        console.groupEnd();
        return diagnostics;
    }
}
/**
 * Generate a detailed diagnostic report
 */
async function generateDbDiagnosticReport() {
    const diagnostics = await diagnoseDbConnection();
    // Create a formatted report
    let report = `
=============================================================
DATABASE CONNECTION DIAGNOSTIC REPORT
=============================================================
Timestamp: ${diagnostics.timestamp}

ENVIRONMENT CONFIGURATION
-------------------------------------------------------------
Host: ${diagnostics.environmentVars.host}
Port: ${diagnostics.environmentVars.port}
Database: ${diagnostics.environmentVars.database}
User: ${diagnostics.environmentVars.user}
SSL Enabled: ${diagnostics.environmentVars.sslEnabled}

TEST RESULTS
-------------------------------------------------------------
✅ Host Reachable: ${diagnostics.hostReachable ? 'PASS' : 'FAIL'}
✅ Valid Credentials: ${diagnostics.credentialsValid ? 'PASS' : 'FAIL'}
✅ SSL Configuration: ${diagnostics.sslConfigurationCorrect ? 'PASS' : 'FAIL'}
✅ Connection Pool: ${diagnostics.connectionPoolCreated ? 'PASS' : 'FAIL'}
✅ Sample Query: ${diagnostics.sampleQueryExecutable ? 'PASS' : 'FAIL'}

OVERALL CONNECTION STATUS: ${diagnostics.hostReachable &&
        diagnostics.credentialsValid &&
        diagnostics.sslConfigurationCorrect &&
        diagnostics.connectionPoolCreated &&
        diagnostics.sampleQueryExecutable ? 'WORKING' : 'FAILING'}
`;
    // Add error details if any
    if (diagnostics.errorDetails) {
        report += `
ERROR DETAILS
-------------------------------------------------------------
${JSON.stringify(diagnostics.errorDetails, null, 2)}
`;
    }
    // Add troubleshooting suggestions
    report += `
TROUBLESHOOTING SUGGESTIONS
-------------------------------------------------------------
${!diagnostics.hostReachable ? '• Check if hostname is correct and the database server is running\n• Verify network connectivity and firewall settings' : ''}
${!diagnostics.credentialsValid ? '• Verify username and password are correct\n• Check if user has permission to connect from this host' : ''}
${!diagnostics.sslConfigurationCorrect ? '• Check SSL/TLS configuration\n• Verify certificates if using SSL/TLS' : ''}
${!diagnostics.connectionPoolCreated ? '• Review connection pool settings\n• Check for maximum connection limits' : ''}
${!diagnostics.sampleQueryExecutable ? '• Verify database exists and user has necessary permissions\n• Check for query syntax errors' : ''}
=============================================================
`;
    return report;
}
