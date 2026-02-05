const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const { query } = require('./src/db/connection');

async function debugDashboard() {
    try {
        console.log('--- Debugging Dashboard Data ---');
        console.log('DB_USER:', process.env.DB_USER);
        console.log('DB_NAME:', process.env.DB_NAME);

        // Check Expenses
        const exp = await query('SELECT count(*), sum(amount) as total, currency FROM expenses GROUP BY currency');
        console.log('Expenses Content:', exp.rows);

        // Check Future Expenses
        const fut = await query('SELECT count(*), sum(amount) as total, currency FROM future_expenses GROUP BY currency');
        console.log('Future Expenses Content:', fut.rows);

    } catch (err) {
        console.error('Debug Error:', err);
    }
    process.exit();
}

debugDashboard();
