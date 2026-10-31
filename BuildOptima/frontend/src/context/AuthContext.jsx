import { createContext, useContext, useState } from 'react';
import api from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('bo_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('bo_token'));

  async function login(username, password) {
    const { data } = await api.post('/auth/login', { username, password });
    localStorage.setItem('bo_token', data.token);
    localStorage.setItem('bo_user', JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function register(payload) {
    return api.post('/auth/register', payload);
  }

  async function verifyOtp(payload) {
    return api.post('/auth/verify-otp', payload);
  }

  async function resendOtp(email) {
    return api.post('/auth/resend-otp', { email });
  }

  async function verifyResetOtp(payload) {
    return api.post('/auth/verify-reset-otp', payload);
  }
  
  async function resetPassword(payload) {
    return api.post('/auth/reset-password', payload);
  }

  async function changePassword(oldPassword, newPassword) {
    return api.post('/auth/change-password', { oldPassword, newPassword });
  }

  async function forgotPassword(email) {
    return api.post('/auth/forgot', { email });
  }

  function logout() {
    localStorage.removeItem('bo_token');
    localStorage.removeItem('bo_user');
    setToken(null);
    setUser(null);
  }

  function updateProfile(patch) {
    setUser((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem('bo_user', JSON.stringify(next));
      return next;
    });
  }

  const isAdmin = user?.role === 'admin';

  return (
    <AuthContext.Provider value={{ user, token, isAdmin, login, register, verifyOtp, resendOtp, changePassword, verifyResetOtp, resetPassword, forgotPassword, logout, updateProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
