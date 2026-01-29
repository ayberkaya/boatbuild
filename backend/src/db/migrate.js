/**
 * Database Migration Script
 * BoatBuild CRM - Run this to set up the database schema and run migrations.
 * Idempotent: safe to run on fresh DB (schema + migrations) or existing DB (migrations only).
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'boatbuild_crm',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
});

async function migrate() {
    const client = await pool.connect();
    const migrationsDir = path.join(__dirname, 'migrations');

    try {
        console.log('Starting database migration...\n');

        // 1. Run main schema (fresh DB only; ignore "already exists" on re-run)
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        console.log('Executing schema...');
        try {
            await client.query(schema);
            console.log('Schema created successfully.\n');
        } catch (schemaError) {
            if (schemaError.message.includes('already exists')) {
                console.log('Schema objects already exist, continuing with migrations.\n');
            } else {
                throw schemaError;
            }
        }

        // 2. Run migration files in order
        if (!fs.existsSync(migrationsDir)) {
            console.log('No migrations folder, skipping.\n');
        } else {
            const files = fs.readdirSync(migrationsDir)
                .filter(f => f.endsWith('.sql'))
                .sort();
            for (const file of files) {
                const filePath = path.join(migrationsDir, file);
                const sql = fs.readFileSync(filePath, 'utf8');
                console.log(`Running migration: ${file}`);
                await client.query(sql);
            }
            if (files.length) console.log('');
        }

        console.log('✓ Migration completed successfully.');
        console.log('  Default login: owner@boatbuild.com / owner123');
        console.log('  Or: kaan@boatbuild.com / operation123');
    } catch (error) {
        console.error('Migration failed:', error.message);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
