/**
 * One-off: analyze unassigned expenses (same definition as /api/vendors).
 * Output: reason, distinct vendor_name + primary_tag, missing categories, suggested matches.
 * Run from backend: node src/scripts/analyze-unassigned.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const { query } = require('../db/connection');
const { getVendorLookup, buildUnassignedWhereClause } = require('../lib/vendorMatching');

async function main() {
    const { allVendorIds, vendorNameKeys } = await getVendorLookup();
    const { whereClause, params } = buildUnassignedWhereClause(allVendorIds, vendorNameKeys, 1);

    const unassigned = await query(`
        SELECT expense_id, vendor_id, TRIM(COALESCE(vendor_name, '')) as vendor_name, primary_tag, description, amount, currency
        FROM expenses e
        WHERE 1=1 ${whereClause}
        ORDER BY vendor_name, primary_tag
    `, params);

    const categories = await query(`
        SELECT primary_tag, name FROM expense_categories ORDER BY primary_tag
    `);
    const knownTags = new Set(categories.rows.map(r => (r.primary_tag || '').toUpperCase()));
    const vendors = await query('SELECT vendor_id, name FROM vendors ORDER BY name');
    const vendorNamesNormalized = new Set(vendors.rows.map(v => (v.name || '').trim().toLowerCase()));

    // Group by vendor_name (raw) and primary_tag
    const byVendorName = new Map();
    const byPrimaryTag = new Map();
    let emptyVendorName = 0;
    for (const row of unassigned.rows) {
        const vn = (row.vendor_name || '').trim();
        const pt = (row.primary_tag || '').trim().toUpperCase();
        if (!vn) emptyVendorName++;
        if (!byVendorName.has(vn)) byVendorName.set(vn, { count: 0, total: 0, primary_tags: new Map(), sample: row });
        const b = byVendorName.get(vn);
        b.count++;
        b.total += parseFloat(row.amount || 0);
        b.primary_tags.set(pt, (b.primary_tags.get(pt) || 0) + 1);
        if (!byPrimaryTag.has(pt)) byPrimaryTag.set(pt, { count: 0, vendor_names: new Map() });
        const t = byPrimaryTag.get(pt);
        t.count++;
        t.vendor_names.set(vn || '(boş)', (t.vendor_names.get(vn || '(boş)') || 0) + 1);
    }

    // Suggest vendor match: first word or normalized name in vendor list?
    function suggestVendorMatch(rawVendorName) {
        const s = (rawVendorName || '').trim().toLowerCase();
        if (!s) return null;
        const firstWord = s.split(/\s+/)[0] || s;
        for (const v of vendorNamesNormalized) {
            if (v === s || v === firstWord) return v;
            if (v.startsWith(firstWord) || firstWord.startsWith(v)) return v;
        }
        return null;
    }

    console.log('=== UNASSIGNED EXPENSES ANALYSIS ===\n');
    console.log('Total unassigned:', unassigned.rows.length);
    console.log('Current vendors:', vendorNameKeys.length, vendorNameKeys.join(', '));
    console.log('Empty vendor_name count:', emptyVendorName);
    console.log('');

    console.log('--- BY VENDOR_NAME (top 40 by count) ---');
    const sortedVendors = [...byVendorName.entries()]
        .sort((a, b) => b[1].count - a[1].count);
    for (const [vn, data] of sortedVendors.slice(0, 40)) {
        const suggest = suggestVendorMatch(vn);
        console.log(`  "${vn || '(boş)'}" | count=${data.count} total=${data.total.toFixed(0)} | primary_tags=${[...data.primary_tags.entries()].map(([t, c]) => `${t}:${c}`).join(', ')}${suggest ? ` | SUGGEST_MATCH→${suggest}` : ''}`);
    }
    if (sortedVendors.length > 40) console.log('  ... and', sortedVendors.length - 40, 'more distinct vendor_names');

    console.log('\n--- PRIMARY_TAGS IN UNASSIGNED NOT IN expense_categories ---');
    const missingTags = [];
    for (const [pt, data] of byPrimaryTag.entries()) {
        if (!pt) continue;
        const inCategories = knownTags.has(pt);
        if (!inCategories) missingTags.push({ tag: pt, count: data.count, vendor_names: [...data.vendor_names.keys()].slice(0, 5) });
    }
    missingTags.sort((a, b) => b.count - a.count);
    for (const m of missingTags) {
        console.log(`  ${m.tag} | count=${m.count} | sample vendors: ${m.vendor_names.join(', ')}`);
    }
    if (missingTags.length === 0) console.log('  (none – all primary_tags exist in expense_categories)');

    console.log('\n--- REASON (why unassigned) ---');
    console.log('  Each expense has: vendor_id NOT in current vendors AND (vendor_name empty OR vendor_name does not match any vendor by exact or first-word).');
    console.log('  So either: (1) vendor_name is empty, (2) vendor_name is spelled differently / extra text, (3) vendor never added to vendors table.');

    process.exit(0);
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
