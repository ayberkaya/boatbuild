/**
 * Spending anomaly detection for BoatBuild CRM
 * Flags high-value outliers (by vendor/category), MoM spikes, and single-expense dominance.
 * Each expense must have: expense_id, amount, currency, vendor_name, primary_tag, date.
 */

const STDDEV_THRESHOLD = 2;
const MIN_SAMPLES_FOR_STDDEV = 3;
const MOM_SPIKE_RATIO = 1.5;
const SINGLE_EXPENSE_DOMINANCE_RATIO = 0.5;

function mean(arr) {
  if (!arr.length) return 0;
  return arr.reduce((s, x) => s + x, 0) / arr.length;
}

function stddev(arr) {
  if (arr.length < 2) return 0;
  const m = mean(arr);
  const variance = arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length;
  return Math.sqrt(variance);
}

/**
 * @param {Array<{ expense_id: string, amount: number, currency: string, vendor_name?: string, primary_tag?: string, date: string }>} expenses
 * @returns {Array<{ alert_type: string, severity: string, title: string, message: string, expense_id?: string, expense_vendor?: string, expense_amount?: number, expense_currency?: string, dismissKey: string }>}
 */
export function detectSpendingAnomalies(expenses) {
  if (!expenses || !expenses.length) return [];
  const alerts = [];
  const seenKeys = new Set();

  const add = (alert) => {
    const key = alert.dismissKey;
    if (seenKeys.has(key)) return;
    seenKeys.add(key);
    alerts.push(alert);
  };

  // By vendor: amount > mean + 2*stddev (per currency for fairness)
  const byVendor = {};
  expenses.forEach((e) => {
    const v = e.vendor_name || e.vendor_display_name || 'Belirsiz';
    const c = e.currency || 'TRY';
    const k = `${v}|${c}`;
    if (!byVendor[k]) byVendor[k] = { vendor: v, currency: c, amounts: [], expenses: [] };
    const amt = parseFloat(e.amount);
    if (!Number.isNaN(amt)) {
      byVendor[k].amounts.push(amt);
      byVendor[k].expenses.push(e);
    }
  });
  Object.values(byVendor).forEach(({ vendor, currency, amounts, expenses: list }) => {
    if (amounts.length < MIN_SAMPLES_FOR_STDDEV) return;
    const m = mean(amounts);
    const sd = stddev(amounts);
    if (sd === 0) return;
    list.forEach((exp) => {
      const amt = parseFloat(exp.amount);
      if (amt > m + STDDEV_THRESHOLD * sd) {
        add({
          alert_type: 'SPENDING_ANOMALY',
          severity: 'HIGH',
          title: 'Yüksek tutarlı gider (tedarikçi)',
          message: `${vendor} için bu tutar, geçmiş ortalamaya göre anormal yüksek (ortalama + 2σ üzeri).`,
          expense_id: exp.expense_id,
          expense_vendor: vendor,
          expense_amount: amt,
          expense_currency: currency,
          dismissKey: `vendor-outlier-${exp.expense_id}`,
        });
      }
    });
  });

  // By category (primary_tag): same logic
  const byTag = {};
  expenses.forEach((e) => {
    const tag = e.primary_tag || 'OTHER';
    const c = e.currency || 'TRY';
    const k = `${tag}|${c}`;
    if (!byTag[k]) byTag[k] = { tag, currency: c, amounts: [], expenses: [] };
    const amt = parseFloat(e.amount);
    if (!Number.isNaN(amt)) {
      byTag[k].amounts.push(amt);
      byTag[k].expenses.push(e);
    }
  });
  Object.values(byTag).forEach(({ tag, currency, amounts, expenses: list }) => {
    if (amounts.length < MIN_SAMPLES_FOR_STDDEV) return;
    const m = mean(amounts);
    const sd = stddev(amounts);
    if (sd === 0) return;
    list.forEach((exp) => {
      const amt = parseFloat(exp.amount);
      if (amt > m + STDDEV_THRESHOLD * sd) {
        add({
          alert_type: 'SPENDING_ANOMALY',
          severity: 'MEDIUM',
          title: 'Yüksek tutarlı gider (kategori)',
          message: `${tag} kategorisinde bu tutar ortalamaya göre yüksek sapma gösteriyor.`,
          expense_id: exp.expense_id,
          expense_vendor: exp.vendor_name || exp.vendor_display_name,
          expense_amount: amt,
          expense_currency: currency,
          dismissKey: `tag-outlier-${exp.expense_id}`,
        });
      }
    });
  });

  // Single expense dominance: one expense > 50% of that vendor's total (same currency)
  Object.values(byVendor).forEach(({ vendor, currency, amounts, expenses: list }) => {
    const total = amounts.reduce((s, x) => s + x, 0);
    if (total <= 0) return;
    list.forEach((exp) => {
      const amt = parseFloat(exp.amount);
      if (amt > total * SINGLE_EXPENSE_DOMINANCE_RATIO && list.length > 1) {
        add({
          alert_type: 'SPENDING_ANOMALY',
          severity: 'MEDIUM',
          title: 'Tek gider baskınlığı',
          message: `${vendor} için bu gider, toplam harcamanın %${Math.round((amt / total) * 100)}'ini oluşturuyor.`,
          expense_id: exp.expense_id,
          expense_vendor: vendor,
          expense_amount: amt,
          expense_currency: currency,
          dismissKey: `dominance-${exp.expense_id}`,
        });
      }
    });
  });

  // Month-over-month spike by baslik (map primary_tag to baslik)
  const getBaslik = (primaryTag) => {
    if (!primaryTag) return 'Diğer';
    const t = primaryTag.toUpperCase();
    if (t.startsWith('IMALAT') || ['MOTOR', 'KAAN_ODEME', 'ETKIN'].includes(t)) return 'İmalat';
    if (t.startsWith('YUNANISTAN')) return 'Yunanistan Kurulum';
    if (t.startsWith('TERSANE')) return 'Tersane Kurulum';
    if (t === 'REKLAM' || t.startsWith('REKLAM')) return 'Reklam ve Tanıtım';
    if (t === 'BARAN' || t.startsWith('BARAN')) return 'Baran';
    return 'Diğer';
  };
  const byMonthBaslik = {};
  expenses.forEach((e) => {
    const date = e.date ? e.date.slice(0, 7) : '';
    const baslik = getBaslik(e.primary_tag);
    const k = `${date}|${baslik}`;
    if (!byMonthBaslik[k]) byMonthBaslik[k] = 0;
    byMonthBaslik[k] += parseFloat(e.amount) || 0;
  });
  const months = [...new Set(Object.keys(byMonthBaslik).map((k) => k.split('|')[0]))].sort();
  if (months.length >= 2) {
    const lastMonth = months[months.length - 1];
    const prevMonth = months[months.length - 2];
    const basliks = [...new Set(Object.keys(byMonthBaslik).map((k) => k.split('|')[1]))];
    basliks.forEach((baslik) => {
      const curr = byMonthBaslik[`${lastMonth}|${baslik}`] || 0;
      const prev = byMonthBaslik[`${prevMonth}|${baslik}`] || 0;
      if (prev > 0 && curr >= prev * MOM_SPIKE_RATIO && curr > prev) {
        const pct = Math.round(((curr - prev) / prev) * 100);
        add({
          alert_type: 'SPENDING_ANOMALY',
          severity: 'MEDIUM',
          title: 'Aylık harcama artışı',
          message: `${baslik} için ${lastMonth} ayı harcaması bir önceki aya göre %${pct} arttı.`,
          dismissKey: `mom-${lastMonth}-${baslik.replace(/\s/g, '-')}`,
        });
      }
    });
  }

  return alerts;
}
