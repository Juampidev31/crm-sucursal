'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlignJustify, BarChart2, PieChart, FileText,
  DollarSign, Settings, Bell, Lock, LogOut, Plus, Search, X, SlidersHorizontal
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { setSession } from '@/lib/auth';
import { useFilter, ESTADOS, ANALISTAS } from '@/context/FilterContext';

const ADMIN_PASSWORD = 'dimenza2024';

const STATUS_LABEL: Record<string, string> = {
  'venta': 'Venta',
  'proyeccion': 'Proyección',
  'en seguimiento': 'En seguimiento',
  'score bajo': 'Score bajo',
  'afectaciones': 'Afectaciones',
  'derivado / aprobado cc': 'Aprob. CC',
  'derivado / rechazado cc': 'Rechaz. CC',
};

// ── NavItem — Pure CSS tooltip via data-label ─────────────────────────────────

function NavItem({
  href, icon: Icon, label, active, badge, onClick
}: {
  href: string; icon: React.ElementType; label: string; active?: boolean; badge?: number; onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <div className="sidebar-icon-btn" data-label={label}>
      <Link
        href={href}
        onClick={onClick}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 50, height: 50,
          borderRadius: 12,
          color: active ? '#fff' : '#444',
          background: active ? 'rgba(255,255,255,0.1)' : 'transparent',
          position: 'relative',
          textDecoration: 'none',
        }}
      >
        <Icon
          size={active ? 24 : 22}
          strokeWidth={active ? 2.5 : 2}
          style={{ opacity: active ? 1 : 0.6 }}
        />
        {badge && badge > 0 ? (
          <span style={{
            position: 'absolute', top: 6, right: 6,
            background: '#ef4444', color: '#fff',
            fontSize: 10, fontWeight: 900,
            width: 18, height: 18, borderRadius: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 8px rgba(0,0,0,0.5)', border: '2px solid #000'
          }}>
            {badge}
          </span>
        ) : null}
      </Link>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar({ hidden }: { hidden?: boolean }) {
  const pathname = usePathname();
  const { isAdmin, logout, refreshUser } = useAuth();
  const { pendingReminders } = useData();
  const { filters, setFilter, limpiarFiltros, hayFiltros, setIsCreationModalOpen, showFilters, setShowFilters } = useFilter();
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const isRegistros = pathname === '/registros';

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
    <aside className={`main-sidebar ${hidden ? 'sidebar-hidden' : ''}`}
      style={{
        background: '#000',
        borderRight: '1px solid rgba(255,255,255,0.03)',
        boxShadow: '20px 0 60px rgba(0,0,0,0.8)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 40,
        gap: 8,
        height: '100vh',
        width: 'var(--sidebar-width)',
      }}
    >


      {/* + Nuevo (only on /registros) */}
      {isRegistros && (
        <>
          <div className="sidebar-icon-btn" data-label="Nuevo Registro">
            <button
              onClick={() => setIsCreationModalOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                width: 50, height: 50,
                borderRadius: 12,
                background: '#fff', color: '#000',
                border: 'none', cursor: 'pointer',
                transition: 'all 0.2s',
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.08)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(255,255,255,0.2)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = 'none'; }}
            >
              <Plus size={24} strokeWidth={3} />
            </button>
          </div>
          <div style={{ width: 28, height: 1, minHeight: 1, flexShrink: 0, background: 'rgba(255,255,255,0.15)', margin: '4px 0' }} />
        </>
      )}

      <NavItem
        href="/registros"
        icon={AlignJustify}
        label="Registros"
        active={pathname === '/registros'}
      />
      <NavItem href="/analistas" icon={BarChart2} label="Reportes" active={pathname === '/analistas'} />
      <NavItem href="/metricas" icon={PieChart} label="Métricas" active={pathname === '/metricas'} />
      <NavItem href="/recordatorios" icon={Bell} label="Recordatorios" active={pathname === '/recordatorios'} badge={pendingReminders} />

      <div style={{ width: 28, height: 1, minHeight: 1, flexShrink: 0, background: 'rgba(255,255,255,0.15)', margin: '4px 0' }} />

      <NavItem href="/reportes/ventas" icon={FileText} label="Ventas" active={pathname === '/reportes/ventas'} />
      <NavItem href="/reportes/cobranzas" icon={DollarSign} label="Cobranzas" active={pathname === '/reportes/cobranzas'} />

      <div style={{ width: 28, height: 1, minHeight: 1, flexShrink: 0, background: 'rgba(255,255,255,0.15)', margin: '4px 0' }} />

      <NavItem
        href="#"
        icon={SlidersHorizontal}
        label="Filtros Avanzados"
        active={showFilters}
        onClick={(e) => {
          e.preventDefault();
          setShowFilters(f => !f);
        }}
      />

      {isAdmin && (
        <>
          <div style={{ width: 32, height: 1, background: 'rgba(255,255,255,0.05)', margin: '30px auto' }} />
          <NavItem href="/ajustes" icon={Settings} label="Ajustes" active={pathname === '/ajustes'} />
        </>
      )}

      <div style={{ flex: 1 }} />

      {/* Bottom: admin toggle */}
      <div style={{ padding: '0 0 32px' }}>
        {isAdmin ? (
          <button
            onClick={() => { logout(); }}
            title="Salir del modo admin"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#333', width: '100%', height: 40,
              transition: 'color 0.2s',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={e => (e.currentTarget.style.color = '#333')}
          >
            <LogOut size={18} strokeWidth={2} style={{ opacity: 0.5 }} />
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
      {
        showAdminModal && (
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
        )
      }
    </aside>
  );
}
