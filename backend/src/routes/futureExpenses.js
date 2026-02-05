/**
 * Future Expense Routes
 * BoatBuild CRM - Future cash flow management
 */

const express = require('express');
const { body, query: checkQuery, validationResult } = require('express-validator');
const { query, transaction } = require('../db/connection');
const { authenticate, requireAuthenticated } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/future-expenses
 * List all future expenses with sorting and filtering
 */
router.get('/', authenticate, requireAuthenticated, async (req, res) => {
    try {
        const { sort_by = 'date', sort_order = 'ASC', start_date, end_date, search } = req.query;

        let whereClause = '1=1';
        const params = [];
        let paramCount = 0;

        if (start_date) {
            paramCount++;
            whereClause += ` AND date >= $${paramCount}`;
            params.push(start_date);
        }

        if (end_date) {
            paramCount++;
            whereClause += ` AND date <= $${paramCount}`;
            params.push(end_date);
        }

        if (search) {
            paramCount++;
            whereClause += ` AND ILIKE(title, $${paramCount})`;
            whereClause = whereClause.replace(`ILIKE(title, $${paramCount})`, `title ILIKE $${paramCount}`);
            params.push(`%${search}%`);
        }

        const validSortFields = ['date', 'amount', 'title', 'created_at', 'status'];
        const safeSortBy = validSortFields.includes(sort_by) ? sort_by : 'date';
        const safeSortOrder = sort_order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

        const sql = `
            SELECT * FROM future_expenses
            WHERE ${whereClause}
            ORDER BY ${safeSortBy} ${safeSortOrder}
        `;

        const result = await query(sql, params);

        const totalAmount = result.rows.reduce((sum, row) => sum + parseFloat(row.amount || 0), 0);

        res.json({
            success: true,
            data: {
                expenses: result.rows,
                totals: { totalAmount }
            }
        });
    } catch (error) {
        console.error('[Future Expenses] List error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch future expenses'
        });
    }
});

/**
 * POST /api/future-expenses
 * Create a new future expense item
 */
router.post('/', authenticate, requireAuthenticated, [
    body('title').notEmpty().trim(),
    body('amount').isFloat({ min: 0 }),
    body('date').isISO8601(),
    body('currency').optional().isIn(['TRY', 'USD', 'EUR']),
    body('status').optional().isIn(['PENDING', 'PAID', 'CANCELLED'])
], async (req, res) => {
    try {
        const errors = validationResult(req);
        if (!errors.isEmpty()) {
            return res.status(400).json({ success: false, errors: errors.array() });
        }

        const { title, amount, date, currency = 'EUR', status = 'PENDING' } = req.body;

        const result = await query(`
            INSERT INTO future_expenses (title, amount, date, currency, status)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING *
        `, [title, amount, date, currency, status]);

        res.status(201).json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('[Future Expenses] Create error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create future expense'
        });
    }
});

/**
 * PUT /api/future-expenses/:id
 * Update a future expense item
 */
router.put('/:id', authenticate, requireAuthenticated, [
    body('title').optional().notEmpty().trim(),
    body('amount').optional().isFloat({ min: 0 }),
    body('date').optional().isISO8601(),
    body('currency').optional().isIn(['TRY', 'USD', 'EUR']),
    body('status').optional().isIn(['PENDING', 'PAID', 'CANCELLED'])
], async (req, res) => {
    try {
        const { id } = req.params;
        const { title, amount, date, currency, status } = req.body;

        const existing = await query('SELECT * FROM future_expenses WHERE id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Not found' });
        }
        const current = existing.rows[0];

        const updated = {
            title: title || current.title,
            amount: amount !== undefined ? amount : current.amount,
            date: date || current.date,
            currency: currency || current.currency,
            status: status || current.status
        };

        if (updated.status === 'PAID' && current.status !== 'PAID') {
            await transaction(async (client) => {
                await client.query(`
                    INSERT INTO expenses (
                        date, vendor_name, amount, currency, description, primary_tag, created_at, updated_at
                    ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
                `, [
                    updated.date,
                    updated.title,
                    updated.amount,
                    updated.currency,
                    `Gelecek Giderlerden Transfer: ${updated.title}`,
                    'Genel'
                ]);

                await client.query('DELETE FROM future_expenses WHERE id = $1', [id]);
            });

            return res.json({
                success: true,
                message: 'Expense moved to main expenses list',
                moved: true
            });
        }

        const result = await query(`
            UPDATE future_expenses 
            SET title = $1, amount = $2, date = $3, currency = $4, status = $5, updated_at = NOW()
            WHERE id = $6
            RETURNING *
        `, [updated.title, updated.amount, updated.date, updated.currency, updated.status, id]);

        res.json({
            success: true,
            data: result.rows[0]
        });
    } catch (error) {
        console.error('[Future Expenses] Update error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update future expense'
        });
    }
});

/**
 * DELETE /api/future-expenses/:id
 * Delete a future expense item
 */
router.delete('/:id', authenticate, requireAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const result = await query('DELETE FROM future_expenses WHERE id = $1 RETURNING id', [id]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'Not found' });
        }

        res.json({
            success: true,
            message: 'Deleted successfully'
        });
    } catch (error) {
        console.error('[Future Expenses] Delete error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete'
        });
    }
});

module.exports = router;
