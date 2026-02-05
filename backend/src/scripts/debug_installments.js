
const { query } = require('../db/connection');

async function debugInstallments() {
    try {
        console.log('Fetching future expenses with type INSTALLMENT and currency EUR...');
        const result = await query(`
      SELECT id, title, amount, date, currency, status, type 
      FROM future_expenses 
      WHERE status = 'PENDING' 
      AND type = 'INSTALLMENT'
      ORDER BY date ASC
    `);

        console.log(`Found ${result.rows.length} records:`);
        let total = 0;
        result.rows.forEach(row => {
            if (row.currency === 'EUR') {
                total += parseFloat(row.amount);
            }
            console.log(`${row.date.toISOString().split('T')[0]} | ${row.title} | ${row.amount} ${row.currency}`);
        });

        console.log('-----------------------------------');
        console.log(`Total EUR: ${total.toLocaleString('tr-TR', { minimumFractionDigits: 2 })}`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

debugInstallments();
