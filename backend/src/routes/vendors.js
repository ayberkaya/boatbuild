/**
 * Vendor Routes
 * BoatBuild CRM - Vendor management
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { query } = require('../db/connection');
const { authenticate, requireAuthenticated, requireOwner, logAudit } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/vendors
 * List all vendors
 */
router.get('/', authenticate, requireAuthenticated, async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                v.*,
                (SELECT COUNT(*) FROM expenses e WHERE e.vendor_id = v.vendor_id) as expense_count,
                (SELECT COALESCE(SUM(amount), 0) FROM expenses e WHERE e.vendor_id = v.vendor_id) as total_expense_amount
            FROM vendors v
            ORDER BY v.name ASC
        `);

        res.json({
            success: true,
            data: {
                vendors: result.rows
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
