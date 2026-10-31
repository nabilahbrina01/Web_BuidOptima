import axios from 'axios';
import mockApi from './mockClient.js';

export const API_MODE = import.meta.env.VITE_API_MODE === 'real' ? 'real' : 'mock';

// Pesan error backend (Inggris) -> Indonesia, supaya toast di UI konsisten dengan mockClient.
const ERROR_ID = {
  'Invalid credentials': 'Username atau password salah.',
  'Email or username already in use': 'Username atau email sudah terdaftar.',
  'Username or email already registered': 'Username atau email sudah terdaftar.',
  'Invalid OTP': 'Kode verifikasi salah.',
  'OTP expired': 'Kode verifikasi sudah kedaluwarsa.',
  'User not found': 'Pengguna tidak ditemukan.',
  'Old password is incorrect': 'Password lama salah.',
  'Email not verified': 'Email belum diverifikasi. Daftar ulang dengan data yang sama untuk mendapatkan kode verifikasi baru.',
  'MQTT broker is not connected': 'Broker MQTT tidak tersambung.',
  'Failed to send verification email': 'Gagal mengirim email verifikasi. Coba lagi nanti.',
  'Room code already exists': 'ID ruangan sudah dipakai.',
  'Room not found': 'Ruangan tidak ditemukan.',
  'Schedule conflict: room is already booked at this time': 'Jadwal bentrok: ruangan sudah terpakai pada waktu tersebut.',
  'Schedule conflict': 'Jadwal bentrok: ruangan sudah terpakai pada waktu tersebut.',
  'Schedule not found': 'Jadwal tidak ditemukan.',
  'Device not found': 'Perangkat tidak ditemukan.',
  'Asset not found': 'Aset tidak ditemukan.',
  'Asset with that code was not found': 'Aset dengan kode tersebut tidak ditemukan.',
  'Forbidden: insufficient permissions': 'Anda tidak memiliki izin untuk tindakan ini.',
  'Password must be at least 8 characters': 'Password minimal 8 karakter.',
  'New password must be at least 8 characters': 'Password baru minimal 8 karakter.',
  'Invalid email': 'Format email tidak valid.',
  'Email (SMTP) is not configured on the server': 'Email belum dikonfigurasi di server (isi SMTP_USER dan SMTP_PASS di server/.env).',
  'Failed to send test email. Check the SMTP settings on the server.': 'Gagal mengirim email. Periksa pengaturan SMTP di server/.env (untuk Gmail gunakan App Password).',
  'Too many requests. Please try again later.': 'Terlalu banyak percobaan. Coba lagi dalam beberapa menit.',
  'Username must be 3–50 chars': 'Username harus 3–50 karakter.',
};

const realApi = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
});

realApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('bo_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

realApi.interceptors.response.use(
  (res) => {
    // Backend Express selalu membungkus response sebagai { success, data, message }.
    // Kode frontend (awalnya dibuat melawan mockClient yang mengembalikan data
    // mentah) mengharapkan res.data langsung berisi array/objeknya.
    // Supaya semua pemanggilan lama (mis. DataContext.jsx) tidak perlu diubah satu-satu,
    // kita "buka" amplopnya di sini.
    if (res.data && typeof res.data === 'object' && 'success' in res.data && 'data' in res.data) {
      res.data = res.data.data;
    }
    return res;
  },
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('bo_token');
      localStorage.removeItem('bo_user');
      if (!window.location.pathname.includes('login')) window.location.reload();
    }
    // Samakan bentuk pesan error dengan yang dipakai mockClient (err.response.data.error).
    // Error validasi (422) membawa daftar `errors[]`; tampilkan pesan field pertama, bukan "Validation failed".
    const d = err.response?.data;
    if (d && typeof d === 'object' && !d.error) {
      const raw = Array.isArray(d.errors) && d.errors[0]?.message ? d.errors[0].message : d.message;
      if (raw) d.error = ERROR_ID[raw] || raw;
    }
    return Promise.reject(err);
  }
);

console.info(`[BuildOptima] API mode: ${API_MODE}${API_MODE === 'mock' ? ' (data lokal di browser, backend TIDAK dipakai)' : ''}`);
const api = API_MODE === 'real' ? realApi : mockApi;

export default api;
