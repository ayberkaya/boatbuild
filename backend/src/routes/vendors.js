/**
 * Vendor Routes
 * BoatBuild CRM - Vendor management
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db/connection');
const { authenticate, requireAuthenticated, requireOwner, logAudit } = require('../middleware/auth');
const { buildUnassignedWhereClause } = require('../lib/vendorMatching');

const router = express.Router();

/**
 * GET /api/vendors
 * List all vendors, deduplicated by name (one card per unique vendor name).
 * Expense aggregation includes: expenses linked by vendor_id + expenses with vendor_id IS NULL matched by vendor_name.
 * Unassigned definition: see lib/vendorMatching.js.
 */
router.get('/', authenticate, requireAuthenticated, async (req, res) => {
    try {
        const result = await query(`
            SELECT * FROM vendors ORDER BY name ASC
        `);

        // Group vendors by normalized name (same name => one logical vendor)
        const byName = new Map();
        for (const row of result.rows) {
            const nameKey = (row.name || '').trim().toLowerCase();
            if (!nameKey) continue;
            if (!byName.has(nameKey)) {
                byName.set(nameKey, { primary: row, vendor_ids: [row.vendor_id] });
            } else {
                byName.get(nameKey).vendor_ids.push(row.vendor_id);
            }
        }

        const allVendorIds = result.rows.map(v => (v.vendor_id && String(v.vendor_id)) || null).filter(Boolean);
        const vendorNameKeys = Array.from(byName.keys());

        // 1) Expenses linked by vendor_id (any current vendor)
        const byVendorId = allVendorIds.length > 0 ? await query(`
            SELECT 
                vendor_id,
                currency,
                COUNT(*)::int as count,
                COALESCE(SUM(amount), 0)::numeric as total_amount
            FROM expenses
            WHERE vendor_id = ANY($1)
            GROUP BY vendor_id, currency
        `, [allVendorIds]) : { rows: [] };

        // 2) Expenses not linked to a current vendor: match by vendor_name only (e.g. import with no vendor_id, or orphaned vendor_id)
        const byVendorName = await query(`
            SELECT 
                LOWER(TRIM(vendor_name)) as name_key,
                currency,
                COUNT(*)::int as count,
                COALESCE(SUM(amount), 0)::numeric as total_amount
            FROM expenses
            WHERE (vendor_id IS NULL OR NOT (vendor_id = ANY($1)))
              AND TRIM(vendor_name) <> ''
            GROUP BY LOWER(TRIM(vendor_name)), currency
        `, [allVendorIds]);

        // Build one logical vendor per unique name with aggregated expense counts/totals
        const vendorsWithCurrency = [];
        for (const [nameKey, { primary, vendor_ids }] of byName) {
            const idsSet = new Set(vendor_ids.map(id => id && String(id)).filter(Boolean));
            const byCurrency = {};
            let expense_count = 0;

            for (const row of byVendorId.rows) {
                const rid = row.vendor_id && String(row.vendor_id);
                if (!rid || !idsSet.has(rid)) continue;
                const c = (row.currency || 'TRY').trim();
                if (!byCurrency[c]) byCurrency[c] = { count: 0, total_amount: 0 };
                byCurrency[c].count += parseInt(row.count, 10);
                byCurrency[c].total_amount += parseFloat(row.total_amount);
                expense_count += parseInt(row.count, 10);
            }

            for (const row of byVendorName.rows) {
                const nk = (row.name_key || '').trim().toLowerCase();
                const firstWord = nk.split(/\s+/)[0] || nk;
                // Match exact (e.g. "BARAN") or first word of expense vendor_name (e.g. "baran akalın" -> BARAN, "motor tedarikçisi" -> MOTOR)
                if (nk !== nameKey && firstWord !== nameKey) continue;
                const c = (row.currency || 'TRY').trim();
                if (!byCurrency[c]) byCurrency[c] = { count: 0, total_amount: 0 };
                byCurrency[c].count += parseInt(row.count, 10);
                byCurrency[c].total_amount += parseFloat(row.total_amount);
                expense_count += parseInt(row.count, 10);
            }

            const total_expense_amount = Object.values(byCurrency).reduce((sum, x) => sum + (x.total_amount || 0), 0);

            vendorsWithCurrency.push({
                ...primary,
                expense_count,
                total_expense_amount,
                expenses_by_currency: byCurrency
            });
        }

        // Sort by name for stable order
        vendorsWithCurrency.sort((a, b) => (a.name || '').localeCompare(b.name || ''));

        // Total spend from all expenses (matches Dashboard Toplam Harcama)
        const totalSpendResult = await query(`
            SELECT currency, COALESCE(SUM(amount), 0)::numeric as total_spend
            FROM expenses
            GROUP BY currency
        `);
        const total_spend = {};
        totalSpendResult.rows.forEach(row => {
            total_spend[(row.currency || 'TRY').trim()] = parseFloat(row.total_spend);
        });

        // Unassigned expenses: not linked to any vendor by vendor_id and vendor_name doesn't match any vendor (vendorNameKeys from above)
        const unassignedByCurrency = {};
        let unassigned_count = 0;

        if (vendorNameKeys.length === 0) {
            // No vendors: all expenses are "unassigned" (tüm giderler)
            const allUnassigned = await query(`
                SELECT currency, COUNT(*)::int as count, COALESCE(SUM(amount), 0)::numeric as total_amount
                FROM expenses
                GROUP BY currency
            `);
            allUnassigned.rows.forEach(row => {
                const c = (row.currency || 'TRY').trim();
                unassignedByCurrency[c] = { count: parseInt(row.count, 10), total_amount: parseFloat(row.total_amount) };
                unassigned_count += parseInt(row.count, 10);
            });
        } else {
            const { whereClause, params } = buildUnassignedWhereClause(allVendorIds, vendorNameKeys, 1);
            const unassignedResult = await query(`
                SELECT currency, COUNT(*)::int as count, COALESCE(SUM(amount), 0)::numeric as total_amount
                FROM expenses e
                WHERE 1=1 ${whereClause}
                GROUP BY currency
            `, params);
            unassignedResult.rows.forEach(row => {
                const c = (row.currency || 'TRY').trim();
                if (!unassignedByCurrency[c]) unassignedByCurrency[c] = { count: 0, total_amount: 0 };
                unassignedByCurrency[c].count += parseInt(row.count, 10);
                unassignedByCurrency[c].total_amount += parseFloat(row.total_amount);
                unassigned_count += parseInt(row.count, 10);
            });
        }

        // Reconciliation: total_spend must equal vendors + unassigned by currency
        const vendorTotalsByCurrency = {};
        for (const v of vendorsWithCurrency) {
            if (!v.expenses_by_currency) continue;
            for (const [c, data] of Object.entries(v.expenses_by_currency)) {
                vendorTotalsByCurrency[c] = (vendorTotalsByCurrency[c] || 0) + (data.total_amount || 0);
            }
        }
        for (const c of Object.keys(total_spend)) {
            const vendorSum = vendorTotalsByCurrency[c] || 0;
            const unassignedSum = (unassignedByCurrency[c] && unassignedByCurrency[c].total_amount) || 0;
            const expected = total_spend[c];
            const actual = vendorSum + unassignedSum;
            if (Math.abs(expected - actual) > 0.01) {
                console.error('[Vendors] Reconciliation mismatch:', { currency: c, total_spend: expected, vendors_plus_unassigned: actual });
            }
        }

        res.json({
            success: true,
            data: {
                vendors: vendorsWithCurrency,
                total_spend,
                unassigned: {
                    expense_count: unassigned_count,
                    expenses_by_currency: unassignedByCurrency
                }
            }
        });
    } catch (error) {
        console.error('[Vendors] List error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch vendors'
        });
    }
});

/**
 * GET /api/vendors/:id
 * Get single vendor with expense history
 */
router.get('/:id', authenticate, requireAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        const vendorResult = await query('SELECT * FROM vendors WHERE vendor_id = $1', [id]);
        
        if (vendorResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Vendor not found'
            });
        }

        // Get expense summary
        const expenseSummary = await query(`
            SELECT 
                COUNT(*) as total_expenses,
                COALESCE(SUM(amount), 0) as total_amount,
                COALESCE(SUM(hak_edis_amount), 0) as total_hak_edis,
                MIN(date) as first_expense_date,
                MAX(date) as last_expense_date
            FROM expenses
            WHERE vendor_id = $1
        `, [id]);

        // Get recent expenses
        const recentExpenses = await query(`
            SELECT expense_id, date, amount, primary_tag, is_hak_edis_eligible, hak_edis_amount
            FROM expenses
            WHERE vendor_id = $1
            ORDER BY date DESC
            LIMIT 10
        `, [id]);

        // Get contracts
        const contracts = await query(
            'SELECT * FROM contracts WHERE vendor_id = $1 ORDER BY created_at DESC',
            [id]
        );

        res.json({
            success: true,
            data: {
                vendor: vendorResult.rows[0],
                expense_summary: expenseSummary.rows[0],
                recent_expenses: recentExpenses.rows,
                contracts: contracts.rows
            }
        });
    } catch (error) {
        console.error('[Vendors] Get error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch vendor'
        });
    }
});

/**
 * POST /api/vendors
 * Create new vendor
 */
router.post('/', authenticate, requireAuthenticated, [
    body('name').notEmpty().trim(),
    body('tax_number').optional().trim(),
    body('email').optional().isEmail().normalizeEmail(),
    body('phone').optional().trim()
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { name, tax_number, address, phone, email, requires_documentation, notes } = req.body;

        // Check if vendor with same name exists
        const existingVendor = await query(
            'SELECT vendor_id FROM vendors WHERE LOWER(name) = LOWER($1)',
            [name]
        );

        if (existingVendor.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Vendor with this name already exists'
            });
        }

        const vendor_id = uuidv4();

        const result = await query(`
            INSERT INTO vendors (vendor_id, name, tax_number, address, phone, email, requires_documentation, notes)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            RETURNING *
        `, [vendor_id, name, tax_number, address, phone, email, requires_documentation || false, notes]);

        await logAudit(req.user.user_id, 'CREATE_VENDOR', 'vendors', vendor_id, null, result.rows[0], req);

        res.status(201).json({
            success: true,
            data: {
                vendor: result.rows[0]
            }
        });
    } catch (error) {
        console.error('[Vendors] Create error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create vendor'
        });
    }
});

/**
 * PUT /api/vendors/:id
 * Update vendor
 */
router.put('/:id', authenticate, requireAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        const existingResult = await query('SELECT * FROM vendors WHERE vendor_id = $1', [id]);
        if (existingResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Vendor not found'
            });
        }

        const existing = existingResult.rows[0];

        const result = await query(`
            UPDATE vendors SET
                name = COALESCE($1, name),
                tax_number = COALESCE($2, tax_number),
                address = COALESCE($3, address),
                phone = COALESCE($4, phone),
                email = COALESCE($5, email),
                requires_documentation = COALESCE($6, requires_documentation),
                notes = COALESCE($7, notes),
                updated_at = NOW()
            WHERE vendor_id = $8
            RETURNING *
        `, [
            req.body.name, req.body.tax_number, req.body.address,
            req.body.phone, req.body.email, req.body.requires_documentation,
            req.body.notes, id
        ]);

        await logAudit(req.user.user_id, 'UPDATE_VENDOR', 'vendors', id, existing, result.rows[0], req);

        res.json({
            success: true,
            data: {
                vendor: result.rows[0]
            }
        });
    } catch (error) {
        console.error('[Vendors] Update error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update vendor'
        });
    }
});

/**
 * DELETE /api/vendors/:id
 * Delete vendor (Owner only, only if no linked expenses)
 */
router.delete('/:id', authenticate, requireOwner, async (req, res) => {
    try {
        const { id } = req.params;

        // Check for linked expenses
        const linkedExpenses = await query(
            'SELECT COUNT(*) as count FROM expenses WHERE vendor_id = $1',
            [id]
        );

        if (parseInt(linkedExpenses.rows[0].count) > 0) {
            return res.status(400).json({
                success: false,
                error: 'Cannot delete vendor with linked expenses',
                linked_expense_count: parseInt(linkedExpenses.rows[0].count)
            });
        }

        const existing = await query('SELECT * FROM vendors WHERE vendor_id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Vendor not found'
            });
        }

        await query('DELETE FROM vendors WHERE vendor_id = $1', [id]);

        await logAudit(req.user.user_id, 'DELETE_VENDOR', 'vendors', id, existing.rows[0], null, req);

        res.json({
            success: true,
            message: 'Vendor deleted successfully'
        });
    } catch (error) {
        console.error('[Vendors] Delete error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete vendor'
        });
    }
});

module.exports = router;
