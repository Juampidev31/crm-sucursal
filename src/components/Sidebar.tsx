'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlignJustify, BarChart2, PieChart, FileText,
  DollarSign, Activity, Settings, Target, Copy, Bell, Shield, Lock, LogOut, // Lock kept for modal
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { setSession } from '@/lib/auth';

const ADMIN_PASSWORD = 'dimenza2024';

// ── Nav config ────────────────────────────────────────────────────────────────

const NAV_MAIN = [
  { href: '/registros', icon: AlignJustify, label: 'Registros'   },
  { href: '/analistas', icon: BarChart2,    label: 'Reportes'    },
  { href: '/metricas',  icon: PieChart,     label: 'Métricas'    },
];

const NAV_INFORMES = [
  { href: '/reportes/ventas',    icon: FileText,   label: 'Ventas'    },
  { href: '/reportes/cobranzas', icon: DollarSign, label: 'Cobranzas' },
];

const NAV_ADMIN = [
  { href: '/analisis-temporal', icon: Activity,  label: 'Análisis Temporal' },
  { href: '/objetivos',         icon: Target,    label: 'Objetivos'         },
  { href: '/duplicados',        icon: Copy,      label: 'Duplicados'        },
  { href: '/auditoria',         icon: Shield,     label: 'Auditoría'        },
  { href: '/ajustes',           icon: Settings,  label: 'Ajustes'           },
];

// ── NavItem ───────────────────────────────────────────────────────────────────

function NavItem({
  href, icon: Icon, label, active, badge,
}: {
  href: string; icon: React.ElementType; label: string; active?: boolean; badge?: number;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      href={href}
      style={{
        display: 'flex', alignItems: 'center', gap: 16,
        padding: '16px 32px',
        margin: '2px 0',
        borderRadius: 0,
        color: active ? '#fff' : hovered ? '#fff' : '#444',
        fontWeight: active ? 700 : 500,
        fontSize: 17, // Matches records typography
        textDecoration: 'none',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        cursor: 'pointer',
        background: active 
          ? 'linear-gradient(90deg, rgba(255, 255, 255, 0.08) 0%, transparent 100%)' 
          : hovered 
            ? 'linear-gradient(90deg, rgba(255, 255, 255, 0.04) 0%, transparent 100%)' 
            : 'transparent',
        position: 'relative',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Indicator pill */}
      {active && (
        <div style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 4,
          height: 24,
          background: '#fff',
          borderRadius: '0 2px 2px 0',
          boxShadow: '0 0 15px rgba(255, 255, 255, 0.4)',
        }} />
      )}

      <Icon 
        size={22} // Larger icon
        strokeWidth={active ? 2.5 : 2} 
        style={{ opacity: active ? 1 : 0.5 }}
      />
      <span style={{ flex: 1, letterSpacing: '0.5px' }}>{label}</span>

      {badge && badge > 0 ? (
        <span style={{
          background: '#fff',
          color: '#000',
          fontSize: 11, fontWeight: 900,
          padding: '3px 9px', borderRadius: 20,
          minWidth: 22, textAlign: 'center', flexShrink: 0,
          boxShadow: '0 4px 12px rgba(255,255,255,0.2)'
        }}>
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

// ── Section divider ───────────────────────────────────────────────────────────

function Divider({ label }: { label: string }) {
  return (
    <div style={{
      padding: '32px 32px 14px',
      fontSize: 13, // Larger divider text
      fontWeight: 900,
      textTransform: 'uppercase',
      color: '#222',
      letterSpacing: '2px',
    }}>
      {label}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar({ hidden }: { hidden?: boolean }) {
  const pathname = usePathname();
  const { isAdmin, logout, refreshUser } = useAuth();
  const { pendingReminders } = useData();
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showAdminModal) {
      setAdminPassword('');
      setAdminError(false);
      setTimeout(() => passwordInputRef.current?.focus(), 50);
    }
  }, [showAdminModal]);

  const handleAdminLogin = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setSession({ username: 'admin', rol: 'admin' });
      refreshUser();
      setShowAdminModal(false);
    } else {
      setAdminError(true);
      setAdminPassword('');
      setTimeout(() => passwordInputRef.current?.focus(), 50);
    }
  };

  return (
    <aside className={`main-sidebar${hidden ? ' sidebar-hidden' : ''}`}
      style={{ 
        background: '#000',
        borderRight: '1px solid rgba(255,255,255,0.03)',
        boxShadow: '30px 0 60px rgba(0,0,0,0.8)',
      }}
    >

      {/* Nav */}
      <div className="sidebar-content" style={{ padding: '64px 0 32px' }}>

        {/* Principal */}
        {NAV_MAIN.map(item => (
          <NavItem key={item.href} {...item} active={pathname === item.href} />
        ))}
        <NavItem href="/recordatorios" icon={Bell} label="Recordatorios" active={pathname === '/recordatorios'} badge={pendingReminders} />

        {/* Informes */}
        <Divider label="Informes" />
        {NAV_INFORMES.map(item => (
          <NavItem key={item.href} {...item} active={pathname === item.href} />
        ))}

        {/* Admin */}
        {isAdmin && (
          <>
            <Divider label="Admin" />
            {NAV_ADMIN.map(item => (
              <NavItem key={item.href} {...item} active={pathname === item.href} />
            ))}
          </>
        )}

      </div>

      {/* Invisible trigger area at bottom */}
      <div style={{ padding: '0 0 32px' }}>
        {isAdmin ? (
          <button
            onClick={() => { logout(); }}
            title="Salir del modo admin"
            style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#333', fontSize: 13, padding: '8px 32px',
              borderRadius: 0, width: '100%',
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#333')}
          >
            <LogOut size={15} strokeWidth={2} style={{ opacity: 0.5 }} />
            <span style={{ opacity: 0.5 }}>Salir admin</span>
          </button>
        ) : (
          <button
            onClick={() => setShowAdminModal(true)}
            style={{
              display: 'block', width: '100%', height: '32px',
              background: 'none', border: 'none', cursor: 'default',
            }}
          />
        )}
      </div>

      {/* Admin password modal */}
      {showAdminModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowAdminModal(false); }}
        >
          <div style={{
            background: '#111', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: '32px 28px', width: 320,
            boxShadow: '0 20px 60px rgba(0,0,0,0.8)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <Lock size={18} style={{ color: '#fff' }} />
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Acceso Admin</span>
            </div>
            <input
              ref={passwordInputRef}
              type="password"
              value={adminPassword}
              onChange={e => { setAdminPassword(e.target.value); setAdminError(false); }}
              onKeyDown={e => { if (e.key === 'Enter') handleAdminLogin(); if (e.key === 'Escape') setShowAdminModal(false); }}
              placeholder="Contraseña"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                background: '#1a1a1a', border: `1px solid ${adminError ? '#e53e3e' : 'rgba(255,255,255,0.15)'}`,
                color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box',
              }}
            />
            {adminError && (
              <div style={{ color: '#e53e3e', fontSize: 13, marginTop: 8 }}>Contraseña incorrecta</div>
            )}
            <button
              onClick={handleAdminLogin}
              style={{
                marginTop: 16, width: '100%', padding: '10px',
                background: '#fff', color: '#000', border: 'none',
                borderRadius: 8, fontWeight: 700, fontSize: 15, cursor: 'pointer',
              }}
            >
              Ingresar
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
