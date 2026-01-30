/**
 * Vendor matching – single source of truth for "unassigned" expenses.
 * Used by: GET /api/vendors (unassigned count/totals), GET /api/expenses?unassigned=true.
 *
 * Definition: An expense is UNASSIGNED iff
 * - It is not linked to any current vendor by vendor_id, AND
 * - Either it has no vendor_name (empty/blank), OR
 *   vendor_name does not match any vendor by:
 *   - exact normalized match (LOWER(TRIM(vendor_name)) = vendor's normalized name), OR
 *   - first-word match (first word of vendor_name = vendor's normalized name).
 * Matching is case-insensitive and trim-normalized.
 */

const { query } = require('../db/connection');

/**
 * Load current vendor list and return IDs + normalized name keys for matching.
 * @returns {Promise<{ allVendorIds: string[], vendorNameKeys: string[] }>}
 */
async function getVendorLookup() {
    const result = await query('SELECT vendor_id, name FROM vendors ORDER BY name');
    const byName = new Map();
    for (const row of result.rows) {
        const nameKey = (row.name || '').trim().toLowerCase();
        if (!nameKey) continue;
        if (!byName.has(nameKey)) {
            byName.set(nameKey, { vendor_ids: [row.vendor_id] });
        } else {
            byName.get(nameKey).vendor_ids.push(row.vendor_id);
        }
    }
    const allVendorIds = result.rows.map(v => (v.vendor_id && String(v.vendor_id)) || null).filter(Boolean);
    const vendorNameKeys = Array.from(byName.keys());
    return { allVendorIds, vendorNameKeys };
}

/**
 * Build WHERE fragment and params for "expense e is unassigned" using existing vendor lookup.
 * When there are no vendors, returns no filter (all expenses are unassigned).
 * @param {string[]} allVendorIds
 * @param {string[]} vendorNameKeys
 * @param {number} paramOffset - 1-based start index for $ placeholders (e.g. 1 => $1,$2)
 * @returns {{ whereClause: string, params: any[] }}
 */
function buildUnassignedWhereClause(allVendorIds, vendorNameKeys, paramOffset = 1) {
    const p1 = paramOffset;
    const p2 = paramOffset + 1;
    if (!vendorNameKeys.length) {
        return { whereClause: '', params: [] };
    }
    const whereClause =
        ` AND (e.vendor_id IS NULL OR NOT (e.vendor_id = ANY($${p1})))` +
        ` AND (` +
        ` TRIM(COALESCE(e.vendor_name, '')) = ''` +
        ` OR (` +
        ` LOWER(TRIM(e.vendor_name)) != ALL($${p2})` +
        ` AND LOWER(SPLIT_PART(TRIM(COALESCE(e.vendor_name, '')), ' ', 1)) != ALL($${p2})` +
        ` )` +
        ` )`;
    return { whereClause, params: [allVendorIds, vendorNameKeys] };
}

/**
 * Get all vendor_ids and normalized name for the logical vendor that includes vendor_id.
 * Used by GET /api/expenses?vendor_id= to match same logic as /api/vendors card count.
 * @param {string} vendorId - One vendor_id (e.g. from card click)
 * @returns {Promise<{ vendorIds: string[], nameKey: string } | null>} null if vendor not found
 */
async function getVendorIdsAndNameKey(vendorId) {
    const result = await query('SELECT vendor_id, name FROM vendors ORDER BY name');
    const byName = new Map();
    for (const row of result.rows) {
        const nameKey = (row.name || '').trim().toLowerCase();
        if (!nameKey) continue;
        const idStr = row.vendor_id && String(row.vendor_id);
        if (!byName.has(nameKey)) {
            byName.set(nameKey, []);
        }
        byName.get(nameKey).push(idStr);
    }
    const targetId = (vendorId && String(vendorId)) || null;
    if (!targetId) return null;
    for (const [nameKey, ids] of byName) {
        if (ids.includes(targetId)) return { vendorIds: ids, nameKey };
    }
    return null;
}

/**
 * Build WHERE fragment and params for "expense e belongs to this logical vendor".
 * Expense matches if: e.vendor_id = ANY(vendorIds) OR (e not linked to any vendor AND vendor_name matches nameKey).
 * @param {string[]} vendorIds - All vendor_ids for this logical vendor (same name)
 * @param {string} nameKey - Normalized vendor name (lowercase trim)
 * @param {string[]} allVendorIds - All current vendor ids (for "not linked" check)
 * @param {number} paramOffset - 1-based start for $ placeholders
 */
function buildVendorFilterWhereClause(vendorIds, nameKey, allVendorIds, paramOffset = 1) {
    const p1 = paramOffset;
    const p2 = paramOffset + 1;
    const p3 = paramOffset + 2;
    const whereClause =
        ` AND (` +
        ` e.vendor_id = ANY($${p1})` +
        ` OR (` +
        ` (e.vendor_id IS NULL OR NOT (e.vendor_id = ANY($${p2})))` +
        ` AND (LOWER(TRIM(COALESCE(e.vendor_name, ''))) = $${p3} OR LOWER(SPLIT_PART(TRIM(COALESCE(e.vendor_name, '')), ' ', 1)) = $${p3})` +
        ` )` +
        ` )`;
    return { whereClause, params: [vendorIds, allVendorIds, nameKey] };
}

module.exports = {
    getVendorLookup,
    getVendorIdsAndNameKey,
    buildUnassignedWhereClause,
    buildVendorFilterWhereClause,
};
