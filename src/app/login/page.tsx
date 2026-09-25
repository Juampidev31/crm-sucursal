'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setSession, getSession } from '@/lib/auth';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (getSession()) router.replace('/');
  }, [router]);

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
        router.replace('/');
      } else {
        setError('Contraseña incorrecta');
      }
    } catch {
      setError('Error de conexión');
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: 'var(--surface-input)',
      fontFamily: 'var(--font-ui)',
    }}>
      <form onSubmit={handleLogin} autoComplete="off" style={{
        background: 'var(--surface-canvas)',
        border: '1px solid var(--neutral-08)',
        borderRadius: '16px', padding: '40px',
        width: '100%', maxWidth: '320px',
        display: 'flex', flexDirection: 'column', gap: '16px',
      }}>
        {/* Trampa anti-autofill: algunos navegadores ignoran autoComplete="off" en campos password */}
        <input type="password" name="fake-password" autoComplete="new-password" style={{ display: 'none' }} aria-hidden="true" tabIndex={-1} />
        <input
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
          style={{
            background: 'var(--surface-card)', border: '1px solid var(--neutral-08)',
            borderRadius: '10px', color: 'var(--text-strong)', fontSize: '14px',
            padding: '12px 16px', outline: 'none',
            fontFamily: 'var(--font-ui)',
          }}
        />
        {error && <div style={{ color: 'var(--danger-strong)', fontSize: '13px' }}>{error}</div>}
        <button type="submit" style={{
          background: '#f7e479', color: 'var(--text-on-accent)', border: 'none',
          borderRadius: '10px', padding: '12px',
          fontSize: '14px', fontWeight: 700, cursor: 'pointer',
          fontFamily: 'var(--font-ui)',
        }}>
          Entrar
        </button>
      </form>
    </div>
  );
}
