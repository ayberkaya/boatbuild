/**
 * Expenses List Page
 * BoatBuild CRM - View and manage expenses
 * Redesigned to match trideck_hesap_defteri.xlsx format
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { expensesAPI } from '../api/client';
import { formatCurrency, formatCurrencyMulti } from '../utils/currency';
import {
  Plus,
  Filter,
  Eye,
  CheckCircle,
  XCircle,
  ChevronLeft,
  ChevronRight,
  Trash2,
  AlertTriangle,
} from 'lucide-react';

// Başlık (Main Category) definitions with colors
const BASLIKLAR = {
  'İmalat': { color: 'bg-green-100 text-green-800', label: 'İmalat' },
  'Yunanistan Kurulum': { color: 'bg-blue-100 text-blue-800', label: 'Yunanistan' },
  'Tersane Kurulum': { color: 'bg-orange-100 text-orange-800', label: 'Tersane' },
  'Reklam ve Tanıtım': { color: 'bg-yellow-100 text-yellow-800', label: 'Reklam' },
  'Baran': { color: 'bg-purple-100 text-purple-800', label: 'Baran' },
};

// Map primary_tag to Başlık
const getBaslikFromTag = (primaryTag) => {
  if (!primaryTag) return { baslik: 'Diğer', kategori: '' };
  
  const tag = primaryTag.toUpperCase();
  
  if (tag.startsWith('IMALAT') || tag === 'MOTOR' || tag === 'KAAN_ODEME' || tag === 'ETKIN') {
    const kategoriMap = {
      'IMALAT_GENEL': 'Genel',
      'IMALAT_TESISAT': 'Tesisat',
      'IMALAT_ELEKTRIK': 'Elektrik',
      'IMALAT_ALUMINYUM': 'Alüminyum',
      'MOTOR': 'Motorlar',
      'KAAN_ODEME': 'Kaan Ödeme',
      'ETKIN': 'Etkin Gürel',
    };
    return { baslik: 'İmalat', kategori: kategoriMap[tag] || 'Genel' };
  }
  
  if (tag.startsWith('YUNANISTAN')) {
    const kategoriMap = {
      'YUNANISTAN_AVUKAT': 'Avukat',
      'YUNANISTAN_DEPOSIT': 'Deposit',
      'YUNANISTAN_ROMORK': 'Römork',
      'YUNANISTAN_SIGORTA': 'Sigorta',
      'YUNANISTAN_GUMRUK': 'Gümrük',
      'YUNANISTAN_LIMAN': 'Liman',
      'YUNANISTAN_KAPTAN': 'Kaptan',
      'YUNANISTAN_MAZOT': 'Mazot',
      'YUNANISTAN_TRANSFER': 'Transfer',
      'YUNANISTAN_SURVEY': 'Survey',
    };
    return { baslik: 'Yunanistan Kurulum', kategori: kategoriMap[tag] || 'Genel' };
  }
  
  if (tag.startsWith('TERSANE')) {
    const kategoriMap = {
      'TERSANE_TENTE': 'Tente Kurulum',
      'TERSANE_KIRALAMA': 'Tersane Kiralama',
      'TERSANE_GENEL': 'Genel',
    };
    return { baslik: 'Tersane Kurulum', kategori: kategoriMap[tag] || 'Genel' };
  }
  
  if (tag === 'REKLAM' || tag.startsWith('REKLAM')) {
    return { baslik: 'Reklam ve Tanıtım', kategori: 'Genel' };
  }
  
  if (tag === 'BARAN' || tag.startsWith('BARAN')) {
    return { baslik: 'Baran', kategori: 'Genel' };
  }
  
  return { baslik: 'Diğer', kategori: primaryTag };
};

// Başlık -> which primary_tag prefixes/specific tags belong (for filtering category list)
const BASLIK_TAG_PREDICATE = {
  'İmalat': (tag) => {
    const t = (tag || '').toUpperCase();
    return t.startsWith('IMALAT') || ['MOTOR', 'KAAN_ODEME', 'ETKIN'].includes(t);
  },
  'Yunanistan Kurulum': (tag) => (tag || '').toUpperCase().startsWith('YUNANISTAN'),
  'Tersane Kurulum': (tag) => (tag || '').toUpperCase().startsWith('TERSANE'),
  'Reklam ve Tanıtım': (tag) => (tag || '').toUpperCase() === 'REKLAM',
  'Baran': (tag) => (tag || '').toUpperCase() === 'BARAN',
};

const categoriesForBaslik = (categories, baslik) => {
  if (!baslik || !categories.length) return [];
  const pred = BASLIK_TAG_PREDICATE[baslik];
  if (!pred) return [];
  return categories.filter((c) => pred(c.primary_tag));
};

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
    baslik: searchParams.get('baslik') || '',
    primary_tag: searchParams.get('primary_tag') || '',
    category_id: searchParams.get('category_id') || '',
    vendor_id: searchParams.get('vendor_id') || '',
    vendor_name: searchParams.get('vendor_name') || '',
    is_hak_edis_eligible: searchParams.get('is_hak_edis_eligible') || '',
    unassigned: searchParams.get('unassigned') || '',
  });
  const [categories, setCategories] = useState([]);
  const [showFilters, setShowFilters] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [totals, setTotals] = useState({
    byCurrency: {},
    eligibleByCurrency: {},
    hakedisByCurrency: {},
  });

  useEffect(() => {
    fetchTotals();
  }, []);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await expensesAPI.categories();
        setCategories(res.data?.data?.categories || []);
      } catch (e) {
        console.error('Failed to load categories', e);
      }
    };
    load();
  }, []);

  useEffect(() => {
    const urlFilters = {
      start_date: searchParams.get('start_date') || '',
      end_date: searchParams.get('end_date') || '',
      baslik: searchParams.get('baslik') || '',
      primary_tag: searchParams.get('primary_tag') || '',
      category_id: searchParams.get('category_id') || '',
      vendor_id: searchParams.get('vendor_id') || '',
      vendor_name: searchParams.get('vendor_name') || '',
      is_hak_edis_eligible: searchParams.get('is_hak_edis_eligible') || '',
      unassigned: searchParams.get('unassigned') || '',
    };
    setFilters(urlFilters);
  }, [searchParams]);

  useEffect(() => {
    fetchExpenses();
  }, [pagination.page, filters]);

  const updateFilter = (key, value) => {
    const cleared = key === 'baslik' ? { primary_tag: '', category_id: '' } : {};
    setFilters(prev => ({
      ...prev,
      [key]: value,
      ...cleared,
    }));
    setPagination(prev => (prev.page === 1 ? prev : { ...prev, page: 1 }));
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value); else next.delete(key);
    if (key === 'baslik') {
      next.delete('primary_tag');
      next.delete('category_id');
    }
    setSearchParams(next, { replace: true });
  };

  const fetchTotals = async () => {
    try {
      const response = await expensesAPI.list({ limit: 10000 });
      const allExpenses = response.data.data.expenses;

      const byCurrency = {};
      const eligibleByCurrency = {};
      const hakedisByCurrency = {};
      allExpenses.forEach((e) => {
        const c = e.currency || 'TRY';
        const amt = parseFloat(e.amount || 0);
        const hak = parseFloat(e.hak_edis_amount || 0);
        if (!byCurrency[c]) byCurrency[c] = 0;
        if (!eligibleByCurrency[c]) eligibleByCurrency[c] = 0;
        if (!hakedisByCurrency[c]) hakedisByCurrency[c] = 0;
        byCurrency[c] += amt;
        if (e.is_hak_edis_eligible) eligibleByCurrency[c] += amt;
        hakedisByCurrency[c] += hak;
      });
      setTotals({ byCurrency, eligibleByCurrency, hakedisByCurrency });
    } catch (error) {
      console.error('Failed to fetch totals:', error);
    }
  };

  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };
      
      // Add date filters
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      if (filters.is_hak_edis_eligible) params.is_hak_edis_eligible = filters.is_hak_edis_eligible;
      
      // primary_tag from URL (e.g. KAAN_ODEME) or map baslik to primary_tag
      if (filters.primary_tag) {
        params.primary_tag = filters.primary_tag;
      } else if (filters.baslik) {
        const baslikTagMap = {
          'İmalat': 'IMALAT',
          'Yunanistan Kurulum': 'YUNANISTAN',
          'Tersane Kurulum': 'TERSANE',
          'Reklam ve Tanıtım': 'REKLAM',
          'Baran': 'BARAN',
        };
        params.primary_tag = baslikTagMap[filters.baslik] || '';
      }
      if (filters.unassigned === 'true') params.unassigned = 'true';
      if (filters.category_id) params.category_id = filters.category_id;
      if (filters.vendor_id) params.vendor_id = filters.vendor_id;

      const response = await expensesAPI.list(params);
      setExpenses(response.data.data.expenses);
      setPagination(prev => ({ ...prev, ...response.data.data.pagination }));
    } catch (error) {
      console.error('Failed to fetch expenses:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('tr-TR');
  };

  const truncateText = (text, maxLength = 40) => {
    if (!text) return '-';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
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

      {/* Vendor filter banner - from /vendors card click */}
      {filters.vendor_id && (
        <div className="card border border-primary-200 bg-primary-50 flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            <strong>Tedarikçi:</strong> Sadece <strong>{decodeURIComponent(filters.vendor_name || '') || 'bu tedarikçi'}</strong> giderleri gösteriliyor.
          </p>
          <Link to="/expenses" className="btn-outline text-sm">Tüm giderler</Link>
        </div>
      )}
      {/* Unassigned filter banner - matches /vendors "Diğer / Atanmamış" */}
      {filters.unassigned === 'true' && (
        <div className="card border-dashed border-2 border-gray-200 bg-gray-50 flex items-center justify-between">
          <p className="text-sm text-text-secondary">
            <strong>Diğer / Atanmamış:</strong> Sadece tedarikçi eşleşmeyen giderler gösteriliyor (Tedarikçiler sayfasındaki liste ile aynı).
          </p>
          <Link to="/expenses" className="btn-outline text-sm">Tüm giderler</Link>
        </div>
      )}

      {/* Filters */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-text-secondary hover:text-text"
            >
              <Filter className="w-5 h-5" />
              Filtreler
            </button>
            {filters.primary_tag === 'KAAN_ODEME' && (
              <span className="text-sm px-2 py-1 rounded bg-green-100 text-green-800">
                Kaan Ödemeler
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">
              Toplam: {pagination.total} gider
            </span>
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
            <div>
              <label className="label">Başlangıç Tarihi</label>
              <input
                type="date"
                value={filters.start_date}
                onChange={(e) => updateFilter('start_date', e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Bitiş Tarihi</label>
              <input
                type="date"
                value={filters.end_date}
                onChange={(e) => updateFilter('end_date', e.target.value)}
                className="input"
              />
            </div>
            <div>
              <label className="label">Başlık</label>
              <select
                value={filters.baslik}
                onChange={(e) => updateFilter('baslik', e.target.value)}
                className="select"
              >
                <option value="">Tümü</option>
                <option value="İmalat">İmalat</option>
                <option value="Yunanistan Kurulum">Yunanistan Kurulum</option>
                <option value="Tersane Kurulum">Tersane Kurulum</option>
                <option value="Reklam ve Tanıtım">Reklam ve Tanıtım</option>
                <option value="Baran">Baran</option>
              </select>
            </div>
            <div>
              <label className="label">Kategori</label>
              <select
                value={filters.category_id}
                onChange={(e) => updateFilter('category_id', e.target.value)}
                className="select"
                disabled={!filters.baslik}
                title={!filters.baslik ? 'Önce başlık seçin' : undefined}
              >
                <option value="">
                  {filters.baslik ? 'Tümü' : 'Önce başlık seçin'}
                </option>
                {categoriesForBaslik(categories, filters.baslik).map((c) => (
                  <option key={c.category_id} value={c.category_id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Kaan Hakediş</label>
              <select
                value={filters.is_hak_edis_eligible}
                onChange={(e) => updateFilter('is_hak_edis_eligible', e.target.value)}
                className="select"
              >
                <option value="">Tümü</option>
                <option value="true">Evet</option>
                <option value="false">Hayır</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card">
          <p className="text-sm text-text-secondary">Toplam Gider</p>
          <div className="space-y-1">
            {formatCurrencyMulti(totals.byCurrency || {}).map((formatted, i) => (
              <p key={i} className="text-2xl font-bold text-primary money">{formatted}</p>
            ))}
          </div>
        </div>
        <div className="card">
          <p className="text-sm text-text-secondary">Hakediş Matrahı</p>
          <div className="space-y-1">
            {formatCurrencyMulti(totals.eligibleByCurrency || {}).map((formatted, i) => (
              <p key={i} className="text-2xl font-bold text-green-600 money">{formatted}</p>
            ))}
          </div>
        </div>
        <div className="card">
          <p className="text-sm text-text-secondary">Toplam Hakediş (%7)</p>
          <div className="space-y-1">
            {formatCurrencyMulti(totals.hakedisByCurrency || {}).map((formatted, i) => (
              <p key={i} className="text-2xl font-bold text-blue-600 money">{formatted}</p>
            ))}
          </div>
        </div>
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
                    <th>Başlık</th>
                    <th>Kategori</th>
                    <th className="text-right">Tutar</th>
                    <th>Kime</th>
                    <th className="text-center">Kaan Hakediş</th>
                    <th>Açıklama</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((expense) => {
                    const { baslik, kategori } = getBaslikFromTag(expense.primary_tag);
                    const baslikStyle = BASLIKLAR[baslik] || { color: 'bg-gray-100 text-gray-800', label: baslik };
                    
                    return (
                      <tr
                        key={expense.expense_id}
                        className="cursor-pointer hover:bg-gray-50"
                        onClick={() => navigate(`/expenses/${expense.expense_id}`)}
                      >
                        <td className="font-medium whitespace-nowrap">
                          {formatDate(expense.date)}
                        </td>
                        <td>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${baslikStyle.color}`}>
                            {baslikStyle.label}
                          </span>
                        </td>
                        <td className="text-text-secondary">
                          {kategori || '-'}
                        </td>
                        <td className="text-right font-semibold whitespace-nowrap">
                          {formatCurrency(expense.amount, expense.currency)}
                        </td>
                        <td className="text-text-secondary">
                          {expense.vendor_name || '-'}
                        </td>
                        <td className="text-center">
                          {expense.is_hak_edis_eligible ? (
                            <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                          ) : (
                            <XCircle className="w-5 h-5 text-gray-400 mx-auto" />
                          )}
                        </td>
                        <td className="text-text-secondary text-sm max-w-xs">
                          {truncateText(expense.description)}
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
                                className="p-2 hover:bg-red-50 rounded-lg text-red-500"
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

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-modal max-w-md w-full p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-red-50 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-red-500" />
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
                {formatDate(deleteConfirm.date)} • {formatCurrency(deleteConfirm.amount, deleteConfirm.currency || 'TRY')}
              </p>
            </div>

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
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-medium"
              >
                {deleting ? (
                  <span className="flex items-center gap-2">
                    <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></span>
                    Siliniyor...
                  </span>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4 mr-2 inline" />
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
