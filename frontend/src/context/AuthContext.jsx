import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);

  const checkAuth = async () => {
    try {
      const data = await api.getMe();
      if (data?.success && data?.data?.admin) {
        setAdmin(data.data.admin);
      } else {
        setAdmin(null);
      }
    } catch {
      setAdmin(null);
      localStorage.removeItem('classorbit_admin_token');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkAuth();
  }, []);

  const login = async (username, password) => {
    const res = await api.login(username, password);
    if (res.success && res.data) {
      if (res.data.token) {
        localStorage.setItem('classorbit_admin_token', res.data.token);
      }
      setAdmin(res.data.admin);
      return res.data.admin;
    }
  };

  const logout = async () => {
    try {
      await api.logout();
    } finally {
      localStorage.removeItem('classorbit_admin_token');
      setAdmin(null);
    }
  };

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout, checkAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
