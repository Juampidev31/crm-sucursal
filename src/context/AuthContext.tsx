'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getSession, clearSession, SessionUser } from '@/lib/auth';

interface AuthContextType {
  user: SessionUser | null;
  isAdmin: boolean;
  realIsAdmin: boolean;
  simulatedAnalista: string | null;
  setSimulatedAnalista: (analista: string | null) => void;
  loading: boolean;
  logout: () => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  realIsAdmin: false,
  simulatedAnalista: null,
  setSimulatedAnalista: () => {},
  loading: false,
  logout: () => {},
  refreshUser: () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [simulatedAnalista, setSimulatedAnalistaState] = useState<string | null>(null);

  useEffect(() => {
    try {
      setUser(getSession());
      const savedSim = localStorage.getItem('crm_simulated_analista');
      if (savedSim) setSimulatedAnalistaState(savedSim);
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

  const setSimulatedAnalista = useCallback((analista: string | null) => {
    setSimulatedAnalistaState(analista);
    try {
      if (analista) {
        localStorage.setItem('crm_simulated_analista', analista);
      } else {
        localStorage.removeItem('crm_simulated_analista');
      }
    } catch {}
  }, []);

  const logout = useCallback(() => {
    clearSession();
    try { localStorage.removeItem('crm_simulated_analista'); } catch {}
    setSimulatedAnalistaState(null);
    setUser(null);
  }, []);

  const realIsAdmin = user?.rol === 'admin';
  const isAdmin = realIsAdmin && !simulatedAnalista;

  return (
    <AuthContext.Provider value={{
      user,
      isAdmin,
      realIsAdmin,
      simulatedAnalista,
      setSimulatedAnalista,
      loading,
      logout,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
