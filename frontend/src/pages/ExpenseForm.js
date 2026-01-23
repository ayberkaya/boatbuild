/**
 * Expense Form Page
 * BoatBuild CRM - Create and edit expenses with hak ediş calculation
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { expensesAPI, vendorsAPI, transfersAPI, documentsAPI, overridesAPI } from '../api/client';
import {
  ArrowLeft,
  Save,
  AlertTriangle,
  CheckCircle,
  Upload,
  FileText,
  Trash2,
  Info,
} from 'lucide-react';

const WORK_SCOPE_LEVELS = [
  { value: 'PURE_IMALAT', label: 'PURE_IMALAT - Saf İmalat', description: 'Her zaman %7 hak ediş' },
  { value: 'MALZEME_PLUS_IMALAT', label: 'MALZEME_PLUS_IMALAT - Malzeme + İmalat', description: 'Politikaya bağlı' },
  { value: 'PURE_MALZEME', label: 'PURE_MALZEME - Saf Malzeme', description: 'Asla hak ediş yok' },
  { value: 'NON_IMALAT', label: 'NON_IMALAT - İmalat Dışı', description: 'Asla hak ediş yok' },
];

const HAK_EDIS_POLICIES = [
  { value: 'ALWAYS_INCLUDED', label: 'ALWAYS_INCLUDED - Her Zaman Dahil', description: '%7 otomatik' },
  { value: 'ALWAYS_EXCLUDED', label: 'ALWAYS_EXCLUDED - Her Zaman Hariç', description: 'Hak ediş yok' },
  { value: 'CONDITIONAL', label: 'CONDITIONAL - Koşullu', description: 'Sahip onayı gerekli' },
];

const ExpenseForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { isOwner, isOperation } = useAuth();
  const isEditing = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [vendors, setVendors] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    vendor_id: '',
    vendor_name: '',
    amount: '',
    currency: 'TRY',
    description: '',
    primary_tag: '',
    work_scope_level: '',
    hak_edis_policy: '',
    linked_transfer_id: '',
    category_id: '',
  });

  const [hakEdisCalc, setHakEdisCalc] = useState(null);
  const [docRequired, setDocRequired] = useState(null);
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideReason, setOverrideReason] = useState('');

  useEffect(() => {
    fetchInitialData();
  }, [id]);

  // Cleanup preview URLs on unmount
  useEffect(() => {
    return () => {
      pendingFiles.forEach(file => {
        if (file.preview) {
          URL.revokeObjectURL(file.preview);
        }
      });
    };
  }, [pendingFiles]);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      const [vendorsRes, categoriesRes] = await Promise.all([
        vendorsAPI.list(),
        expensesAPI.categories(),
      ]);

      setVendors(vendorsRes.data.data.vendors);
      setCategories(categoriesRes.data.data.categories);

      // Fetch unlinked transfers for linking
      const transfersRes = await transfersAPI.list({ status: 'APPROVED' });
      setTransfers(transfersRes.data.data.transfers);

      if (isEditing) {
        const expenseRes = await expensesAPI.get(id);
        const expense = expenseRes.data.data.expense;
        setFormData({
          date: expense.date.split('T')[0],
          vendor_id: expense.vendor_id || '',
          vendor_name: expense.vendor_name,
          amount: expense.amount,
          currency: expense.currency,
          description: expense.description || '',
          primary_tag: expense.primary_tag,
          work_scope_level: expense.work_scope_level,
          hak_edis_policy: expense.hak_edis_policy,
          linked_transfer_id: expense.linked_transfer_id || '',
          category_id: expense.category_id || '',
        });
        setDocuments(expenseRes.data.data.documents || []);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Calculate hak ediş preview when relevant fields change
  useEffect(() => {
    if (formData.amount && formData.work_scope_level && formData.hak_edis_policy) {
      calculateHakEdisPreview();
    }
  }, [formData.amount, formData.work_scope_level, formData.hak_edis_policy]);

  const calculateHakEdisPreview = () => {
    const amount = parseFloat(formData.amount) || 0;
    const { work_scope_level, hak_edis_policy } = formData;

    let isEligible = false;
    let hakEdisAmount = 0;
    let reason = '';

    if (work_scope_level === 'NON_IMALAT' || work_scope_level === 'PURE_MALZEME') {
      reason = 'Bu iş kapsamı için hak ediş uygulanmaz';
    } else if (work_scope_level === 'PURE_IMALAT') {
      isEligible = true;
      hakEdisAmount = amount * 0.07;
      reason = 'Saf imalat - otomatik %7';
    } else if (work_scope_level === 'MALZEME_PLUS_IMALAT') {
      if (hak_edis_policy === 'ALWAYS_INCLUDED') {
        isEligible = true;
        hakEdisAmount = amount * 0.07;
        reason = 'Politika: Her zaman dahil - %7';
      } else if (hak_edis_policy === 'ALWAYS_EXCLUDED') {
        reason = 'Politika: Her zaman hariç';
      } else if (hak_edis_policy === 'CONDITIONAL') {
        hakEdisAmount = amount * 0.07; // Potential
        reason = 'Koşullu - Sahip onayı gerekiyor';
      }
    }

    setHakEdisCalc({
      isEligible,
      hakEdisAmount: Math.round(hakEdisAmount * 100) / 100,
      reason,
      isConditional: hak_edis_policy === 'CONDITIONAL' && work_scope_level === 'MALZEME_PLUS_IMALAT',
    });
  };

  // Check documentation requirement
  useEffect(() => {
    checkDocumentationRequired();
  }, [formData.work_scope_level, formData.primary_tag, formData.vendor_name]);

  const checkDocumentationRequired = () => {
    const { work_scope_level, primary_tag, vendor_name } = formData;
    const specialVendors = ['BARAN', 'MOTOR', 'ETKIN'];

    let required = false;
    let reason = '';

    if (work_scope_level === 'NON_IMALAT') {
      required = true;
      reason = 'NON_IMALAT giderleri belge gerektirir';
    } else if (primary_tag === 'REKLAM') {
      required = true;
      reason = 'Reklam giderleri belge gerektirir';
    } else if (specialVendors.some(sv => vendor_name.toUpperCase().includes(sv))) {
      required = true;
      reason = `${vendor_name} tedarikçisi için belge zorunludur`;
    }

    setDocRequired(required ? { required, reason } : null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setErrors(prev => ({ ...prev, [name]: null }));
  };

  const handleCategorySelect = (category) => {
    setFormData(prev => ({
      ...prev,
      category_id: category.category_id,
      primary_tag: category.primary_tag,
      work_scope_level: category.default_work_scope,
      hak_edis_policy: category.default_hak_edis_policy,
    }));
  };

  const handleVendorSelect = (e) => {
    const vendorId = e.target.value;
    const vendor = vendors.find(v => v.vendor_id === vendorId);
    setFormData(prev => ({
      ...prev,
      vendor_id: vendorId,
      vendor_name: vendor ? vendor.name : prev.vendor_name,
    }));
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.date) newErrors.date = 'Tarih zorunludur';
    if (!formData.vendor_name) newErrors.vendor_name = 'Tedarikçi adı zorunludur';
    if (!formData.amount || parseFloat(formData.amount) <= 0) newErrors.amount = 'Geçerli bir tutar giriniz';
    if (!formData.primary_tag) newErrors.primary_tag = 'Etiket zorunludur';
    if (!formData.work_scope_level) newErrors.work_scope_level = 'İş kapsamı zorunludur';
    if (!formData.hak_edis_policy) newErrors.hak_edis_policy = 'Hak ediş politikası zorunludur';

    // Check document requirement
    if (docRequired?.required) {
      if (isEditing && documents.length === 0) {
        newErrors.documents = docRequired.reason;
      } else if (!isEditing && pendingFiles.length === 0 && documents.length === 0) {
        newErrors.documents = docRequired.reason;
      }
    }

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
        linked_transfer_id: formData.linked_transfer_id || null,
        category_id: formData.category_id || null,
      };

      let expenseId;
      if (isEditing) {
        await expensesAPI.update(id, payload);
        expenseId = id;
      } else {
        const response = await expensesAPI.create(payload);
        expenseId = response.data.data.expense.expense_id;
      }

      // Upload pending files after expense is created/updated
      if (pendingFiles.length > 0) {
        await handleFileUpload(expenseId);
      }

      navigate('/expenses');
    } catch (error) {
      console.error('Failed to save expense:', error);
      setErrors({ submit: error.response?.data?.error || 'Kaydetme başarısız oldu' });
    } finally {
      setSaving(false);
    }
  };

  const handleRequestOverride = async () => {
    if (!overrideReason || overrideReason.length < 10) {
      setErrors({ override: 'En az 10 karakter açıklama gerekli' });
      return;
    }

    try {
      await overridesAPI.create(id, overrideReason);
      setShowOverrideModal(false);
      navigate('/expenses');
    } catch (error) {
      console.error('Failed to request override:', error);
      setErrors({ override: error.response?.data?.error || 'İstek başarısız' });
    }
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const newFiles = files.map(file => ({
      file,
      id: Date.now() + Math.random(),
      name: file.name,
      size: file.size,
      type: file.type,
      preview: file.type.startsWith('image/') ? URL.createObjectURL(file) : null,
    }));

    setPendingFiles(prev => [...prev, ...newFiles]);
    e.target.value = ''; // Reset input
  };

  const handleRemovePendingFile = (fileId) => {
    setPendingFiles(prev => {
      const file = prev.find(f => f.id === fileId);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== fileId);
    });
  };

  const handleFileUpload = async (expenseId) => {
    if (pendingFiles.length === 0) return;

    const uploadPromises = pendingFiles.map(async (pendingFile) => {
      const formDataUpload = new FormData();
      formDataUpload.append('file', pendingFile.file);
      formDataUpload.append('expense_id', expenseId);
      formDataUpload.append('document_type', 'INVOICE');

      try {
        const response = await documentsAPI.upload(formDataUpload);
        return response.data.data.document;
      } catch (error) {
        console.error('Upload failed:', error);
        throw error;
      }
    });

    try {
      const uploadedDocs = await Promise.all(uploadPromises);
      setDocuments(prev => [...prev, ...uploadedDocs]);
      setPendingFiles([]);
    } catch (error) {
      console.error('Some uploads failed:', error);
      setErrors({ submit: 'Bazı belgeler yüklenemedi' });
    }
  };

  const handleFileUploadEdit = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const formDataUpload = new FormData();
    formDataUpload.append('file', file);
    formDataUpload.append('expense_id', id);
    formDataUpload.append('document_type', 'INVOICE');

    try {
      const response = await documentsAPI.upload(formDataUpload);
      setDocuments(prev => [...prev, response.data.data.document]);
    } catch (error) {
      console.error('Upload failed:', error);
      setErrors({ submit: 'Belge yüklenemedi' });
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
    <div className="max-w-4xl mx-auto space-y-6">
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
        {/* Basic Info Card */}
        <div className="card">
          <h3 className="font-semibold text-text mb-4">Temel Bilgiler</h3>
          
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
              <label className="label">Tedarikçi</label>
              <select
                name="vendor_id"
                value={formData.vendor_id}
                onChange={handleVendorSelect}
                className="select"
              >
                <option value="">Seçiniz veya yeni girin</option>
                {vendors.map(v => (
                  <option key={v.vendor_id} value={v.vendor_id}>{v.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">Tedarikçi Adı *</label>
              <input
                type="text"
                name="vendor_name"
                value={formData.vendor_name}
                onChange={handleInputChange}
                className={`input ${errors.vendor_name ? 'input-error' : ''}`}
                placeholder="Tedarikçi adını girin"
              />
              {errors.vendor_name && <p className="text-sm text-danger mt-1">{errors.vendor_name}</p>}
            </div>

            <div className="md:col-span-2">
              <label className="label">Açıklama</label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="input"
                rows={2}
                placeholder="Gider hakkında açıklama..."
              />
            </div>
          </div>
        </div>

        {/* Category Quick Select */}
        <div className="card">
          <h3 className="font-semibold text-text mb-4">Hızlı Kategori Seçimi</h3>
          <div className="flex flex-wrap gap-2">
            {categories.slice(0, 8).map(cat => (
              <button
                key={cat.category_id}
                type="button"
                onClick={() => handleCategorySelect(cat)}
                className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                  formData.category_id === cat.category_id
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-text hover:bg-gray-200'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        {/* Hak Ediş Configuration Card */}
        <div className="card border-2 border-primary-100">
          <h3 className="font-semibold text-text mb-4 flex items-center gap-2">
            <Info className="w-5 h-5 text-primary" />
            Hak Ediş Yapılandırması (ZORUNLU)
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Birincil Etiket *</label>
              <input
                type="text"
                name="primary_tag"
                value={formData.primary_tag}
                onChange={handleInputChange}
                className={`input ${errors.primary_tag ? 'input-error' : ''}`}
                placeholder="KAYNAK, CAM, PARKE, vb."
              />
              {errors.primary_tag && <p className="text-sm text-danger mt-1">{errors.primary_tag}</p>}
            </div>

            <div>
              <label className="label">Bağlı Transfer</label>
              <select
                name="linked_transfer_id"
                value={formData.linked_transfer_id}
                onChange={handleInputChange}
                className="select"
              >
                <option value="">Transfer seçin (opsiyonel)</option>
                {transfers.map(t => (
                  <option key={t.transfer_id} value={t.transfer_id}>
                    {new Date(t.date).toLocaleDateString('tr-TR')} - {t.amount} {t.currency}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="label">İş Kapsamı Seviyesi *</label>
              <select
                name="work_scope_level"
                value={formData.work_scope_level}
                onChange={handleInputChange}
                className={`select ${errors.work_scope_level ? 'input-error' : ''}`}
              >
                <option value="">Seçiniz</option>
                {WORK_SCOPE_LEVELS.map(ws => (
                  <option key={ws.value} value={ws.value}>{ws.label}</option>
                ))}
              </select>
              {errors.work_scope_level && <p className="text-sm text-danger mt-1">{errors.work_scope_level}</p>}
              {formData.work_scope_level && (
                <p className="text-xs text-text-muted mt-1">
                  {WORK_SCOPE_LEVELS.find(ws => ws.value === formData.work_scope_level)?.description}
                </p>
              )}
            </div>

            <div>
              <label className="label">Hak Ediş Politikası *</label>
              <select
                name="hak_edis_policy"
                value={formData.hak_edis_policy}
                onChange={handleInputChange}
                className={`select ${errors.hak_edis_policy ? 'input-error' : ''}`}
                disabled={isOperation && isEditing}
              >
                <option value="">Seçiniz</option>
                {HAK_EDIS_POLICIES.map(hp => (
                  <option key={hp.value} value={hp.value}>{hp.label}</option>
                ))}
              </select>
              {errors.hak_edis_policy && <p className="text-sm text-danger mt-1">{errors.hak_edis_policy}</p>}
              {formData.hak_edis_policy && (
                <p className="text-xs text-text-muted mt-1">
                  {HAK_EDIS_POLICIES.find(hp => hp.value === formData.hak_edis_policy)?.description}
                </p>
              )}
            </div>
          </div>

          {/* Hak Ediş Preview */}
          {hakEdisCalc && (
            <div className={`mt-4 p-4 rounded-lg ${
              hakEdisCalc.isEligible ? 'bg-success-50' :
              hakEdisCalc.isConditional ? 'bg-warning-50' :
              'bg-gray-50'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {hakEdisCalc.isEligible ? (
                    <CheckCircle className="w-5 h-5 text-success" />
                  ) : hakEdisCalc.isConditional ? (
                    <AlertTriangle className="w-5 h-5 text-warning" />
                  ) : (
                    <Info className="w-5 h-5 text-text-muted" />
                  )}
                  <span className="font-medium">
                    {hakEdisCalc.isEligible ? 'Hak Ediş Uygulanacak' :
                     hakEdisCalc.isConditional ? 'Koşullu - Onay Gerekli' :
                     'Hak Ediş Uygulanmayacak'}
                  </span>
                </div>
                <span className={`text-lg font-bold money ${
                  hakEdisCalc.isEligible ? 'text-success' :
                  hakEdisCalc.isConditional ? 'text-warning' :
                  'text-text-muted'
                }`}>
                  {hakEdisCalc.hakEdisAmount > 0 ? (
                    <>
                      {hakEdisCalc.isConditional ? 'Potansiyel: ' : ''}
                      {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(hakEdisCalc.hakEdisAmount)}
                    </>
                  ) : '-'}
                </span>
              </div>
              <p className="text-sm text-text-secondary mt-1">{hakEdisCalc.reason}</p>
            </div>
          )}
        </div>

        {/* Document Requirement Warning */}
        {docRequired && (
          <div className="alert-warning">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-medium">Belge Gerekli</p>
              <p className="text-sm">{docRequired.reason}</p>
            </div>
          </div>
        )}

        {/* Documents Section */}
        <div className="card">
          <h3 className="font-semibold text-text mb-4">Fatura/Fiş Belgeleri</h3>
          
          {/* Pending Files (for new expenses) */}
          {!isEditing && pendingFiles.length > 0 && (
            <div className="mb-4">
              <p className="text-sm text-text-secondary mb-2">Yüklenecek belgeler:</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {pendingFiles.map(pendingFile => (
                  <div key={pendingFile.id} className="border rounded-lg p-3 bg-gray-50 relative">
                    {pendingFile.preview ? (
                      <div className="mb-2">
                        <img 
                          src={pendingFile.preview} 
                          alt={pendingFile.name}
                          className="w-full h-32 object-cover rounded"
                        />
                      </div>
                    ) : (
                      <FileText className="w-8 h-8 text-text-secondary mb-2" />
                    )}
                    <p className="text-sm font-medium truncate">{pendingFile.name}</p>
                    <p className="text-xs text-text-muted">
                      {(pendingFile.size / 1024).toFixed(1)} KB
                    </p>
                    <button
                      type="button"
                      onClick={() => handleRemovePendingFile(pendingFile.id)}
                      className="absolute top-2 right-2 p-1 text-danger hover:bg-danger-50 rounded"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Existing Documents (for editing) */}
          {isEditing && documents.length > 0 && (
            <div className="space-y-2 mb-4">
              {documents.map(doc => (
                <div key={doc.document_id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="w-5 h-5 text-text-secondary" />
                    <div>
                      <p className="font-medium text-sm">{doc.file_name}</p>
                      <p className="text-xs text-text-muted">{doc.document_type}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await documentsAPI.delete(doc.document_id);
                        setDocuments(prev => prev.filter(d => d.document_id !== doc.document_id));
                      } catch (error) {
                        console.error('Delete failed:', error);
                      }
                    }}
                    className="p-2 text-danger hover:bg-danger-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Upload Button */}
          <label className="btn-outline cursor-pointer inline-flex items-center">
            <Upload className="w-4 h-4 mr-2" />
            {isEditing ? 'Belge Yükle' : 'Fatura/Fiş Ekle'}
            <input
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx"
              multiple={!isEditing}
              onChange={isEditing ? handleFileUploadEdit : handleFileSelect}
            />
          </label>
          {errors.documents && <p className="text-sm text-danger mt-2">{errors.documents}</p>}
          {!isEditing && pendingFiles.length === 0 && documents.length === 0 && (
            <p className="text-text-muted text-sm mt-2">
              Fatura veya fiş görseli/belgesi yükleyebilirsiniz (PDF, resim, Word, Excel)
            </p>
          )}
        </div>

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
            onClick={() => navigate('/expenses')}
            className="btn-ghost"
          >
            İptal
          </button>

          <div className="flex items-center gap-3">
            {/* Override Request Button (for conditional expenses) */}
            {isEditing && isOperation && hakEdisCalc?.isConditional && (
              <button
                type="button"
                onClick={() => setShowOverrideModal(true)}
                className="btn-outline"
              >
                Hak Ediş Onayı İste
              </button>
            )}

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
        </div>
      </form>

      {/* Override Request Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-modal max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-text mb-4">Hak Ediş Onayı İste</h3>
            <p className="text-text-secondary text-sm mb-4">
              Bu gider için hak ediş onayı talep ediyorsunuz. Lütfen gerekçenizi yazın.
            </p>
            
            <textarea
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              className="input"
              rows={4}
              placeholder="Neden hak ediş uygulanmalı? (en az 10 karakter)"
            />
            {errors.override && <p className="text-sm text-danger mt-2">{errors.override}</p>}

            <div className="flex justify-end gap-3 mt-4">
              <button
                type="button"
                onClick={() => setShowOverrideModal(false)}
                className="btn-ghost"
              >
                İptal
              </button>
              <button
                type="button"
                onClick={handleRequestOverride}
                className="btn-primary"
              >
                Onay İste
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpenseForm;
