import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE_URL = 'https://jappoo-faju-backend-production-b1f1.up.railway.app';

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

// ── Auth ──────────────────────────────────────────────────────
export const authAPI = {
  register: async (data) => (await api.post('/auth/register', data)).data,
  login: async (email, password) => {
    // FastAPI OAuth2 expects form-encoded data
    const form = new URLSearchParams();
    form.append('username', email);
    form.append('password', password);
    const res = await api.post('/auth/login', form.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    });
    return res.data;
  },
  getCurrentUser: async () => (await api.get('/auth/me')).data,
};

// ── Demandes médicales ────────────────────────────────────────
export const medicalRequestsAPI = {
  getAll: async (params = {}) => (await api.get('/medical-requests/', { params })).data,
  getById: async (id) => (await api.get(`/medical-requests/${id}`)).data,
  create: async (data) => (await api.post('/medical-requests/', data)).data,
  validate: async (id) => (await api.patch(`/medical-requests/${id}/validate`)).data,
  reject: async (id) => (await api.patch(`/medical-requests/${id}/reject`)).data,
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
