/**
 * Hakediş Summary Page
 * BoatBuild CRM - View Kaan's commission summary and payment history
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { expensesAPI } from '../api/client';
import {
  Percent,
  TrendingUp,
  CreditCard,
  Wallet,
  ChevronRight,
} from 'lucide-react';

const Hakedis = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    baseAmount: 0,
    totalHakedis: 0,
    paidAmount: 0,
    remainingAmount: 0,
  });
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    fetchHakedisSummary();
  }, []);

  const fetchHakedisSummary = async () => {
    try {
      setLoading(true);
      
      // Try to use the dedicated API endpoint first
      try {
        const response = await expensesAPI.hakedisSummary();
        const data = response.data.data;
        
        setSummary({
          baseAmount: data.summary.baseAmount,
          totalHakedis: data.summary.totalHakedis,
          paidAmount: data.summary.paidAmount,
          remainingAmount: data.summary.remainingAmount,
        });
        
        setPayments(data.payments || []);
      } catch (apiError) {
        // Fallback: Calculate from expense list if API endpoint not available
        console.log('Falling back to client-side calculation');
        const response = await expensesAPI.list({ limit: 1000 });
        const expenses = response.data.data.expenses;
        
        // Calculate base amount (expenses with hak_edis_eligible = true)
        const baseAmount = expenses
          .filter(e => e.is_hak_edis_eligible)
          .reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
        
        // Calculate total hakediş (7%)
        const totalHakedis = baseAmount * 0.07;
        
        // Get Kaan payments (expenses with KAAN_ODEME tag)
        const kaanPayments = expenses.filter(e => 
          e.primary_tag === 'KAAN_ODEME' || 
          e.primary_tag?.toUpperCase().includes('KAAN')
        );
        
        const paidAmount = kaanPayments.reduce((sum, e) => sum + parseFloat(e.amount || 0), 0);
        
        // Calculate remaining
        const remainingAmount = totalHakedis - paidAmount;
        
        setSummary({
          baseAmount,
          totalHakedis,
          paidAmount,
          remainingAmount,
        });
        
        setPayments(kaanPayments);
      }
    } catch (error) {
      console.error('Failed to fetch hakediş summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('tr-TR', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('tr-TR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text">Kaan Hakediş</h1>
        <p className="text-text-secondary">İmalat giderleri üzerinden %7 hakediş özeti</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Hakediş Matrahı */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-text-secondary">Hakediş Matrahı</span>
          </div>
          <p className="text-2xl font-bold text-text">{formatCurrency(summary.baseAmount)}</p>
          <p className="text-xs text-text-muted mt-1">Hakediş dahil giderler toplamı</p>
        </div>

        {/* Toplam Hakediş */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Percent className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-text-secondary">Toplam Hakediş (%7)</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(summary.totalHakedis)}</p>
          <p className="text-xs text-text-muted mt-1">Matrah x %7</p>
        </div>

        {/* Ödenen Hakediş */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CreditCard className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm text-text-secondary">Ödenen Hakediş</span>
          </div>
          <p className="text-2xl font-bold text-purple-600">{formatCurrency(summary.paidAmount)}</p>
          <p className="text-xs text-text-muted mt-1">Kaan'a yapılan ödemeler</p>
        </div>

        {/* Kalan Hakediş */}
        <div className="card border-2 border-orange-200 bg-orange-50">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Wallet className="w-5 h-5 text-orange-600" />
            </div>
            <span className="text-sm text-text-secondary">Kalan Hakediş</span>
          </div>
          <p className="text-2xl font-bold text-orange-600">{formatCurrency(summary.remainingAmount)}</p>
          <p className="text-xs text-text-muted mt-1">Ödenecek tutar</p>
        </div>
      </div>

      {/* Calculation Breakdown */}
      <div className="card">
        <h3 className="font-semibold text-text mb-4">Hesaplama Detayı</h3>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-text-secondary">Hakediş Matrahı (Kaan Hakediş = Evet)</span>
            <span className="font-medium">{formatCurrency(summary.baseAmount)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-text-secondary">Hakediş Oranı</span>
            <span className="font-medium">%7</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-text-secondary">Toplam Hakediş</span>
            <span className="font-medium text-green-600">{formatCurrency(summary.totalHakedis)}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-text-secondary">Ödenen (Kaan Ödemeler)</span>
            <span className="font-medium text-purple-600">- {formatCurrency(summary.paidAmount)}</span>
          </div>
          <div className="flex justify-between py-2 bg-orange-50 -mx-4 px-4 rounded-lg">
            <span className="font-semibold text-text">KALAN BAKİYE</span>
            <span className="font-bold text-orange-600 text-lg">{formatCurrency(summary.remainingAmount)}</span>
          </div>
        </div>
      </div>

      {/* Payment History */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-text">Kaan Ödeme Geçmişi</h3>
          <span className="text-sm text-text-secondary">{payments.length} ödeme</span>
        </div>

        {payments.length === 0 ? (
          <div className="text-center py-8 text-text-secondary">
            <CreditCard className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>Henüz ödeme kaydı yok</p>
          </div>
        ) : (
          <div className="space-y-2">
            {payments.map((payment) => (
              <div
                key={payment.expense_id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                onClick={() => navigate(`/expenses/${payment.expense_id}`)}
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <CreditCard className="w-4 h-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="font-medium text-text">{formatCurrency(payment.amount)}</p>
                    <p className="text-sm text-text-secondary">{formatDate(payment.date)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {payment.description && (
                    <span className="text-sm text-text-muted max-w-[200px] truncate">
                      {payment.description}
                    </span>
                  )}
                  <ChevronRight className="w-4 h-4 text-text-muted" />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <h4 className="font-medium text-blue-800 mb-2">Hakediş Hesaplama Kuralları</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• Sadece "Kaan Hakediş = Evet" olan giderler matrahı oluşturur</li>
          <li>• Hakediş oranı sabit %7'dir</li>
          <li>• "Kaan Ödeme" kategorisindeki giderler ödenen tutarı oluşturur</li>
          <li>• Kalan bakiye = Toplam Hakediş - Ödenen Hakediş</li>
        </ul>
      </div>
    </div>
  );
};

export default Hakedis;
