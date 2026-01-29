/**
 * Data Export/Import Routes
 * BoatBuild CRM - Round-trip single CSV export/import for vendors, categories, transfers, expenses, overrides
 */

const express = require('express');
const { parse: csvParse } = require('csv-parse/sync');
const multer = require('multer');
const { query, transaction } = require('../db/connection');
const { authenticate, requireAuthenticated, logAudit } = require('../middleware/auth');

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const ok = file.mimetype === 'text/csv' || file.mimetype === 'application/csv' || file.originalname?.toLowerCase().endsWith('.csv');
    if (!ok) return cb(new Error('Only CSV files are allowed'));
    cb(null, true);
  }
});

const ENTITY_TYPE = 'entity_type';

/**
 * Escape a CSV field (RFC 4180)
 */
function escapeCsvField(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/**
 * Export: serialize date/timestamp as ISO 8601 so PostgreSQL accepts on re-import (avoids "time zone GMT+0400 not recognized")
 */
function toIsoTimestamp(val) {
  if (val == null) return '';
  if (val instanceof Date) return val.toISOString();
  const d = new Date(val);
  return isNaN(d.getTime()) ? String(val) : d.toISOString();
}

/**
 * Import: parse CSV date/timestamp string to ISO 8601 or null for PostgreSQL timestamptz
 */
function parseTimestampForPg(val) {
  if (val === '' || val === undefined || val === null) return null;
  const s = String(val).trim();
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

/**
 * Single CSV: entity_type + prefixed columns per entity (no name collision)
 */
const SINGLE_CSV_COLUMNS = [
  ENTITY_TYPE,
  'v_id', 'v_name', 'v_tax_number', 'v_address', 'v_phone', 'v_email', 'v_requires_doc', 'v_notes', 'v_created_at', 'v_updated_at',
  'c_id', 'c_name', 'c_primary_tag', 'c_work_scope', 'c_hak_policy', 'c_requires_doc', 'c_description', 'c_created_at',
  't_id', 't_date', 't_amount', 't_currency', 't_from', 't_to', 't_vendor_id', 't_description', 't_status', 't_created_by', 't_created_at', 't_updated_at', 't_approved_by', 't_approved_at',
  'e_id', 'e_date', 'e_vendor_id', 'e_vendor_name', 'e_amount', 'e_currency', 'e_description', 'e_primary_tag', 'e_work_scope', 'e_hak_policy', 'e_eligible', 'e_hak_amount', 'e_hak_rate', 'e_linked_transfer', 'e_category_id', 'e_has_override', 'e_override_id', 'e_created_by', 'e_created_at', 'e_updated_at',
  'o_id', 'o_expense_id', 'o_orig_eligible', 'o_orig_amount', 'o_req_eligible', 'o_req_amount', 'o_reason', 'o_status', 'o_requested_by', 'o_requested_at', 'o_approved_by', 'o_approved_at', 'o_notes', 'o_created_at', 'o_updated_at'
];

function toCsv(rows, columns) {
  if (!rows.length) return columns.map(escapeCsvField).join(',') + '\n';
  const header = columns.map(escapeCsvField).join(',');
  const body = rows.map(row => columns.map(col => escapeCsvField(row[col])).join(',')).join('\n');
  return header + '\n' + body;
}

/**
 * GET /api/data/export
 * Export all data as a single CSV (round-trip format). First column is entity_type: vendor | expense_category | transfer | expense | hak_edis_override
 */
router.get('/export', authenticate, requireAuthenticated, async (req, res) => {
  try {
    const [vendorsRes, categoriesRes, transfersRes, expensesRes, overridesRes] = await Promise.all([
      query('SELECT vendor_id, name, tax_number, address, phone, email, requires_documentation, notes, created_at, updated_at FROM vendors ORDER BY name'),
      query('SELECT category_id, name, primary_tag, default_work_scope, default_hak_edis_policy, requires_documentation, description, created_at FROM expense_categories ORDER BY name'),
      query('SELECT transfer_id, date, amount, currency, from_account, to_account, vendor_id, description, status, created_by, created_at, updated_at, approved_by, approved_at FROM transfers ORDER BY date, created_at'),
      query(`SELECT expense_id, date, vendor_id, vendor_name, amount, currency, description, primary_tag, work_scope_level, hak_edis_policy,
             is_hak_edis_eligible, hak_edis_amount, hak_edis_rate, linked_transfer_id, category_id, has_owner_override, override_id, created_by, created_at, updated_at FROM expenses ORDER BY date, created_at`),
      query(`SELECT override_id, expense_id, original_is_eligible, original_hak_edis_amount, requested_is_eligible, requested_hak_edis_amount,
             reason, status, requested_by, requested_at, approved_by, approved_at, approval_notes, created_at, updated_at FROM hak_edis_overrides ORDER BY requested_at`)
    ]);

    const rows = [];

    vendorsRes.rows.forEach(r => {
      rows.push({
        [ENTITY_TYPE]: 'vendor',
        v_id: r.vendor_id, v_name: r.name, v_tax_number: r.tax_number, v_address: r.address, v_phone: r.phone, v_email: r.email,
        v_requires_doc: r.requires_documentation, v_notes: r.notes, v_created_at: toIsoTimestamp(r.created_at), v_updated_at: toIsoTimestamp(r.updated_at)
      });
    });
    categoriesRes.rows.forEach(r => {
      rows.push({
        [ENTITY_TYPE]: 'expense_category',
        c_id: r.category_id, c_name: r.name, c_primary_tag: r.primary_tag, c_work_scope: r.default_work_scope, c_hak_policy: r.default_hak_edis_policy,
        c_requires_doc: r.requires_documentation, c_description: r.description, c_created_at: toIsoTimestamp(r.created_at)
      });
    });
    transfersRes.rows.forEach(r => {
      rows.push({
        [ENTITY_TYPE]: 'transfer',
        t_id: r.transfer_id, t_date: r.date, t_amount: r.amount, t_currency: r.currency, t_from: r.from_account, t_to: r.to_account,
        t_vendor_id: r.vendor_id, t_description: r.description, t_status: r.status, t_created_by: r.created_by,
        t_created_at: toIsoTimestamp(r.created_at), t_updated_at: toIsoTimestamp(r.updated_at), t_approved_by: r.approved_by, t_approved_at: toIsoTimestamp(r.approved_at)
      });
    });
    expensesRes.rows.forEach(r => {
      rows.push({
        [ENTITY_TYPE]: 'expense',
        e_id: r.expense_id, e_date: r.date, e_vendor_id: r.vendor_id, e_vendor_name: r.vendor_name, e_amount: r.amount, e_currency: r.currency, e_description: r.description,
        e_primary_tag: r.primary_tag, e_work_scope: r.work_scope_level, e_hak_policy: r.hak_edis_policy, e_eligible: r.is_hak_edis_eligible, e_hak_amount: r.hak_edis_amount, e_hak_rate: r.hak_edis_rate,
        e_linked_transfer: r.linked_transfer_id, e_category_id: r.category_id, e_has_override: r.has_owner_override, e_override_id: r.override_id, e_created_by: r.created_by,
        e_created_at: toIsoTimestamp(r.created_at), e_updated_at: toIsoTimestamp(r.updated_at)
      });
    });
    overridesRes.rows.forEach(r => {
      rows.push({
        [ENTITY_TYPE]: 'hak_edis_override',
        o_id: r.override_id, o_expense_id: r.expense_id, o_orig_eligible: r.original_is_eligible, o_orig_amount: r.original_hak_edis_amount,
        o_req_eligible: r.requested_is_eligible, o_req_amount: r.requested_hak_edis_amount, o_reason: r.reason, o_status: r.status,
        o_requested_by: r.requested_by, o_requested_at: toIsoTimestamp(r.requested_at), o_approved_by: r.approved_by, o_approved_at: toIsoTimestamp(r.approved_at),
        o_notes: r.approval_notes, o_created_at: toIsoTimestamp(r.created_at), o_updated_at: toIsoTimestamp(r.updated_at)
      });
    });

    const csv = toCsv(rows, SINGLE_CSV_COLUMNS);
    const filename = `boatbuild-export-${new Date().toISOString().slice(0, 10)}.csv`;
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);

    await logAudit(req.user.user_id, 'DATA_EXPORT', 'data', null, null, { format: 'single_csv' }, req);
  } catch (error) {
    console.error('[Export] Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: 'Export failed' });
    }
  }
});

/**
 * Normalize empty string to null; parse booleans and numbers from CSV string
 */
function cell(val, opts = {}) {
  if (val === '' || val === undefined || val === null) return opts.bool ? false : null;
  if (opts.bool) return val === 'true' || val === '1';
  if (opts.num) return parseFloat(val) || 0;
  return val;
}

/**
 * POST /api/data/import
 * Import from single CSV (same format as export). Upserts by ID; created_by/requested_by set to current user.
 */
router.post('/import', authenticate, requireAuthenticated, upload.single('file'), async (req, res) => {
  if (!req.file || !req.file.buffer) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }

  const currentUserId = req.user.user_id;

  try {
    const text = req.file.buffer.toString('utf8').trim();
    if (!text) {
      return res.status(400).json({ success: false, error: 'CSV file is empty' });
    }

    const rawRows = csvParse(text, { columns: true, skip_empty_lines: true, trim: true, relax_column_count: true });
    const typeKey = Object.keys(rawRows[0] || {}).find(k => k.toLowerCase() === 'entity_type') || 'entity_type';

    const categories = [];
    const vendors = [];
    const transfers = [];
    const expenses = [];
    const overrides = [];

    for (const row of rawRows) {
      const t = (row[typeKey] || '').toLowerCase().replace(/\s/g, '');
      if (t === 'expense_category' || t === 'category') {
        categories.push({
          category_id: row.c_id || null,
          name: row.c_name || '',
          primary_tag: row.c_primary_tag || '',
          default_work_scope: row.c_work_scope || 'PURE_IMALAT',
          default_hak_edis_policy: row.c_hak_policy || 'ALWAYS_EXCLUDED',
          requires_documentation: cell(row.c_requires_doc, { bool: true }),
          description: row.c_description || null,
          created_at: parseTimestampForPg(row.c_created_at)
        });
      } else if (t === 'vendor') {
        vendors.push({
          vendor_id: row.v_id || null,
          name: row.v_name || '',
          tax_number: row.v_tax_number || null,
          address: row.v_address || null,
          phone: row.v_phone || null,
          email: row.v_email || null,
          requires_documentation: cell(row.v_requires_doc, { bool: true }),
          notes: row.v_notes || null,
          created_at: parseTimestampForPg(row.v_created_at),
          updated_at: parseTimestampForPg(row.v_updated_at)
        });
      } else if (t === 'transfer') {
        transfers.push({
          transfer_id: row.t_id || null,
          date: row.t_date,
          amount: cell(row.t_amount, { num: true }),
          currency: row.t_currency || 'TRY',
          from_account: row.t_from || null,
          to_account: row.t_to || null,
          vendor_id: row.t_vendor_id || null,
          description: row.t_description || null,
          status: row.t_status || 'PENDING',
          created_by: row.t_created_by || null,
          created_at: parseTimestampForPg(row.t_created_at),
          updated_at: parseTimestampForPg(row.t_updated_at),
          approved_by: row.t_approved_by || null,
          approved_at: parseTimestampForPg(row.t_approved_at)
        });
      } else if (t === 'expense') {
        expenses.push({
          expense_id: row.e_id || null,
          date: row.e_date,
          vendor_id: row.e_vendor_id || null,
          vendor_name: row.e_vendor_name || '',
          amount: cell(row.e_amount, { num: true }),
          currency: row.e_currency || 'TRY',
          description: row.e_description || null,
          primary_tag: row.e_primary_tag || '',
          work_scope_level: row.e_work_scope || 'PURE_IMALAT',
          hak_edis_policy: row.e_hak_policy || 'ALWAYS_EXCLUDED',
          is_hak_edis_eligible: cell(row.e_eligible, { bool: true }),
          hak_edis_amount: cell(row.e_hak_amount, { num: true }),
          hak_edis_rate: cell(row.e_hak_rate, { num: true }),
          linked_transfer_id: row.e_linked_transfer || null,
          category_id: row.e_category_id || null,
          has_owner_override: cell(row.e_has_override, { bool: true }),
          override_id: row.e_override_id || null,
          created_by: row.e_created_by || null,
          created_at: parseTimestampForPg(row.e_created_at),
          updated_at: parseTimestampForPg(row.e_updated_at)
        });
      } else if (t === 'hak_edis_override' || t === 'override') {
        overrides.push({
          override_id: row.o_id || null,
          expense_id: row.o_expense_id || null,
          original_is_eligible: cell(row.o_orig_eligible, { bool: true }),
          original_hak_edis_amount: cell(row.o_orig_amount, { num: true }),
          requested_is_eligible: cell(row.o_req_eligible, { bool: true }),
          requested_hak_edis_amount: cell(row.o_req_amount, { num: true }),
          reason: row.o_reason || '',
          status: row.o_status || 'PENDING',
          requested_by: row.o_requested_by || null,
          requested_at: parseTimestampForPg(row.o_requested_at),
          approved_by: row.o_approved_by || null,
          approved_at: parseTimestampForPg(row.o_approved_at),
          approval_notes: row.o_notes || null,
          created_at: parseTimestampForPg(row.o_created_at),
          updated_at: parseTimestampForPg(row.o_updated_at)
        });
      }
    }

    const stats = { vendors: 0, categories: 0, transfers: 0, expenses: 0, overrides: 0 };

    const userIdsResult = await query('SELECT user_id FROM users');
    const validUserIds = new Set(userIdsResult.rows.map(r => r.user_id));
    const resolveApprovedBy = (uuid) => (!uuid ? null : validUserIds.has(uuid) ? uuid : null);

    await transaction(async (client) => {
      for (const row of categories) {
        if (!row.category_id) continue;
        await client.query(`
          INSERT INTO expense_categories (category_id, name, primary_tag, default_work_scope, default_hak_edis_policy, requires_documentation, description, created_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8::timestamptz, NOW()))
          ON CONFLICT (category_id) DO UPDATE SET
            name = EXCLUDED.name, primary_tag = EXCLUDED.primary_tag, default_work_scope = EXCLUDED.default_work_scope,
            default_hak_edis_policy = EXCLUDED.default_hak_edis_policy, requires_documentation = EXCLUDED.requires_documentation,
            description = EXCLUDED.description
        `, [row.category_id, row.name, row.primary_tag, row.default_work_scope, row.default_hak_edis_policy, row.requires_documentation, row.description, row.created_at]);
        stats.categories++;
      }

      for (const row of vendors) {
        if (!row.vendor_id) continue;
        await client.query(`
          INSERT INTO vendors (vendor_id, name, tax_number, address, phone, email, requires_documentation, notes, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9::timestamptz, NOW()), COALESCE($10::timestamptz, NOW()))
          ON CONFLICT (vendor_id) DO UPDATE SET
            name = EXCLUDED.name, tax_number = EXCLUDED.tax_number, address = EXCLUDED.address, phone = EXCLUDED.phone,
            email = EXCLUDED.email, requires_documentation = EXCLUDED.requires_documentation, notes = EXCLUDED.notes, updated_at = NOW()
        `, [row.vendor_id, row.name, row.tax_number, row.address, row.phone, row.email, row.requires_documentation, row.notes, row.created_at, row.updated_at]);
        stats.vendors++;
      }

      for (const row of transfers) {
        if (!row.transfer_id) continue;
        await client.query(`
          INSERT INTO transfers (transfer_id, date, amount, currency, from_account, to_account, vendor_id, description, status, created_by, created_at, updated_at, approved_by, approved_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, COALESCE($9, 'PENDING'), $10, COALESCE($11::timestamptz, NOW()), COALESCE($12::timestamptz, NOW()), $13, $14)
          ON CONFLICT (transfer_id) DO UPDATE SET
            date = EXCLUDED.date, amount = EXCLUDED.amount, currency = EXCLUDED.currency, from_account = EXCLUDED.from_account,
            to_account = EXCLUDED.to_account, vendor_id = EXCLUDED.vendor_id, description = EXCLUDED.description, status = EXCLUDED.status,
            updated_at = NOW(), approved_by = EXCLUDED.approved_by, approved_at = EXCLUDED.approved_at
        `, [row.transfer_id, row.date, row.amount, row.currency, row.from_account, row.to_account, row.vendor_id, row.description, row.status, currentUserId, row.created_at, row.updated_at, resolveApprovedBy(row.approved_by), row.approved_at]);
        stats.transfers++;
      }

      for (const row of expenses) {
        if (!row.expense_id) continue;
        await client.query(`
          INSERT INTO expenses (expense_id, date, vendor_id, vendor_name, amount, currency, description, primary_tag, work_scope_level, hak_edis_policy,
            is_hak_edis_eligible, hak_edis_amount, hak_edis_rate, linked_transfer_id, category_id, has_owner_override, override_id, created_by, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13, 0.07), $14, $15, COALESCE($16, false), $17, $18, COALESCE($19::timestamptz, NOW()), COALESCE($20::timestamptz, NOW()))
          ON CONFLICT (expense_id) DO UPDATE SET
            date = EXCLUDED.date, vendor_id = EXCLUDED.vendor_id, vendor_name = EXCLUDED.vendor_name, amount = EXCLUDED.amount, currency = EXCLUDED.currency,
            description = EXCLUDED.description, primary_tag = EXCLUDED.primary_tag, work_scope_level = EXCLUDED.work_scope_level, hak_edis_policy = EXCLUDED.hak_edis_policy,
            is_hak_edis_eligible = EXCLUDED.is_hak_edis_eligible, hak_edis_amount = EXCLUDED.hak_edis_amount, hak_edis_rate = EXCLUDED.hak_edis_rate,
            linked_transfer_id = EXCLUDED.linked_transfer_id, category_id = EXCLUDED.category_id, has_owner_override = EXCLUDED.has_owner_override, override_id = EXCLUDED.override_id, updated_at = NOW()
        `, [row.expense_id, row.date, row.vendor_id, row.vendor_name, row.amount, row.currency, row.description, row.primary_tag, row.work_scope_level, row.hak_edis_policy,
          row.is_hak_edis_eligible, row.hak_edis_amount, row.hak_edis_rate, row.linked_transfer_id, row.category_id, row.has_owner_override, row.override_id, currentUserId, row.created_at, row.updated_at]);
        stats.expenses++;
      }

      for (const row of overrides) {
        if (!row.override_id || !row.expense_id) continue;
        await client.query(`
          INSERT INTO hak_edis_overrides (override_id, expense_id, original_is_eligible, original_hak_edis_amount, requested_is_eligible, requested_hak_edis_amount, reason, status, requested_by, requested_at, approved_by, approved_at, approval_notes, created_at, updated_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'PENDING'), $9, COALESCE($10::timestamptz, NOW()), $11, $12, $13, COALESCE($14::timestamptz, NOW()), COALESCE($15::timestamptz, NOW()))
          ON CONFLICT (override_id) DO UPDATE SET
            expense_id = EXCLUDED.expense_id, original_is_eligible = EXCLUDED.original_is_eligible, original_hak_edis_amount = EXCLUDED.original_hak_edis_amount,
            requested_is_eligible = EXCLUDED.requested_is_eligible, requested_hak_edis_amount = EXCLUDED.requested_hak_edis_amount, reason = EXCLUDED.reason, status = EXCLUDED.status,
            requested_by = EXCLUDED.requested_by, approved_by = EXCLUDED.approved_by, approved_at = EXCLUDED.approved_at, approval_notes = EXCLUDED.approval_notes, updated_at = NOW()
        `, [row.override_id, row.expense_id, row.original_is_eligible, row.original_hak_edis_amount, row.requested_is_eligible, row.requested_hak_edis_amount, row.reason, row.status, currentUserId, row.requested_at, resolveApprovedBy(row.approved_by), row.approved_at, row.approval_notes, row.created_at, row.updated_at]);
        stats.overrides++;
      }
    });

    await logAudit(req.user.user_id, 'DATA_IMPORT', 'data', null, null, stats, req);

    res.json({
      success: true,
      data: {
        message: 'Import completed',
        ...stats
      }
    });
  } catch (error) {
    console.error('[Import] Error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Import failed'
    });
  }
});

module.exports = router;
