/**
 * Database Migration Script
 * BoatBuild CRM - Run this to set up the database schema
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'boatbuild_crm',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
});

async function migrate() {
    const client = await pool.connect();
    
    try {
        console.log('Starting database migration...\n');

        // Read and execute schema
        const schemaPath = path.join(__dirname, 'schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');

        console.log('Executing schema...');
        await client.query(schema);
        console.log('Schema created successfully.\n');

        // Create default Owner user
        console.log('Creating default users...');
        
        const ownerPasswordHash = await bcrypt.hash('owner123', 12);
        const operationPasswordHash = await bcrypt.hash('operation123', 12);

        // Check if users exist
        const existingOwner = await client.query(
            "SELECT user_id FROM users WHERE email = 'owner@boatbuild.com'"
        );

        if (existingOwner.rows.length === 0) {
            await client.query(`
                INSERT INTO users (email, password_hash, full_name, role)
                VALUES 
                    ('owner@boatbuild.com', $1, 'Owner', 'OWNER'),
                    ('kaan@boatbuild.com', $2, 'Kaan (Operation)', 'OPERATION')
            `, [ownerPasswordHash, operationPasswordHash]);
            
            console.log('Default users created:');
            console.log('  - Owner: owner@boatbuild.com / owner123');
            console.log('  - Operation: kaan@boatbuild.com / operation123');
        } else {
            console.log('Users already exist, skipping...');
        }

        console.log('\n✓ Migration completed successfully!');

    } catch (error) {
        console.error('Migration failed:', error.message);
        
        if (error.message.includes('already exists')) {
            console.log('\nNote: Some objects may already exist. This is expected on re-runs.');
        }
        
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

migrate();
