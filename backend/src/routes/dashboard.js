/**
 * Dashboard Routes
 * BoatBuild CRM - KPIs, charts, projections, and alerts for Owner
 */

const express = require('express');
const { query } = require('../db/connection');
const { authenticate, requireAuthenticated, requireOwner } = require('../middleware/auth');
const { 
    calculateHakEdisExposure, 
    getProjectionCategories,
    HAK_EDIS_RATE 
} = require('../engine/hakEdisEngine');

const router = express.Router();

/**
 * GET /api/dashboard/kpis
 * Get key performance indicators
 */
router.get('/kpis', authenticate, requireAuthenticated, async (req, res) => {
    try {
        // Total Spend by currency
        const totalSpendResult = await query(`
            SELECT 
                currency,
                COALESCE(SUM(amount), 0) as total_spend
            FROM expenses
            GROUP BY currency
        `);

        // Spend by Başlık (top-level category) grouped by currency
        const spendByBaslikResult = await query(`
            SELECT 
                CASE 
                    WHEN UPPER(primary_tag) LIKE 'IMALAT%' OR UPPER(primary_tag) IN ('MOTOR', 'KAAN_ODEME', 'ETKIN') THEN 'İmalat'
                    WHEN UPPER(primary_tag) LIKE 'YUNANISTAN%' THEN 'Yunanistan Kurulum'
                    WHEN UPPER(primary_tag) LIKE 'TERSANE%' THEN 'Tersane Kurulum'
                    WHEN UPPER(primary_tag) = 'REKLAM' THEN 'Reklam ve Tanıtım'
                    WHEN UPPER(primary_tag) = 'BARAN' THEN 'Baran'
                    ELSE 'Diğer'
                END as baslik,
                currency,
                COALESCE(SUM(amount), 0) as total_spend,
                COUNT(*) as expense_count
            FROM expenses
            GROUP BY 
                CASE 
                    WHEN UPPER(primary_tag) LIKE 'IMALAT%' OR UPPER(primary_tag) IN ('MOTOR', 'KAAN_ODEME', 'ETKIN') THEN 'İmalat'
                    WHEN UPPER(primary_tag) LIKE 'YUNANISTAN%' THEN 'Yunanistan Kurulum'
                    WHEN UPPER(primary_tag) LIKE 'TERSANE%' THEN 'Tersane Kurulum'
                    WHEN UPPER(primary_tag) = 'REKLAM' THEN 'Reklam ve Tanıtım'
                    WHEN UPPER(primary_tag) = 'BARAN' THEN 'Baran'
                    ELSE 'Diğer'
                END,
                currency
            ORDER BY total_spend DESC
        `);

        // Ödenen Hak Ediş: Kaan'a yapılan ödemeler (KAAN_ODEME kategorisi)
        const paidHakEdisResult = await query(`
            SELECT 
                currency,
                COALESCE(SUM(amount), 0) as paid_hak_edis
            FROM expenses
            WHERE UPPER(primary_tag) = 'KAAN_ODEME'
            GROUP BY currency
        `);

        // Remaining Potential Hak Ediş by currency
        const potentialResult = await query(`
            SELECT 
                currency,
                COALESCE(SUM(amount * 0.07), 0) as potential_hak_edis
            FROM expenses
            WHERE work_scope_level IN ('PURE_IMALAT', 'MALZEME_PLUS_IMALAT')
            AND is_hak_edis_eligible = false
            GROUP BY currency
        `);

        // Conditional Risk Exposure (pending approval) - not used in KPIs anymore but kept for compatibility
        const conditionalResult = await query(`
            SELECT 
                COALESCE(SUM(amount * 0.07), 0) as conditional_exposure,
                COUNT(*) as conditional_count
            FROM expenses
            WHERE hak_edis_policy = 'CONDITIONAL'
            AND is_hak_edis_eligible = false
            AND has_owner_override = false
        `);

        // Transfer vs Expense mismatch
        const mismatchResult = await query(`
            SELECT 
                (SELECT COALESCE(SUM(amount), 0) FROM transfers WHERE status = 'APPROVED') as total_transfers,
                (SELECT COALESCE(SUM(amount), 0) FROM expenses WHERE linked_transfer_id IS NOT NULL) as linked_expense_total
        `);

        const mismatch = parseFloat(mismatchResult.rows[0].total_transfers) - 
                         parseFloat(mismatchResult.rows[0].linked_expense_total);

        // Pending approvals count and future expenses by currency
        const pendingApprovalsResult = await query(`
            SELECT 
                (SELECT COUNT(*) FROM transfers WHERE status = 'PENDING') as pending_transfers,
                (SELECT COUNT(*) FROM hak_edis_overrides WHERE status = 'PENDING') as pending_overrides
        `);

        const futureExpensesResult = await query(`
            SELECT 
                currency,
                COALESCE(SUM(amount), 0) as future_expenses
            FROM transfers
            WHERE status = 'PENDING'
            GROUP BY currency
        `);

        // Convert results to objects keyed by currency
        const totalSpendByCurrency = {};
        totalSpendResult.rows.forEach(row => {
            totalSpendByCurrency[row.currency] = parseFloat(row.total_spend);
        });

        const paidHakEdisByCurrency = {};
        paidHakEdisResult.rows.forEach(row => {
            paidHakEdisByCurrency[row.currency] = parseFloat(row.paid_hak_edis);
        });

        const potentialByCurrency = {};
        potentialResult.rows.forEach(row => {
            potentialByCurrency[row.currency] = parseFloat(row.potential_hak_edis);
        });

        const futureExpensesByCurrency = {};
        futureExpensesResult.rows.forEach(row => {
            futureExpensesByCurrency[row.currency] = parseFloat(row.future_expenses);
        });

        // Process spend by başlık with currency breakdown
        const spendByBaslik = {};
        spendByBaslikResult.rows.forEach(row => {
            if (!spendByBaslik[row.baslik]) {
                spendByBaslik[row.baslik] = {
                    by_currency: {},
                    expense_count: 0
                };
            }
            spendByBaslik[row.baslik].by_currency[row.currency] = parseFloat(row.total_spend);
            spendByBaslik[row.baslik].expense_count += parseInt(row.expense_count);
        });

        res.json({
            success: true,
            data: {
                total_spend: totalSpendByCurrency,
                paid_hak_edis: paidHakEdisByCurrency,
                remaining_potential: potentialByCurrency,
                conditional_exposure: parseFloat(conditionalResult.rows[0].conditional_exposure),
                conditional_count: parseInt(conditionalResult.rows[0].conditional_count),
                transfer_expense_mismatch: mismatch,
                pending_transfers: parseInt(pendingApprovalsResult.rows[0].pending_transfers),
                pending_overrides: parseInt(pendingApprovalsResult.rows[0].pending_overrides),
                future_expenses: futureExpensesByCurrency,
                spend_by_baslik: spendByBaslik
            }
        });
    } catch (error) {
        console.error('[Dashboard] KPIs error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch KPIs'
        });
    }
});

/**
 * GET /api/dashboard/charts/hak-edis-comparison
 * Bar chart: Hak edişli vs Hak edişsiz giderler
 */
router.get('/charts/hak-edis-comparison', authenticate, requireAuthenticated, async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                CASE WHEN is_hak_edis_eligible THEN 'Hak Edişli' ELSE 'Hak Edişsiz' END as category,
                COUNT(*) as count,
                COALESCE(SUM(amount), 0) as total_amount,
                COALESCE(SUM(hak_edis_amount), 0) as hak_edis_total
            FROM expenses
            GROUP BY is_hak_edis_eligible
        `);

        // By work scope level
        const byWorkScopeResult = await query(`
            SELECT 
                work_scope_level,
                COUNT(*) as count,
                COALESCE(SUM(amount), 0) as total_amount,
                COALESCE(SUM(hak_edis_amount), 0) as hak_edis_total,
                COALESCE(SUM(CASE WHEN is_hak_edis_eligible THEN amount ELSE 0 END), 0) as eligible_amount
            FROM expenses
            GROUP BY work_scope_level
            ORDER BY total_amount DESC
        `);

        res.json({
            success: true,
            data: {
                comparison: result.rows,
                by_work_scope: byWorkScopeResult.rows
            }
        });
    } catch (error) {
        console.error('[Dashboard] Chart comparison error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch chart data'
        });
    }
});

/**
 * GET /api/dashboard/charts/hak-edis-trend
 * Line chart: Monthly hak ediş trend
 */
router.get('/charts/hak-edis-trend', authenticate, requireAuthenticated, async (req, res) => {
    try {
        const { months = 12 } = req.query;

        const result = await query(`
            SELECT 
                TO_CHAR(date, 'YYYY-MM') as month,
                COUNT(*) as expense_count,
                COALESCE(SUM(amount), 0) as total_amount,
                COALESCE(SUM(hak_edis_amount), 0) as hak_edis_total,
                COALESCE(SUM(CASE WHEN is_hak_edis_eligible THEN amount ELSE 0 END), 0) as eligible_amount,
                ROUND(
                    CASE 
                        WHEN SUM(amount) > 0 
                        THEN (SUM(hak_edis_amount) / SUM(amount)) * 100 
                        ELSE 0 
                    END, 2
                ) as hak_edis_rate_percent
            FROM expenses
            WHERE date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '${parseInt(months)} months')
            GROUP BY TO_CHAR(date, 'YYYY-MM')
            ORDER BY month ASC
        `);

        res.json({
            success: true,
            data: {
                trend: result.rows
            }
        });
    } catch (error) {
        console.error('[Dashboard] Chart trend error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch trend data'
        });
    }
});

/**
 * GET /api/dashboard/tables/realized-hak-edis
 * Table: Realized hak ediş by category
 */
router.get('/tables/realized-hak-edis', authenticate, requireAuthenticated, async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                primary_tag,
                work_scope_level,
                hak_edis_policy,
                COUNT(*) as expense_count,
                COALESCE(SUM(amount), 0) as total_amount,
                COALESCE(SUM(hak_edis_amount), 0) as total_hak_edis
            FROM expenses
            WHERE is_hak_edis_eligible = true
            GROUP BY primary_tag, work_scope_level, hak_edis_policy
            ORDER BY total_hak_edis DESC
        `);

        const totalHakEdis = result.rows.reduce((sum, row) => 
            sum + parseFloat(row.total_hak_edis), 0);

        res.json({
            success: true,
            data: {
                realized: result.rows,
                total: totalHakEdis
            }
        });
    } catch (error) {
        console.error('[Dashboard] Realized table error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch realized hak ediş data'
        });
    }
});

/**
 * GET /api/dashboard/tables/future-projection
 * Table: Future hak ediş projection (Cam, Parke, Boya, etc.)
 */
router.get('/tables/future-projection', authenticate, requireAuthenticated, async (req, res) => {
    try {
        const projectionCategories = getProjectionCategories();

        // Get current stats for each category by currency
        const result = await query(`
            SELECT 
                primary_tag,
                currency,
                COUNT(*) as expense_count,
                COALESCE(SUM(amount), 0) as total_spent,
                COALESCE(SUM(CASE WHEN is_hak_edis_eligible THEN hak_edis_amount ELSE 0 END), 0) as paid_hak_edis,
                COALESCE(SUM(CASE WHEN is_hak_edis_eligible = false AND hak_edis_policy = 'CONDITIONAL' THEN amount * 0.07 ELSE 0 END), 0) as pending_potential
            FROM expenses
            WHERE primary_tag = ANY($1)
            GROUP BY primary_tag, currency
        `, [projectionCategories.map(c => c.tag)]);

        // Map results to projection categories with currency breakdown
        const projection = projectionCategories.map(category => {
            const categoryStats = result.rows.filter(r => r.primary_tag === category.tag);
            
            // Aggregate by currency
            const byCurrency = {};
            categoryStats.forEach(stat => {
                byCurrency[stat.currency] = {
                    expense_count: parseInt(stat.expense_count) || 0,
                    total_spent: parseFloat(stat.total_spent) || 0,
                    paid_hak_edis: parseFloat(stat.paid_hak_edis) || 0,
                    pending_potential: parseFloat(stat.pending_potential) || 0,
                    estimated_7_percent_exposure: parseFloat(stat.total_spent) * HAK_EDIS_RATE
                };
            });

            // Calculate totals across all currencies
            const totals = Object.values(byCurrency).reduce((acc, curr) => ({
                expense_count: acc.expense_count + curr.expense_count,
                total_spent: acc.total_spent + curr.total_spent,
                paid_hak_edis: acc.paid_hak_edis + curr.paid_hak_edis,
                pending_potential: acc.pending_potential + curr.pending_potential,
                estimated_7_percent_exposure: acc.estimated_7_percent_exposure + curr.estimated_7_percent_exposure
            }), { expense_count: 0, total_spent: 0, paid_hak_edis: 0, pending_potential: 0, estimated_7_percent_exposure: 0 });

            return {
                tag: category.tag,
                name: category.name,
                work_scope: category.work_scope,
                policy: category.policy,
                by_currency: byCurrency,
                expense_count: totals.expense_count,
                total_spent: totals.total_spent,
                paid_hak_edis: totals.paid_hak_edis,
                pending_potential: totals.pending_potential,
                estimated_7_percent_exposure: totals.estimated_7_percent_exposure
            };
        });

        // Summary totals by currency
        const totalsByCurrency = {};
        result.rows.forEach(row => {
            if (!totalsByCurrency[row.currency]) {
                totalsByCurrency[row.currency] = {
                    total_spent: 0,
                    paid_hak_edis: 0,
                    pending_potential: 0,
                    total_exposure: 0
                };
            }
            totalsByCurrency[row.currency].total_spent += parseFloat(row.total_spent) || 0;
            totalsByCurrency[row.currency].paid_hak_edis += parseFloat(row.paid_hak_edis) || 0;
            totalsByCurrency[row.currency].pending_potential += parseFloat(row.pending_potential) || 0;
            totalsByCurrency[row.currency].total_exposure += (parseFloat(row.total_spent) || 0) * HAK_EDIS_RATE;
        });

        // Also calculate overall totals for backward compatibility
        const totals = projection.reduce((acc, p) => ({
            total_spent: acc.total_spent + p.total_spent,
            paid_hak_edis: acc.paid_hak_edis + p.paid_hak_edis,
            pending_potential: acc.pending_potential + p.pending_potential,
            total_exposure: acc.total_exposure + p.estimated_7_percent_exposure
        }), { total_spent: 0, paid_hak_edis: 0, pending_potential: 0, total_exposure: 0 });

        res.json({
            success: true,
            data: {
                projection,
                totals,
                totals_by_currency: totalsByCurrency
            }
        });
    } catch (error) {
        console.error('[Dashboard] Projection table error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch projection data'
        });
    }
});

/**
 * GET /api/dashboard/alerts
 * Get active alerts and warnings
 */
router.get('/alerts', authenticate, requireAuthenticated, async (req, res) => {
    try {
        const result = await query(`
            SELECT 
                a.*,
                e.vendor_name as expense_vendor,
                e.amount as expense_amount,
                e.currency as expense_currency,
                e.date as expense_date
            FROM alerts a
            LEFT JOIN expenses e ON a.expense_id = e.expense_id
            WHERE a.is_resolved = false
            ORDER BY 
                CASE a.severity 
                    WHEN 'CRITICAL' THEN 1 
                    WHEN 'HIGH' THEN 2 
                    WHEN 'MEDIUM' THEN 3 
                    WHEN 'LOW' THEN 4 
                END,
                a.created_at DESC
            LIMIT 50
        `);

        // Count by type
        const countByType = await query(`
            SELECT alert_type, COUNT(*) as count
            FROM alerts
            WHERE is_resolved = false
            GROUP BY alert_type
        `);

        res.json({
            success: true,
            data: {
                alerts: result.rows,
                total_count: result.rows.length,
                by_type: countByType.rows
            }
        });
    } catch (error) {
        console.error('[Dashboard] Alerts error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch alerts'
        });
    }
});

/**
 * POST /api/dashboard/alerts/:id/resolve
 * Resolve an alert
 */
router.post('/alerts/:id/resolve', authenticate, requireAuthenticated, async (req, res) => {
    try {
        const { id } = req.params;
        const { notes } = req.body;

        const result = await query(`
            UPDATE alerts SET
                is_resolved = true,
                resolved_by = $1,
                resolved_at = NOW(),
                resolution_notes = $2
            WHERE alert_id = $3
            RETURNING *
        `, [req.user.user_id, notes, id]);

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Alert not found'
            });
        }

        res.json({
            success: true,
            data: {
                alert: result.rows[0]
            }
        });
    } catch (error) {
        console.error('[Dashboard] Resolve alert error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to resolve alert'
        });
    }
});

/**
 * GET /api/dashboard/hak-edis-rate-check
 * Check for unusual increase in hak ediş rate
 */
router.get('/hak-edis-rate-check', authenticate, requireOwner, async (req, res) => {
    try {
        // Compare last month to previous 3 months average
        const result = await query(`
            WITH monthly_rates AS (
                SELECT 
                    TO_CHAR(date, 'YYYY-MM') as month,
                    CASE 
                        WHEN SUM(amount) > 0 
                        THEN (SUM(hak_edis_amount) / SUM(amount)) * 100 
                        ELSE 0 
                    END as rate
                FROM expenses
                WHERE date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '4 months')
                GROUP BY TO_CHAR(date, 'YYYY-MM')
                ORDER BY month DESC
            )
            SELECT * FROM monthly_rates
        `);

        const rates = result.rows;
        
        let warning = null;
        if (rates.length >= 2) {
            const lastMonthRate = parseFloat(rates[0]?.rate || 0);
            const previousAvg = rates.slice(1).reduce((sum, r) => sum + parseFloat(r.rate || 0), 0) / (rates.length - 1);
            
            // If last month is 20% higher than average, flag it
            if (lastMonthRate > previousAvg * 1.2 && previousAvg > 0) {
                warning = {
                    type: 'HAK_EDIS_RATE_INCREASE',
                    message: `Hak ediş rate increased from ${previousAvg.toFixed(2)}% average to ${lastMonthRate.toFixed(2)}%`,
                    last_month_rate: lastMonthRate,
                    previous_average: previousAvg,
                    increase_percent: ((lastMonthRate - previousAvg) / previousAvg * 100).toFixed(2)
                };
            }
        }

        res.json({
            success: true,
            data: {
                monthly_rates: rates,
                warning
            }
        });
    } catch (error) {
        console.error('[Dashboard] Rate check error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to check hak ediş rate'
        });
    }
});

/**
 * GET /api/dashboard/summary (Owner view)
 * Complete dashboard summary in one call
 */
router.get('/summary', authenticate, requireOwner, async (req, res) => {
    try {
        // Parallel fetch all dashboard data
        const [
            kpisResult,
            alertsResult,
            pendingTransfersResult,
            pendingOverridesResult,
            recentExpensesResult
        ] = await Promise.all([
            // KPIs
            query(`
                SELECT 
                    (SELECT COALESCE(SUM(amount), 0) FROM expenses) as total_spend,
                    (SELECT COALESCE(SUM(hak_edis_amount), 0) FROM expenses WHERE is_hak_edis_eligible = true) as paid_hak_edis,
                    (SELECT COALESCE(SUM(amount * 0.07), 0) FROM expenses WHERE work_scope_level IN ('PURE_IMALAT', 'MALZEME_PLUS_IMALAT') AND is_hak_edis_eligible = false) as remaining_potential,
                    (SELECT COALESCE(SUM(amount * 0.07), 0) FROM expenses WHERE hak_edis_policy = 'CONDITIONAL' AND is_hak_edis_eligible = false) as conditional_exposure,
                    (SELECT COUNT(*) FROM expenses WHERE hak_edis_policy = 'CONDITIONAL' AND is_hak_edis_eligible = false) as conditional_count
            `),
            // Alerts count
            query(`SELECT COUNT(*) as count FROM alerts WHERE is_resolved = false`),
            // Pending transfers
            query(`SELECT COUNT(*) as count FROM transfers WHERE status = 'PENDING'`),
            // Pending overrides  
            query(`SELECT COUNT(*) as count FROM hak_edis_overrides WHERE status = 'PENDING'`),
            // Recent expenses
            query(`
                SELECT expense_id, date, vendor_name, amount, primary_tag, is_hak_edis_eligible, hak_edis_amount
                FROM expenses
                ORDER BY created_at DESC
                LIMIT 10
            `)
        ]);

        res.json({
            success: true,
            data: {
                kpis: {
                    total_spend: parseFloat(kpisResult.rows[0].total_spend),
                    paid_hak_edis: parseFloat(kpisResult.rows[0].paid_hak_edis),
                    remaining_potential: parseFloat(kpisResult.rows[0].remaining_potential),
                    conditional_exposure: parseFloat(kpisResult.rows[0].conditional_exposure),
                    conditional_count: parseInt(kpisResult.rows[0].conditional_count)
                },
                counts: {
                    active_alerts: parseInt(alertsResult.rows[0].count),
                    pending_transfers: parseInt(pendingTransfersResult.rows[0].count),
                    pending_overrides: parseInt(pendingOverridesResult.rows[0].count)
                },
                recent_expenses: recentExpensesResult.rows
            }
        });
    } catch (error) {
        console.error('[Dashboard] Summary error:', error);
        res.status(500).json({
            success: false,
            error: 'Failed to fetch dashboard summary'
        });
    }
});

module.exports = router;
