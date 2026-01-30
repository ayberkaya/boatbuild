/**
 * Vendors Page
 * BoatBuild CRM - Vendor management
 * Total spend (Toplam Harcama) matches Dashboard; vendors + unassigned reconcile to total.
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { vendorsAPI } from '../api/client';
import {
  Plus,
  Edit2,
  Trash2,
  AlertTriangle,
  Search,
  X,
  DollarSign,
  Receipt,
  MoreHorizontal,
} from 'lucide-react';

const Vendors = () => {
  const navigate = useNavigate();
  const { isOwner } = useAuth();
  const [vendors, setVendors] = useState([]);
  const [totalSpend, setTotalSpend] = useState({});
  const [unassigned, setUnassigned] = useState({ expense_count: 0, expenses_by_currency: {} });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingVendor, setEditingVendor] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    name: '',
    tax_number: '',
    address: '',
    phone: '',
    email: '',
    requires_documentation: false,
    notes: '',
  });

  useEffect(() => {
    fetchVendors();
  }, []);

  const fetchVendors = async () => {
    try {
      setLoading(true);
      const response = await vendorsAPI.list();
      const { vendors: v, total_spend, unassigned: u } = response.data.data;
      setVendors(v || []);
      setTotalSpend(total_spend || {});
      setUnassigned(u || { expense_count: 0, expenses_by_currency: {} });
    } catch (error) {
      console.error('Failed to fetch vendors:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
    setErrors(prev => ({ ...prev, [name]: null }));
  };

  const openModal = (vendor = null) => {
    if (vendor) {
      setEditingVendor(vendor);
      setFormData({
        name: vendor.name,
        tax_number: vendor.tax_number || '',
        address: vendor.address || '',
        phone: vendor.phone || '',
        email: vendor.email || '',
        requires_documentation: vendor.requires_documentation || false,
        notes: vendor.notes || '',
      });
    } else {
      setEditingVendor(null);
      setFormData({
        name: '',
        tax_number: '',
        address: '',
        phone: '',
        email: '',
        requires_documentation: false,
        notes: '',
      });
    }
    setErrors({});
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingVendor(null);
    setFormData({
      name: '',
      tax_number: '',
      address: '',
      phone: '',
      email: '',
      requires_documentation: false,
      notes: '',
    });
    setErrors({});
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) newErrors.name = 'Tedarikçi adı zorunludur';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Geçerli bir e-posta adresi giriniz';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      setSaving(true);
      if (editingVendor) {
        await vendorsAPI.update(editingVendor.vendor_id, formData);
      } else {
        await vendorsAPI.create(formData);
      }
      closeModal();
      fetchVendors();
    } catch (error) {
      console.error('Failed to save vendor:', error);
      setErrors({ submit: error.response?.data?.error || 'Kaydetme başarısız oldu' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (vendorId) => {
    if (!window.confirm('Bu tedarikçiyi silmek istediğinizden emin misiniz?')) return;

    try {
      await vendorsAPI.delete(vendorId);
      fetchVendors();
    } catch (error) {
      console.error('Failed to delete vendor:', error);
      alert(error.response?.data?.error || 'Silme başarısız oldu');
    }
  };

  const formatCurrency = (amount, currency = 'TRY') => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  /** For total_spend: { EUR: 2314544, TRY: 1000 } */
  const formatCurrencyMultiPlain = (byCurrency) => {
    if (!byCurrency || typeof byCurrency !== 'object') return [formatCurrency(0)];
    const currencies = Object.keys(byCurrency).filter(c => (byCurrency[c] || 0) > 0);
    if (currencies.length === 0) return [formatCurrency(0)];
    return currencies.map(c => formatCurrency(byCurrency[c], c));
  };

  /** For expenses_by_currency: { EUR: { total_amount: x } } */
  const formatCurrencyMulti = (expensesByCurrency) => {
    if (!expensesByCurrency || typeof expensesByCurrency !== 'object') return [formatCurrency(0)];
    const currencies = Object.keys(expensesByCurrency).filter(c => (expensesByCurrency[c]?.total_amount || 0) > 0);
    if (currencies.length === 0) return [formatCurrency(0)];
    return currencies.map(currency => formatCurrency(expensesByCurrency[currency].total_amount, currency));
  };

  const filteredVendors = vendors.filter(v =>
    v.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.tax_number?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const hasUnassigned = (unassigned?.expense_count || 0) > 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">Tedarikçiler</h1>
          <p className="text-text-secondary">Tedarikçi listesi ve yönetimi</p>
        </div>
        <button onClick={() => openModal()} className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          Yeni Tedarikçi
        </button>
      </div>

      {/* Toplam Harcama KPI - matches Dashboard */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          className="card bg-white cursor-pointer hover:shadow-lg transition-shadow"
          onClick={() => navigate('/expenses')}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-secondary">Toplam Harcama</p>
              <div className="space-y-1 mt-1">
                {formatCurrencyMultiPlain(totalSpend).map((val, i) => (
                  <p key={i} className="text-2xl font-bold money text-primary break-words">{val}</p>
                ))}
              </div>
              <p className="text-sm mt-1 text-text-muted">Tüm giderler (kalem kalem: Giderler sayfası)</p>
            </div>
            <div className="p-3 rounded-lg bg-primary-50">
              <DollarSign className="w-6 h-6 text-primary" />
            </div>
          </div>
        </div>
        <div
          className="card bg-white cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => navigate('/expenses')}
        >
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-text-secondary">Tedarikçilere göre</p>
              <p className="text-lg font-bold text-text mt-1">
                {filteredVendors.length} tedarikçi
              </p>
              <p className="text-sm mt-1 text-text-muted">+ Atanmamış giderler</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => navigate('/expenses')}
          className="card bg-primary-50 border border-primary-200 hover:bg-primary-100 transition-colors text-left flex items-center gap-3"
        >
          <Receipt className="w-8 h-8 text-primary" />
          <div>
            <p className="font-medium text-text">Tüm giderleri kalem kalem gör</p>
            <p className="text-sm text-text-secondary">Giderler sayfasına git</p>
          </div>
        </button>
      </div>

      {/* Search */}
      <div className="card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-10"
            placeholder="Tedarikçi ara..."
          />
        </div>
      </div>

      {/* Vendors Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
        </div>
      ) : filteredVendors.length === 0 && !searchTerm ? (
        <div className="space-y-4">
          <div className="card p-6">
            <h3 className="font-semibold text-text mb-4">Tüm Giderler</h3>
            <p className="text-text-secondary text-sm mb-4">Henüz tedarikçi yok. Tüm giderler aşağıda toplu olarak görünüyor.</p>
            <div className="space-y-2">
              {formatCurrencyMulti(unassigned?.expenses_by_currency || {}).map((val, i) => (
                <p key={i} className="text-xl font-bold money text-primary">{val}</p>
              ))}
              <p className="text-sm text-text-muted">{(unassigned?.expense_count || 0)} gider kaydı</p>
            </div>
            <button onClick={() => navigate('/expenses')} className="btn-primary mt-4">
              <Receipt className="w-4 h-4 mr-2" />
              Giderleri kalem kalem gör
            </button>
            <button onClick={() => openModal()} className="btn-outline mt-4 ml-3">
              <Plus className="w-4 h-4 mr-2" />
              İlk tedarikçiyi ekle
            </button>
          </div>
        </div>
      ) : filteredVendors.length === 0 && searchTerm ? (
        <div className="card text-center py-12">
          <p className="text-text-secondary">Arama sonucu bulunamadı</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVendors.map((vendor) => (
            <div
              key={vendor.vendor_id}
              className="card card-hover cursor-pointer"
              onClick={() => navigate(`/expenses?vendor_id=${vendor.vendor_id}&vendor_name=${encodeURIComponent(vendor.name || '')}`)}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-text">{vendor.name}</h3>
                  {vendor.tax_number && (
                    <p className="text-sm text-text-secondary">VKN: {vendor.tax_number}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2 text-sm">
                {vendor.phone && (
                  <p className="text-text-secondary">Tel: {vendor.phone}</p>
                )}
                {vendor.email && (
                  <p className="text-text-secondary">{vendor.email}</p>
                )}
              </div>

              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-text-secondary">
                      {vendor.expense_count || 0} gider
                    </span>
                  </div>
                  {vendor.expenses_by_currency ? (
                    <div className="space-y-1">
                      {Object.keys(vendor.expenses_by_currency)
                        .filter(c => vendor.expenses_by_currency[c].total_amount > 0)
                        .map(currency => (
                          <div key={currency} className="font-medium money text-right">
                            {formatCurrency(vendor.expenses_by_currency[currency].total_amount, currency)}
                          </div>
                        ))}
                      {Object.keys(vendor.expenses_by_currency).filter(c => vendor.expenses_by_currency[c].total_amount > 0).length === 0 && (
                        <div className="font-medium money text-right">
                          {formatCurrency(0)}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="font-medium money text-right">
                      {formatCurrency(vendor.total_expense_amount || 0)}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  onClick={(e) => { e.stopPropagation(); openModal(vendor); }}
                  className="p-2 text-text-secondary hover:bg-gray-100 rounded-lg"
                  title="Düzenle"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
                {isOwner && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(vendor.vendor_id); }}
                    className="p-2 text-danger hover:bg-danger-50 rounded-lg"
                    title="Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
              <p className="text-xs text-primary mt-2">Tıklayarak giderleri gör</p>
            </div>
          ))}
          {/* Diğer / Atanmamış - expenses not matching any vendor (same set as GET /api/expenses?unassigned=true) */}
          {hasUnassigned && (
            <div
              className="card card-hover border-dashed border-2 border-gray-200 bg-gray-50"
              onClick={() => navigate('/expenses?unassigned=true')}
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <MoreHorizontal className="w-5 h-5 text-text-muted" />
                  <h3 className="font-semibold text-text">Diğer / Atanmamış</h3>
                </div>
              </div>
              <p className="text-sm text-text-secondary mb-2">Tedarikçi eşleşmeyen giderler</p>
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="text-sm">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-text-secondary">{unassigned.expense_count} gider</span>
                  </div>
                  {formatCurrencyMulti(unassigned.expenses_by_currency || {}).map((val, i) => (
                    <div key={i} className="font-medium money text-right">{val}</div>
                  ))}
                </div>
              </div>
              <p className="text-xs text-primary mt-3">Tıklayarak detayı gör</p>
            </div>
          )}
        </div>
      )}

      {/* Vendor Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-modal max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-gray-100">
              <h3 className="text-lg font-semibold text-text">
                {editingVendor ? 'Tedarikçi Düzenle' : 'Yeni Tedarikçi'}
              </h3>
              <button onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 space-y-4">
              <div>
                <label className="label">Tedarikçi Adı *</label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  className={`input ${errors.name ? 'input-error' : ''}`}
                  placeholder="Tedarikçi adı"
                />
                {errors.name && <p className="text-sm text-danger mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="label">Vergi Numarası</label>
                <input
                  type="text"
                  name="tax_number"
                  value={formData.tax_number}
                  onChange={handleInputChange}
                  className="input"
                  placeholder="VKN"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Telefon</label>
                  <input
                    type="text"
                    name="phone"
                    value={formData.phone}
                    onChange={handleInputChange}
                    className="input"
                    placeholder="0212 123 45 67"
                  />
                </div>
                <div>
                  <label className="label">E-posta</label>
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleInputChange}
                    className={`input ${errors.email ? 'input-error' : ''}`}
                    placeholder="info@example.com"
                  />
                  {errors.email && <p className="text-sm text-danger mt-1">{errors.email}</p>}
                </div>
              </div>

              <div>
                <label className="label">Adres</label>
                <textarea
                  name="address"
                  value={formData.address}
                  onChange={handleInputChange}
                  className="input"
                  rows={2}
                  placeholder="Adres bilgisi"
                />
              </div>

              <div>
                <label className="label">Notlar</label>
                <textarea
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  className="input"
                  rows={2}
                  placeholder="Ek notlar..."
                />
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  name="requires_documentation"
                  checked={formData.requires_documentation}
                  onChange={handleInputChange}
                  className="w-4 h-4 text-primary rounded focus:ring-primary"
                  id="requires_documentation"
                />
                <label htmlFor="requires_documentation" className="text-sm text-text cursor-pointer">
                  Bu tedarikçi için belge zorunlu olsun
                </label>
              </div>

              {errors.submit && (
                <div className="alert-danger">
                  <AlertTriangle className="w-5 h-5" />
                  <span>{errors.submit}</span>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                <button type="button" onClick={closeModal} className="btn-ghost">
                  İptal
                </button>
                <button type="submit" disabled={saving} className="btn-primary">
                  {saving ? 'Kaydediliyor...' : editingVendor ? 'Güncelle' : 'Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Vendors;
