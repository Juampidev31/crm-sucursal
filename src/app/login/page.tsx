'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { setSession, getSession } from '@/lib/auth';
import { useAuth } from '@/context/AuthContext';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refreshUser } = useAuth();

  useEffect(() => {
    if (searchParams.get('preview') !== '1' && getSession()) router.replace('/');
  }, [router, searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setSession({ username: 'admin', rol: 'admin' });
        // `router.replace` es navegación de cliente: no remonta `AuthProvider`,
        // así que su efecto de montaje no vuelve a leer la sesión y el usuario
        // quedaría en `null` (sin acciones de admin) hasta una recarga completa.
        refreshUser();
        router.replace('/');
      } else {
        setError('Contraseña incorrecta');
      }
    } catch {
      setError('Error de conexión');
    }
  };

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={handleLogin} autoComplete="off">
        <div className={styles.heading}>
          <div className={styles.eyebrow}>Acceso seguro</div>
          <h1 className={styles.title}>Administración</h1>
          <p className={styles.description}>Ingresá tu contraseña para gestionar el sistema.</p>
        </div>
        {/* Trampa anti-autofill: algunos navegadores ignoran autoComplete="off" en campos password */}
        <input className={styles.autofillTrap} type="password" name="fake-password" autoComplete="new-password" aria-hidden="true" tabIndex={-1} />
        <input
          className={styles.password}
          type="password"
          name="admin-pwd"
          value={password}
          onChange={e => { setPassword(e.target.value); setError(''); }}
          placeholder="Contraseña"
          autoFocus
          autoComplete="new-password"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
        />
        {error && <div className={styles.error}>{error}</div>}
        <button className={styles.submit} type="submit">
          Entrar
        </button>
      </form>
    </div>
  );
}
