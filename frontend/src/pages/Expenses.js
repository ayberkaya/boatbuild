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
  Trash2,
  AlertTriangle,
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
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);

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

  const getWorkScopeLabel = (scope) => {
    const labels = {
      PURE_IMALAT: 'Saf İmalat',
      MALZEME_PLUS_IMALAT: 'Malzeme + İmalat',
      PURE_MALZEME: 'Saf Malzeme',
      NON_IMALAT: 'İmalat Dışı',
    };
    return labels[scope] || scope;
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

  const handleDeleteClick = (e, expense) => {
    e.stopPropagation();
    setDeleteConfirm(expense);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    try {
      setDeleting(true);
      await expensesAPI.delete(deleteConfirm.expense_id);
      setDeleteConfirm(null);
      fetchExpenses();
    } catch (error) {
      console.error('Failed to delete expense:', error);
      alert(error.response?.data?.error || 'Gider silinemedi');
    } finally {
      setDeleting(false);
    }
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
                            {getWorkScopeLabel(expense.work_scope_level)}
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
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/expenses/${expense.expense_id}`);
                              }}
                              className="p-2 hover:bg-gray-100 rounded-lg"
                              title="Detayları görüntüle"
                            >
                              <Eye className="w-4 h-4 text-text-secondary" />
                            </button>
                            {isOwner && (
                              <button
                                onClick={(e) => handleDeleteClick(e, expense)}
                                className="p-2 hover:bg-danger-50 rounded-lg text-danger"
                                title="Gideri sil"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
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
          <div className="space-y-1">
            {['TRY', 'USD', 'EUR'].map(currency => {
              const total = expenses
                .filter(e => e.currency === currency)
                .reduce((sum, e) => sum + parseFloat(e.amount), 0);
              if (total === 0) return null;
              return (
                <p key={currency} className="text-xl font-bold text-primary money">
                  {formatCurrency(total, currency)}
                </p>
              );
            })}
            {['TRY', 'USD', 'EUR'].every(c => 
              expenses.filter(e => e.currency === c).reduce((sum, e) => sum + parseFloat(e.amount), 0) === 0
            ) && (
              <p className="text-xl font-bold text-primary money">
                {formatCurrency(0, 'TRY')}
              </p>
            )}
          </div>
        </div>
        <div className="card">
          <p className="text-sm text-text-secondary">Hak Edişli Gider</p>
          <div className="space-y-1">
            {['TRY', 'USD', 'EUR'].map(currency => {
              const total = expenses
                .filter(e => e.is_hak_edis_eligible && e.currency === currency)
                .reduce((sum, e) => sum + parseFloat(e.amount), 0);
              if (total === 0) return null;
              return (
                <p key={currency} className="text-xl font-bold text-success money">
                  {formatCurrency(total, currency)}
                </p>
              );
            })}
            {['TRY', 'USD', 'EUR'].every(c => 
              expenses.filter(e => e.is_hak_edis_eligible && e.currency === c).reduce((sum, e) => sum + parseFloat(e.amount), 0) === 0
            ) && (
              <p className="text-xl font-bold text-success money">
                {formatCurrency(0, 'TRY')}
              </p>
            )}
          </div>
        </div>
        <div className="card">
          <p className="text-sm text-text-secondary">Toplam Hak Ediş</p>
          <div className="space-y-1">
            {['TRY', 'USD', 'EUR'].map(currency => {
              const total = expenses
                .filter(e => e.currency === currency)
                .reduce((sum, e) => sum + parseFloat(e.hak_edis_amount || 0), 0);
              if (total === 0) return null;
              return (
                <p key={currency} className="text-xl font-bold text-secondary money">
                  {formatCurrency(total, currency)}
                </p>
              );
            })}
            {['TRY', 'USD', 'EUR'].every(c => 
              expenses.filter(e => e.currency === c).reduce((sum, e) => sum + parseFloat(e.hak_edis_amount || 0), 0) === 0
            ) && (
              <p className="text-xl font-bold text-secondary money">
                {formatCurrency(0, 'TRY')}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-modal max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-danger-50 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-danger" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-text">Gideri Sil</h3>
                <p className="text-sm text-text-secondary">Bu işlem geri alınamaz</p>
              </div>
            </div>

            <div className="mb-4 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-text-secondary mb-2">Silinecek gider:</p>
              <p className="font-medium text-text">{deleteConfirm.vendor_name}</p>
              <p className="text-sm text-text-muted mt-1">
                {formatDate(deleteConfirm.date)} • {formatCurrency(deleteConfirm.amount, deleteConfirm.currency)}
              </p>
              <p className="text-sm text-text-muted">
                Etiket: <span className="font-medium">{deleteConfirm.primary_tag}</span>
              </p>
            </div>

            <p className="text-sm text-text-secondary mb-4">
              Bu gideri silmek istediğinizden emin misiniz? Bu işlem gideri, bağlı belgeleri ve uyarıları kalıcı olarak silecektir.
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                disabled={deleting}
                className="btn-ghost"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={deleting}
                className="btn-danger"
              >
                {deleting ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></span>
                    Siliniyor...
                  </span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Sil
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
