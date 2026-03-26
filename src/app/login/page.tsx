'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { setSession, getSession } from '@/lib/auth';

const ADMIN_PASSWORD = 'dimenza2024';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    if (getSession()) router.replace('/');
  }, [router]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ADMIN_PASSWORD) {
      setSession({ username: 'admin', rol: 'admin' });
      router.replace('/');
    } else {
      setError('Contraseña incorrecta');
    }
  };

  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', background: '#000',
      fontFamily: "'Outfit', sans-serif",
    }}>
      <form onSubmit={handleLogin} style={{
        background: '#0a0a0a',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px', padding: '40px',
        width: '100%', maxWidth: '320px',
        display: 'flex', flexDirection: 'column', gap: '16px',
      }}>
        <input
          type="password"
          value={password}
          onChange={e => { setPassword(e.target.value); setError(''); }}
          placeholder="Contraseña"
          autoFocus
          style={{
            background: '#111', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '10px', color: '#fff', fontSize: '14px',
            padding: '12px 16px', outline: 'none',
            fontFamily: "'Outfit', sans-serif",
          }}
        />
        {error && <div style={{ color: '#f87171', fontSize: '13px' }}>{error}</div>}
        <button type="submit" style={{
          background: '#f7e479', color: '#000', border: 'none',
          borderRadius: '10px', padding: '12px',
          fontSize: '14px', fontWeight: 700, cursor: 'pointer',
          fontFamily: "'Outfit', sans-serif",
        }}>
          Entrar
        </button>
      </form>
    </div>
  );
}
