"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const db_1 = __importDefault(require("./db"));
class BaseModel {
    constructor(tableName) {
        this.tableName = tableName;
    }
    // Get a connection from the pool
    async getConnection() {
        return await BaseModel.pool.getConnection();
    }
    // Execute a query with transaction support
    async executeQuery(query, params = [], useTransaction = false) {
        let connection = null;
        try {
            if (useTransaction) {
                connection = await this.getConnection();
                await connection.beginTransaction();
                const [results, fields] = await connection.execute(query, params);
                await connection.commit();
                return { results, fields };
            }
            else {
                const [results, fields] = await BaseModel.pool.execute(query, params);
                return { results, fields };
            }
        }
        catch (error) {
            if (connection && useTransaction) {
                await connection.rollback();
            }
            throw error;
        }
        finally {
            if (connection) {
                connection.release();
            }
        }
    }
    // Find one record by id
    async findById(id) {
        const primaryKey = this.getPrimaryKeyColumn();
        const query = `SELECT * FROM ${this.tableName} WHERE ${primaryKey} = ?`;
        const { results } = await this.executeQuery(query, [id]);
        if (Array.isArray(results) && results.length > 0) {
            return results[0];
        }
        return null;
    }
    // Find all records
    async findAll(limit, offset) {
        let query = `SELECT * FROM ${this.tableName}`;
        if (limit !== undefined && offset !== undefined) {
            query += ` LIMIT ? OFFSET ?`;
            const { results } = await this.executeQuery(query, [limit, offset]);
            return results;
        }
        else {
            const { results } = await this.executeQuery(query);
            return results;
        }
    }
    // Find records by a condition
    async findBy(fieldName, value) {
        const query = `SELECT * FROM ${this.tableName} WHERE ${fieldName} = ?`;
        const { results } = await this.executeQuery(query, [value]);
        return results;
    }
    // Create a new record
    async create(data) {
        const fields = Object.keys(data).join(', ');
        const placeholders = Object.keys(data).map(() => '?').join(', ');
        const values = Object.values(data);
        const query = `INSERT INTO ${this.tableName} (${fields}) VALUES (${placeholders})`;
        const { results } = await this.executeQuery(query, values, true);
        return results;
    }
    // Update a record by id
    async updateById(id, data) {
        const primaryKey = this.getPrimaryKeyColumn();
        const fields = Object.keys(data).map(key => `${key} = ?`).join(', ');
        const values = [...Object.values(data), id];
        const query = `UPDATE ${this.tableName} SET ${fields} WHERE ${primaryKey} = ?`;
        const { results } = await this.executeQuery(query, values, true);
        return results;
    }
    // Delete a record by id
    async deleteById(id) {
        const primaryKey = this.getPrimaryKeyColumn();
        const query = `DELETE FROM ${this.tableName} WHERE ${primaryKey} = ?`;
        const { results } = await this.executeQuery(query, [id], true);
        return results;
    }
    // Count records
    async count() {
        const query = `SELECT COUNT(*) as count FROM ${this.tableName}`;
        const { results } = await this.executeQuery(query);
        if (Array.isArray(results) && results.length > 0) {
            return results[0].count;
        }
        return 0;
    }
    // Custom query execution
    async query(query, params = []) {
        return await this.executeQuery(query, params);
    }
    // Get the primary key column name (override in specific model classes)
    getPrimaryKeyColumn() {
        return 'id';
    }
}
BaseModel.pool = db_1.default;
exports.default = BaseModel;
