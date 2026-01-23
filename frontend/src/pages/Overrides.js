/**
 * Hak Ediş Overrides Page
 * BoatBuild CRM - Owner approval workflow for conditional items
 */

import React, { useState, useEffect } from 'react';
import { overridesAPI } from '../api/client';
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

const Overrides = () => {
  const [overrides, setOverrides] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('PENDING');
  const [expandedId, setExpandedId] = useState(null);
  const [actionLoading, setActionLoading] = useState(null);
  const [approvalNotes, setApprovalNotes] = useState('');
  const [rejectionNotes, setRejectionNotes] = useState('');

  useEffect(() => {
    fetchOverrides();
  }, [filter]);

  const fetchOverrides = async () => {
    try {
      setLoading(true);
      const response = filter === 'PENDING'
        ? await overridesAPI.pending()
        : await overridesAPI.list({ status: filter || undefined });
      
      setOverrides(filter === 'PENDING' 
        ? response.data.data.pending_overrides 
        : response.data.data.overrides);
    } catch (error) {
      console.error('Failed to fetch overrides:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (overrideId) => {
    try {
      setActionLoading(overrideId);
      await overridesAPI.approve(overrideId, approvalNotes);
      setApprovalNotes('');
      setExpandedId(null);
      fetchOverrides();
    } catch (error) {
      console.error('Failed to approve:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (overrideId) => {
    if (!rejectionNotes || rejectionNotes.length < 5) {
      alert('Red gerekçesi giriniz (en az 5 karakter)');
      return;
    }

    try {
      setActionLoading(overrideId);
      await overridesAPI.reject(overrideId, rejectionNotes);
      setRejectionNotes('');
      setExpandedId(null);
      fetchOverrides();
    } catch (error) {
      console.error('Failed to reject:', error);
    } finally {
      setActionLoading(null);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'TRY',
    }).format(amount);
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

  const pendingCount = overrides.filter(o => o.status === 'PENDING').length;
  const totalExposure = overrides
    .filter(o => o.status === 'PENDING')
    .reduce((sum, o) => sum + parseFloat(o.requested_hak_edis_amount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-text">Hak Ediş Onayları</h1>
          <p className="text-text-secondary">Koşullu giderler için onay yönetimi</p>
        </div>
        {pendingCount > 0 && (
          <div className="alert-warning p-3">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <div>
              <p className="font-medium">{pendingCount} onay bekliyor</p>
              <p className="text-sm">Potansiyel risk: {formatCurrency(totalExposure)}</p>
            </div>
          </div>
        )}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2">
        {['PENDING', 'APPROVED', 'REJECTED', ''].map(status => (
          <button
            key={status || 'all'}
            onClick={() => setFilter(status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filter === status
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

      {/* Overrides List */}
      <div className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
          </div>
        ) : overrides.length === 0 ? (
          <div className="card text-center py-12">
            <CheckCircle className="w-12 h-12 text-success mx-auto mb-4" />
            <p className="text-text-secondary">
              {filter === 'PENDING' ? 'Bekleyen onay yok' : 'Kayıt bulunamadı'}
            </p>
          </div>
        ) : (
          overrides.map((override) => {
            const status = getStatusBadge(override.status);
            const isExpanded = expandedId === override.override_id;

            return (
              <div key={override.override_id} className="card">
                {/* Header Row */}
                <div
                  className="flex items-center justify-between cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : override.override_id)}
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${
                      override.status === 'PENDING' ? 'bg-warning-50' :
                      override.status === 'APPROVED' ? 'bg-success-50' : 'bg-danger-50'
                    }`}>
                      <status.icon className={`w-5 h-5 ${
                        override.status === 'PENDING' ? 'text-warning' :
                        override.status === 'APPROVED' ? 'text-success' : 'text-danger'
                      }`} />
                    </div>
                    <div>
                      <p className="font-medium text-text">{override.vendor_name}</p>
                      <p className="text-sm text-text-secondary">
                        {formatDate(override.expense_date)} • {override.primary_tag}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-sm text-text-secondary">Talep Edilen Hak Ediş</p>
                      <p className="font-bold text-lg money text-warning">
                        {formatCurrency(override.requested_hak_edis_amount)}
                      </p>
                    </div>
                    <span className={`badge ${status.class}`}>{status.label}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-text-secondary" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-text-secondary" />
                    )}
                  </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                    {/* Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-text-secondary">Gider Tutarı</p>
                        <p className="font-semibold money">{formatCurrency(override.expense_amount)}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-text-secondary">İş Kapsamı</p>
                        <p className="font-semibold">{override.work_scope_level}</p>
                      </div>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <p className="text-sm text-text-secondary">Talep Eden</p>
                        <p className="font-semibold">{override.requested_by_name}</p>
                      </div>
                    </div>

                    {/* Reason */}
                    <div className="bg-warning-50 p-4 rounded-lg">
                      <p className="text-sm font-medium text-warning-700 mb-1">Talep Gerekçesi:</p>
                      <p className="text-text">{override.reason}</p>
                    </div>

                    {/* Approval Notes (if approved/rejected) */}
                    {override.approval_notes && (
                      <div className={`p-4 rounded-lg ${
                        override.status === 'APPROVED' ? 'bg-success-50' : 'bg-danger-50'
                      }`}>
                        <p className={`text-sm font-medium mb-1 ${
                          override.status === 'APPROVED' ? 'text-success-700' : 'text-danger-700'
                        }`}>
                          {override.status === 'APPROVED' ? 'Onay Notu:' : 'Red Gerekçesi:'}
                        </p>
                        <p className="text-text">{override.approval_notes}</p>
                        <p className="text-sm text-text-secondary mt-2">
                          {override.approved_by_name} • {formatDate(override.approved_at)}
                        </p>
                      </div>
                    )}

                    {/* Action Buttons (for pending) */}
                    {override.status === 'PENDING' && (
                      <div className="space-y-4">
                        <div>
                          <label className="label">Onay Notu (opsiyonel)</label>
                          <textarea
                            value={approvalNotes}
                            onChange={(e) => setApprovalNotes(e.target.value)}
                            className="input"
                            rows={2}
                            placeholder="Onay için not ekleyin..."
                          />
                        </div>

                        <div className="flex items-center justify-between">
                          <div className="flex-1 mr-4">
                            <label className="label">Red Gerekçesi (red için zorunlu)</label>
                            <input
                              type="text"
                              value={rejectionNotes}
                              onChange={(e) => setRejectionNotes(e.target.value)}
                              className="input"
                              placeholder="Red sebebini giriniz..."
                            />
                          </div>
                          
                          <div className="flex gap-3">
                            <button
                              onClick={() => handleReject(override.override_id)}
                              disabled={actionLoading === override.override_id}
                              className="btn-danger"
                            >
                              <XCircle className="w-4 h-4 mr-2" />
                              Reddet
                            </button>
                            <button
                              onClick={() => handleApprove(override.override_id)}
                              disabled={actionLoading === override.override_id}
                              className="btn-success"
                            >
                              <CheckCircle className="w-4 h-4 mr-2" />
                              Onayla
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Summary Stats */}
      {overrides.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card">
            <p className="text-sm text-text-secondary">Bekleyen</p>
            <p className="text-xl font-bold text-warning">
              {overrides.filter(o => o.status === 'PENDING').length}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-text-secondary">Onaylanan</p>
            <p className="text-xl font-bold text-success">
              {overrides.filter(o => o.status === 'APPROVED').length}
            </p>
          </div>
          <div className="card">
            <p className="text-sm text-text-secondary">Reddedilen</p>
            <p className="text-xl font-bold text-danger">
              {overrides.filter(o => o.status === 'REJECTED').length}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Overrides;
