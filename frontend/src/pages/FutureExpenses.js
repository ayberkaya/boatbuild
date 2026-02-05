import React, { useState, useEffect } from 'react';
import { Plus, Search, Filter, ArrowUpDown, Pencil, Trash2, X, Calendar, Check, AlertCircle } from 'lucide-react';
import { futureExpensesAPI } from '../api/client';
import { formatCurrency } from '../utils/currency';

const FutureExpenses = () => {
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [totals, setTotals] = useState({ totalAmount: 0 });

    const [activeTab, setActiveTab] = useState('general'); // 'general' or 'installments'

    // Filters & Sorting
    const [filters, setFilters] = useState({
        search: '',
        sort_by: 'date',
        sort_order: 'ASC',
        exclude_type: 'INSTALLMENT' // Default to hiding installments in 'general' view
    });

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [formData, setFormData] = useState({
        date: '',
        title: '',
        amount: '',
        currency: 'EUR',
        status: 'PENDING'
    });
    const [formLoading, setFormLoading] = useState(false);

    useEffect(() => {
        fetchExpenses();
    }, [filters]);

    const fetchExpenses = async () => {
        try {
            setLoading(true);
            const response = await futureExpensesAPI.list(filters);
            if (response.data.success) {
                setExpenses(response.data.data.expenses);
                setTotals(response.data.data.totals);
            }
        } catch (error) {
            console.error('Error fetching future expenses:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSort = (field) => {
        setFilters(prev => ({
            ...prev,
            sort_by: field,
            sort_order: prev.sort_by === field && prev.sort_order === 'ASC' ? 'DESC' : 'ASC'
        }));
    };

    const handleSearch = (e) => {
        const value = e.target.value;
        setFilters(prev => ({ ...prev, search: value }));
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (tab === 'installments') {
            setFilters(prev => ({
                ...prev,
                type: 'INSTALLMENT',
                exclude_type: undefined
            }));
        } else {
            setFilters(prev => ({
                ...prev,
                type: undefined,
                exclude_type: 'INSTALLMENT'
            }));
        }
    };

    const openModal = (expense = null) => {
        if (expense) {
            setEditingId(expense.id);
            setFormData({
                date: expense.date ? expense.date.split('T')[0] : '',
                title: expense.title,
                amount: expense.amount,
                currency: expense.currency || 'EUR',
                status: expense.status || 'PENDING'
            });
        } else {
            setEditingId(null);
            setFormData({
                date: new Date().toISOString().split('T')[0],
                title: '',
                amount: '',
                currency: 'EUR',
                status: 'PENDING'
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            setFormLoading(true);
            if (editingId) {
                await futureExpensesAPI.update(editingId, formData);
            } else {
                await futureExpensesAPI.create(formData);
            }
            closeModal();
            fetchExpenses();
        } catch (error) {
            console.error('Error saving future expense:', error);
            alert('Failed to save expense');
        } finally {
            setFormLoading(false);
        }
    };

    const handleDelete = async (id) => {
        if (!window.confirm('Bu kalemi silmek istediğinize emin misiniz?')) return;
        try {
            await futureExpensesAPI.delete(id);
            fetchExpenses();
        } catch (error) {
            console.error('Error deleting expense:', error);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'PAID': return 'bg-green-100 text-green-800';
            case 'CANCELLED': return 'bg-gray-100 text-gray-800';
            default: return 'bg-yellow-100 text-yellow-800';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'PAID': return 'Ödendi';
            case 'CANCELLED': return 'İptal';
            default: return 'Bekliyor';
        }
    };

    if (loading && expenses.length === 0) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-text">Gelecek Giderler</h1>
                    <p className="text-text-secondary">Beklenen ödemeler ve nakit akışı planı</p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Yeni Kalem Ekle
                </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-200 mb-4">
                <button
                    className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'general'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-text-secondary hover:text-text'
                        }`}
                    onClick={() => handleTabChange('general')}
                >
                    Genel Plan
                </button>
                <button
                    className={`px-6 py-3 font-medium text-sm border-b-2 transition-colors ${activeTab === 'installments'
                        ? 'border-primary text-primary'
                        : 'border-transparent text-text-secondary hover:text-text'
                        }`}
                    onClick={() => handleTabChange('installments')}
                >
                    Gelecek Taksitler
                </button>
            </div>

            {/* Controls */}
            <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Kalem ara..."
                        value={filters.search}
                        onChange={handleSearch}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 rounded-lg border border-gray-200 whitespace-nowrap">
                    <span className="text-sm font-medium text-gray-600">Toplam:</span>
                    <span className="text-lg font-bold text-primary">{formatCurrency(totals.totalAmount, 'EUR')}</span>
                </div>
            </div>

            {/* Advanced Filters */}
            <div className="flex flex-wrap gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="flex items-center gap-2">
                    <Filter className="w-5 h-5 text-gray-400" />
                    <span className="text-sm font-medium text-text-secondary">Filtrele:</span>
                </div>

                <select
                    value={filters.status || ''}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                >
                    <option value="">Tüm Durumlar</option>
                    <option value="PENDING">Bekliyor</option>
                    <option value="PAID">Ödendi</option>
                    <option value="CANCELLED">İptal</option>
                </select>

                <div className="flex items-center gap-2">
                    <input
                        type="date"
                        value={filters.start_date || ''}
                        onChange={(e) => setFilters(prev => ({ ...prev, start_date: e.target.value }))}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                    <span className="text-gray-400">-</span>
                    <input
                        type="date"
                        value={filters.end_date || ''}
                        onChange={(e) => setFilters(prev => ({ ...prev, end_date: e.target.value }))}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                </div>

                {(filters.status || filters.start_date || filters.end_date) && (
                    <button
                        onClick={() => setFilters({ search: '', sort_by: 'date', sort_order: 'ASC', status: '', start_date: '', end_date: '' })}
                        className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition-colors ml-auto"
                    >
                        Filtreleri Temizle
                    </button>
                )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-50 text-text-secondary border-b border-gray-200">
                            <tr>
                                <th
                                    className="px-6 py-4 font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                                    onClick={() => handleSort('date')}
                                >
                                    <div className="flex items-center gap-2">
                                        Tarih
                                        <ArrowUpDown className="w-4 h-4" />
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 font-semibold cursor-pointer hover:bg-gray-100 transition-colors"
                                    onClick={() => handleSort('title')}
                                >
                                    <div className="flex items-center gap-2">
                                        Açıklama / Kalem
                                        <ArrowUpDown className="w-4 h-4" />
                                    </div>
                                </th>
                                <th
                                    className="px-6 py-4 font-semibold text-right cursor-pointer hover:bg-gray-100 transition-colors"
                                    onClick={() => handleSort('amount')}
                                >
                                    <div className="flex items-center justify-end gap-2">
                                        Tutar
                                        <ArrowUpDown className="w-4 h-4" />
                                    </div>
                                </th>
                                <th className="px-6 py-4 font-semibold text-center">Durum</th>
                                <th className="px-6 py-4 font-semibold text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {expenses.length > 0 ? (
                                expenses.map((expense) => (
                                    <tr key={expense.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap text-text">
                                            {new Date(expense.date).toLocaleDateString('tr-TR')}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-text">
                                            {expense.title}
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-text">
                                            {formatCurrency(expense.amount, expense.currency)}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(expense.status)}`}>
                                                {getStatusLabel(expense.status)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => openModal(expense)}
                                                    className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                                                    title="Düzenle"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(expense.id)}
                                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                    title="Sil"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex flex-col items-center gap-2">
                                            <AlertCircle className="w-8 h-8 opacity-50" />
                                            <p>Kayıt bulunamadı</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Edit/Create Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-text">
                                {editingId ? 'Gider Düzenle' : 'Yeni Gelecek Gider'}
                            </h3>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Tarih</label>
                                <div className="relative">
                                    <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="date"
                                        required
                                        value={formData.date}
                                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Açıklama / Kalem Adı</label>
                                <input
                                    type="text"
                                    required
                                    placeholder="Örn: Motor Ödemesi 2. Taksit"
                                    value={formData.title}
                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">Tutar</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        min="0"
                                        required
                                        value={formData.amount}
                                        onChange={e => setFormData({ ...formData, amount: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-text-secondary mb-1">Para Birimi</label>
                                    <select
                                        value={formData.currency}
                                        onChange={e => setFormData({ ...formData, currency: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                    >
                                        <option value="EUR">EUR (€)</option>
                                        <option value="USD">USD ($)</option>
                                        <option value="TRY">TRY (₺)</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-text-secondary mb-1">Durum</label>
                                <select
                                    value={formData.status}
                                    onChange={e => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                >
                                    <option value="PENDING">Bekliyor</option>
                                    <option value="PAID">Ödendi</option>
                                    <option value="CANCELLED">İptal</option>
                                </select>
                            </div>

                            <div className="pt-4 flex items-center justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-lg"
                                >
                                    İptal
                                </button>
                                <button
                                    type="submit"
                                    disabled={formLoading}
                                    className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                                >
                                    {formLoading ? (
                                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <Check className="w-4 h-4" />
                                    )}
                                    Kaydet
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FutureExpenses;
