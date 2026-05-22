import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL } from '../config/server';

const api = axios.create({ baseURL: API_URL, timeout: 10000 });

// Attach token to every request
api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401 - force logout
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401) {
      await AsyncStorage.multiRemove(['token', 'user']);
    }
    return Promise.reject(err);
  }
);

export const AuthAPI = {
  login: (phone, password, deviceId, fcmToken) =>
    api.post('/auth/login', { phone, password, deviceId, fcmToken }),
  register: (name, phone, password, role, adminCode) =>
    api.post('/auth/register', { name, phone, password, role, adminCode }),
  logout: () => api.post('/auth/logout'),
  me: () => api.get('/auth/me'),
  createUser: (name, phone, password) =>
    api.post('/auth/create-user', { name, phone, password }),
};

export const LocationAPI = {
  update: (coords) => api.post('/location/update', coords),
  history: (userId) => api.get(`/location/history/${userId}`),
  allLatest: () => api.get('/location/all-latest'),
  highlights: (userId) => api.get(`/location/highlights/${userId}`),
};

export const GeofenceAPI = {
  create: (data) => api.post('/geofence/create', data),
  list: () => api.get('/geofence/list'),
  update: (id, data) => api.put(`/geofence/${id}`, data),
  delete: (id) => api.delete(`/geofence/${id}`),
};

export const AdminAPI = {
  users: () => api.get('/admin/users'),
  deactivateUser: (id) => api.put(`/admin/users/${id}/deactivate`),
  resetDevice: (resetCode) => api.post('/admin/reset-device', { resetCode }),
};

export default api;
