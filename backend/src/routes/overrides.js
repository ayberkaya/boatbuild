/**
 * Hak Ediş Override Routes
 * BoatBuild CRM - Owner approval workflow for conditional items
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { query, transaction } = require('../db/connection');
const { authenticate, requireAuthenticated, requireOwner, logAudit } = require('../middleware/auth');
const { calculateHakEdis, HAK_EDIS_RATE } = require('../engine/hakEdisEngine');

const router = express.Router();

/**
 * GET /api/overrides
 * List all override requests
 */
router.get('/', authenticate, requireAuthenticated, async (req, res) => {
    try {
        const { status, page = 1, limit = 50 } = req.query;

        let whereClause = '';
        const params = [];
        let paramCount = 0;

        if (status) {
            paramCount++;
            whereClause += ` AND o.status = $${paramCount}`;
            params.push(status);
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);
        paramCount++;
        params.push(parseInt(limit));
        paramCount++;
        params.push(offset);

        const result = await query(`
            SELECT 
                o.*,
                e.date as expense_date,
                e.vendor_name,
                e.amount as expense_amount,
                e.primary_tag,
                e.work_scope_level,
                e.hak_edis_policy,
                u1.full_name as requested_by_name,
                u2.full_name as approved_by_name
            FROM hak_edis_overrides o
            JOIN expenses e ON o.expense_id = e.expense_id
            JOIN users u1 ON o.requested_by = u1.user_id
            LEFT JOIN users u2 ON o.approved_by = u2.user_id
            WHERE 1=1 ${whereClause}
            ORDER BY 
                CASE o.status WHEN 'PENDING' THEN 0 ELSE 1 END,
                o.requested_at DESC
            LIMIT $${paramCount - 1} OFFSET $${paramCount}
        `, params);

        res.json({
            success: true,
            data: {
                overrides: result.rows
            }
        });
    } catch (error) {
        console.error('[Overrides] List error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch overrides'
        });
    }
});

/**
 * GET /api/overrides/pending
 * Get pending override requests (for Owner dashboard)
 */
router.get('/pending', authenticate, requireOwner, async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                o.*,
                e.date as expense_date,
                e.vendor_name,
                e.amount as expense_amount,
                e.primary_tag,
                e.work_scope_level,
                e.description as expense_description,
                u.full_name as requested_by_name
            FROM hak_edis_overrides o
            JOIN expenses e ON o.expense_id = e.expense_id
            JOIN users u ON o.requested_by = u.user_id
            WHERE o.status = 'PENDING'
            ORDER BY o.requested_at ASC
        `);

        // Calculate total potential exposure
        const totalPotentialExposure = result.rows.reduce((sum, row) => {
            return sum + parseFloat(row.requested_hak_edis_amount || 0);
        }, 0);

        res.json({
            success: true,
            data: {
                pending_overrides: result.rows,
                count: result.rows.length,
                total_potential_exposure: Math.round(totalPotentialExposure * 100) / 100
            }
        });
    } catch (error) {
        console.error('[Overrides] Pending list error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch pending overrides'
        });
    }
});

/**
 * POST /api/overrides
 * Create override request for conditional expense
 */
router.post('/', authenticate, requireAuthenticated, [
    body('expense_id').isUUID(),
    body('reason').notEmpty().trim().isLength({ min: 10 })
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { expense_id, reason } = req.body;

        // Get expense
        const expenseResult = await query('SELECT * FROM expenses WHERE expense_id = $1', [expense_id]);
        if (expenseResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Expense not found'
            });
        }

        const expense = expenseResult.rows[0];

        // Validate expense is CONDITIONAL
        if (expense.hak_edis_policy !== 'CONDITIONAL') {
            return res.status(400).json({
                success: false,
                error: 'Override requests are only for CONDITIONAL expenses',
                code: 'NOT_CONDITIONAL'
            });
        }

        // Check for existing pending override
        const existingOverride = await query(
            'SELECT override_id FROM hak_edis_overrides WHERE expense_id = $1 AND status = $2',
            [expense_id, 'PENDING']
        );

        if (existingOverride.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Pending override request already exists for this expense',
                code: 'OVERRIDE_EXISTS'
            });
        }

        const override_id = uuidv4();
        const potentialHakEdis = Math.round(expense.amount * HAK_EDIS_RATE * 100) / 100;

        const result = await transaction(async (client) => {
            // Create override request
            const overrideResult = await client.query(`
                INSERT INTO hak_edis_overrides (
                    override_id, expense_id,
                    original_is_eligible, original_hak_edis_amount,
                    requested_is_eligible, requested_hak_edis_amount,
                    reason, requested_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                RETURNING *
            `, [
                override_id, expense_id,
                expense.is_hak_edis_eligible, expense.hak_edis_amount,
                true, potentialHakEdis,
                reason, req.user.user_id
            ]);

            // Update expense with override reference
            await client.query(
                'UPDATE expenses SET override_id = $1, updated_at = NOW() WHERE expense_id = $2',
                [override_id, expense_id]
            );

            // Resolve existing conditional alert
            await client.query(`
                UPDATE alerts SET is_resolved = true, resolved_at = NOW()
                WHERE expense_id = $1 AND alert_type = 'CONDITIONAL_PENDING' AND is_resolved = false
            `, [expense_id]);

            // Create new alert for pending approval
            await client.query(`
                INSERT INTO alerts (alert_type, severity, title, message, expense_id)
                VALUES ('OVERRIDE_PENDING', 'HIGH', 'Hak Ediş Override Pending Approval', $1, $2)
            `, [
                `Override request for ${expense.vendor_name}: ${potentialHakEdis} TRY hak ediş. Reason: ${reason}`,
                expense_id
            ]);

            return overrideResult.rows[0];
        });

        await logAudit(req.user.user_id, 'CREATE_OVERRIDE', 'hak_edis_overrides', override_id, null, result, req);

        res.status(201).json({
            success: true,
            data: {
                override: result
            }
        });
    } catch (error) {
        console.error('[Overrides] Create error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create override request'
        });
    }
});

/**
 * POST /api/overrides/:id/approve
 * Approve override request (Owner only)
 */
router.post('/:id/approve', authenticate, requireOwner, [
    body('notes').optional().trim()
], async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const existingResult = await query(`
            SELECT o.*, e.expense_id, e.amount
            FROM hak_edis_overrides o
            JOIN expenses e ON o.expense_id = e.expense_id
            WHERE o.override_id = $1
        `, [id]);

        if (existingResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Override request not found'
            });
        }

        const existing = existingResult.rows[0];

        if (existing.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                error: `Override is already ${existing.status.toLowerCase()}`
            });
        }

        await transaction(async (client) => {
            // Update override status
            await client.query(`
                UPDATE hak_edis_overrides SET
                    status = 'APPROVED',
                    approved_by = $1,
                    approved_at = NOW(),
                    approval_notes = $2,
                    updated_at = NOW()
                WHERE override_id = $3
            `, [req.user.user_id, notes, id]);

            // Update expense with new hak ediş values
            await client.query(`
                UPDATE expenses SET
                    is_hak_edis_eligible = true,
                    hak_edis_amount = $1,
                    has_owner_override = true,
                    updated_at = NOW()
                WHERE expense_id = $2
            `, [existing.requested_hak_edis_amount, existing.expense_id]);

            // Resolve pending alert
            await client.query(`
                UPDATE alerts SET is_resolved = true, resolved_at = NOW(), resolved_by = $1
                WHERE expense_id = $2 AND alert_type = 'OVERRIDE_PENDING' AND is_resolved = false
            `, [req.user.user_id, existing.expense_id]);
        });

        await logAudit(req.user.user_id, 'APPROVE_OVERRIDE', 'hak_edis_overrides', id, existing, { status: 'APPROVED' }, req);

        res.json({
            success: true,
            message: 'Override approved successfully',
            data: {
                expense_id: existing.expense_id,
                new_hak_edis_amount: existing.requested_hak_edis_amount
            }
        });
    } catch (error) {
        console.error('[Overrides] Approve error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to approve override'
        });
    }
});

/**
 * POST /api/overrides/:id/reject
 * Reject override request (Owner only)
 */
router.post('/:id/reject', authenticate, requireOwner, [
    body('notes').notEmpty().trim().withMessage('Rejection reason is required')
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const { id } = req.params;
        const { notes } = req.body;

        const existingResult = await query(`
            SELECT o.*, e.expense_id
            FROM hak_edis_overrides o
            JOIN expenses e ON o.expense_id = e.expense_id
            WHERE o.override_id = $1
        `, [id]);

        if (existingResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Override request not found'
            });
        }

        const existing = existingResult.rows[0];

        if (existing.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                error: `Override is already ${existing.status.toLowerCase()}`
            });
        }

        await transaction(async (client) => {
            // Update override status
            await client.query(`
                UPDATE hak_edis_overrides SET
                    status = 'REJECTED',
                    approved_by = $1,
                    approved_at = NOW(),
                    approval_notes = $2,
                    updated_at = NOW()
                WHERE override_id = $3
            `, [req.user.user_id, notes, id]);

            // Clear override reference from expense (keep it excluded)
            await client.query(`
                UPDATE expenses SET
                    override_id = NULL,
                    updated_at = NOW()
                WHERE expense_id = $1
            `, [existing.expense_id]);

            // Resolve pending alert and create rejection alert
            await client.query(`
                UPDATE alerts SET is_resolved = true, resolved_at = NOW(), resolved_by = $1
                WHERE expense_id = $2 AND alert_type = 'OVERRIDE_PENDING' AND is_resolved = false
            `, [req.user.user_id, existing.expense_id]);

            await client.query(`
                INSERT INTO alerts (alert_type, severity, title, message, expense_id)
                VALUES ('OVERRIDE_REJECTED', 'LOW', 'Hak Ediş Override Rejected', $1, $2)
            `, [notes, existing.expense_id]);
        });

        await logAudit(req.user.user_id, 'REJECT_OVERRIDE', 'hak_edis_overrides', id, existing, { status: 'REJECTED', notes }, req);

        res.json({
            success: true,
            message: 'Override rejected',
            data: {
                expense_id: existing.expense_id,
                rejection_reason: notes
            }
        });
    } catch (error) {
        console.error('[Overrides] Reject error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reject override'
        });
    }
});

module.exports = router;
