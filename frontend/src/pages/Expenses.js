/**
 * Expenses List Page
 * BoatBuild CRM - View and manage expenses
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { expensesAPI } from '../api/client';
import {
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  CheckCircle,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

const Expenses = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isOwner } = useAuth();
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [filters, setFilters] = useState({
    start_date: searchParams.get('start_date') || '',
    end_date: searchParams.get('end_date') || '',
    primary_tag: searchParams.get('primary_tag') || '',
    work_scope_level: searchParams.get('work_scope_level') || '',
    is_hak_edis_eligible: searchParams.get('is_hak_edis_eligible') || '',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Update filters from URL params on mount
  useEffect(() => {
    const urlFilters = {
      start_date: searchParams.get('start_date') || '',
      end_date: searchParams.get('end_date') || '',
      primary_tag: searchParams.get('primary_tag') || '',
      work_scope_level: searchParams.get('work_scope_level') || '',
      is_hak_edis_eligible: searchParams.get('is_hak_edis_eligible') || '',
    };
    setFilters(urlFilters);
  }, [searchParams]);

  useEffect(() => {
    fetchExpenses();
  }, [pagination.page, filters]);

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v !== '')),
      };
      const response = await expensesAPI.list(params);
      setExpenses(response.data.data.expenses);
      setPagination(prev => ({ ...prev, ...response.data.data.pagination }));
    } catch (error) {
      console.error('Failed to fetch expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount, currency = 'TRY') => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('tr-TR');
  };

  const getWorkScopeBadge = (scope) => {
    const styles = {
      PURE_IMALAT: 'badge-success',
      MALZEME_PLUS_IMALAT: 'badge-warning',
      PURE_MALZEME: 'badge-secondary',
      NON_IMALAT: 'badge-danger',
    };
    return styles[scope] || 'badge-secondary';
  };

  const getHakEdisStatus = (expense) => {
    if (expense.is_hak_edis_eligible) {
      return { icon: CheckCircle, class: 'text-success', label: 'Uygun' };
    }
    if (expense.hak_edis_policy === 'CONDITIONAL' && !expense.has_owner_override) {
      return { icon: Clock, class: 'text-warning', label: 'Onay Bekliyor' };
    }
    return { icon: XCircle, class: 'text-text-muted', label: 'Uygun Değil' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">Giderler</h1>
          <p className="text-text-secondary">Tüm giderleri görüntüle ve yönet</p>
        </div>
        <Link to="/expenses/new" className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          Yeni Gider
        </Link>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-text-secondary hover:text-text"
          >
            <Filter className="w-5 h-5" />
            Filtreler
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">
              Toplam: {pagination.total} gider
            </span>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 pt-4 border-t border-gray-100">
            <div>
              <label className="label">Başlangıç Tarihi</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => setFilters({ ...filters, start_date: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Bitiş Tarihi</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => setFilters({ ...filters, end_date: e.target.value })}
                className="input"
              />
            </div>
            <div>
              <label className="label">Etiket</label>
              <input
                type="text"
                value={filters.primary_tag}
                onChange={(e) => setFilters({ ...filters, primary_tag: e.target.value })}
                className="input"
                placeholder="KAYNAK, CAM, vb."
              />
            </div>
            <div>
              <label className="label">İş Kapsamı</label>
              <select
                value={filters.work_scope_level}
                onChange={(e) => setFilters({ ...filters, work_scope_level: e.target.value })}
                className="select"
              >
                <option value="">Tümü</option>
                <option value="PURE_IMALAT">PURE_IMALAT</option>
                <option value="MALZEME_PLUS_IMALAT">MALZEME_PLUS_IMALAT</option>
                <option value="PURE_MALZEME">PURE_MALZEME</option>
                <option value="NON_IMALAT">NON_IMALAT</option>
              </select>
            </div>
            <div>
              <label className="label">Hak Ediş</label>
              <select
                value={filters.is_hak_edis_eligible}
                onChange={(e) => setFilters({ ...filters, is_hak_edis_eligible: e.target.value })}
                className="select"
              >
                <option value="">Tümü</option>
                <option value="true">Uygun</option>
                <option value="false">Uygun Değil</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Expenses Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : expenses.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-text-secondary">
            <p>Henüz gider kaydı yok</p>
            <Link to="/expenses/new" className="btn-outline mt-4">
              <Plus className="w-4 h-4 mr-2" />
              İlk gideri ekle
            </Link>
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Tarih</th>
                    <th>Tedarikçi</th>
                    <th>Etiket</th>
                    <th>İş Kapsamı</th>
                    <th className="text-right">Tutar</th>
                    <th className="text-center">Hak Ediş</th>
                    <th className="text-right">Hak Ediş Tutarı</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => {
                    const hakEdisStatus = getHakEdisStatus(expense);
                    return (
                      <tr
                        key={expense.expense_id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/expenses/${expense.expense_id}`)}
                      >
                        <td className="font-medium">{formatDate(expense.date)}</td>
                        <td>{expense.vendor_name}</td>
                        <td>
                          <span className="badge badge-primary">{expense.primary_tag}</span>
                        </td>
                        <td>
                          <span className={`badge ${getWorkScopeBadge(expense.work_scope_level)}`}>
                            {expense.work_scope_level}
                          </span>
                        </td>
                        <td className="text-right money font-medium">
                          {formatCurrency(expense.amount, expense.currency)}
                        </td>
                        <td className="text-center">
                          <div className={`flex items-center justify-center gap-1 ${hakEdisStatus.class}`}>
                            <hakEdisStatus.icon className="w-4 h-4" />
                            <span className="text-sm">{hakEdisStatus.label}</span>
                          </div>
                        </td>
                        <td className={`text-right money ${expense.is_hak_edis_eligible ? 'text-success font-medium' : 'text-text-muted'}`}>
                          {expense.is_hak_edis_eligible
                            ? formatCurrency(expense.hak_edis_amount, expense.currency)
                            : '-'}
                        </td>
                        <td>
                          <button className="p-2 hover:bg-gray-100 rounded-lg">
                            <Eye className="w-4 h-4 text-text-secondary" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
              <div className="text-sm text-text-secondary">
                Sayfa {pagination.page} / {pagination.pages}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                  disabled={pagination.page === 1}
                  className="btn-ghost p-2 disabled:opacity-50"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <button
                  onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                  disabled={pagination.page === pagination.pages}
                  className="btn-ghost p-2 disabled:opacity-50"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-text-secondary">Toplam Gider</p>
          <p className="text-xl font-bold text-primary money">
            {formatCurrency(expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0))}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-text-secondary">Hak Edişli Gider</p>
          <p className="text-xl font-bold text-success money">
            {formatCurrency(expenses.filter(e => e.is_hak_edis_eligible).reduce((sum, e) => sum + parseFloat(e.amount), 0))}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-text-secondary">Toplam Hak Ediş</p>
          <p className="text-xl font-bold text-secondary money">
            {formatCurrency(expenses.reduce((sum, e) => sum + parseFloat(e.hak_edis_amount || 0), 0))}
          </p>
        </div>
      </div>
    </div>
  );
};

export default Expenses;
