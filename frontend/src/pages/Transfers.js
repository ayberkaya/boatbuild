/**
 * Transfers List Page
 * BoatBuild CRM - View and manage transfers
 */

import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { transfersAPI } from '../api/client';
import {
  Plus,
  Filter,
  CheckCircle,
  XCircle,
  Clock,
  ChevronLeft,
  ChevronRight,
  Eye,
  Check,
  X,
} from 'lucide-react';

const Transfers = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { isOwner } = useAuth();
  const [transfers, setTransfers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 1 });
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [actionLoading, setActionLoading] = useState(null);

  // Update filter from URL params on mount
  useEffect(() => {
    const urlStatus = searchParams.get('status') || '';
    if (urlStatus) {
      setStatusFilter(urlStatus);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchTransfers();
  }, [pagination.page, statusFilter]);

  const fetchTransfers = async () => {
    try {
      setLoading(true);
      const params = {
        page: pagination.page,
        limit: pagination.limit,
        ...(statusFilter && { status: statusFilter }),
      };
      const response = await transfersAPI.list(params);
      setTransfers(response.data.data.transfers);
      setPagination(prev => ({ ...prev, ...response.data.data.pagination }));
    } catch (error) {
      console.error('Failed to fetch transfers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (transferId, e) => {
    e.stopPropagation();
    try {
      setActionLoading(transferId);
      await transfersAPI.approve(transferId);
      fetchTransfers();
    } catch (error) {
      console.error('Failed to approve:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (transferId, e) => {
    e.stopPropagation();
    const reason = window.prompt('Red sebebini giriniz:');
    if (!reason) return;

    try {
      setActionLoading(transferId);
      await transfersAPI.reject(transferId, reason);
      fetchTransfers();
    } catch (error) {
      console.error('Failed to reject:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const formatCurrency = (amount, currency = 'TRY') => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: currency,
    }).format(amount);
  };

  // Group transfers by currency and calculate totals
  const calculateTotalsByCurrency = (transferList) => {
    const totals = {};
    transferList.forEach(t => {
      const currency = t.currency || 'TRY';
      if (!totals[currency]) {
        totals[currency] = 0;
      }
      totals[currency] += parseFloat(t.amount || 0);
    });
    return totals;
  };

  // Format multiple currencies for display
  const formatCurrencyMulti = (totalsByCurrency) => {
    if (!totalsByCurrency || Object.keys(totalsByCurrency).length === 0) {
      return [formatCurrency(0)];
    }
    const currencies = Object.keys(totalsByCurrency).filter(c => totalsByCurrency[c] > 0);
    if (currencies.length === 0) {
      return [formatCurrency(0)];
    }
    return currencies.map(currency => formatCurrency(totalsByCurrency[currency], currency));
  };

  // Calculate linked expense totals by currency
  const calculateLinkedExpenseTotalsByCurrency = (transferList) => {
    const totals = {};
    transferList.forEach(t => {
      // Use the transfer's currency for linked expenses
      const currency = t.currency || 'TRY';
      if (!totals[currency]) {
        totals[currency] = 0;
      }
      totals[currency] += parseFloat(t.linked_expense_total || 0);
    });
    return totals;
  };

  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('tr-TR');
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'APPROVED':
        return { icon: CheckCircle, class: 'badge-success', label: 'Onaylandı' };
      case 'REJECTED':
        return { icon: XCircle, class: 'badge-danger', label: 'Reddedildi' };
      default:
        return { icon: Clock, class: 'badge-warning', label: 'Bekliyor' };
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">Transferler</h1>
          <p className="text-text-secondary">Tüm transferleri görüntüle ve yönet</p>
        </div>
        <Link to="/transfers/new" className="btn-primary">
          <Plus className="w-5 h-5 mr-2" />
          Yeni Transfer
        </Link>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="flex items-center gap-4">
          <Filter className="w-5 h-5 text-text-secondary" />
          <div className="flex gap-2">
            {['', 'PENDING', 'APPROVED', 'REJECTED'].map(status => (
              <button
                key={status || 'all'}
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                  statusFilter === status
                    ? 'bg-primary text-white'
                    : 'bg-gray-100 text-text hover:bg-gray-200'
                }`}
              >
                {status === '' ? 'Tümü' :
                 status === 'PENDING' ? 'Bekleyen' :
                 status === 'APPROVED' ? 'Onaylanan' : 'Reddedilen'}
              </button>
            ))}
          </div>
          <span className="text-sm text-text-secondary ml-auto">
            Toplam: {pagination.total} transfer
          </span>
        </div>
      </div>

      {/* Transfers Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : transfers.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-text-secondary">
            <p>Henüz transfer kaydı yok</p>
            <Link to="/transfers/new" className="btn-outline mt-4">
              <Plus className="w-4 h-4 mr-2" />
              İlk transferi ekle
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
                    <th>Hesaplar</th>
                    <th className="text-right">Tutar</th>
                    <th className="text-center">Durum</th>
                    <th className="text-center">Bağlı Giderler</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {transfers.map((transfer) => {
                    const status = getStatusBadge(transfer.status);
                    return (
                      <tr
                        key={transfer.transfer_id}
                        className="cursor-pointer"
                        onClick={() => navigate(`/transfers/${transfer.transfer_id}`)}
                      >
                        <td className="font-medium">{formatDate(transfer.date)}</td>
                        <td>{transfer.vendor_name || '-'}</td>
                        <td className="text-sm text-text-secondary">
                          {transfer.from_account && transfer.to_account ? (
                            <span>{transfer.from_account} → {transfer.to_account}</span>
                          ) : '-'}
                        </td>
                        <td className="text-right money font-medium">
                          {formatCurrency(transfer.amount, transfer.currency)}
                        </td>
                        <td className="text-center">
                          <span className={`badge ${status.class}`}>
                            <status.icon className="w-3.5 h-3.5 mr-1" />
                            {status.label}
                          </span>
                        </td>
                        <td className="text-center">
                          {transfer.linked_expense_count > 0 ? (
                            <span className="badge badge-secondary">
                              {transfer.linked_expense_count} gider
                            </span>
                          ) : (
                            <span className="text-text-muted text-sm">-</span>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            {isOwner && transfer.status === 'PENDING' && (
                              <>
                                <button
                                  onClick={(e) => handleApprove(transfer.transfer_id, e)}
                                  disabled={actionLoading === transfer.transfer_id}
                                  className="p-2 text-success hover:bg-success-50 rounded-lg"
                                  title="Onayla"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={(e) => handleReject(transfer.transfer_id, e)}
                                  disabled={actionLoading === transfer.transfer_id}
                                  className="p-2 text-danger hover:bg-danger-50 rounded-lg"
                                  title="Reddet"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </>
                            )}
                            <button className="p-2 hover:bg-gray-100 rounded-lg">
                              <Eye className="w-4 h-4 text-text-secondary" />
                            </button>
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="card">
          <p className="text-sm text-text-secondary">Toplam Transfer</p>
          <div className="space-y-1">
            {formatCurrencyMulti(calculateTotalsByCurrency(transfers)).map((formatted, index) => (
              <p key={index} className="text-xl font-bold text-primary money">
                {formatted}
              </p>
            ))}
          </div>
        </div>
        <div className="card">
          <p className="text-sm text-text-secondary">Onaylanan</p>
          <div className="space-y-1">
            {formatCurrencyMulti(calculateTotalsByCurrency(transfers.filter(t => t.status === 'APPROVED'))).map((formatted, index) => (
              <p key={index} className="text-xl font-bold text-success money">
                {formatted}
              </p>
            ))}
          </div>
        </div>
        <div className="card">
          <p className="text-sm text-text-secondary">Bekleyen</p>
          <div className="space-y-1">
            {formatCurrencyMulti(calculateTotalsByCurrency(transfers.filter(t => t.status === 'PENDING'))).map((formatted, index) => (
              <p key={index} className="text-xl font-bold text-warning money">
                {formatted}
              </p>
            ))}
          </div>
        </div>
        <div className="card">
          <p className="text-sm text-text-secondary">Bağlı Gider Toplamı</p>
          <div className="space-y-1">
            {formatCurrencyMulti(calculateLinkedExpenseTotalsByCurrency(transfers)).map((formatted, index) => (
              <p key={index} className="text-xl font-bold text-secondary money">
                {formatted}
              </p>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Transfers;
