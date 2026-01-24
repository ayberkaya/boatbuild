/**
 * Reset User Passwords Script
 * Reset passwords for default users
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

async function resetPasswords() {
    const client = await pool.connect();
    
    try {
        console.log('Resetting user passwords...\n');

        const ownerPasswordHash = await bcrypt.hash('owner123', 12);
        const operationPasswordHash = await bcrypt.hash('operation123', 12);

        // Update owner password
        const ownerResult = await client.query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2 RETURNING email, full_name, role',
            [ownerPasswordHash, 'owner@boatbuild.com']
        );

        if (ownerResult.rows.length > 0) {
            console.log('✅ Owner password reset:', ownerResult.rows[0]);
        } else {
            console.log('⚠️  Owner user not found, creating...');
            await client.query(`
                INSERT INTO users (email, password_hash, full_name, role)
                VALUES ('owner@boatbuild.com', $1, 'Owner', 'OWNER')
            `, [ownerPasswordHash]);
            console.log('✅ Owner user created');
        }

        // Update operation password
        const operationResult = await client.query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2 RETURNING email, full_name, role',
            [operationPasswordHash, 'kaan@boatbuild.com']
        );

        if (operationResult.rows.length > 0) {
            console.log('✅ Operation password reset:', operationResult.rows[0]);
        } else {
            console.log('⚠️  Operation user not found, creating...');
            await client.query(`
                INSERT INTO users (email, password_hash, full_name, role)
                VALUES ('kaan@boatbuild.com', $1, 'Kaan (Operation)', 'OPERATION')
            `, [operationPasswordHash]);
            console.log('✅ Operation user created');
        }

        // Ensure users are active
        await client.query(`
            UPDATE users 
            SET is_active = true 
            WHERE email IN ('owner@boatbuild.com', 'kaan@boatbuild.com')
        `);

        console.log('\n✅ Password reset completed!');
        console.log('\nDefault credentials:');
        console.log('  Owner: owner@boatbuild.com / owner123');
        console.log('  Operation: kaan@boatbuild.com / operation123');

    } catch (error) {
        console.error('Error resetting passwords:', error.message);
        console.error(error);
        process.exit(1);
    } finally {
        client.release();
        await pool.end();
    }
}

resetPasswords();
