const { query } = require('./src/db/connection');

async function checkCounts() {
    try {
        const expenses = await query('SELECT COUNT(*), SUM(amount) FROM expenses');
        console.log('Expenses:', expenses.rows[0]);

        const future = await query('SELECT COUNT(*), SUM(amount) FROM future_expenses');
        console.log('Future Expenses:', future.rows[0]);

        const transfers = await query('SELECT COUNT(*), SUM(amount) FROM transfers');
        console.log('Transfers:', transfers.rows[0]);

    } catch (err) {
        console.error(err);
    }
    process.exit();
}

checkCounts();
