/**
 * AlertItem – reusable alert row for dashboard and spending anomaly alerts
 * Supports expense_currency for correct tr-TR symbol; onResolve optional (e.g. local dismiss).
 */

import React from 'react';
import { FileWarning, Clock, AlertTriangle } from 'lucide-react';
import { formatCurrency } from '../utils/currency';

const severityColors = {
  CRITICAL: 'border-l-danger bg-danger-50',
  HIGH: 'border-l-warning bg-warning-50',
  MEDIUM: 'border-l-secondary bg-secondary-50',
  LOW: 'border-l-gray-400 bg-gray-50',
};

const icons = {
  MISSING_DOCUMENT: FileWarning,
  CONDITIONAL_PENDING: Clock,
  OVERRIDE_PENDING: AlertTriangle,
  SPENDING_ANOMALY: AlertTriangle,
};

export default function AlertItem({ alert, onResolve }) {
  const Icon = icons[alert.alert_type] || AlertTriangle;
  const currency = alert.expense_currency || 'TRY';

  return (
    <div className={`p-4 border-l-4 rounded-r-lg ${severityColors[alert.severity] || severityColors.LOW}`}>
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 text-text-secondary flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-text">{alert.title}</p>
          <p className="text-sm text-text-secondary mt-1">{alert.message}</p>
          {alert.expense_vendor != null && (
            <p className="text-xs text-text-muted mt-2">
              {alert.expense_vendor}
              {alert.expense_amount != null && (
                <> – {formatCurrency(alert.expense_amount, currency)}</>
              )}
            </p>
          )}
        </div>
        {onResolve && (alert.alert_id != null || alert.dismissKey != null) && (
          <button
            onClick={() => onResolve(alert.alert_id ?? alert.dismissKey)}
            className="text-sm text-primary hover:underline flex-shrink-0"
          >
            {alert.alert_id != null ? 'Çöz' : 'Kapat'}
          </button>
        )}
      </div>
    </div>
  );
}
