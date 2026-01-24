/**
 * Check Users Script
 * Verify default users exist and can authenticate
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'boatbuild_crm',
    user: process.env.DB_USER || 'postgres',
    password: process.env.DB_PASSWORD
});

async function checkUsers() {
    const client = await pool.connect();
    
    try {
        console.log('Checking users in database...\n');

        const result = await client.query(`
            SELECT user_id, email, full_name, role, is_active, 
                   CASE WHEN password_hash IS NOT NULL THEN 'HAS_PASSWORD' ELSE 'NO_PASSWORD' END as password_status
            FROM users
            ORDER BY role, email
        `);

        if (result.rows.length === 0) {
            console.log('❌ No users found in database!');
            console.log('Run: npm run migrate (in backend directory)');
            return;
        }

        console.log(`Found ${result.rows.length} user(s):\n`);
        
        for (const user of result.rows) {
            console.log(`Email: ${user.email}`);
            console.log(`  Name: ${user.full_name}`);
            console.log(`  Role: ${user.role}`);
            console.log(`  Active: ${user.is_active ? 'Yes' : 'No'}`);
            console.log(`  Password: ${user.password_status}`);
            
            // Test password
            if (user.email === 'owner@boatbuild.com') {
                const testHash = await bcrypt.hash('owner123', 12);
                const existingUser = await client.query(
                    'SELECT password_hash FROM users WHERE email = $1',
                    [user.email]
                );
                if (existingUser.rows.length > 0) {
                    const isValid = await bcrypt.compare('owner123', existingUser.rows[0].password_hash);
                    console.log(`  Password test: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
                }
            } else if (user.email === 'kaan@boatbuild.com') {
                const existingUser = await client.query(
                    'SELECT password_hash FROM users WHERE email = $1',
                    [user.email]
                );
                if (existingUser.rows.length > 0) {
                    const isValid = await bcrypt.compare('operation123', existingUser.rows[0].password_hash);
                    console.log(`  Password test: ${isValid ? '✅ Valid' : '❌ Invalid'}`);
                }
            }
            console.log('');
        }

        // Check for required users
        const ownerExists = result.rows.some(u => u.email === 'owner@boatbuild.com');
        const operationExists = result.rows.some(u => u.email === 'kaan@boatbuild.com');

        if (!ownerExists) {
            console.log('⚠️  Warning: owner@boatbuild.com not found!');
        }
        if (!operationExists) {
            console.log('⚠️  Warning: kaan@boatbuild.com not found!');
        }

        if (ownerExists && operationExists) {
            console.log('✅ Required users exist');
        }

    } catch (error) {
        console.error('Error checking users:', error.message);
        console.error(error);
    } finally {
        client.release();
        await pool.end();
    }
}

checkUsers();
