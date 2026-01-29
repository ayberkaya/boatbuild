/**
 * Settings Page
 * BoatBuild CRM - User settings and password change
 */

import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { authAPI, dataAPI } from '../api/client';
import { Settings as SettingsIcon, Eye, EyeOff, AlertCircle, CheckCircle2, Lock, Download, Upload } from 'lucide-react';

const MIN_PASSWORD_LENGTH = 8;

const Settings = () => {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [importError, setImportError] = useState('');
  const fileInputRef = useRef(null);

  const resetForm = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setShowCurrent(false);
    setShowNew(false);
    setShowConfirm(false);
    setError('');
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      setError(`Yeni şifre en az ${MIN_PASSWORD_LENGTH} karakter olmalıdır.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Yeni şifre ve tekrar alanları eşleşmiyor.');
      return;
    }
    if (currentPassword === newPassword) {
      setError('Yeni şifre mevcut şifreden farklı olmalıdır.');
      return;
    }

    setLoading(true);
    try {
      await authAPI.changePassword(currentPassword, newPassword);
      setSuccess('Şifreniz başarıyla güncellendi.');
      resetForm();
    } catch (err) {
      const msg = err.response?.data?.error || 'Şifre değiştirilemedi.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCsv = async () => {
    setExportLoading(true);
    setImportError('');
    setImportResult(null);
    try {
      const res = await dataAPI.exportCsv();
      if (res.data instanceof Blob && res.data.type && res.data.type !== 'text/csv' && !res.data.type.includes('text/plain')) {
        const text = await res.data.text();
        let msg = 'Export failed';
        try {
          const j = JSON.parse(text);
          msg = j.error || msg;
        } catch (_) {}
        setImportError(msg);
        return;
      }
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `boatbuild-export-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      let msg = 'Export failed';
      if (err.response?.data instanceof Blob) {
        try {
          const text = await err.response.data.text();
          const j = JSON.parse(text);
          msg = j.error || msg;
        } catch (_) {}
      } else if (err.response?.data?.error) {
        msg = err.response.data.error;
      } else if (err.message) {
        msg = err.message;
      }
      setImportError(msg);
    } finally {
      setExportLoading(false);
    }
  };

  const handleImportCsv = async (e) => {
    const file = e?.target?.files?.[0];
    if (!file) return;
    setImportLoading(true);
    setImportError('');
    setImportResult(null);
    try {
      const res = await dataAPI.importCsv(file);
      setImportResult(res.data?.data || res.data);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      const msg = err.response?.data?.error || err.message || 'Import failed';
      setImportError(msg);
    } finally {
      setImportLoading(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-text mb-6 flex items-center gap-2">
        <SettingsIcon className="w-7 h-7 text-primary" />
        Ayarlar
      </h1>

      {/* Profile info (read-only) */}
      <div className="card mb-6">
        <h2 className="text-lg font-semibold text-text mb-4">Hesap Bilgileri</h2>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <dt className="text-sm text-text-secondary">Ad Soyad</dt>
            <dd className="font-medium text-text">{user?.full_name || '—'}</dd>
          </div>
          <div>
            <dt className="text-sm text-text-secondary">E-posta</dt>
            <dd className="font-medium text-text">{user?.email || '—'}</dd>
          </div>
          <div>
            <dt className="text-sm text-text-secondary">Rol</dt>
            <dd className="font-medium text-text">
              {user?.role === 'OWNER' ? 'Sahip' : user?.role === 'OPERATION' ? 'Operasyon' : user?.role || '—'}
            </dd>
          </div>
        </dl>
      </div>

      {/* Password change */}
      <div className="card">
        <h2 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
          <Lock className="w-5 h-5 text-primary" />
          Şifre Değiştir
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-danger-50 border border-danger-100 rounded-lg flex items-center gap-2 text-danger">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}
        {success && (
          <div className="mb-4 p-3 bg-success-50 border border-success-100 rounded-lg flex items-center gap-2 text-success-700">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{success}</span>
          </div>
        )}

        <form onSubmit={handleChangePassword} className="space-y-5">
          <div>
            <label htmlFor="current-password" className="label">
              Mevcut şifre
            </label>
            <div className="relative">
              <input
                id="current-password"
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="input pr-10"
                placeholder="••••••••"
                required
                autoComplete="current-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text"
                onClick={() => setShowCurrent(!showCurrent)}
                aria-label={showCurrent ? 'Hide password' : 'Show password'}
              >
                {showCurrent ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="new-password" className="label">
              Yeni şifre
            </label>
            <div className="relative">
              <input
                id="new-password"
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="input pr-10"
                placeholder="En az 8 karakter"
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text"
                onClick={() => setShowNew(!showNew)}
                aria-label={showNew ? 'Hide password' : 'Show password'}
              >
                {showNew ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            <p className="mt-1 text-xs text-text-secondary">En az {MIN_PASSWORD_LENGTH} karakter</p>
          </div>

          <div>
            <label htmlFor="confirm-password" className="label">
              Yeni şifre (tekrar)
            </label>
            <div className="relative">
              <input
                id="confirm-password"
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input pr-10"
                placeholder="••••••••"
                required
                minLength={MIN_PASSWORD_LENGTH}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text"
                onClick={() => setShowConfirm(!showConfirm)}
                aria-label={showConfirm ? 'Hide password' : 'Show password'}
              >
                {showConfirm ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn-primary"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                    fill="none"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                Güncelleniyor...
              </span>
            ) : (
              'Şifreyi Güncelle'
            )}
          </button>
        </form>
      </div>

      {/* Data export/import */}
      <div className="card mt-6">
        <h2 className="text-lg font-semibold text-text mb-4 flex items-center gap-2">
          <Download className="w-5 h-5 text-primary" />
          Veri aktarımı (CSV)
        </h2>
        <p className="text-sm text-text-secondary mb-4">
          Tüm verileri (tedarikçiler, kategoriler, transferler, giderler, hakediş override’ları) tek bir CSV dosyasında dışa aktarın veya daha önce export edilmiş CSV’yi içe aktarın. İlk sütun entity_type (vendor, expense_category, transfer, expense, hak_edis_override) ile satır türü belirtilir.
        </p>

        {importError && (
          <div className="mb-4 p-3 bg-danger-50 border border-danger-100 rounded-lg flex items-center gap-2 text-danger">
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">{importError}</span>
          </div>
        )}
        {importResult && (
          <div className="mb-4 p-3 bg-success-50 border border-success-100 rounded-lg flex items-center gap-2 text-success-700">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm">
              Import tamamlandı: {importResult.vendors ?? 0} tedarikçi, {importResult.categories ?? 0} kategori, {importResult.transfers ?? 0} transfer, {importResult.expenses ?? 0} gider, {importResult.overrides ?? 0} override.
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-4">
          <button
            type="button"
            onClick={handleExportCsv}
            disabled={exportLoading}
            className="btn-primary flex items-center gap-2"
          >
            {exportLoading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Hazırlanıyor...
              </span>
            ) : (
              <>
                <Download className="w-5 h-5" />
                Export as CSV
              </>
            )}
          </button>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv,text/plain"
              onChange={handleImportCsv}
              disabled={importLoading}
              className="hidden"
              id="csv-import-file"
            />
            <label htmlFor="csv-import-file" className="btn-outline flex items-center gap-2 cursor-pointer">
              {importLoading ? (
                <span className="flex items-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Yükleniyor...
                </span>
              ) : (
                <>
                  <Upload className="w-5 h-5" />
                  Import as CSV
                </>
              )}
            </label>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
