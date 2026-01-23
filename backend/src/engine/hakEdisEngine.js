/**
 * Hak Ediş Rule Engine
 * BoatBuild CRM - Production-grade commission calculation
 * 
 * CORE PRINCIPLE: Hak ediş is based on OPERATIONAL VALUE, not expense name.
 * 
 * WORK SCOPE LEVELS:
 * - PURE_IMALAT: Pure manufacturing labor → Always 7%
 * - MALZEME_PLUS_IMALAT: Material + installation → Policy-dependent
 * - PURE_MALZEME: Raw materials only → Never eligible
 * - NON_IMALAT: Non-manufacturing → Never eligible
 * 
 * HAK EDİŞ POLICIES:
 * - ALWAYS_INCLUDED: Always calculate 7%
 * - ALWAYS_EXCLUDED: Never calculate hak ediş
 * - CONDITIONAL: Requires explicit owner approval
 */

const HAK_EDIS_RATE = 0.07; // 7%

/**
 * Work scope levels enumeration
 */
const WORK_SCOPE_LEVEL = {
    PURE_IMALAT: 'PURE_IMALAT',
    MALZEME_PLUS_IMALAT: 'MALZEME_PLUS_IMALAT',
    PURE_MALZEME: 'PURE_MALZEME',
    NON_IMALAT: 'NON_IMALAT'
};

/**
 * Hak ediş policy enumeration
 */
const HAK_EDIS_POLICY = {
    ALWAYS_INCLUDED: 'ALWAYS_INCLUDED',
    ALWAYS_EXCLUDED: 'ALWAYS_EXCLUDED',
    CONDITIONAL: 'CONDITIONAL'
};

/**
 * Calculate hak ediş eligibility and amount
 * 
 * @param {Object} expense - The expense object
 * @param {number} expense.amount - Expense amount
 * @param {string} expense.work_scope_level - Work scope level
 * @param {string} expense.hak_edis_policy - Hak ediş policy
 * @param {Object} options - Additional options
 * @param {boolean} options.hasOwnerOverride - Whether owner has approved override
 * @param {boolean} options.overrideEligibility - Override eligibility value
 * @returns {Object} - { is_eligible, hak_edis_amount, calculation_reason }
 */
function calculateHakEdis(expense, options = {}) {
    const { amount, work_scope_level, hak_edis_policy } = expense;
    const { hasOwnerOverride = false, overrideEligibility = false } = options;

    // Validate mandatory fields
    if (!work_scope_level) {
        return {
            is_eligible: false,
            hak_edis_amount: 0,
            calculation_reason: 'MISSING_WORK_SCOPE_LEVEL',
            error: 'work_scope_level is mandatory'
        };
    }

    if (!hak_edis_policy) {
        return {
            is_eligible: false,
            hak_edis_amount: 0,
            calculation_reason: 'MISSING_HAK_EDIS_POLICY',
            error: 'hak_edis_policy is mandatory'
        };
    }

    if (!amount || amount <= 0) {
        return {
            is_eligible: false,
            hak_edis_amount: 0,
            calculation_reason: 'INVALID_AMOUNT',
            error: 'Amount must be positive'
        };
    }

    // RULE 1: NON_IMALAT and PURE_MALZEME are NEVER eligible
    if (work_scope_level === WORK_SCOPE_LEVEL.NON_IMALAT || 
        work_scope_level === WORK_SCOPE_LEVEL.PURE_MALZEME) {
        return {
            is_eligible: false,
            hak_edis_amount: 0,
            calculation_reason: 'WORK_SCOPE_EXCLUDED',
            details: `${work_scope_level} is never eligible for hak ediş`
        };
    }

    // RULE 2: PURE_IMALAT is ALWAYS eligible (7%)
    if (work_scope_level === WORK_SCOPE_LEVEL.PURE_IMALAT) {
        const hakEdisAmount = roundToTwoDecimals(amount * HAK_EDIS_RATE);
        return {
            is_eligible: true,
            hak_edis_amount: hakEdisAmount,
            calculation_reason: 'PURE_IMALAT_ALWAYS_INCLUDED',
            details: 'Pure manufacturing labor - always eligible at 7%'
        };
    }

    // RULE 3: MALZEME_PLUS_IMALAT depends on policy
    if (work_scope_level === WORK_SCOPE_LEVEL.MALZEME_PLUS_IMALAT) {
        // ALWAYS_INCLUDED → 7%
        if (hak_edis_policy === HAK_EDIS_POLICY.ALWAYS_INCLUDED) {
            const hakEdisAmount = roundToTwoDecimals(amount * HAK_EDIS_RATE);
            return {
                is_eligible: true,
                hak_edis_amount: hakEdisAmount,
                calculation_reason: 'POLICY_ALWAYS_INCLUDED',
                details: 'Material + installation with ALWAYS_INCLUDED policy'
            };
        }

        // ALWAYS_EXCLUDED → 0
        if (hak_edis_policy === HAK_EDIS_POLICY.ALWAYS_EXCLUDED) {
            return {
                is_eligible: false,
                hak_edis_amount: 0,
                calculation_reason: 'POLICY_ALWAYS_EXCLUDED',
                details: 'Material + installation with ALWAYS_EXCLUDED policy'
            };
        }

        // CONDITIONAL → Requires owner approval
        if (hak_edis_policy === HAK_EDIS_POLICY.CONDITIONAL) {
            // Check for owner override
            if (hasOwnerOverride && overrideEligibility) {
                const hakEdisAmount = roundToTwoDecimals(amount * HAK_EDIS_RATE);
                return {
                    is_eligible: true,
                    hak_edis_amount: hakEdisAmount,
                    calculation_reason: 'CONDITIONAL_OWNER_APPROVED',
                    details: 'Conditional item approved by owner'
                };
            }

            // DEFAULT for CONDITIONAL = EXCLUDED until approved
            return {
                is_eligible: false,
                hak_edis_amount: 0,
                calculation_reason: 'CONDITIONAL_PENDING_APPROVAL',
                requires_owner_approval: true,
                potential_hak_edis: roundToTwoDecimals(amount * HAK_EDIS_RATE),
                details: 'Conditional item - awaiting owner approval. Default is EXCLUDED.'
            };
        }
    }

    // Fallback - should never reach here
    return {
        is_eligible: false,
        hak_edis_amount: 0,
        calculation_reason: 'UNKNOWN_CONFIGURATION',
        error: 'Unable to determine hak ediş eligibility'
    };
}

/**
 * Batch calculate hak ediş for multiple expenses
 */
function calculateBatchHakEdis(expenses, overridesMap = {}) {
    return expenses.map(expense => {
        const override = overridesMap[expense.expense_id];
        const result = calculateHakEdis(expense, {
            hasOwnerOverride: override?.status === 'APPROVED',
            overrideEligibility: override?.requested_is_eligible
        });
        return {
            expense_id: expense.expense_id,
            ...result
        };
    });
}

/**
 * Calculate total hak ediş exposure (realized + potential)
 */
function calculateHakEdisExposure(expenses, overridesMap = {}) {
    let realizedHakEdis = 0;
    let potentialHakEdis = 0;
    let conditionalExposure = 0;

    expenses.forEach(expense => {
        const override = overridesMap[expense.expense_id];
        const result = calculateHakEdis(expense, {
            hasOwnerOverride: override?.status === 'APPROVED',
            overrideEligibility: override?.requested_is_eligible
        });

        if (result.is_eligible) {
            realizedHakEdis += result.hak_edis_amount;
        }

        if (result.requires_owner_approval) {
            conditionalExposure += result.potential_hak_edis;
        }

        // Calculate total potential (what would be 7% if everything was eligible)
        if (expense.work_scope_level === WORK_SCOPE_LEVEL.PURE_IMALAT ||
            expense.work_scope_level === WORK_SCOPE_LEVEL.MALZEME_PLUS_IMALAT) {
            potentialHakEdis += roundToTwoDecimals(expense.amount * HAK_EDIS_RATE);
        }
    });

    return {
        realized_hak_edis: roundToTwoDecimals(realizedHakEdis),
        potential_hak_edis: roundToTwoDecimals(potentialHakEdis),
        conditional_exposure: roundToTwoDecimals(conditionalExposure),
        remaining_potential: roundToTwoDecimals(potentialHakEdis - realizedHakEdis)
    };
}

/**
 * Validate expense for hak ediş calculation
 */
function validateExpenseForHakEdis(expense) {
    const errors = [];

    if (!expense.primary_tag) {
        errors.push('primary_tag is required');
    }

    if (!expense.work_scope_level) {
        errors.push('work_scope_level is required');
    } else if (!Object.values(WORK_SCOPE_LEVEL).includes(expense.work_scope_level)) {
        errors.push(`Invalid work_scope_level: ${expense.work_scope_level}`);
    }

    if (!expense.hak_edis_policy) {
        errors.push('hak_edis_policy is required');
    } else if (!Object.values(HAK_EDIS_POLICY).includes(expense.hak_edis_policy)) {
        errors.push(`Invalid hak_edis_policy: ${expense.hak_edis_policy}`);
    }

    if (!expense.amount || expense.amount <= 0) {
        errors.push('amount must be a positive number');
    }

    return {
        isValid: errors.length === 0,
        errors
    };
}

/**
 * Check if documentation is required for this expense
 */
function isDocumentationRequired(expense, vendor = null) {
    // NON_IMALAT requires documentation
    if (expense.work_scope_level === WORK_SCOPE_LEVEL.NON_IMALAT) {
        return { required: true, reason: 'NON_IMALAT expenses require documentation' };
    }

    // REKLAM_GIDERI always requires documentation
    if (expense.primary_tag === 'REKLAM') {
        return { required: true, reason: 'Advertising expenses require documentation' };
    }

    // Special vendors require documentation
    const specialVendors = ['BARAN', 'MOTOR', 'ETKIN'];
    const vendorName = (vendor?.name || expense.vendor_name || '').toUpperCase();
    if (specialVendors.some(sv => vendorName.includes(sv))) {
        return { required: true, reason: `Vendor ${vendorName} requires mandatory documentation` };
    }

    // Check vendor's requires_documentation flag
    if (vendor?.requires_documentation) {
        return { required: true, reason: 'Vendor requires documentation' };
    }

    return { required: false };
}

/**
 * Round to two decimal places
 */
function roundToTwoDecimals(num) {
    return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Get future hak ediş projection for categories
 */
function getProjectionCategories() {
    return [
        { tag: 'CAM', name: 'Cam (Glass)', work_scope: 'MALZEME_PLUS_IMALAT', policy: 'CONDITIONAL' },
        { tag: 'PARKE', name: 'Parke (Flooring)', work_scope: 'MALZEME_PLUS_IMALAT', policy: 'CONDITIONAL' },
        { tag: 'BOYA', name: 'Boya (Paint)', work_scope: 'MALZEME_PLUS_IMALAT', policy: 'CONDITIONAL' },
        { tag: 'MOBILYA', name: 'Mobilya (Furniture)', work_scope: 'MALZEME_PLUS_IMALAT', policy: 'CONDITIONAL' },
        { tag: 'KAYNAK', name: 'Kaynak (Welding)', work_scope: 'PURE_IMALAT', policy: 'ALWAYS_INCLUDED' },
        { tag: 'MONTAJ', name: 'Montaj (Assembly)', work_scope: 'PURE_IMALAT', policy: 'ALWAYS_INCLUDED' },
        { tag: 'TESISAT', name: 'Tesisat (Plumbing)', work_scope: 'PURE_IMALAT', policy: 'ALWAYS_INCLUDED' },
        { tag: 'ELEKTRIK', name: 'Elektrik (Electrical)', work_scope: 'PURE_IMALAT', policy: 'ALWAYS_INCLUDED' }
    ];
}

module.exports = {
    HAK_EDIS_RATE,
    WORK_SCOPE_LEVEL,
    HAK_EDIS_POLICY,
    calculateHakEdis,
    calculateBatchHakEdis,
    calculateHakEdisExposure,
    validateExpenseForHakEdis,
    isDocumentationRequired,
    getProjectionCategories,
    roundToTwoDecimals
};
