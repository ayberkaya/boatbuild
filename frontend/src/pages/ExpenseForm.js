/**
 * Expense Form Page
 * BoatBuild CRM - Create and edit expenses
 * Redesigned to match trideck_hesap_defteri.xlsx format
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { expensesAPI } from '../api/client';
import {
  ArrowLeft,
  Save,
  AlertTriangle,
  CheckCircle,
  Plus,
  X,
} from 'lucide-react';

// Hierarchical category structure matching trideck_hesap_defteri.xlsx
const BASLIK_KATEGORI = {
  'İmalat': {
    kategoriler: ['Genel', 'Tesisat', 'Elektrik', 'Alüminyum', 'Motorlar', 'Kaan Ödeme', 'Etkin Gürel'],
    defaultHakedis: {
      'Genel': true,
      'Tesisat': true,
      'Elektrik': true,
      'Alüminyum': true,
      'Motorlar': false,
      'Kaan Ödeme': false,
      'Etkin Gürel': false,
    },
    color: 'bg-green-100 text-green-800',
  },
  'Yunanistan Kurulum': {
    kategoriler: ['Avukat', 'Deposit', 'Römork', 'Sigorta', 'Gümrük', 'Liman', 'Kaptan', 'Mazot', 'Transfer', 'Survey', 'Genel'],
    defaultHakedis: {},  // All false
    color: 'bg-blue-100 text-blue-800',
  },
  'Tersane Kurulum': {
    kategoriler: ['Tente Kurulum', 'Tersane Kiralama', 'Genel'],
    defaultHakedis: {},  // All false
    color: 'bg-orange-100 text-orange-800',
  },
  'Reklam ve Tanıtım': {
    kategoriler: ['Genel'],
    defaultHakedis: {},  // All false
    color: 'bg-yellow-100 text-yellow-800',
  },
  'Baran': {
    kategoriler: ['Genel'],
    defaultHakedis: {},  // All false
    color: 'bg-purple-100 text-purple-800',
  },
};

// Map Başlık + Kategori to backend primary_tag
const getPrimaryTag = (baslik, kategori) => {
  const tagMap = {
    'İmalat': {
      'Genel': 'IMALAT_GENEL',
      'Tesisat': 'IMALAT_TESISAT',
      'Elektrik': 'IMALAT_ELEKTRIK',
      'Alüminyum': 'IMALAT_ALUMINYUM',
      'Motorlar': 'MOTOR',
      'Kaan Ödeme': 'KAAN_ODEME',
      'Etkin Gürel': 'ETKIN',
    },
    'Yunanistan Kurulum': {
      'Avukat': 'YUNANISTAN_AVUKAT',
      'Deposit': 'YUNANISTAN_DEPOSIT',
      'Römork': 'YUNANISTAN_ROMORK',
      'Sigorta': 'YUNANISTAN_SIGORTA',
      'Gümrük': 'YUNANISTAN_GUMRUK',
      'Liman': 'YUNANISTAN_LIMAN',
      'Kaptan': 'YUNANISTAN_KAPTAN',
      'Mazot': 'YUNANISTAN_MAZOT',
      'Transfer': 'YUNANISTAN_TRANSFER',
      'Survey': 'YUNANISTAN_SURVEY',
      'Genel': 'YUNANISTAN_GENEL',
    },
    'Tersane Kurulum': {
      'Tente Kurulum': 'TERSANE_TENTE',
      'Tersane Kiralama': 'TERSANE_KIRALAMA',
      'Genel': 'TERSANE_GENEL',
    },
    'Reklam ve Tanıtım': {
      'Genel': 'REKLAM',
    },
    'Baran': {
      'Genel': 'BARAN',
    },
  };

  return tagMap[baslik]?.[kategori] || 'UNCLASSIFIED';
};

// Reverse map: primary_tag to Başlık + Kategori
const getBaslikKategoriFromTag = (primaryTag) => {
  if (!primaryTag) return { baslik: 'İmalat', kategori: 'Genel' };

  const tag = primaryTag.toUpperCase();

  const reverseMap = {
    'IMALAT_GENEL': { baslik: 'İmalat', kategori: 'Genel' },
    'IMALAT_TESISAT': { baslik: 'İmalat', kategori: 'Tesisat' },
    'IMALAT_ELEKTRIK': { baslik: 'İmalat', kategori: 'Elektrik' },
    'IMALAT_ALUMINYUM': { baslik: 'İmalat', kategori: 'Alüminyum' },
    'MOTOR': { baslik: 'İmalat', kategori: 'Motorlar' },
    'KAAN_ODEME': { baslik: 'İmalat', kategori: 'Kaan Ödeme' },
    'ETKIN': { baslik: 'İmalat', kategori: 'Etkin Gürel' },
    'YUNANISTAN_AVUKAT': { baslik: 'Yunanistan Kurulum', kategori: 'Avukat' },
    'YUNANISTAN_DEPOSIT': { baslik: 'Yunanistan Kurulum', kategori: 'Deposit' },
    'YUNANISTAN_ROMORK': { baslik: 'Yunanistan Kurulum', kategori: 'Römork' },
    'YUNANISTAN_SIGORTA': { baslik: 'Yunanistan Kurulum', kategori: 'Sigorta' },
    'YUNANISTAN_GUMRUK': { baslik: 'Yunanistan Kurulum', kategori: 'Gümrük' },
    'YUNANISTAN_LIMAN': { baslik: 'Yunanistan Kurulum', kategori: 'Liman' },
    'YUNANISTAN_KAPTAN': { baslik: 'Yunanistan Kurulum', kategori: 'Kaptan' },
    'YUNANISTAN_MAZOT': { baslik: 'Yunanistan Kurulum', kategori: 'Mazot' },
    'YUNANISTAN_TRANSFER': { baslik: 'Yunanistan Kurulum', kategori: 'Transfer' },
    'YUNANISTAN_SURVEY': { baslik: 'Yunanistan Kurulum', kategori: 'Survey' },
    'YUNANISTAN_GENEL': { baslik: 'Yunanistan Kurulum', kategori: 'Genel' },
    'TERSANE_TENTE': { baslik: 'Tersane Kurulum', kategori: 'Tente Kurulum' },
    'TERSANE_KIRALAMA': { baslik: 'Tersane Kurulum', kategori: 'Tersane Kiralama' },
    'TERSANE_GENEL': { baslik: 'Tersane Kurulum', kategori: 'Genel' },
    'REKLAM': { baslik: 'Reklam ve Tanıtım', kategori: 'Genel' },
    'BARAN': { baslik: 'Baran', kategori: 'Genel' },
  };

  return reverseMap[tag] || { baslik: 'İmalat', kategori: 'Genel' };
};

const ExpenseForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const isEditing = !!id;
  const presetKaanOdeme = location.state?.presetKaanOdeme === true;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    baslik: 'İmalat',
    kategori: presetKaanOdeme ? 'Kaan Ödeme' : 'Genel',
    amount: '',
    kime: '',
    currency: 'USD',
    kaanHakedis: presetKaanOdeme ? false : true,
    description: '',
  });

  const [showAddBaslik, setShowAddBaslik] = useState(false);
  const [showAddKategori, setShowAddKategori] = useState(false);
  const [newBaslik, setNewBaslik] = useState('');
  const [newKategori, setNewKategori] = useState('');
  const [customBasliklar, setCustomBasliklar] = useState([]);
  const [customKategoriler, setCustomKategoriler] = useState({});

  useEffect(() => {
    if (isEditing) {
      fetchExpense();
    }
  }, [id]);

  // Update Kaan Hakediş when Başlık/Kategori changes
  useEffect(() => {
    const baslikConfig = BASLIK_KATEGORI[formData.baslik];
    if (baslikConfig) {
      const defaultHakedis = baslikConfig.defaultHakedis[formData.kategori];
      setFormData(prev => ({
        ...prev,
        kaanHakedis: defaultHakedis !== undefined ? defaultHakedis : false,
      }));
    }
  }, [formData.baslik, formData.kategori]);

  const fetchExpense = async () => {
    try {
      setLoading(true);
      const response = await expensesAPI.get(id);
      const expense = response.data.data.expense;

      const { baslik, kategori } = getBaslikKategoriFromTag(expense.primary_tag);

      setFormData({
        date: expense.date.split('T')[0],
        baslik,
        kategori,
        amount: expense.amount,
        currency: expense.currency || 'USD',
        kime: expense.vendor_name || '',
        kaanHakedis: expense.is_hak_edis_eligible,
        description: expense.description || '',
      });
    } catch (error) {
      console.error('Failed to fetch expense:', error);
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

  const handleBaslikChange = (e) => {
    const newBaslik = e.target.value;
    const baslikConfig = BASLIK_KATEGORI[newBaslik] || { kategoriler: ['Genel'] };
    const firstKategori = baslikConfig.kategoriler[0] || 'Genel';

    setFormData(prev => ({
      ...prev,
      baslik: newBaslik,
      kategori: firstKategori,
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.date) newErrors.date = 'Tarih zorunludur';
    if (!formData.baslik) newErrors.baslik = 'Başlık seçimi zorunludur';
    if (!formData.kategori) newErrors.kategori = 'Kategori seçimi zorunludur';
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      newErrors.amount = 'Geçerli bir tutar giriniz';
    }
    if (!formData.kime || formData.kime.trim() === '') {
      newErrors.kime = 'Kime alanı zorunludur';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setSaving(true);

      const primaryTag = getPrimaryTag(formData.baslik, formData.kategori);

      const payload = {
        date: formData.date,
        vendor_name: formData.kime,
        amount: parseFloat(formData.amount),
        currency: formData.currency,
        description: formData.description,
        primary_tag: primaryTag,
        work_scope_level: formData.kaanHakedis ? 'PURE_IMALAT' : 'NON_IMALAT',
        hak_edis_policy: formData.kaanHakedis ? 'ALWAYS_INCLUDED' : 'ALWAYS_EXCLUDED',
      };

      if (isEditing) {
        await expensesAPI.update(id, payload);
      } else {
        await expensesAPI.create(payload);
      }

      navigate('/expenses');
    } catch (error) {
      console.error('Failed to save expense:', error);
      setErrors({ submit: error.response?.data?.error || 'Kaydetme başarısız oldu' });
    } finally {
      setSaving(false);
    }
  };

  const handleAddBaslik = () => {
    if (newBaslik.trim()) {
      setCustomBasliklar(prev => [...prev, newBaslik.trim()]);
      setFormData(prev => ({ ...prev, baslik: newBaslik.trim(), kategori: 'Genel' }));
      setCustomKategoriler(prev => ({ ...prev, [newBaslik.trim()]: ['Genel'] }));
      setNewBaslik('');
      setShowAddBaslik(false);
    }
  };

  const handleAddKategori = () => {
    if (newKategori.trim()) {
      const currentBaslik = formData.baslik;
      if (BASLIK_KATEGORI[currentBaslik]) {
        // For predefined başlık, add to custom kategoriler
        setCustomKategoriler(prev => ({
          ...prev,
          [currentBaslik]: [...(prev[currentBaslik] || []), newKategori.trim()],
        }));
      } else {
        // For custom başlık
        setCustomKategoriler(prev => ({
          ...prev,
          [currentBaslik]: [...(prev[currentBaslik] || ['Genel']), newKategori.trim()],
        }));
      }
      setFormData(prev => ({ ...prev, kategori: newKategori.trim() }));
      setNewKategori('');
      setShowAddKategori(false);
    }
  };

  // Get available kategoriler for current başlık
  const getKategoriler = () => {
    const predefined = BASLIK_KATEGORI[formData.baslik]?.kategoriler || [];
    const custom = customKategoriler[formData.baslik] || [];
    return [...predefined, ...custom.filter(k => !predefined.includes(k))];
  };

  // Get all başlıklar (predefined + custom)
  const getAllBasliklar = () => {
    return [...Object.keys(BASLIK_KATEGORI), ...customBasliklar];
  };

  // Calculate hak ediş preview
  const hakEdisAmount = formData.kaanHakedis && formData.amount
    ? (parseFloat(formData.amount) * 0.07).toFixed(2)
    : 0;

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
        <button onClick={() => navigate('/expenses')} className="btn-ghost p-2">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-text">
            {isEditing ? 'Gider Düzenle' : 'Yeni Gider'}
          </h1>
          <p className="text-text-secondary">
            {isEditing ? 'Gider bilgilerini güncelleyin' : 'Yeni gider kaydı oluşturun'}
          </p>
        </div>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="card space-y-4">
          {/* Tarih */}
          <div>
            <label className="label">Tarih *</label>
            <input
              type="date"
              name="date"
              value={formData.date}
              onChange={handleInputChange}
              className={`input ${errors.date ? 'border-red-500' : ''}`}
            />
            {errors.date && <p className="text-sm text-red-500 mt-1">{errors.date}</p>}
          </div>

          {/* Başlık */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Başlık *</label>
              <button
                type="button"
                onClick={() => setShowAddBaslik(true)}
                className="text-sm text-primary hover:text-primary-dark flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Yeni Başlık
              </button>
            </div>
            <select
              name="baslik"
              value={formData.baslik}
              onChange={handleBaslikChange}
              className={`select ${errors.baslik ? 'border-red-500' : ''}`}
            >
              {getAllBasliklar().map(baslik => (
                <option key={baslik} value={baslik}>{baslik}</option>
              ))}
            </select>
            {errors.baslik && <p className="text-sm text-red-500 mt-1">{errors.baslik}</p>}
          </div>

          {/* Kategori */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="label mb-0">Kategori *</label>
              <button
                type="button"
                onClick={() => setShowAddKategori(true)}
                className="text-sm text-primary hover:text-primary-dark flex items-center gap-1"
              >
                <Plus className="w-4 h-4" />
                Yeni Kategori
              </button>
            </div>
            <select
              name="kategori"
              value={formData.kategori}
              onChange={handleInputChange}
              className={`select ${errors.kategori ? 'border-red-500' : ''}`}
            >
              {getKategoriler().map(kategori => (
                <option key={kategori} value={kategori}>{kategori}</option>
              ))}
            </select>
            {errors.kategori && <p className="text-sm text-red-500 mt-1">{errors.kategori}</p>}
          </div>

          {/* Tutar ve Para Birimi */}
          <div>
            <label className="label">Tutar *</label>
            <div className="flex gap-2">
              <select
                name="currency"
                value={formData.currency}
                onChange={handleInputChange}
                className="select w-24 flex-shrink-0"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="TRY">TRY</option>
              </select>
              <input
                type="number"
                name="amount"
                value={formData.amount}
                onChange={handleInputChange}
                className={`input flex-1 ${errors.amount ? 'border-red-500' : ''}`}
                placeholder="0.00"
                step="0.01"
                min="0"
              />
            </div>
            {errors.amount && <p className="text-sm text-red-500 mt-1">{errors.amount}</p>}
          </div>

          {/* Kime */}
          <div>
            <label className="label">Kime *</label>
            <input
              type="text"
              name="kime"
              value={formData.kime}
              onChange={handleInputChange}
              className={`input ${errors.kime ? 'border-red-500' : ''}`}
              placeholder="Ödeme yapılan kişi/firma"
            />
            {errors.kime && <p className="text-sm text-red-500 mt-1">{errors.kime}</p>}
          </div>

          {/* Kaan Hakediş */}
          <div className="p-4 rounded-lg bg-gray-50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    name="kaanHakedis"
                    checked={formData.kaanHakedis}
                    onChange={handleInputChange}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                </label>
                <div>
                  <span className="font-medium text-text">Kaan Hakediş</span>
                  <p className="text-sm text-text-secondary">
                    {formData.kaanHakedis ? 'Bu gider hakediş hesabına dahil' : 'Hakediş hesabına dahil değil'}
                  </p>
                </div>
              </div>
              {formData.kaanHakedis ? (
                <CheckCircle className="w-6 h-6 text-green-500" />
              ) : (
                <X className="w-6 h-6 text-gray-400" />
              )}
            </div>

            {formData.kaanHakedis && formData.amount > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex justify-between text-sm">
                  <span className="text-text-secondary">Hakediş (%7):</span>
                  <span className="font-semibold text-green-600">${hakEdisAmount}</span>
                </div>
              </div>
            )}
          </div>

          {/* Açıklama */}
          <div>
            <label className="label">Açıklama</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              className="input"
              rows={3}
              placeholder="Gider hakkında açıklama (opsiyonel)"
            />
          </div>
        </div>

        {/* Error Message */}
        {errors.submit && (
          <div className="flex items-center gap-2 p-4 bg-red-50 text-red-700 rounded-lg">
            <AlertTriangle className="w-5 h-5" />
            <span>{errors.submit}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => navigate('/expenses')}
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

      {/* Add Başlık Modal */}
      {showAddBaslik && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-text mb-4">Yeni Başlık Ekle</h3>
            <input
              type="text"
              value={newBaslik}
              onChange={(e) => setNewBaslik(e.target.value)}
              className="input mb-4"
              placeholder="Başlık adı"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowAddBaslik(false); setNewBaslik(''); }}
                className="btn-ghost"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleAddBaslik}
                className="btn-primary"
              >
                Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Kategori Modal */}
      {showAddKategori && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-text mb-4">
              Yeni Kategori Ekle ({formData.baslik})
            </h3>
            <input
              type="text"
              value={newKategori}
              onChange={(e) => setNewKategori(e.target.value)}
              className="input mb-4"
              placeholder="Kategori adı"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => { setShowAddKategori(false); setNewKategori(''); }}
                className="btn-ghost"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleAddKategori}
                className="btn-primary"
              >
                Ekle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseForm;
