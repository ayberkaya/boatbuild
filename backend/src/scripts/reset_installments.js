
const { query } = require('../db/connection');

async function deleteLegacyInstallments() {
    try {
        console.log('Deleting legacy installment records...');

        // Delete items with type = 'INSTALLMENT' (The ones we identified are from a migration)
        // We will reset them to 'ESTIMATE' or just delete them if user wants them GONE from that tab.
        // User said "remove from here", implying they shouldn't be in "Gelecek Taksitler".
        // Since they were auto-migrated based on title, the safest way to "remove" them from the tab
        // without losing data is to set their type back to 'ESTIMATE'.

        // However, the user explicitly said "sisteme henüz taksitli gider eklenmedi" (no installments have been added to the system yet).
        // This implies these are FALSE POSITIVES from our migration script.
        // So we should update their type to 'ESTIMATE' so they appear in "Genel Plan" instead.

        const result = await query(`
      UPDATE future_expenses 
      SET type = 'ESTIMATE'
      WHERE type = 'INSTALLMENT'
    `);

        console.log(`Updated ${result.rowCount} records from INSTALLMENT to ESTIMATE.`);

    } catch (err) {
        console.error('Error:', err);
    } finally {
        process.exit();
    }
}

deleteLegacyInstallments();
