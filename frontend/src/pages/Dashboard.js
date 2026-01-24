/**
 * Dashboard Page
 * BoatBuild CRM - Owner and Operation views with KPIs, charts, and alerts
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI } from '../api/client';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  CheckCircle,
  Clock,
  FileWarning,
  ArrowRight,
  Calendar,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';

// KPI Card Component
const KPICard = ({ title, value, subtitle, icon: Icon, trend, trendValue, variant = 'default', onClick }) => {
  const variants = {
    default: 'bg-white',
    primary: 'bg-primary text-white',
    success: 'bg-success text-white',
    warning: 'bg-warning text-white',
    danger: 'bg-danger text-white',
  };

  const formatCurrency = (val) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div 
      className={`card ${variants[variant]} ${onClick ? 'cursor-pointer hover:shadow-lg transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${variant === 'default' ? 'text-text-secondary' : 'opacity-80'}`}>
            {title}
          </p>
          {Array.isArray(value) ? (
            <div className="space-y-1 mt-1">
              {value.map((currencyValue, index) => (
                <p key={index} className={`text-2xl font-bold money ${variant === 'default' ? 'text-primary' : ''} break-words`}>
                  {currencyValue}
                </p>
              ))}
            </div>
          ) : (
            <p className={`text-2xl font-bold mt-1 money ${variant === 'default' ? 'text-primary' : ''} break-words`}>
              {typeof value === 'number' ? formatCurrency(value) : value}
            </p>
          )}
          {subtitle && (
            <p className={`text-sm mt-1 ${variant === 'default' ? 'text-text-muted' : 'opacity-70'}`}>
              {subtitle}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`p-3 rounded-lg ${variant === 'default' ? 'bg-primary-50' : 'bg-white/20'}`}>
            <Icon className={`w-6 h-6 ${variant === 'default' ? 'text-primary' : 'text-white'}`} />
          </div>
        )}
      </div>
      {trend && (
        <div className={`flex items-center gap-1 mt-3 text-sm ${
          trend === 'up' ? 'text-success' : 'text-danger'
        }`}>
          {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span>{trendValue}</span>
        </div>
      )}
    </div>
  );
};

// Alert Item Component
const AlertItem = ({ alert, onResolve }) => {
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
  };

  const Icon = icons[alert.alert_type] || AlertTriangle;

  return (
    <div className={`p-4 border-l-4 rounded-r-lg ${severityColors[alert.severity] || severityColors.LOW}`}>
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 text-text-secondary flex-shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-text">{alert.title}</p>
          <p className="text-sm text-text-secondary mt-1">{alert.message}</p>
          {alert.expense_vendor && (
            <p className="text-xs text-text-muted mt-2">
              {alert.expense_vendor} - {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(alert.expense_amount)}
            </p>
          )}
        </div>
        <button
          onClick={() => onResolve(alert.alert_id)}
          className="text-sm text-primary hover:underline flex-shrink-0"
        >
          Çöz
        </button>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { isOwner } = useAuth();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [trend, setTrend] = useState(null);
  const [projection, setProjection] = useState(null);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [kpisRes, comparisonRes, trendRes, projectionRes, alertsRes] = await Promise.all([
        dashboardAPI.kpis(),
        dashboardAPI.hakEdisComparison(),
        dashboardAPI.hakEdisTrend(12),
        dashboardAPI.futureProjection(),
        dashboardAPI.alerts(),
      ]);

      setKpis(kpisRes.data.data);
      setComparison(comparisonRes.data.data);
      setTrend(trendRes.data.data.trend);
      setProjection(projectionRes.data.data);
      setAlerts(alertsRes.data.data.alerts);
    } catch (error) {
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveAlert = async (alertId) => {
    try {
      await dashboardAPI.resolveAlert(alertId, 'Resolved from dashboard');
      setAlerts(alerts.filter(a => a.alert_id !== alertId));
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  const formatCurrency = (val, currency = 'TRY') => {
    if (typeof val === 'string') return val; // Already formatted
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const formatCurrencyMulti = (valuesByCurrency) => {
    if (!valuesByCurrency || typeof valuesByCurrency !== 'object') {
      return formatCurrency(0);
    }
    
    const currencies = Object.keys(valuesByCurrency).filter(c => valuesByCurrency[c] > 0);
    if (currencies.length === 0) {
      return formatCurrency(0);
    }
    
    return currencies.map(currency => formatCurrency(valuesByCurrency[currency], currency));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text">Dashboard</h1>
          <p className="text-text-secondary">
            {isOwner ? 'Finansal özet ve hak ediş takibi' : 'Operasyon özeti'}
          </p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Toplam Harcama"
          value={formatCurrencyMulti(kpis?.total_spend)}
          icon={DollarSign}
          onClick={() => navigate('/expenses')}
        />
        <KPICard
          title="Ödenen Hak Ediş"
          value={formatCurrencyMulti(kpis?.paid_hak_edis)}
          subtitle={(() => {
            const totalSpend = kpis?.total_spend || {};
            const paidHakEdis = kpis?.paid_hak_edis || {};
            const currencies = Object.keys(totalSpend).filter(c => totalSpend[c] > 0);
            if (currencies.length === 0) return '0.0% oran';
            // Calculate percentage for each currency and show if significant
            const percentages = currencies.map(c => {
              const total = totalSpend[c] || 0;
              const paid = paidHakEdis[c] || 0;
              return total > 0 ? ((paid / total) * 100).toFixed(1) : 0;
            }).filter(p => parseFloat(p) > 0);
            if (percentages.length === 0) return '0.0% oran';
            return `${percentages[0]}% oran`;
          })()}
          icon={CheckCircle}
          variant="success"
          onClick={() => navigate('/expenses?is_hak_edis_eligible=true')}
        />
        <KPICard
          title="Potansiyel Hak Ediş"
          value={formatCurrencyMulti(kpis?.remaining_potential)}
          subtitle="Henüz uygulanmamış"
          icon={TrendingUp}
          onClick={() => navigate('/expenses?is_hak_edis_eligible=false')}
        />
        <KPICard
          title="Gelecek Harcamalar"
          value={formatCurrencyMulti(kpis?.future_expenses)}
          subtitle={`${kpis?.pending_transfers || 0} transfer onay bekliyor`}
          icon={Calendar}
          variant="warning"
          onClick={() => navigate('/transfers?status=PENDING')}
        />
      </div>

      {/* Pending Actions (Owner only) */}
      {isOwner && (kpis?.pending_transfers > 0 || kpis?.pending_overrides > 0) && (
        <div className="alert-warning">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          <div>
            <p className="font-medium">Onay Bekleyen İşlemler</p>
            <p className="text-sm mt-1">
              {kpis?.pending_transfers > 0 && `${kpis.pending_transfers} transfer`}
              {kpis?.pending_transfers > 0 && kpis?.pending_overrides > 0 && ' ve '}
              {kpis?.pending_overrides > 0 && `${kpis.pending_overrides} hak ediş onayı`}
              {' '}bekliyor.
            </p>
          </div>
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar Chart: Hak Ediş vs Non-Hak Ediş */}
        <div className="card">
          <h3 className="font-semibold text-text mb-4">Hak Edişli vs Hak Edişsiz Giderler</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={comparison?.by_work_scope || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="work_scope_level" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  formatter={(value) => formatCurrency(value)}
                  labelStyle={{ color: '#1C1C1C' }}
                />
                <Legend />
                <Bar dataKey="eligible_amount" name="Hak Edişli" fill="#2ECC71" />
                <Bar dataKey="total_amount" name="Toplam" fill="#0A2540" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Line Chart: Monthly Trend */}
        <div className="card">
          <h3 className="font-semibold text-text mb-4">Aylık Hak Ediş Trendi</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trend || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} tickFormatter={(v) => `${(v / 1000).toFixed(0)}K`} />
                <Tooltip
                  formatter={(value, name) => [
                    name === 'hak_edis_rate_percent' ? `${value}%` : formatCurrency(value),
                    name === 'hak_edis_total' ? 'Hak Ediş' : name === 'total_amount' ? 'Toplam' : 'Oran'
                  ]}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="total_amount"
                  name="Toplam Gider"
                  stroke="#0A2540"
                  strokeWidth={2}
                />
                <Line
                  type="monotone"
                  dataKey="hak_edis_total"
                  name="Hak Ediş"
                  stroke="#00B4D8"
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Future Projection Table (Owner only) */}
      {isOwner && projection && (
        <div className="card">
          <div className="mb-4">
            <h3 className="font-semibold text-text">Gelecek Hak Ediş Projeksiyonu</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Kategori</th>
                  <th>İş Kapsamı</th>
                  <th>Politika</th>
                  <th className="text-right">Harcanan</th>
                  <th className="text-right">Ödenen Hak Ediş</th>
                  <th className="text-right">Bekleyen</th>
                  <th className="text-right">%7 Hakediş</th>
                </tr>
              </thead>
              <tbody>
                {projection.projection.filter(p => p.total_spent > 0).map((item) => {
                  const byCurrency = item.by_currency || {};
                  const currencies = Object.keys(byCurrency).filter(c => byCurrency[c].total_spent > 0);
                  
                  return (
                    <tr key={item.tag}>
                      <td className="font-medium">{item.name}</td>
                      <td>
                        <span className={`badge ${
                          item.work_scope === 'PURE_IMALAT' ? 'badge-success' :
                          item.work_scope === 'MALZEME_PLUS_IMALAT' ? 'badge-warning' :
                          'badge-secondary'
                        }`}>
                          {item.work_scope}
                        </span>
                      </td>
                      <td>
                        <span className={`text-sm ${
                          item.policy === 'ALWAYS_INCLUDED' ? 'text-success' :
                          item.policy === 'CONDITIONAL' ? 'text-warning' :
                          'text-text-muted'
                        }`}>
                          {item.policy}
                        </span>
                      </td>
                      <td className="text-right">
                        {currencies.length > 0 ? (
                          <div className="space-y-1">
                            {currencies.map(currency => (
                              <div key={currency} className="money">
                                {formatCurrency(byCurrency[currency].total_spent, currency)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="money">{formatCurrency(0)}</span>
                        )}
                      </td>
                      <td className="text-right text-success">
                        {currencies.length > 0 ? (
                          <div className="space-y-1">
                            {currencies.map(currency => (
                              <div key={currency} className="money">
                                {formatCurrency(byCurrency[currency].paid_hak_edis, currency)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="money">{formatCurrency(0)}</span>
                        )}
                      </td>
                      <td className="text-right text-warning">
                        {currencies.length > 0 ? (
                          <div className="space-y-1">
                            {currencies.map(currency => (
                              <div key={currency} className="money">
                                {formatCurrency(byCurrency[currency].pending_potential, currency)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="money">{formatCurrency(0)}</span>
                        )}
                      </td>
                      <td className="text-right text-danger font-medium">
                        {currencies.length > 0 ? (
                          <div className="space-y-1">
                            {currencies.map(currency => (
                              <div key={currency} className="money">
                                {formatCurrency(byCurrency[currency].estimated_7_percent_exposure, currency)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="money">{formatCurrency(0)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td colSpan={3}>TOPLAM</td>
                  <td className="text-right">
                    {projection.totals_by_currency ? (
                      <div className="space-y-1">
                        {Object.keys(projection.totals_by_currency)
                          .filter(c => projection.totals_by_currency[c].total_spent > 0)
                          .map(currency => (
                            <div key={currency} className="money">
                              {formatCurrency(projection.totals_by_currency[currency].total_spent, currency)}
                            </div>
                          ))}
                      </div>
                    ) : (
                      <span className="money">{formatCurrency(projection.totals.total_spent)}</span>
                    )}
                  </td>
                  <td className="text-right text-success">
                    {projection.totals_by_currency ? (
                      <div className="space-y-1">
                        {Object.keys(projection.totals_by_currency)
                          .filter(c => projection.totals_by_currency[c].paid_hak_edis > 0)
                          .map(currency => (
                            <div key={currency} className="money">
                              {formatCurrency(projection.totals_by_currency[currency].paid_hak_edis, currency)}
                            </div>
                          ))}
                      </div>
                    ) : (
                      <span className="money">{formatCurrency(projection.totals.paid_hak_edis)}</span>
                    )}
                  </td>
                  <td className="text-right text-warning">
                    {projection.totals_by_currency ? (
                      <div className="space-y-1">
                        {Object.keys(projection.totals_by_currency)
                          .filter(c => projection.totals_by_currency[c].pending_potential > 0)
                          .map(currency => (
                            <div key={currency} className="money">
                              {formatCurrency(projection.totals_by_currency[currency].pending_potential, currency)}
                            </div>
                          ))}
                      </div>
                    ) : (
                      <span className="money">{formatCurrency(projection.totals.pending_potential)}</span>
                    )}
                  </td>
                  <td className="text-right text-danger">
                    {projection.totals_by_currency ? (
                      <div className="space-y-1">
                        {Object.keys(projection.totals_by_currency)
                          .filter(c => projection.totals_by_currency[c].total_exposure > 0)
                          .map(currency => (
                            <div key={currency} className="money">
                              {formatCurrency(projection.totals_by_currency[currency].total_exposure, currency)}
                            </div>
                          ))}
                      </div>
                    ) : (
                      <span className="money">{formatCurrency(projection.totals.total_exposure)}</span>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Alerts Panel */}
      {alerts.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text">Uyarılar ve Hatırlatmalar</h3>
            <span className="badge badge-danger">{alerts.length} aktif</span>
          </div>
          <div className="space-y-3">
            {alerts.slice(0, 5).map((alert) => (
              <AlertItem key={alert.alert_id} alert={alert} onResolve={handleResolveAlert} />
            ))}
            {alerts.length > 5 && (
              <button className="flex items-center gap-2 text-sm text-primary hover:underline">
                Tüm uyarıları gör ({alerts.length})
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
