/**
 * Dashboard Page
 * BoatBuild CRM - Owner and Operation views with KPIs, charts, and alerts
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { dashboardAPI, futureExpensesAPI } from '../api/client';
import { formatCurrency, formatCurrencyMulti } from '../utils/currency';
import AlertItem from '../components/AlertItem';
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
  Wrench,
  Ship,
  Building2,
  Megaphone,
  User,
  MoreHorizontal,
} from 'lucide-react';

// KPI Card Component
const KPICard = ({ title, value, subtitle, icon: Icon, trend, trendValue, variant = 'default', onClick }) => {
  const variants = {
    default: 'bg-white',
    primary: 'bg-primary text-white',
    success: 'bg-success text-white',
    warning: 'bg-warning text-white',
    danger: 'bg-danger text-white',
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
              {typeof value === 'number' ? formatCurrency(value, 'TRY') : value}
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
        <div className={`flex items-center gap-1 mt-3 text-sm ${trend === 'up' ? 'text-success' : 'text-danger'
          }`}>
          {trend === 'up' ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span>{trendValue}</span>
        </div>
      )}
    </div>
  );
};

// Başlık configuration with icons and colors
const BASLIK_CONFIG = {
  'İmalat': {
    icon: Wrench,
    color: 'bg-green-50 border-green-200',
    iconColor: 'text-green-600',
    filter: 'baslik=İmalat'
  },
  'Yunanistan Kurulum': {
    icon: Ship,
    color: 'bg-blue-50 border-blue-200',
    iconColor: 'text-blue-600',
    filter: 'baslik=Yunanistan'
  },
  'Tersane Kurulum': {
    icon: Building2,
    color: 'bg-orange-50 border-orange-200',
    iconColor: 'text-orange-600',
    filter: 'baslik=Tersane'
  },
  'Reklam ve Tanıtım': {
    icon: Megaphone,
    color: 'bg-yellow-50 border-yellow-200',
    iconColor: 'text-yellow-600',
    filter: 'primary_tag=REKLAM'
  },
  'Baran': {
    icon: User,
    color: 'bg-purple-50 border-purple-200',
    iconColor: 'text-purple-600',
    filter: 'primary_tag=BARAN'
  },
  'Diğer': {
    icon: MoreHorizontal,
    color: 'bg-gray-50 border-gray-200',
    iconColor: 'text-gray-600',
    filter: ''
  },
};

// Category Spend Card Component
const CategorySpendCard = ({ baslik, data, formatCurrencyMulti, onClick }) => {
  const config = BASLIK_CONFIG[baslik] || BASLIK_CONFIG['Diğer'];
  const Icon = config.icon;

  return (
    <div
      className={`p-4 rounded-lg border ${config.color} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Icon className={`w-5 h-5 ${config.iconColor}`} />
            <p className="font-medium text-text">{baslik}</p>
          </div>
          {Array.isArray(formatCurrencyMulti(data.by_currency)) ? (
            formatCurrencyMulti(data.by_currency).map((currencyValue, index) => (
              <p key={index} className="text-lg font-bold text-text money">
                {currencyValue}
              </p>
            ))
          ) : (
            <p className="text-lg font-bold text-text money">
              {formatCurrencyMulti(data.by_currency)}
            </p>
          )}
          <p className="text-xs text-text-muted mt-1">
            {data.expense_count} gider
          </p>
        </div>
      </div>
    </div>
  );
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { isOwner } = useAuth();
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [futureExpenseTotal, setFutureExpenseTotal] = useState(0);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [kpisRes, alertsRes, futureRes] = await Promise.all([
        dashboardAPI.kpis(),
        dashboardAPI.alerts(),
        futureExpensesAPI.list().catch(err => ({ data: { success: false } })),
      ]);

      setKpis(kpisRes.data.data);
      setAlerts(alertsRes.data.data.alerts);

      if (kpisRes.data.data.planned_future_expenses !== undefined) {
        setFutureExpenseTotal(kpisRes.data.data.planned_future_expenses);
      } else if (futureRes && futureRes.data && futureRes.data.success) {
        setFutureExpenseTotal(futureRes.data.data.totals.totalAmount);
      }
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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Toplam Harcama (All Expenses) */}
        <KPICard
          title="Toplam Harcama"
          value={formatCurrencyMulti(kpis?.total_spend)}
          icon={DollarSign}
          onClick={() => navigate('/expenses')}
        />

        {/* Card 2: Gelecek Taksitler (Installments Only) */}
        <KPICard
          title="Gelecek Taksitler"
          value={formatCurrencyMulti(kpis?.future_installments)}
          subtitle="Taksitli ödemeler"
          icon={Calendar}
          variant="warning"
          onClick={() => navigate('/future-expenses')}
        />

        {/* Card 3: Gelecekteki Gider Akışı (Total Projected) */}
        <div className="card bg-primary text-white" onClick={() => navigate('/future-expenses')} role="button">
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium opacity-80">Gelecekteki Gider Akışı</p>
              <div className="mt-1">
                {kpis?.future_flow ? (
                  <div className="text-2xl font-bold money">
                    {formatCurrencyMulti(kpis.future_flow).map((val, idx) => (
                      <div key={idx}>{val}</div>
                    ))}
                  </div>
                ) : (
                  <p className="text-2xl font-bold mt-1 money">{formatCurrency(0, 'EUR')}</p>
                )}
              </div>
              <p className="text-sm mt-1 opacity-70">
                Planlanan tüm nakit çıkışı
              </p>
            </div>
            <div className="p-3 rounded-lg bg-white/20">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* Spend by Category (Başlık) */}
      {kpis?.spend_by_baslik && Object.keys(kpis.spend_by_baslik).length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text">Başlıklara Göre Harcamalar</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {Object.entries(kpis.spend_by_baslik)
              .sort((a, b) => {
                // Sort by total spending descending (sum across currencies)
                const totalA = Object.values(a[1].by_currency).reduce((sum, v) => sum + v, 0);
                const totalB = Object.values(b[1].by_currency).reduce((sum, v) => sum + v, 0);
                return totalB - totalA;
              })
              .map(([baslik, data]) => (
                <CategorySpendCard
                  key={baslik}
                  baslik={baslik}
                  data={data}
                  formatCurrencyMulti={formatCurrencyMulti}
                  onClick={() => navigate(`/expenses?baslik=${encodeURIComponent(baslik)}`)}
                />
              ))}
            {/* Ödenen Hak Ediş Card (Kaan'a yapılan ödemeler) */}
            <div
              className="p-4 rounded-lg border bg-green-50 border-green-200 cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => navigate('/expenses?primary_tag=KAAN_ODEME')}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <p className="font-medium text-text">Ödenen Hak Ediş</p>
                  </div>
                  {Array.isArray(formatCurrencyMulti(kpis?.paid_hak_edis)) ? (
                    formatCurrencyMulti(kpis?.paid_hak_edis).map((currencyValue, index) => (
                      <p key={index} className="text-lg font-bold text-text money">
                        {currencyValue}
                      </p>
                    ))
                  ) : (
                    <p className="text-lg font-bold text-text money">
                      {formatCurrencyMulti(kpis?.paid_hak_edis)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

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

      {/* Alerts Panel */}
      {alerts.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-text">Uyarılar ve Hatırlatmalar</h3>
            <span className="badge badge-danger">{alerts.length} aktif</span>
          </div>
          <div className="space-y-3">
            {alerts.slice(0, 5).map((alert) => (
              <AlertItem
                key={alert.alert_id}
                alert={{ ...alert, expense_currency: alert.expense_currency || 'TRY' }}
                onResolve={handleResolveAlert}
              />
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
