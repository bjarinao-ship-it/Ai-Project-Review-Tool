import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

// Bump this version whenever you want to force all users to re-login
const APP_TOKEN_VERSION = 'v2';

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    const storedVersion = localStorage.getItem('token_version');

    // If token version doesn't match, force re-login
    if (token && savedUser && storedVersion === APP_TOKEN_VERSION) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (e) {
        clearAuth();
      }
    } else {
      // Stale or old version token — clear everything
      clearAuth();
    }
    setLoading(false);
  }, []);

  function clearAuth() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('token_version');
    setUser(null);
  }

  const login = async (email, password) => {
    const data = await api.login(email, password);
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('token_version', APP_TOKEN_VERSION);
    setUser(data.user);
    return data.user;
  };

  const loginAsDemo = async (email) => {
    const pwd = email.includes('admin') ? 'admin123' : 'candidate123';
    return await login(email, pwd);
  };

  const register = async (name, email, password, role) => {
    const data = await api.register(name, email, password, role);
    localStorage.setItem('token', data.access_token);
    localStorage.setItem('user', JSON.stringify(data.user));
    localStorage.setItem('token_version', APP_TOKEN_VERSION);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    clearAuth();
  };

  // Called by API layer when server returns 401
  const handleUnauthorized = () => {
    clearAuth();
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginAsDemo, register, logout, handleUnauthorized }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
