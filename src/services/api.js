import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://jappoo-faju-backend-production-b1f1.up.railway.app';

const api = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'JappooFajuMobile/1.0',
  },
  timeout: 15000,
});

api.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Intercepteur réponse — rafraîchit automatiquement l'access token sur 401
let _isRefreshing = false;
let _queue = [];
const _processQueue = (error, token = null) => {
  _queue.forEach(p => error ? p.reject(error) : p.resolve(token));
  _queue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && !original._retry) {
      if (_isRefreshing) {
        return new Promise((resolve, reject) => _queue.push({ resolve, reject }))
          .then(token => { original.headers.Authorization = `Bearer ${token}`; return api(original); })
          .catch(err => Promise.reject(err));
      }
      original._retry = true;
      _isRefreshing = true;
      const refreshToken = await SecureStore.getItemAsync('refresh_token');
      if (!refreshToken) {
        _isRefreshing = false;
        await SecureStore.deleteItemAsync('token').catch(() => {});
        return Promise.reject(error);
      }
      try {
        const resp = await api.post('/auth/refresh', { refresh_token: refreshToken });
        const { access_token, refresh_token } = resp.data;
        await SecureStore.setItemAsync('token', access_token);
        await SecureStore.setItemAsync('refresh_token', refresh_token);
        _processQueue(null, access_token);
        original.headers.Authorization = `Bearer ${access_token}`;
        return api(original);
      } catch (err) {
        _processQueue(err, null);
        await SecureStore.deleteItemAsync('token').catch(() => {});
        await SecureStore.deleteItemAsync('refresh_token').catch(() => {});
        return Promise.reject(err);
      } finally {
        _isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// ── Auth ──────────────────────────────────────────────────────
export const authAPI = {
  register: async (data) => (await api.post('/auth/register', data)).data,
  login: async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    return res.data;
  },
  getCurrentUser: async () => (await api.get('/auth/me')).data,
  savePushToken: async (push_token) => (await api.post('/auth/push-token', { push_token })).data,
};

// ── Demandes médicales ────────────────────────────────────────
export const medicalRequestsAPI = {
  getAll: async (params = {}) => (await api.get('/medical-requests/', { params })).data,
  getById: async (id) => (await api.get(`/medical-requests/${id}`)).data,
  create: async (data) => (await api.post('/medical-requests/', data)).data,
  createMedicalRequest: async (data) => (await api.post('/medical-requests/', data)).data,
  getPending: async () => (await api.get('/medical-requests/pending')).data,
  validate: async (id) => (await api.patch(`/medical-requests/${id}/validate`)).data,
  reject: async (id) => (await api.patch(`/medical-requests/${id}/reject`)).data,
  publish: async (id) => (await api.patch(`/medical-requests/${id}/publish`)).data,
};

// ── Paiements ─────────────────────────────────────────────────
export const paymentsAPI = {
  createDonation: async (data) => (await api.post('/donations/', data)).data,
  initiatePayDunya: async (data) => (await api.post('/payments/paydunya/initiate', data)).data,
  createStripeCheckout: async (data) => (await api.post('/payments/stripe/create-checkout', data)).data,
};

// ── Dons ──────────────────────────────────────────────────────
export const donationsAPI = {
  getMyDonations: async () => (await api.get('/donations/')).data,
};

// ── Hôpitaux ──────────────────────────────────────────────────
export const hospitalsAPI = {
  getMyHospital: async () => (await api.get('/hospitals/me')).data,
  create: async (data) => (await api.post('/hospitals/', data)).data,
  getAll: async () => (await api.get('/hospitals/')).data,
  verify: async (id) => (await api.patch(`/hospitals/${id}/verify`)).data,
};

export default api;
