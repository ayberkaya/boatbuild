/**
 * Expense Routes
 * BoatBuild CRM - Core expense management with hak ediş calculation
 */

const express = require('express');
const { body, query: checkQuery, validationResult } = require('express-validator');
const { v4: uuidv4 } = require('uuid');
const { query, transaction } = require('../db/connection');
const { authenticate, requireAuthenticated, requireOwner, logAudit } = require('../middleware/auth');
const {
    calculateHakEdis,
    validateExpenseForHakEdis,
    isDocumentationRequired,
    WORK_SCOPE_LEVEL,
    HAK_EDIS_POLICY
} = require('../engine/hakEdisEngine');

const router = express.Router();

/**
 * GET /api/expenses
 * List all expenses with filtering
 */
router.get('/', authenticate, requireAuthenticated, async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50,
            start_date,
            end_date,
            vendor_id,
            primary_tag,
            work_scope_level,
            is_hak_edis_eligible
        } = req.query;

        let whereClause = '';
        const params = [];
        let paramCount = 0;

        if (start_date) {
            paramCount++;
            whereClause += ` AND e.date >= $${paramCount}`;
            params.push(start_date);
        }

        if (end_date) {
            paramCount++;
            whereClause += ` AND e.date <= $${paramCount}`;
            params.push(end_date);
        }

        if (vendor_id) {
            paramCount++;
            whereClause += ` AND e.vendor_id = $${paramCount}`;
            params.push(vendor_id);
        }

        if (primary_tag) {
            paramCount++;
            whereClause += ` AND e.primary_tag = $${paramCount}`;
            params.push(primary_tag);
        }

        if (work_scope_level) {
            paramCount++;
            whereClause += ` AND e.work_scope_level = $${paramCount}`;
            params.push(work_scope_level);
        }

        if (is_hak_edis_eligible !== undefined) {
            paramCount++;
            whereClause += ` AND e.is_hak_edis_eligible = $${paramCount}`;
            params.push(is_hak_edis_eligible === 'true');
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
                e.*,
                v.name as vendor_display_name,
                t.status as transfer_status,
                u.full_name as created_by_name,
                (SELECT COUNT(*) FROM documents d WHERE d.expense_id = e.expense_id) as document_count
            FROM expenses e
            LEFT JOIN vendors v ON e.vendor_id = v.vendor_id
            LEFT JOIN transfers t ON e.linked_transfer_id = t.transfer_id
            LEFT JOIN users u ON e.created_by = u.user_id
            WHERE 1=1 ${whereClause}
            ORDER BY e.date DESC, e.created_at DESC
            LIMIT $${limitParam} OFFSET $${offsetParam}
        `;

        const countSql = `
            SELECT COUNT(*) as total
            FROM expenses e
            WHERE 1=1 ${whereClause}
        `;

        const [expensesResult, countResult] = await Promise.all([
            query(sql, params),
            query(countSql, params.slice(0, -2))
        ]);

        res.json({
            success: true,
            data: {
                expenses: expensesResult.rows,
                pagination: {
                    page: parseInt(page),
                    limit: parseInt(limit),
                    total: parseInt(countResult.rows[0].total),
                    pages: Math.ceil(countResult.rows[0].total / parseInt(limit))
                }
            }
        });
    } catch (error) {
        console.error('[Expenses] List error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch expenses'
        });
    }
});

/**
 * GET /api/expenses/hakedis-summary
 * Get Kaan hakediş summary (base amount, total, paid, remaining)
 * IMPORTANT: This must be defined BEFORE /:id route
 */
router.get('/hakedis-summary', authenticate, requireAuthenticated, async (req, res) => {
    try {
        // Get hakediş base amount (sum of expenses where is_hak_edis_eligible = true)
        const baseResult = await query(`
            SELECT COALESCE(SUM(amount), 0) as base_amount
            FROM expenses
            WHERE is_hak_edis_eligible = true
        `);
        
        // Get total hak_edis_amount (sum of all hak_edis_amount)
        const hakEdisResult = await query(`
            SELECT COALESCE(SUM(hak_edis_amount), 0) as total_hakedis
            FROM expenses
        `);
        
        // Get paid amount (expenses with KAAN_ODEME tag)
        const paidResult = await query(`
            SELECT COALESCE(SUM(amount), 0) as paid_amount
            FROM expenses
            WHERE UPPER(primary_tag) = 'KAAN_ODEME'
        `);
        
        // Get Kaan payment history
        const paymentsResult = await query(`
            SELECT expense_id, date, amount, description, vendor_name
            FROM expenses
            WHERE UPPER(primary_tag) = 'KAAN_ODEME'
            ORDER BY date DESC
        `);
        
        const baseAmount = parseFloat(baseResult.rows[0].base_amount) || 0;
        const totalHakedis = parseFloat(hakEdisResult.rows[0].total_hakedis) || 0;
        const paidAmount = parseFloat(paidResult.rows[0].paid_amount) || 0;
        const remainingAmount = totalHakedis - paidAmount;
        
        res.json({
            success: true,
            data: {
                summary: {
                    baseAmount,
                    totalHakedis,
                    paidAmount,
                    remainingAmount,
                },
                payments: paymentsResult.rows
            }
        });
    } catch (error) {
        console.error('[Expenses] Hakedis summary error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch hakediş summary'
        });
    }
});

/**
 * GET /api/expenses/:id
 * Get single expense with details
 */
router.get('/:id', authenticate, requireAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await query(`
            SELECT 
                e.*,
                v.name as vendor_display_name,
                v.requires_documentation as vendor_requires_docs,
                t.status as transfer_status,
                t.amount as transfer_amount,
                u.full_name as created_by_name,
                o.override_id,
                o.status as override_status,
                o.reason as override_reason
            FROM expenses e
            LEFT JOIN vendors v ON e.vendor_id = v.vendor_id
            LEFT JOIN transfers t ON e.linked_transfer_id = t.transfer_id
            LEFT JOIN users u ON e.created_by = u.user_id
            LEFT JOIN hak_edis_overrides o ON e.override_id = o.override_id
            WHERE e.expense_id = $1
        `, [id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Expense not found'
            });
        }

        // Get related documents
        const documentsResult = await query(
            'SELECT * FROM documents WHERE expense_id = $1 ORDER BY uploaded_at DESC',
            [id]
        );

        res.json({
            success: true,
            data: {
                expense: result.rows[0],
                documents: documentsResult.rows
            }
        });
    } catch (error) {
        console.error('[Expenses] Get error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch expense'
        });
    }
});

/**
 * POST /api/expenses
 * Create new expense with hak ediş calculation
 */
router.post('/', authenticate, requireAuthenticated, [
    body('date').isISO8601(),
    body('vendor_name').notEmpty().trim(),
    body('amount').isFloat({ min: 0.01 }),
    body('primary_tag').notEmpty().trim(),
    body('work_scope_level').isIn(Object.values(WORK_SCOPE_LEVEL)),
    body('hak_edis_policy').isIn(Object.values(HAK_EDIS_POLICY)),
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
            vendor_id,
            vendor_name,
            amount,
            currency = 'TRY',
            description,
            primary_tag,
            work_scope_level,
            hak_edis_policy,
            linked_transfer_id,
            category_id
        } = req.body;

        // Validate for hak ediş
        const validation = validateExpenseForHakEdis({
            primary_tag,
            work_scope_level,
            hak_edis_policy,
            amount
        });

        if (!validation.isValid) {
            return res.status(400).json({
                success: false,
                error: 'Validation failed',
                details: validation.errors
            });
        }

        // Check documentation requirement
        let vendor = null;
        if (vendor_id) {
            const vendorResult = await query('SELECT * FROM vendors WHERE vendor_id = $1', [vendor_id]);
            vendor = vendorResult.rows[0];
        }

        const docRequirement = isDocumentationRequired(
            { work_scope_level, primary_tag, vendor_name },
            vendor
        );

        // Calculate hak ediş
        const hakEdisResult = calculateHakEdis({
            amount,
            work_scope_level,
            hak_edis_policy
        });

        const expense_id = uuidv4();

        // Create expense within transaction
        const newExpense = await transaction(async (client) => {
            const insertResult = await client.query(`
                INSERT INTO expenses (
                    expense_id, date, vendor_id, vendor_name, amount, currency,
                    description, primary_tag, work_scope_level, hak_edis_policy,
                    is_hak_edis_eligible, hak_edis_amount, linked_transfer_id,
                    category_id, created_by
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
                RETURNING *
            `, [
                expense_id, date, vendor_id, vendor_name, amount, currency,
                description, primary_tag, work_scope_level, hak_edis_policy,
                hakEdisResult.is_eligible, hakEdisResult.hak_edis_amount,
                linked_transfer_id, category_id, req.user.user_id
            ]);

            // Create alert if documentation is required but not uploaded
            if (docRequirement.required) {
                await client.query(`
                    INSERT INTO alerts (alert_type, severity, title, message, expense_id)
                    VALUES ('MISSING_DOCUMENT', 'HIGH', 'Documentation Required', $1, $2)
                `, [docRequirement.reason, expense_id]);
            }

            // Create alert if conditional and pending approval
            if (hakEdisResult.requires_owner_approval) {
                await client.query(`
                    INSERT INTO alerts (alert_type, severity, title, message, expense_id)
                    VALUES ('CONDITIONAL_PENDING', 'MEDIUM', 'Conditional Hak Ediş Pending', $1, $2)
                `, [
                    `Expense requires owner approval for hak ediş. Potential: ${hakEdisResult.potential_hak_edis} TRY`,
                    expense_id
                ]);
            }

            return insertResult.rows[0];
        });

        await logAudit(req.user.user_id, 'CREATE_EXPENSE', 'expenses', expense_id, null, newExpense, req);

        res.status(201).json({
            success: true,
            data: {
                expense: newExpense,
                hak_edis_calculation: hakEdisResult,
                documentation_required: docRequirement
            }
        });
    } catch (error) {
        console.error('[Expenses] Create error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create expense'
        });
    }
});

/**
 * PUT /api/expenses/:id
 * Update expense (Operation cannot change hak ediş rate)
 */
router.put('/:id', authenticate, requireAuthenticated, [
    body('date').optional().isISO8601(),
    body('amount').optional().isFloat({ min: 0.01 }),
    body('primary_tag').optional().notEmpty().trim(),
    body('work_scope_level').optional().isIn(Object.values(WORK_SCOPE_LEVEL)),
    body('hak_edis_policy').optional().isIn(Object.values(HAK_EDIS_POLICY))
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

        // Get existing expense
        const existingResult = await query('SELECT * FROM expenses WHERE expense_id = $1', [id]);
        if (existingResult.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Expense not found'
            });
        }

        const existing = existingResult.rows[0];

        // Operation users cannot modify hak_edis_rate
        if (req.user.role === 'OPERATION' && req.body.hak_edis_rate !== undefined) {
            return res.status(403).json({
                success: false,
                error: 'Operation users cannot modify hak ediş rate',
                code: 'HAK_EDIS_RATE_FORBIDDEN'
            });
        }

        // Merge updates
        const updated = {
            date: req.body.date || existing.date,
            vendor_id: req.body.vendor_id !== undefined ? req.body.vendor_id : existing.vendor_id,
            vendor_name: req.body.vendor_name || existing.vendor_name,
            amount: req.body.amount || existing.amount,
            currency: req.body.currency || existing.currency,
            description: req.body.description !== undefined ? req.body.description : existing.description,
            primary_tag: req.body.primary_tag || existing.primary_tag,
            work_scope_level: req.body.work_scope_level || existing.work_scope_level,
            hak_edis_policy: req.body.hak_edis_policy || existing.hak_edis_policy,
            linked_transfer_id: req.body.linked_transfer_id !== undefined ? req.body.linked_transfer_id : existing.linked_transfer_id,
            category_id: req.body.category_id !== undefined ? req.body.category_id : existing.category_id
        };

        // Recalculate hak ediş if relevant fields changed
        const hakEdisResult = calculateHakEdis({
            amount: updated.amount,
            work_scope_level: updated.work_scope_level,
            hak_edis_policy: updated.hak_edis_policy
        }, {
            hasOwnerOverride: existing.has_owner_override,
            overrideEligibility: existing.is_hak_edis_eligible
        });

        const result = await query(`
            UPDATE expenses SET
                date = $1, vendor_id = $2, vendor_name = $3, amount = $4,
                currency = $5, description = $6, primary_tag = $7,
                work_scope_level = $8, hak_edis_policy = $9,
                is_hak_edis_eligible = $10, hak_edis_amount = $11,
                linked_transfer_id = $12, category_id = $13,
                updated_at = NOW()
            WHERE expense_id = $14
            RETURNING *
        `, [
            updated.date, updated.vendor_id, updated.vendor_name, updated.amount,
            updated.currency, updated.description, updated.primary_tag,
            updated.work_scope_level, updated.hak_edis_policy,
            hakEdisResult.is_eligible, hakEdisResult.hak_edis_amount,
            updated.linked_transfer_id, updated.category_id, id
        ]);

        await logAudit(req.user.user_id, 'UPDATE_EXPENSE', 'expenses', id, existing, result.rows[0], req);

        res.json({
            success: true,
            data: {
                expense: result.rows[0],
                hak_edis_calculation: hakEdisResult
            }
        });
    } catch (error) {
        console.error('[Expenses] Update error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to update expense'
        });
    }
});

/**
 * DELETE /api/expenses/:id
 * Delete expense (Owner only)
 */
router.delete('/:id', authenticate, requireOwner, async (req, res) => {
    try {
        const { id } = req.params;

        const existing = await query('SELECT * FROM expenses WHERE expense_id = $1', [id]);
        if (existing.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Expense not found'
            });
        }

        await transaction(async (client) => {
            // Delete related documents records (not files)
            await client.query('DELETE FROM documents WHERE expense_id = $1', [id]);
            // Delete related alerts
            await client.query('DELETE FROM alerts WHERE expense_id = $1', [id]);
            // Delete related overrides
            await client.query('DELETE FROM hak_edis_overrides WHERE expense_id = $1', [id]);
            // Delete expense
            await client.query('DELETE FROM expenses WHERE expense_id = $1', [id]);
        });

        await logAudit(req.user.user_id, 'DELETE_EXPENSE', 'expenses', id, existing.rows[0], null, req);

        res.json({
            success: true,
            message: 'Expense deleted successfully'
        });
    } catch (error) {
        console.error('[Expenses] Delete error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to delete expense'
        });
    }
});

/**
 * GET /api/expenses/categories/list
 * Get expense categories (deduplicated by name)
 */
router.get('/categories/list', authenticate, requireAuthenticated, async (req, res) => {
    try {
        // Use DISTINCT ON to deduplicate by name, keeping the first entry
        const result = await query(`
            SELECT DISTINCT ON (name) *
            FROM expense_categories
            ORDER BY name, category_id
        `);
        res.json({
            success: true,
            data: {
                categories: result.rows
            }
        });
    } catch (error) {
        console.error('[Expenses] Categories error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch categories'
        });
    }
});

/**
 * POST /api/expenses/import
 * Bulk import expenses from CSV data
 * Owner only - imports multiple expenses at once
 */
router.post('/import', authenticate, requireOwner, async (req, res) => {
    try {
        const { expenses } = req.body;

        if (!Array.isArray(expenses) || expenses.length === 0) {
            return res.status(400).json({
                success: false,
                error: 'expenses array is required and must not be empty'
            });
        }

        if (expenses.length > 500) {
            return res.status(400).json({
                success: false,
                error: 'Maximum 500 expenses can be imported at once'
            });
        }

        const results = {
            imported: 0,
            failed: 0,
            errors: [],
            expenses: []
        };

        // Process each expense within a transaction
        await transaction(async (client) => {
            for (let i = 0; i < expenses.length; i++) {
                const exp = expenses[i];
                
                try {
                    // Validate required fields
                    if (!exp.date || !exp.vendor_name || !exp.amount || !exp.primary_tag || 
                        !exp.work_scope_level || !exp.hak_edis_policy) {
                        throw new Error(`Missing required fields at index ${i}`);
                    }

                    // Validate enums
                    if (!Object.values(WORK_SCOPE_LEVEL).includes(exp.work_scope_level)) {
                        throw new Error(`Invalid work_scope_level: ${exp.work_scope_level} at index ${i}`);
                    }
                    if (!Object.values(HAK_EDIS_POLICY).includes(exp.hak_edis_policy)) {
                        throw new Error(`Invalid hak_edis_policy: ${exp.hak_edis_policy} at index ${i}`);
                    }

                    // Calculate hak ediş
                    const hakEdisResult = calculateHakEdis({
                        amount: parseFloat(exp.amount),
                        work_scope_level: exp.work_scope_level,
                        hak_edis_policy: exp.hak_edis_policy
                    });

                    // Use provided expense_id or generate new one
                    const expense_id = exp.expense_id || uuidv4();

                    // Handle is_hak_edis_eligible - use provided value or calculated
                    const is_eligible = exp.is_hak_edis_eligible !== undefined 
                        ? exp.is_hak_edis_eligible 
                        : hakEdisResult.is_eligible;
                    
                    // Handle hak_edis_amount - use provided value or calculated
                    const hak_edis_amount = exp.hak_edis_amount !== undefined 
                        ? parseFloat(exp.hak_edis_amount) 
                        : hakEdisResult.hak_edis_amount;

                    const insertResult = await client.query(`
                        INSERT INTO expenses (
                            expense_id, date, vendor_name, amount, currency,
                            description, primary_tag, work_scope_level, hak_edis_policy,
                            is_hak_edis_eligible, hak_edis_amount, payment_method, created_by
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
                        RETURNING expense_id, date, vendor_name, amount, primary_tag
                    `, [
                        expense_id,
                        exp.date,
                        exp.vendor_name,
                        parseFloat(exp.amount),
                        exp.currency || 'USD',
                        exp.description || '',
                        exp.primary_tag,
                        exp.work_scope_level,
                        exp.hak_edis_policy,
                        is_eligible,
                        hak_edis_amount,
                        exp.payment_method || null,
                        req.user.user_id
                    ]);

                    results.imported++;
                    results.expenses.push(insertResult.rows[0]);
                } catch (err) {
                    results.failed++;
                    results.errors.push({
                        index: i,
                        expense: exp,
                        error: err.message
                    });
                }
            }
        });

        // Log the import action
        await logAudit(req.user.user_id, 'BULK_IMPORT', 'expenses', null, null, {
            imported: results.imported,
            failed: results.failed
        }, req);

        res.status(results.failed > 0 ? 207 : 201).json({
            success: results.failed === 0,
            data: results
        });
    } catch (error) {
        console.error('[Expenses] Import error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to import expenses',
            details: error.message
        });
    }
});

/**
 * POST /api/expenses/categories
 * Create new expense category
 */
router.post('/categories', authenticate, requireAuthenticated, [
    body('name').notEmpty().trim(),
    body('primary_tag').notEmpty().trim(),
    body('default_work_scope').isIn(Object.values(WORK_SCOPE_LEVEL)),
    body('default_hak_edis_policy').isIn(Object.values(HAK_EDIS_POLICY)),
    body('requires_documentation').optional().isBoolean(),
    body('description').optional().trim()
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
            name,
            primary_tag,
            default_work_scope,
            default_hak_edis_policy,
            requires_documentation = false,
            description
        } = req.body;

        // Check if category with same name or primary_tag exists
        const existing = await query(
            'SELECT category_id FROM expense_categories WHERE name = $1 OR primary_tag = $2',
            [name, primary_tag]
        );

        if (existing.rows.length > 0) {
            return res.status(400).json({
                success: false,
                error: 'Category with this name or primary tag already exists'
            });
        }

        const result = await query(`
            INSERT INTO expense_categories (
                name, primary_tag, default_work_scope, default_hak_edis_policy,
                requires_documentation, description
            ) VALUES ($1, $2, $3, $4, $5, $6)
            RETURNING *
        `, [name, primary_tag, default_work_scope, default_hak_edis_policy, requires_documentation, description]);

        await logAudit(req.user.user_id, 'CREATE_CATEGORY', 'expense_categories', result.rows[0].category_id, null, result.rows[0], req);

        res.status(201).json({
            success: true,
            data: {
                category: result.rows[0]
            }
        });
    } catch (error) {
        console.error('[Expenses] Create category error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to create category'
        });
    }
});

module.exports = router;
