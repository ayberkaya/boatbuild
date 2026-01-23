/**
 * Transfer Routes
 * BoatBuild CRM - Transfer management with approval workflow
 */

const express = require('express');
const { body, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { query, transaction } = require('../db/connection');
const { authenticate, requireAuthenticated, requireOwner, logAudit } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/transfers
 * List all transfers with filtering
 */
router.get('/', authenticate, requireAuthenticated, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            start_date,
            end_date,
            vendor_id,
            status
        } = req.query;

        let whereClause = '';
        const params = [];
        let paramCount = 0;

        if (start_date) {
            paramCount++;
            whereClause += ` AND t.date >= $${paramCount}`;
            params.push(start_date);
        }

        if (end_date) {
            paramCount++;
            whereClause += ` AND t.date <= $${paramCount}`;
            params.push(end_date);
        }

        if (vendor_id) {
            paramCount++;
            whereClause += ` AND t.vendor_id = $${paramCount}`;
            params.push(vendor_id);
        }

        if (status) {
            paramCount++;
            whereClause += ` AND t.status = $${paramCount}`;
            params.push(status);
        }

        const offset = (parseInt(page) - 1) * parseInt(limit);
        paramCount++;
        const limitParam = paramCount;
        params.push(parseInt(limit));
        paramCount++;
        const offsetParam = paramCount;
        params.push(offset);

        const sql = `
            SELECT 
                t.*,
                v.name as vendor_name,
                u1.full_name as created_by_name,
                u2.full_name as approved_by_name,
                (SELECT COUNT(*) FROM expenses e WHERE e.linked_transfer_id = t.transfer_id) as linked_expense_count,
                (SELECT COALESCE(SUM(amount), 0) FROM expenses e WHERE e.linked_transfer_id = t.transfer_id) as linked_expense_total
            FROM transfers t
            LEFT JOIN vendors v ON t.vendor_id = v.vendor_id
            LEFT JOIN users u1 ON t.created_by = u1.user_id
            LEFT JOIN users u2 ON t.approved_by = u2.user_id
            WHERE 1=1 ${whereClause}
            ORDER BY t.date DESC, t.created_at DESC
            LIMIT $${limitParam} OFFSET $${offsetParam}
        `;

        const countSql = `
            SELECT COUNT(*) as total
            FROM transfers t
            WHERE 1=1 ${whereClause}
        `;

        const [transfersResult, countResult] = await Promise.all([
            query(sql, params),
            query(countSql, params.slice(0, -2))
        ]);

        res.json({
            success: true,
            data: {
                transfers: transfersResult.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: parseInt(countResult.rows[0].total),
                    pages: Math.ceil(countResult.rows[0].total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error('[Transfers] List error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch transfers'
        });
    }
});

/**
 * GET /api/transfers/:id
 * Get single transfer with linked expenses
 */
router.get('/:id', authenticate, requireAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        const transferResult = await query(`
            SELECT 
                t.*,
                v.name as vendor_name,
                u1.full_name as created_by_name,
                u2.full_name as approved_by_name
            FROM transfers t
            LEFT JOIN vendors v ON t.vendor_id = v.vendor_id
            LEFT JOIN users u1 ON t.created_by = u1.user_id
            LEFT JOIN users u2 ON t.approved_by = u2.user_id
            WHERE t.transfer_id = $1
        `, [id]);

        if (transferResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Transfer not found'
            });
        }

        // Get linked expenses
        const expensesResult = await query(`
            SELECT expense_id, date, vendor_name, amount, primary_tag, is_hak_edis_eligible, hak_edis_amount
            FROM expenses
            WHERE linked_transfer_id = $1
            ORDER BY date DESC
        `, [id]);

        // Get documents
        const documentsResult = await query(
            'SELECT * FROM documents WHERE transfer_id = $1 ORDER BY uploaded_at DESC',
            [id]
        );

        res.json({
            success: true,
            data: {
                transfer: transferResult.rows[0],
                linked_expenses: expensesResult.rows,
                documents: documentsResult.rows
            }
        });
    } catch (error) {
        console.error('[Transfers] Get error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch transfer'
        });
    }
});

/**
 * POST /api/transfers
 * Create new transfer (starts as PENDING)
 */
router.post('/', authenticate, requireAuthenticated, [
    body('date').isISO8601(),
    body('amount').isFloat({ min: 0.01 }),
    body('from_account').optional().trim(),
    body('to_account').optional().trim(),
    body('description').optional().trim(),
    body('currency').optional().isIn(['TRY', 'USD', 'EUR'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({
                success: false,
                errors: errors.array()
            });
        }

        const {
            date,
            amount,
            currency = 'TRY',
            from_account,
            to_account,
            vendor_id,
            description
        } = req.body;

        const transfer_id = uuidv4();

        const result = await query(`
            INSERT INTO transfers (
                transfer_id, date, amount, currency, from_account,
                to_account, vendor_id, description, status, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING', $9)
            RETURNING *
        `, [
            transfer_id, date, amount, currency, from_account,
            to_account, vendor_id, description, req.user.user_id
        ]);

        await logAudit(req.user.user_id, 'CREATE_TRANSFER', 'transfers', transfer_id, null, result.rows[0], req);

        res.status(201).json({
            success: true,
            data: {
                transfer: result.rows[0]
            }
        });
    } catch (error) {
        console.error('[Transfers] Create error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create transfer'
        });
    }
});

/**
 * PUT /api/transfers/:id
 * Update transfer (only if PENDING)
 */
router.put('/:id', authenticate, requireAuthenticated, [
    body('date').optional().isISO8601(),
    body('amount').optional().isFloat({ min: 0.01 }),
    body('currency').optional().isIn(['TRY', 'USD', 'EUR'])
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

        // Get existing transfer
        const existingResult = await query('SELECT * FROM transfers WHERE transfer_id = $1', [id]);
        if (existingResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Transfer not found'
            });
        }

        const existing = existingResult.rows[0];

        // Only allow updates to PENDING transfers (unless Owner)
        if (existing.status !== 'PENDING' && req.user.role !== 'OWNER') {
            return res.status(403).json({
                success: false,
                error: 'Cannot modify non-pending transfers',
                code: 'TRANSFER_NOT_PENDING'
            });
        }

        const result = await query(`
            UPDATE transfers SET
                date = COALESCE($1, date),
                amount = COALESCE($2, amount),
                currency = COALESCE($3, currency),
                from_account = COALESCE($4, from_account),
                to_account = COALESCE($5, to_account),
                vendor_id = COALESCE($6, vendor_id),
                description = COALESCE($7, description),
                updated_at = NOW()
            WHERE transfer_id = $8
            RETURNING *
        `, [
            req.body.date, req.body.amount, req.body.currency,
            req.body.from_account, req.body.to_account,
            req.body.vendor_id, req.body.description, id
        ]);

        await logAudit(req.user.user_id, 'UPDATE_TRANSFER', 'transfers', id, existing, result.rows[0], req);

        res.json({
            success: true,
            data: {
                transfer: result.rows[0]
            }
        });
    } catch (error) {
        console.error('[Transfers] Update error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update transfer'
        });
    }
});

/**
 * POST /api/transfers/:id/approve
 * Approve transfer (Owner only)
 */
router.post('/:id/approve', authenticate, requireOwner, async (req, res) => {
    try {
        const { id } = req.params;

        const existingResult = await query('SELECT * FROM transfers WHERE transfer_id = $1', [id]);
        if (existingResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Transfer not found'
            });
        }

        const existing = existingResult.rows[0];

        if (existing.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                error: `Transfer is already ${existing.status.toLowerCase()}`
            });
        }

        const result = await query(`
            UPDATE transfers SET
                status = 'APPROVED',
                approved_by = $1,
                approved_at = NOW(),
                updated_at = NOW()
            WHERE transfer_id = $2
            RETURNING *
        `, [req.user.user_id, id]);

        await logAudit(req.user.user_id, 'APPROVE_TRANSFER', 'transfers', id, existing, result.rows[0], req);

        res.json({
            success: true,
            data: {
                transfer: result.rows[0]
            }
        });
    } catch (error) {
        console.error('[Transfers] Approve error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to approve transfer'
        });
    }
});

/**
 * POST /api/transfers/:id/reject
 * Reject transfer (Owner only)
 */
router.post('/:id/reject', authenticate, requireOwner, [
    body('reason').optional().trim()
], async (req, res) => {
    try {
        const { id } = req.params;
        const { reason } = req.body;

        const existingResult = await query('SELECT * FROM transfers WHERE transfer_id = $1', [id]);
        if (existingResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Transfer not found'
            });
        }

        const existing = existingResult.rows[0];

        if (existing.status !== 'PENDING') {
            return res.status(400).json({
                success: false,
                error: `Transfer is already ${existing.status.toLowerCase()}`
            });
        }

        const result = await query(`
            UPDATE transfers SET
                status = 'REJECTED',
                approved_by = $1,
                approved_at = NOW(),
                updated_at = NOW()
            WHERE transfer_id = $2
            RETURNING *
        `, [req.user.user_id, id]);

        // Create alert for rejection
        await query(`
            INSERT INTO alerts (alert_type, severity, title, message, transfer_id)
            VALUES ('TRANSFER_REJECTED', 'HIGH', 'Transfer Rejected', $1, $2)
        `, [reason || 'Transfer was rejected by owner', id]);

        await logAudit(req.user.user_id, 'REJECT_TRANSFER', 'transfers', id, existing, result.rows[0], req);

        res.json({
            success: true,
            data: {
                transfer: result.rows[0]
            }
        });
    } catch (error) {
        console.error('[Transfers] Reject error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to reject transfer'
        });
    }
});

/**
 * GET /api/transfers/unlinked/list
 * Get transfers without linked expenses (for mismatch detection)
 */
router.get('/unlinked/list', authenticate, requireAuthenticated, async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                t.*,
                v.name as vendor_name
            FROM transfers t
            LEFT JOIN vendors v ON t.vendor_id = v.vendor_id
            WHERE t.transfer_id NOT IN (
                SELECT DISTINCT linked_transfer_id FROM expenses WHERE linked_transfer_id IS NOT NULL
            )
            AND t.status = 'APPROVED'
            ORDER BY t.date DESC
        `);

        res.json({
            success: true,
            data: {
                unlinked_transfers: result.rows,
                count: result.rows.length
            }
        });
    } catch (error) {
        console.error('[Transfers] Unlinked list error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch unlinked transfers'
        });
    }
});

module.exports = router;
