'use client';

import React, { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlignJustify, BarChart2, PieChart, FileText,
  DollarSign, Activity, Settings, Target, Copy, Bell, Shield, Lock, LogOut, Plus, Search, X, SlidersHorizontal
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { setSession } from '@/lib/auth';
import { useFilter, ESTADOS, ANALISTAS } from '@/context/FilterContext';

const ADMIN_PASSWORD = 'dimenza2024';

const STATUS_LABEL: Record<string, string> = {
  'venta':                   'Venta',
  'proyeccion':              'Proyección',
  'en seguimiento':          'En seguimiento',
  'score bajo':              'Score bajo',
  'afectaciones':            'Afectaciones',
  'derivado / aprobado cc':  'Aprob. CC',
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
  const { filters, setFilter, limpiarFiltros, hayFiltros, setIsCreationModalOpen } = useFilter();
  const [showFilters, setShowFilters] = useState(true);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const isRegistros = pathname === '/registros';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showFilters) {
        setShowFilters(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showFilters]);

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

  const showPanel = isRegistros && showFilters;

  return (
    <aside className={`main-sidebar ${hidden ? 'sidebar-hidden' : ''} ${showPanel ? 'sidebar-expanded-filters' : ''}`}
      style={{
        background: '#000',
        borderRight: '1px solid rgba(255,255,255,0.03)',
        boxShadow: '20px 0 60px rgba(0,0,0,0.8)',
        display: 'flex', flexDirection: 'row',
      }}
    >
      {/* ── Icon Rail ── */}
      <div style={{
        width: 'var(--sidebar-width)',
        minWidth: 'var(--sidebar-width)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        borderRight: showPanel ? '1px solid rgba(255,255,255,0.03)' : 'none',
        paddingTop: 40,
        gap: 8,
        zIndex: 10,
        height: '100vh',
      }}>


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
            <NavItem href="/analisis-temporal" icon={Activity} label="Análisis Temporal" active={pathname === '/analisis-temporal'} />
            <NavItem href="/objetivos" icon={Target} label="Objetivos" active={pathname === '/objetivos'} />
            <NavItem href="/duplicados" icon={Copy} label="Duplicados" active={pathname === '/duplicados'} />
            <NavItem href="/auditoria" icon={Shield} label="Auditoría" active={pathname === '/auditoria'} />
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
      </div>

      {/* ── Filters Panel (only on /registros when open) ── */}
      {showPanel && (
        <div className="animate-swap-in" style={{
          width: 260,
          display: 'flex', flexDirection: 'column',
          background: 'linear-gradient(180deg, #050505 0%, #000 100%)',
          overflow: 'hidden',
          height: '100vh',
        }}>
          {/* Close button row */}
          <div style={{
            padding: '20px 20px 0',
            display: 'flex', justifyContent: 'flex-end',
          }}>
            <button
              onClick={() => setShowFilters(false)}
              style={{
                background: 'transparent', border: 'none', color: '#666',
                cursor: 'pointer', padding: 4, transition: '0.2s'
              }}
              onMouseEnter={e => e.currentTarget.style.color = '#fff'}
              onMouseLeave={e => e.currentTarget.style.color = '#666'}
              title="Cerrar (Esc)"
            >
              <X size={18} />
            </button>
          </div>

          {/* Scrollable filter controls */}
          <div style={{
            padding: '16px 20px 20px',
            display: 'flex', flexDirection: 'column', gap: '16px',
            flex: 1, overflowY: 'auto',
          }}>
            {/* Búsqueda */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={labelStyle}>BÚSQUEDA</label>
              <div style={{ position: 'relative' }}>
                <Search
                  style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#333' }}
                  size={14}
                />
                <input
                  type="text"
                  placeholder="Nombre, CUIL..."
                  value={filters.search}
                  onChange={e => setFilter('search', e.target.value)}
                  style={{
                    ...inputStyle,
                    paddingLeft: 36,
                  }}
                />
              </div>
            </div>

            {/* Estado */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={labelStyle}>ESTADO</label>
              <select
                value={filters.estado}
                onChange={e => setFilter('estado', e.target.value)}
                className="form-select"
                style={inputStyle}
              >
                <option value="">Seleccionar estados</option>
                {ESTADOS.map(st => <option key={st} value={st}>{STATUS_LABEL[st] ?? st}</option>)}
              </select>
            </div>

            {/* Analista */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={labelStyle}>ANALISTA</label>
              <select
                value={filters.analista}
                onChange={e => setFilter('analista', e.target.value)}
                className="form-select"
                style={inputStyle}
              >
                <option value="">Todos</option>
                {ANALISTAS.map(an => <option key={an} value={an}>{an}</option>)}
              </select>
            </div>

            {/* Score Min / Max */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>SCORE MIN</label>
                <input
                  type="number"
                  placeholder="Mín"
                  value={filters.scoreMin}
                  onChange={e => setFilter('scoreMin', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>MAX</label>
                <input
                  type="number"
                  placeholder="Máx"
                  value={filters.scoreMax}
                  onChange={e => setFilter('scoreMax', e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Monto Min / Max */}
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>MONTO MIN</label>
                <input
                  type="number"
                  placeholder="Min"
                  value={filters.montoMin}
                  onChange={e => setFilter('montoMin', e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={labelStyle}>MAX</label>
                <input
                  type="number"
                  placeholder="Max"
                  value={filters.montoMax}
                  onChange={e => setFilter('montoMax', e.target.value)}
                  style={inputStyle}
                />
              </div>
            </div>

            {/* Fecha Desde */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={labelStyle}>FECHA DESDE</label>
              <input
                type="date"
                value={filters.fechaDesde}
                onChange={e => setFilter('fechaDesde', e.target.value)}
                style={{ ...inputStyle, colorScheme: 'dark' }}
              />
            </div>

            {/* Fecha Hasta */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={labelStyle}>FECHA HASTA</label>
              <input
                type="date"
                value={filters.fechaHasta}
                onChange={e => setFilter('fechaHasta', e.target.value)}
                style={{ ...inputStyle, colorScheme: 'dark' }}
              />
            </div>

            <div style={{ flex: 1 }} />

            {/* Limpiar Filtros */}
            {hayFiltros && (
              <button
                onClick={limpiarFiltros}
                style={{
                  height: 42, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  color: '#888', borderRadius: '8px', fontWeight: 800, fontSize: '11px',
                  cursor: 'pointer', letterSpacing: '1.5px', textTransform: 'uppercase',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  transition: '0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(248,113,113,0.3)'; e.currentTarget.style.color = '#f87171'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#888'; }}
              >
                LIMPIAR FILTROS
              </button>
            )}
          </div>
        </div>
      )}

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

// ── Shared styles ──────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  fontSize: '9px',
  color: '#555',
  fontWeight: 900,
  textTransform: 'uppercase',
  letterSpacing: '2px',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  height: 38,
  fontSize: '13px',
  fontWeight: 600,
  padding: '0 12px',
  background: 'rgba(255,255,255,0.02)',
  border: '1px solid rgba(255,255,255,0.04)',
  borderRadius: '6px',
  color: '#aaa',
  outline: 'none',
  transition: 'border-color 0.2s',
};
