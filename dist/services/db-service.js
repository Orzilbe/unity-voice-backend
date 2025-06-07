"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
// apps/api/src/services/db-service.ts
const db_1 = require("../lib/db");
class DatabaseService {
    async query(sql, params = []) {
        const pool = await (0, db_1.getDbPool)();
        const [results] = await pool.execute(sql, params);
        return results;
    }
    async findAll(table) {
        return this.query(`SELECT * FROM ${table}`);
    }
    async findById(table, id) {
        return this.query(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    }
    async create(table, data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const placeholders = keys.map(() => '?').join(', ');
        const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
        const result = await this.query(sql, values);
        return result;
    }
    async update(table, id, data) {
        const keys = Object.keys(data);
        const values = Object.values(data);
        const setClause = keys.map(key => `${key} = ?`).join(', ');
        const sql = `UPDATE ${table} SET ${setClause} WHERE id = ?`;
        const result = await this.query(sql, [...values, id]);
        return result;
    }
    async delete(table, id) {
        const sql = `DELETE FROM ${table} WHERE id = ?`;
        const result = await this.query(sql, [id]);
        return result;
    }
}
exports.DatabaseService = DatabaseService;
