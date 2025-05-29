"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.auditEnvironmentVariables = auditEnvironmentVariables;
exports.runComprehensiveDiagnostics = runComprehensiveDiagnostics;
exports.createDiagnosticHandler = createDiagnosticHandler;
// apps/api/src/lib/dbDiagnostic.ts
const db_1 = require("./db");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
const os_1 = __importDefault(require("os"));
/**
 * Audit environment variables across projects
 */
async function auditEnvironmentVariables() {
    // Variables to check
    const dbVars = [
        'MYSQL_HOST',
        'MYSQL_USER',
        'MYSQL_PASSWORD',
        'MYSQL_DATABASE',
        'MYSQL_PORT',
        'MYSQL_SSL'
    ];
    // Load API environment
    const apiEnvPath = path_1.default.resolve(process.cwd(), '../api/.env');
    let apiEnv = {};
    try {
        if (fs_1.default.existsSync(apiEnvPath)) {
            const apiEnvContent = fs_1.default.readFileSync(apiEnvPath, 'utf8');
            const apiDotenv = dotenv_1.default.parse(apiEnvContent);
            apiEnv = dbVars.reduce((acc, varName) => {
                acc[varName] = apiDotenv[varName] || process.env[varName];
                return acc;
            }, {});
        }
        else {
            // Fall back to process.env if no .env file
            apiEnv = dbVars.reduce((acc, varName) => {
                acc[varName] = process.env[varName];
                return acc;
            }, {});
        }
    }
    catch (error) {
        console.error('Error loading API environment variables:', error);
    }
    // Load Web environment
    const webEnvPath = path_1.default.resolve(process.cwd(), '../web/.env');
    let webEnv = {};
    try {
        if (fs_1.default.existsSync(webEnvPath)) {
            const webEnvContent = fs_1.default.readFileSync(webEnvPath, 'utf8');
            const webDotenv = dotenv_1.default.parse(webEnvContent);
            webEnv = dbVars.reduce((acc, varName) => {
                acc[varName] = webDotenv[varName] || process.env[varName];
                return acc;
            }, {});
        }
        else {
            // Fall back to process.env if no .env file
            webEnv = dbVars.reduce((acc, varName) => {
                acc[varName] = process.env[varName];
                return acc;
            }, {});
        }
    }
    catch (error) {
        console.error('Error loading Web environment variables:', error);
    }
    // Check for mismatches
    const mismatches = [];
    for (const varName of dbVars) {
        if (apiEnv[varName] !== webEnv[varName]) {
            mismatches.push(varName);
        }
    }
    return {
        api: apiEnv,
        web: webEnv,
        identical: mismatches.length === 0,
        mismatches
    };
}
/**
 * Run comprehensive database diagnostics and save report
 */
async function runComprehensiveDiagnostics() {
    console.log('Starting comprehensive database diagnostics...');
    // Generate timestamp for report filename
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportDir = path_1.default.resolve(process.cwd(), 'logs');
    // Create logs directory if it doesn't exist
    if (!fs_1.default.existsSync(reportDir)) {
        fs_1.default.mkdirSync(reportDir, { recursive: true });
    }
    const reportPath = path_1.default.resolve(reportDir, `db-diagnostic-${timestamp}.log`);
    // Run environment variable audit
    const envAudit = await auditEnvironmentVariables();
    // Run database diagnostics
    const diagnostics = await (0, db_1.diagnoseDbConnection)();
    // Generate system information
    const systemInfo = {
        os: {
            type: os_1.default.type(),
            platform: os_1.default.platform(),
            release: os_1.default.release(),
            hostname: os_1.default.hostname()
        },
        env: process.env.NODE_ENV,
        user: os_1.default.userInfo().username,
        cwd: process.cwd(),
        memory: {
            total: `${Math.round(os_1.default.totalmem() / (1024 * 1024 * 1024))} GB`,
            free: `${Math.round(os_1.default.freemem() / (1024 * 1024 * 1024))} GB`
        }
    };
    // Generate report
    const dbReport = await (0, db_1.generateDbDiagnosticReport)();
    // Compose the full report
    const report = `
=============================================================
UNITY VOICE LEARNING PLATFORM - DATABASE DIAGNOSTIC REPORT
=============================================================
Generated: ${new Date().toISOString()}

SYSTEM INFORMATION
-------------------------------------------------------------
OS: ${systemInfo.os.type} ${systemInfo.os.platform} ${systemInfo.os.release}
Hostname: ${systemInfo.os.hostname}
Environment: ${systemInfo.env}
User: ${systemInfo.user}
Working Directory: ${systemInfo.cwd}
Memory: Total: ${systemInfo.memory.total}, Free: ${systemInfo.memory.free}

ENVIRONMENT VARIABLES AUDIT
-------------------------------------------------------------
Variables Identical Across Projects: ${envAudit.identical ? 'YES' : 'NO'}
${envAudit.mismatches.length > 0 ? `Mismatched Variables: ${envAudit.mismatches.join(', ')}` : ''}

API Environment:
${Object.entries(envAudit.api)
        .map(([key, value]) => `  ${key}: ${value ? (key.includes('PASSWORD') ? '********' : value) : 'undefined'}`)
        .join('\n')}

Web Environment:
${Object.entries(envAudit.web)
        .map(([key, value]) => `  ${key}: ${value ? (key.includes('PASSWORD') ? '********' : value) : 'undefined'}`)
        .join('\n')}

${dbReport}
`;
    // Save report to file
    fs_1.default.writeFileSync(reportPath, report);
    console.log(`Diagnostic report saved to: ${reportPath}`);
    return report;
}
/**
 * Create an Express route handler for diagnosing database connections
 */
function createDiagnosticHandler() {
    return async (req, res) => {
        try {
            const report = await runComprehensiveDiagnostics();
            // Determine response format based on query param or accept header
            const format = req.query.format || (req.headers.accept?.includes('application/json') ? 'json' : 'text');
            if (format === 'json') {
                const diagnostics = await (0, db_1.diagnoseDbConnection)();
                const envAudit = await auditEnvironmentVariables();
                res.json({
                    timestamp: new Date().toISOString(),
                    diagnostics,
                    environmentAudit: envAudit,
                    status: diagnostics.hostReachable &&
                        diagnostics.credentialsValid &&
                        diagnostics.sslConfigurationCorrect &&
                        diagnostics.connectionPoolCreated &&
                        diagnostics.sampleQueryExecutable ? 'healthy' : 'unhealthy'
                });
            }
            else {
                res.setHeader('Content-Type', 'text/plain');
                res.send(report);
            }
        }
        catch (error) {
            console.error('Error in diagnostic handler:', error);
            res.status(500).json({
                error: 'Diagnostic failed',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    };
}
// If this module is run directly from the command line
if (require.main === module) {
    runComprehensiveDiagnostics()
        .then(report => {
        console.log(report);
        process.exit(0);
    })
        .catch(error => {
        console.error('Failed to run diagnostics:', error);
        process.exit(1);
    });
}
