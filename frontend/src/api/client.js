/**
 * API Client
 * BoatBuild CRM - Axios configuration with authentication
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor - add auth token
client.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - handle errors
client.interceptors.response.use(
  (response) => response,
  (error) => {
    // Network error (backend not reachable)
    if (!error.response) {
      console.error('[API] Network error:', error.message);
      error.response = {
        data: {
          error: 'Backend server is not reachable. Please check if the server is running.',
          networkError: true
        },
        status: 0
      };
    }

    if (error.response?.status === 401) {
      // Token expired or invalid
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Don't redirect if we're already on login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: (email, password) => client.post('/auth/login', { email, password }),
  me: () => client.get('/auth/me'),
  changePassword: (currentPassword, newPassword) =>
    client.post('/auth/change-password', { current_password: currentPassword, new_password: newPassword }),
};

// Expenses API
export const expensesAPI = {
  list: (params) => client.get('/expenses', { params }),
  get: (id) => client.get(`/expenses/${id}`),
  create: (data) => client.post('/expenses', data),
  update: (id, data) => client.put(`/expenses/${id}`, data),
  delete: (id) => client.delete(`/expenses/${id}`),
  categories: () => client.get('/expenses/categories/list'),
  createCategory: (data) => client.post('/expenses/categories', data),
  hakedisSummary: () => client.get('/expenses/hakedis-summary'),
};

// Transfers API
export const transfersAPI = {
  list: (params) => client.get('/transfers', { params }),
  get: (id) => client.get(`/transfers/${id}`),
  create: (data) => client.post('/transfers', data),
  update: (id, data) => client.put(`/transfers/${id}`, data),
  delete: (id) => client.delete(`/transfers/${id}`),
  approve: (id) => client.post(`/transfers/${id}/approve`),
  reject: (id, reason) => client.post(`/transfers/${id}/reject`, { reason }),
  unlinked: () => client.get('/transfers/unlinked/list'),
};

// Overrides API
export const overridesAPI = {
  list: (params) => client.get('/overrides', { params }),
  pending: () => client.get('/overrides/pending'),
  create: (expenseId, reason) => client.post('/overrides', { expense_id: expenseId, reason }),
  approve: (id, notes) => client.post(`/overrides/${id}/approve`, { notes }),
  reject: (id, notes) => client.post(`/overrides/${id}/reject`, { notes }),
};

// Documents API
export const documentsAPI = {
  list: (params) => client.get('/documents', { params }),
  upload: (formData) =>
    client.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  preview: async (id) => {
    const response = await client.get(`/documents/${id}/preview`, { responseType: 'blob' });
    return URL.createObjectURL(response.data);
  },
  download: (id) => client.get(`/documents/${id}/download`, { responseType: 'blob' }),
  delete: (id) => client.delete(`/documents/${id}`),
  missing: () => client.get('/documents/missing/list'),
};

// Vendors API
export const vendorsAPI = {
  list: () => client.get('/vendors'),
  get: (id) => client.get(`/vendors/${id}`),
  create: (data) => client.post('/vendors', data),
  update: (id, data) => client.put(`/vendors/${id}`, data),
  delete: (id) => client.delete(`/vendors/${id}`),
};

// Dashboard API
export const dashboardAPI = {
  kpis: () => client.get('/dashboard/kpis'),
  summary: () => client.get('/dashboard/summary'),
  hakEdisComparison: () => client.get('/dashboard/charts/hak-edis-comparison'),
  hakEdisTrend: (months) => client.get('/dashboard/charts/hak-edis-trend', { params: { months } }),
  realizedHakEdis: () => client.get('/dashboard/tables/realized-hak-edis'),
  futureProjection: () => client.get('/dashboard/tables/future-projection'),
  alerts: () => client.get('/dashboard/alerts'),
  resolveAlert: (id, notes) => client.post(`/dashboard/alerts/${id}/resolve`, { notes }),
  rateCheck: () => client.get('/dashboard/hak-edis-rate-check'),
};

// Data export/import (round-trip CSV ZIP)
export const dataAPI = {
  exportCsv: () =>
    client.get('/data/export', { responseType: 'blob' }),
  importCsv: (file) => {
    const formData = new FormData();
    formData.append('file', file);
    return client.post('/data/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export default client;
