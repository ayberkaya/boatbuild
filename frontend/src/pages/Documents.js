/**
 * Documents Page
 * BoatBuild CRM - Document management and missing documents view
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { documentsAPI } from '../api/client';
import {
  FileText,
  Upload,
  Download,
  Trash2,
  AlertTriangle,
  Filter,
  Search,
  File,
  Image,
  FileSpreadsheet,
  Eye,
  X,
} from 'lucide-react';

const Documents = () => {
  const { isOwner } = useAuth();
  const [documents, setDocuments] = useState([]);
  const [allDocuments, setAllDocuments] = useState([]); // For tab counts
  const [missingDocs, setMissingDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('invoices'); // 'invoices' | 'contracts'
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [uploading, setUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, [typeFilter]);

  useEffect(() => {
    if (activeTab === 'contracts') {
      setTypeFilter('CONTRACT');
    } else if (activeTab === 'all') {
      setTypeFilter('');
    }
  }, [activeTab]);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [docsRes, allDocsRes, missingRes] = await Promise.all([
        documentsAPI.list({ document_type: typeFilter || undefined }),
        documentsAPI.list(), // Fetch all for counts
        documentsAPI.missing(),
      ]);
      setDocuments(docsRes.data.data.documents);
      setAllDocuments(allDocsRes.data.data.documents);
      setMissingDocs(missingRes.data.data.expenses_missing_docs);
    } catch (error) {
      console.error('Failed to fetch documents:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'contracts') {
      setTypeFilter('CONTRACT');
    } else if (activeTab === 'all') {
      setTypeFilter('');
    }
  }, [activeTab]);

  const handleDownload = async (doc) => {
    try {
      const response = await documentsAPI.download(doc.document_id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', doc.file_name);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  const handleDelete = async (docId) => {
    if (!window.confirm('Bu belgeyi silmek istediğinizden emin misiniz?')) return;

    try {
      await documentsAPI.delete(docId);
      fetchData();
    } catch (error) {
      console.error('Delete failed:', error);
    }
  };

  const handlePreview = async (doc) => {
    try {
      setPreviewLoading(true);
      setPreviewDoc(doc);
      const url = await documentsAPI.preview(doc.document_id);
      setPreviewUrl(url);
    } catch (error) {
      console.error('Preview failed:', error);
      alert('Belge önizlemesi yüklenemedi');
    } finally {
      setPreviewLoading(false);
    }
  };

  const closePreview = () => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewDoc(null);
    setPreviewUrl(null);
    setPreviewLoading(false);
  };

  const getFileIcon = (mimeType) => {
    if (mimeType?.includes('image')) return Image;
    if (mimeType?.includes('spreadsheet') || mimeType?.includes('excel')) return FileSpreadsheet;
    if (mimeType?.includes('pdf')) return FileText;
    return File;
  };

  const canPreview = (mimeType) => {
    if (!mimeType) return false;
    return (
      mimeType.includes('image') ||
      mimeType.includes('pdf') ||
      mimeType.includes('text')
    );
  };

  const formatFileSize = (bytes) => {
    if (!bytes) return '-';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatCurrency = (amount, currency = 'TRY') => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  const filteredDocuments = documents.filter(doc =>
    doc.file_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    doc.expense_vendor?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const documentTypes = [
    { value: '', label: 'Tüm Türler' },
    { value: 'INVOICE', label: 'Fatura' },
    { value: 'CONTRACT', label: 'Sözleşme' },
    { value: 'RECEIPT', label: 'Makbuz' },
    { value: 'WORK_ORDER', label: 'İş Emri' },
    { value: 'DELIVERY_NOTE', label: 'İrsaliye' },
    { value: 'OTHER', label: 'Diğer' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">Belgeler</h1>
          <p className="text-text-secondary">Belge yönetimi</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'invoices'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-text'
          }`}
        >
          Fiş/Fatura ({allDocuments.filter(d => d.document_type === 'INVOICE').length})
        </button>
        <button
          onClick={() => setActiveTab('contracts')}
          className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors ${
            activeTab === 'contracts'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-secondary hover:text-text'
          }`}
        >
          Sözleşmeler ({allDocuments.filter(d => d.document_type === 'CONTRACT').length})
        </button>
      </div>

      {/* Contracts Tab */}
      {activeTab === 'contracts' && (
        <>
          {/* Filters */}
          <div className="card">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-10"
                  placeholder="Sözleşme ara..."
                />
              </div>
            </div>
          </div>

          {/* Contracts List */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="card text-center py-12">
              <FileText className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <p className="text-text-secondary">
                {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz sözleşme yok'}
              </p>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <table className="table">
                <thead>
                  <tr>
                    <th>Belge</th>
                    <th>Tür</th>
                    <th>İlişkili Gider</th>
                    <th>Boyut</th>
                    <th>Yüklenme Tarihi</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((doc) => {
                    const FileIcon = getFileIcon(doc.mime_type);
                    return (
                      <tr key={doc.document_id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-100 rounded-lg">
                              <FileIcon className="w-5 h-5 text-text-secondary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm truncate max-w-xs">{doc.file_name}</p>
                              <p className="text-xs text-text-muted">{doc.uploaded_by_name}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-secondary">{doc.document_type}</span>
                        </td>
                        <td>
                          {doc.expense_vendor ? (
                            <div>
                              <p className="text-sm">{doc.expense_vendor}</p>
                              <p className="text-xs text-text-muted money">
                                {formatCurrency(doc.expense_amount, doc.expense_currency)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-text-muted">-</span>
                          )}
                        </td>
                        <td className="text-sm text-text-secondary">{formatFileSize(doc.file_size)}</td>
                        <td className="text-sm text-text-secondary">{formatDate(doc.uploaded_at)}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            {canPreview(doc.mime_type) && (
                              <button
                                onClick={() => handlePreview(doc)}
                                className="p-2 hover:bg-gray-100 rounded-lg text-text-secondary"
                                title="Önizle"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDownload(doc)}
                              className="p-2 hover:bg-gray-100 rounded-lg text-text-secondary"
                              title="İndir"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            {isOwner && (
                              <button
                                onClick={() => handleDelete(doc.document_id)}
                                className="p-2 hover:bg-danger-50 rounded-lg text-danger"
                                title="Sil"
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
          )}
        </>
      )}

      {/* Invoices/Receipts Tab */}
      {activeTab === 'invoices' && (
        <>
          {/* Filters */}
          <div className="card">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-muted" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="input pl-10"
                  placeholder="Fiş/Fatura ara..."
                />
              </div>
            </div>
          </div>

          {/* Documents List */}
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="card text-center py-12">
              <FileText className="w-12 h-12 text-text-muted mx-auto mb-4" />
              <p className="text-text-secondary">
                {searchTerm ? 'Arama sonucu bulunamadı' : 'Henüz fiş/fatura yok'}
              </p>
            </div>
          ) : (
            <div className="card p-0 overflow-hidden">
              <table className="table">
                <thead>
                  <tr>
                    <th>Belge</th>
                    <th>Tür</th>
                    <th>İlişkili Gider</th>
                    <th>Boyut</th>
                    <th>Yüklenme Tarihi</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocuments.map((doc) => {
                    const FileIcon = getFileIcon(doc.mime_type);
                    return (
                      <tr key={doc.document_id}>
                        <td>
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-gray-100 rounded-lg">
                              <FileIcon className="w-5 h-5 text-text-secondary" />
                            </div>
                            <div>
                              <p className="font-medium text-sm truncate max-w-xs">{doc.file_name}</p>
                              <p className="text-xs text-text-muted">{doc.uploaded_by_name}</p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span className="badge badge-secondary">{doc.document_type}</span>
                        </td>
                        <td>
                          {doc.expense_vendor ? (
                            <div>
                              <p className="text-sm">{doc.expense_vendor}</p>
                              <p className="text-xs text-text-muted money">
                                {formatCurrency(doc.expense_amount, doc.expense_currency)}
                              </p>
                            </div>
                          ) : (
                            <span className="text-text-muted">-</span>
                          )}
                        </td>
                        <td className="text-sm text-text-secondary">{formatFileSize(doc.file_size)}</td>
                        <td className="text-sm text-text-secondary">{formatDate(doc.uploaded_at)}</td>
                        <td>
                          <div className="flex items-center gap-1">
                            {canPreview(doc.mime_type) && (
                              <button
                                onClick={() => handlePreview(doc)}
                                className="p-2 hover:bg-gray-100 rounded-lg text-text-secondary"
                                title="Önizle"
                              >
                                <Eye className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              onClick={() => handleDownload(doc)}
                              className="p-2 hover:bg-gray-100 rounded-lg text-text-secondary"
                              title="İndir"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                            {isOwner && (
                              <button
                                onClick={() => handleDelete(doc.document_id)}
                                className="p-2 hover:bg-danger-50 rounded-lg text-danger"
                                title="Sil"
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
          )}
        </>
      )}


      {/* Preview Modal */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4" onClick={closePreview}>
          <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b">
              <div>
                <h3 className="font-semibold text-lg">{previewDoc.file_name}</h3>
                <p className="text-sm text-text-secondary">{previewDoc.document_type}</p>
              </div>
              <button
                onClick={closePreview}
                className="p-2 hover:bg-gray-100 rounded-lg"
                title="Kapat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {previewLoading ? (
                <div className="flex items-center justify-center h-64">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : previewUrl ? (
                previewDoc.mime_type?.includes('image') ? (
                  <div className="flex items-center justify-center">
                    <img src={previewUrl} alt={previewDoc.file_name} className="max-w-full max-h-[70vh] object-contain" />
                  </div>
                ) : previewDoc.mime_type?.includes('pdf') ? (
                  <iframe
                    src={previewUrl}
                    className="w-full h-[70vh] border-0"
                    title={previewDoc.file_name}
                  />
                ) : (
                  <div className="text-center py-12">
                    <FileText className="w-12 h-12 text-text-muted mx-auto mb-4" />
                    <p className="text-text-secondary">Bu dosya türü için önizleme desteklenmiyor</p>
                    <button
                      onClick={() => handleDownload(previewDoc)}
                      className="btn-primary mt-4"
                    >
                      <Download className="w-4 h-4 mr-2" />
                      İndir
                    </button>
                  </div>
                )
              ) : null}
            </div>
            <div className="flex items-center justify-end gap-2 p-4 border-t">
              <button
                onClick={() => handleDownload(previewDoc)}
                className="btn-outline"
              >
                <Download className="w-4 h-4 mr-2" />
                İndir
              </button>
              <button
                onClick={closePreview}
                className="btn-primary"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-text-secondary">Toplam Belge</p>
          <p className="text-xl font-bold text-primary">{allDocuments.length}</p>
        </div>
        <div className="card">
          <p className="text-sm text-text-secondary">Fatura</p>
          <p className="text-xl font-bold text-text">
            {allDocuments.filter(d => d.document_type === 'INVOICE').length}
          </p>
        </div>
        <div className="card">
          <p className="text-sm text-text-secondary">Sözleşme</p>
          <p className="text-xl font-bold text-text">
            {allDocuments.filter(d => d.document_type === 'CONTRACT').length}
          </p>
        </div>
        <div className="card border-danger/20 bg-danger-50">
          <p className="text-sm text-danger">Eksik Belgeler</p>
          <p className="text-xl font-bold text-danger">{missingDocs.length}</p>
        </div>
      </div>
    </div>
  );
};

export default Documents;
