/**
 * Hakediş Summary Page
 * BoatBuild CRM - View Kaan's commission summary and payment history
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { expensesAPI } from '../api/client';
import { formatCurrency, formatCurrencyMulti } from '../utils/currency';
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
    byCurrency: {},
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
          byCurrency: data.summary.byCurrency || {},
        });

        setPayments(data.payments || []);
      } catch (apiError) {
        // Fallback: Calculate from expense list if API endpoint not available
        console.log('Falling back to client-side calculation');
        const response = await expensesAPI.list({ limit: 1000 });
        const expenses = response.data.data.expenses;
        
        // Calculate base amount (expenses with hak_edis_eligible = true)
        const byCurrency = {};
        expenses.forEach((e) => {
          const c = e.currency || 'TRY';
          if (!byCurrency[c]) byCurrency[c] = { baseAmount: 0, totalHakedis: 0, paidAmount: 0 };
          if (e.is_hak_edis_eligible) byCurrency[c].baseAmount += parseFloat(e.amount || 0);
          byCurrency[c].totalHakedis += parseFloat(e.hak_edis_amount || 0);
          if (e.primary_tag === 'KAAN_ODEME' || e.primary_tag?.toUpperCase().includes('KAAN')) {
            byCurrency[c].paidAmount += parseFloat(e.amount || 0);
          }
        });
        Object.keys(byCurrency).forEach((c) => {
          byCurrency[c].remainingAmount = byCurrency[c].totalHakedis - byCurrency[c].paidAmount;
        });
        const baseAmount = Object.values(byCurrency).reduce((s, x) => s + x.baseAmount, 0);
        const totalHakedis = Object.values(byCurrency).reduce((s, x) => s + x.totalHakedis, 0);
        const paidAmount = Object.values(byCurrency).reduce((s, x) => s + x.paidAmount, 0);
        const remainingAmount = totalHakedis - paidAmount;

        setSummary({
          baseAmount,
          totalHakedis,
          paidAmount,
          remainingAmount,
          byCurrency,
        });

        setPayments(
          expenses
            .filter((e) => e.primary_tag === 'KAAN_ODEME' || e.primary_tag?.toUpperCase().includes('KAAN'))
            .map((e) => ({
              expense_id: e.expense_id,
              date: e.date,
              amount: e.amount,
              description: e.description,
              vendor_name: e.vendor_name,
              currency: e.currency || 'TRY',
            }))
        );
      }
    } catch (error) {
      console.error('Failed to fetch hakediş summary:', error);
    } finally {
      setLoading(false);
    }
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

      {/* Primary: Hakediş Matrahı / Toplam Hakediş / Ödenen Bakiye / Kalan Bakiye */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Hakediş Matrahı (komisyonun hesaplanacağı toplam tutar) */}
        <div className="card border-2 border-blue-200 bg-blue-50/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-text-secondary">Hakediş Matrahı</span>
          </div>
          <div className="space-y-1">
            {formatCurrencyMulti(
              Object.fromEntries(
                Object.entries(summary.byCurrency || {}).map(([c, v]) => [c, v.baseAmount])
              )
            ).map((formatted, i) => (
              <p key={i} className="text-2xl font-bold text-blue-700 money">{formatted}</p>
            ))}
          </div>
          <p className="text-xs text-text-muted mt-1">Komisyonun hesaplanacağı toplam tutar</p>
        </div>

        {/* Toplam Hakediş (ortaya çıkan toplam hakediş) */}
        <div className="card border-2 border-green-200 bg-green-50/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Percent className="w-5 h-5 text-green-600" />
            </div>
            <span className="text-sm text-text-secondary">Toplam Hakediş</span>
          </div>
          <div className="space-y-1">
            {formatCurrencyMulti(
              Object.fromEntries(
                Object.entries(summary.byCurrency || {}).map(([c, v]) => [c, v.totalHakedis])
              )
            ).map((formatted, i) => (
              <p key={i} className="text-2xl font-bold text-green-700 money">{formatted}</p>
            ))}
          </div>
          <p className="text-xs text-text-muted mt-1">Ortaya çıkan toplam hakediş (henüz ödenmemiş olabilir)</p>
        </div>

        {/* Ödenen Bakiye */}
        <div className="card">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <CreditCard className="w-5 h-5 text-purple-600" />
            </div>
            <span className="text-sm text-text-secondary">Ödenen Bakiye</span>
          </div>
          <div className="space-y-1">
            {formatCurrencyMulti(
              Object.fromEntries(
                Object.entries(summary.byCurrency || {}).map(([c, v]) => [c, v.paidAmount])
              )
            ).map((formatted, i) => (
              <p key={i} className="text-2xl font-bold text-purple-600 money">{formatted}</p>
            ))}
          </div>
          <p className="text-xs text-text-muted mt-1">Kaan'a yapılan ödemeler (Kaan Ödemeler giderleri)</p>
        </div>

        {/* Kalan Bakiye */}
        <div className="card border-2 border-orange-200 bg-orange-50">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-orange-100 rounded-lg">
              <Wallet className="w-5 h-5 text-orange-600" />
            </div>
            <span className="text-sm text-text-secondary">Kalan Bakiye</span>
          </div>
          <div className="space-y-1">
            {formatCurrencyMulti(
              Object.fromEntries(
                Object.entries(summary.byCurrency || {}).map(([c, v]) => [c, v.remainingAmount])
              )
            ).map((formatted, i) => (
              <p key={i} className="text-2xl font-bold text-orange-600 money">{formatted}</p>
            ))}
          </div>
          <p className="text-xs text-text-muted mt-1">Ödenecek tutar (Matrah − Ödenen)</p>
        </div>
      </div>

      {/* Hakediş ödemesi gir + secondary: Hakedişe esas gider toplamı */}
      <div className="flex flex-wrap items-center gap-4">
        <button
          type="button"
          onClick={() => navigate('/expenses/new', { state: { presetKaanOdeme: true } })}
          className="btn btn-primary inline-flex items-center gap-2"
        >
          <CreditCard className="w-4 h-4" />
          Hakediş ödemesi gir
        </button>
        <p className="text-sm text-text-secondary">
          Hakediş ödemesi, Gider ekle → Başlık: İmalat, Kategori: Kaan Ödeme ile kaydedilir.
        </p>
      </div>

      {/* Secondary: Hakedişe esas gider toplamı (matrah hesabı) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card bg-gray-50">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <TrendingUp className="w-5 h-5 text-blue-600" />
            </div>
            <span className="text-sm text-text-secondary">Hakedişe esas gider toplamı</span>
          </div>
          <div className="space-y-1">
            {formatCurrencyMulti(
              Object.fromEntries(
                Object.entries(summary.byCurrency || {}).map(([c, v]) => [c, v.baseAmount])
              )
            ).map((formatted, i) => (
              <p key={i} className="text-xl font-bold text-text money">{formatted}</p>
            ))}
          </div>
          <p className="text-xs text-text-muted mt-1">Kaan Hakediş = Evet giderler toplamı (matrah × %7 = Hakediş Matrahı)</p>
        </div>
      </div>

      {/* Calculation Breakdown */}
      <div className="card">
        <h3 className="font-semibold text-text mb-4">Hesaplama Detayı</h3>
        <div className="space-y-3">
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-text-secondary">Hakedişe esas gider toplamı (Kaan Hakediş = Evet)</span>
            <span className="font-medium text-right">
              {formatCurrencyMulti(
                Object.fromEntries(
                  Object.entries(summary.byCurrency || {}).map(([c, v]) => [c, v.baseAmount])
                )
              ).join(' · ')}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-text-secondary">Hakediş Oranı</span>
            <span className="font-medium">%7</span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-text-secondary">Toplam Hakediş (ortaya çıkan hakediş)</span>
            <span className="font-medium text-green-600 text-right">
              {formatCurrencyMulti(
                Object.fromEntries(
                  Object.entries(summary.byCurrency || {}).map(([c, v]) => [c, v.totalHakedis])
                )
              ).join(' · ')}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-gray-100">
            <span className="text-text-secondary">Ödenen Bakiye (Kaan Ödemeler)</span>
            <span className="font-medium text-purple-600 text-right">
              −
              {' '}
              {formatCurrencyMulti(
                Object.fromEntries(
                  Object.entries(summary.byCurrency || {}).map(([c, v]) => [c, v.paidAmount])
                )
              ).join(' · ')}
            </span>
          </div>
          <div className="flex justify-between py-2 bg-orange-50 -mx-4 px-4 rounded-lg">
            <span className="font-semibold text-text">Kalan Bakiye</span>
            <span className="font-bold text-orange-600 text-lg text-right">
              {formatCurrencyMulti(
                Object.fromEntries(
                  Object.entries(summary.byCurrency || {}).map(([c, v]) => [c, v.remainingAmount])
                )
              ).join(' · ')}
            </span>
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
                    <p className="font-medium text-text">{formatCurrency(payment.amount, payment.currency || 'TRY')}</p>
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
          <li>• Sadece &quot;Kaan Hakediş = Evet&quot; olan giderler hakedişe esas gider toplamını oluşturur; toplam × %7 = Hakediş Matrahı</li>
          <li>• Hakediş matrahı ortaya çıkar; ödemesi ayrıca yapılır. Ödemeyi girmek için &quot;Hakediş ödemesi gir&quot; ile gider ekleyin, Başlık: İmalat, Kategori: Kaan Ödeme seçin</li>
          <li>• Ödenen bakiye = Kaan Ödemeler kategorisindeki giderler toplamı</li>
          <li>• Kalan bakiye = Toplam Hakediş − Ödenen Bakiye</li>
        </ul>
      </div>
    </div>
  );
};

export default Hakedis;
