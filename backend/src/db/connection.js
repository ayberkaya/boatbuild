/**
 * Database Connection Module
 * BoatBuild CRM - Production-grade PostgreSQL connection
 */

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'boatbuild_crm',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

pool.on('connect', () => {
    console.log('[DB] Connected to PostgreSQL');
});

pool.on('error', (err) => {
    console.error('[DB] Unexpected error on idle client', err);
    process.exit(-1);
});

/**
 * Execute a query with parameters
 */
const query = async (text, params) => {
    const start = Date.now();
    try {
        const result = await pool.query(text, params);
        const duration = Date.now() - start;
        if (process.env.NODE_ENV === 'development') {
            console.log('[DB] Query executed', { text: text.substring(0, 50), duration, rows: result.rowCount });
        }
        return result;
    } catch (error) {
        console.error('[DB] Query error', { text: text.substring(0, 100), error: error.message });
        throw error;
    }
};

/**
 * Get a client from the pool for transactions
 */
const getClient = async () => {
    const client = await pool.connect();
    const originalQuery = client.query.bind(client);
    const release = client.release.bind(client);

    // Track query count for debugging
    let queryCount = 0;

    client.query = (...args) => {
        queryCount++;
        return originalQuery(...args);
    };

    client.release = () => {
        client.query = originalQuery;
        release();
    };

    return client;
};

/**
 * Execute a transaction
 */
const transaction = async (callback) => {
    const client = await getClient();
    try {
        await client.query('BEGIN');
        const result = await callback(client);
        await client.query('COMMIT');
        return result;
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
};

module.exports = {
    pool,
    query,
    getClient,
    transaction
};
