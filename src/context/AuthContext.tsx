'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSession, clearSession, SessionUser } from '@/lib/auth';

interface AuthContextType {
  user: SessionUser | null;
  isAdmin: boolean;
  loading: boolean;
  logout: () => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  loading: false,
  logout: () => {},
  refreshUser: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      setUser(getSession());
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshUser = useCallback(() => {
    try {
      setUser(getSession());
    } catch {
      setUser(null);
    }
  }, []);

  const logout = useCallback(() => {
    clearSession();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      isAdmin: user?.rol === 'admin',
      loading,
      logout,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
