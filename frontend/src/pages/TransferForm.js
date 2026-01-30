/**
 * Transfer Form Page
 * BoatBuild CRM - Create and edit transfers
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { transfersAPI, vendorsAPI } from '../api/client';
import { formatCurrency } from '../utils/currency';
import { ArrowLeft, Save, AlertTriangle } from 'lucide-react';

const TransferForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [linkedExpenses, setLinkedExpenses] = useState([]);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    amount: '',
    currency: 'TRY',
    from_account: '',
    to_account: '',
    vendor_id: '',
    description: '',
  });

  useEffect(() => {
    fetchInitialData();
  }, [id]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const vendorsRes = await vendorsAPI.list();
      setVendors(vendorsRes.data.data.vendors);

      if (isEditing) {
        const transferRes = await transfersAPI.get(id);
        const transfer = transferRes.data.data.transfer;
        setFormData({
          date: transfer.date.split('T')[0],
          amount: transfer.amount,
          currency: transfer.currency,
          from_account: transfer.from_account || '',
          to_account: transfer.to_account || '',
          vendor_id: transfer.vendor_id || '',
          description: transfer.description || '',
        });
        setLinkedExpenses(transferRes.data.data.linked_expenses || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: null }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.date) newErrors.date = 'Tarih zorunludur';
    if (!formData.amount || parseFloat(formData.amount) <= 0) newErrors.amount = 'Geçerli bir tutar giriniz';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setSaving(true);

      const payload = {
        ...formData,
        amount: parseFloat(formData.amount),
        vendor_id: formData.vendor_id || null,
      };

      if (isEditing) {
        await transfersAPI.update(id, payload);
      } else {
        await transfersAPI.create(payload);
      }

      navigate('/transfers');
    } catch (error) {
      console.error('Failed to save transfer:', error);
      setErrors({ submit: error.response?.data?.error || 'Kaydetme başarısız oldu' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/transfers')} className="btn-ghost p-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-text">
            {isEditing ? 'Transfer Düzenle' : 'Yeni Transfer'}
          </h1>
          <p className="text-text-secondary">
            {isEditing ? 'Transfer bilgilerini güncelleyin' : 'Yeni transfer kaydı oluşturun'}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card">
          <h3 className="font-semibold text-text mb-4">Transfer Bilgileri</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Tarih *</label>
              <input
                type="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                className={`input ${errors.date ? 'input-error' : ''}`}
              />
              {errors.date && <p className="text-sm text-danger mt-1">{errors.date}</p>}
            </div>

            <div>
              <label className="label">Tutar *</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  className={`input flex-1 ${errors.amount ? 'input-error' : ''}`}
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
                <select
                  name="currency"
                  value={formData.currency}
                  onChange={handleInputChange}
                  className="select w-24"
                >
                  <option value="TRY">TRY</option>
                  <option value="USD">USD</option>
                  <option value="EUR">EUR</option>
                </select>
              </div>
              {errors.amount && <p className="text-sm text-danger mt-1">{errors.amount}</p>}
            </div>

            <div>
              <label className="label">Gönderen Hesap</label>
              <input
                type="text"
                name="from_account"
                value={formData.from_account}
                onChange={handleInputChange}
                className="input"
                placeholder="Banka / Hesap adı"
              />
            </div>

            <div>
              <label className="label">Alıcı Hesap</label>
              <input
                type="text"
                name="to_account"
                value={formData.to_account}
                onChange={handleInputChange}
                className="input"
                placeholder="Banka / Hesap adı"
              />
            </div>

            <div className="md:col-span-2">
              <label className="label">Tedarikçi</label>
              <select
                name="vendor_id"
                value={formData.vendor_id}
                onChange={handleInputChange}
                className="select"
              >
                <option value="">Tedarikçi seçin (opsiyonel)</option>
                {vendors.map(v => (
                  <option key={v.vendor_id} value={v.vendor_id}>{v.name}</option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="label">Açıklama</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="input"
                rows={3}
                placeholder="Transfer hakkında açıklama..."
              />
            </div>
          </div>
        </div>

        {/* Linked Expenses (for editing) */}
        {isEditing && linkedExpenses.length > 0 && (
          <div className="card">
            <h3 className="font-semibold text-text mb-4">Bağlı Giderler</h3>
            <div className="space-y-2">
              {linkedExpenses.map(expense => (
                <div
                  key={expense.expense_id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <p className="font-medium">{expense.vendor_name}</p>
                    <p className="text-sm text-text-secondary">{expense.primary_tag}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium money">{formatCurrency(expense.amount, expense.currency)}</p>
                    {expense.is_hak_edis_eligible && (
                      <p className="text-sm text-success">
                        Hak ediş: {formatCurrency(expense.hak_edis_amount, expense.currency)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {errors.submit && (
          <div className="alert-danger">
            <AlertTriangle className="w-5 h-5" />
            <span>{errors.submit}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/transfers')}
            className="btn-ghost"
          >
            İptal
          </button>

          <button
            type="submit"
            disabled={saving}
            className="btn-primary"
          >
            {saving ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-white"></span>
                Kaydediliyor...
              </span>
            ) : (
              <>
                <Save className="w-5 h-5 mr-2" />
                {isEditing ? 'Güncelle' : 'Kaydet'}
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default TransferForm;
