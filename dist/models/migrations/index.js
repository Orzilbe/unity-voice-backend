"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const db_1 = __importDefault(require("../db"));
async function runMigrations() {
    try {
        console.log('Running database migrations...');
        // Create migrations table if it doesn't exist
        await db_1.default.execute(`
      CREATE TABLE IF NOT EXISTS DatabaseMigrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        filename VARCHAR(255) NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY unique_filename (filename)
      )
    `);
        // Get list of executed migrations
        const [executedMigrations] = await db_1.default.execute('SELECT filename FROM DatabaseMigrations');
        const executedFiles = new Set(executedMigrations.map(row => row.filename));
        // Read migration files
        const migrationsDir = path_1.default.join(__dirname);
        const files = fs_1.default.readdirSync(migrationsDir)
            .filter(file => file.endsWith('.sql'))
            .sort();
        // Execute new migrations
        for (const file of files) {
            if (!executedFiles.has(file)) {
                console.log(`Executing migration: ${file}`);
                const filePath = path_1.default.join(migrationsDir, file);
                const sql = fs_1.default.readFileSync(filePath, 'utf8');
                const connection = await db_1.default.getConnection();
                try {
                    await connection.beginTransaction();
                    // Execute migration
                    await connection.execute(sql);
                    // Record migration
                    await connection.execute('INSERT INTO DatabaseMigrations (filename) VALUES (?)', [file]);
                    await connection.commit();
                    console.log(`Migration ${file} executed successfully`);
                }
                catch (error) {
                    await connection.rollback();
                    throw error;
                }
                finally {
                    connection.release();
                }
            }
        }
        console.log('All migrations completed successfully');
    }
    catch (error) {
        console.error('Error running migrations:', error);
        throw error;
    }
}
exports.default = runMigrations;
