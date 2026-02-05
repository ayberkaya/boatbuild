const { query } = require('./src/db/connection');

async function debugColumn() {
    try {
        console.log('--- Checking for type column ---');
        const res = await query(`
            SELECT column_name, data_type 
            FROM information_schema.columns 
            WHERE table_name = 'future_expenses';
        `);
        console.table(res.rows);

        console.log('--- Trying to SELECT type ---');
        const select = await query('SELECT type FROM future_expenses LIMIT 1');
        console.log('Select success:', select.rows);

    } catch (err) {
        console.error('Debug Error:', err.message);
    }
    process.exit();
}

debugColumn();
