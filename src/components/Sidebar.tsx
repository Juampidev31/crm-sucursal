'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useFilter } from '@/context/FilterContext';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { ESTADOS, ANALISTAS } from '@/context/FilterContext';
import { STATUS_LABEL } from '@/lib/utils';
import {
  AlignJustify, BarChart2, FileText,
  DollarSign, Settings, Bell, Lock, LogOut, Plus,
  SlidersHorizontal, ChevronDown, ChevronUp, X, Calculator,
  ZoomIn, ZoomOut, FileSpreadsheet, Users, Database
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRecordatorios } from '@/features/recordatorios/RecordatoriosProvider';
import { setSession } from '@/lib/auth';
import { ExportXlsxModal } from '@/components/ExportXlsxModal';
import { useSettings } from '@/features/settings/SettingsProvider';

// ── NavItem — Pure CSS tooltip via data-label ─────────────────────────────────

function NavItem({
  href, icon: Icon, label, active, badge, onClick, indent, rightIcon: RightIcon, badgeColor = '#10b981', onNavigate,
  isMessage = false, avatarColor = '#ccc'
}: {
  href: string; icon?: React.ElementType; label: string; active?: boolean; badge?: number | string; onClick?: (e: React.MouseEvent) => void; indent?: boolean; rightIcon?: React.ElementType; badgeColor?: string; onNavigate?: () => void;
  isMessage?: boolean; avatarColor?: string;
}) {
  return (
    <Link
      href={href}
      onClick={(e) => {
        if (onClick) onClick(e);
        else if (onNavigate) onNavigate();
      }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '10px 16px', paddingLeft: indent ? '40px' : '16px',
        borderRadius: 16,
        color: active ? '#ffffff' : '#9a9a9a',
        background: 'transparent',
        textDecoration: 'none',
        transition: 'all 0.2s ease',
        marginBottom: 2
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = '#ffffff';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = '#9a9a9a';
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {isMessage ? (
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111', fontWeight: 800, fontSize: 11 }}>
            {label.substring(0, 1)}
          </div>
        ) : (
          Icon && <Icon size={18} strokeWidth={2} style={{ color: active ? '#ffffff' : '#777777' }} fill={active ? '#ffffff' : 'transparent'} />
        )}
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.1px' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {badge ? (
          <span style={{
            background: badgeColor, color: '#fff',
            fontSize: 10, fontWeight: 800,
            padding: '2px 8px', borderRadius: 12,
            minWidth: 22, textAlign: 'center'
          }}>
            {badge}
          </span>
        ) : null}
        {RightIcon && <RightIcon size={14} style={{ color: '#555' }} />}
      </div>
    </Link>
  );
}

function SidebarDivider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '16px 20px' }} />;
}

// ── Modal overlay shared shell ────────────────────────────────────────────────

const MODAL_OVERLAY_STYLE: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9999,
  background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '20px 16px',
};

const MODAL_CARD_STYLE: React.CSSProperties = {
  background: 'var(--bg-elev-2)', border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 24, padding: '32px',
  boxShadow: '0 24px 80px rgba(0,0,0,0.8)', margin: 'auto',
  fontFamily: 'var(--font-outfit), sans-serif',
};

function AdminLoginModal({
  passwordRef, password, error, onChange, onSubmit, onClose,
}: {
  passwordRef: React.RefObject<HTMLInputElement | null>;
  password: string;
  error: boolean;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}) {
  return (
    <div style={MODAL_OVERLAY_STYLE} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...MODAL_CARD_STYLE, width: 360 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(255,155,66,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF9B42' }}>
            <Lock size={20} />
          </div>
          <span style={{ color: '#fff', fontWeight: 600, fontSize: 18 }}>Acceso JUAN PABLO</span>
        </div>
        <input
          ref={passwordRef}
          type="password"
          value={password}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') onSubmit(); if (e.key === 'Escape') onClose(); }}
          placeholder="Contraseña de administrador"
          style={{
            width: '100%', padding: '14px 16px', borderRadius: 12,
            background: '#0c0c0c', border: `1px solid ${error ? '#ff3366' : 'rgba(255,255,255,0.1)'}`,
            color: '#fff', fontSize: 15, outline: 'none', boxSizing: 'border-box',
            fontFamily: 'inherit',
          }}
        />
        {error && (
          <div style={{ color: '#ff3366', fontSize: 13, marginTop: 8, fontWeight: 500 }}>Contraseña incorrecta</div>
        )}
        <button
          onClick={onSubmit}
          style={{
            marginTop: 24, width: '100%', padding: '14px',
            background: '#5e6cff', color: '#fff', border: 'none',
            borderRadius: 12, fontWeight: 600, fontSize: 15, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'transform 0.2s',
            boxShadow: '0 8px 24px rgba(94, 108, 255, 0.25)',
          }}
          onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
          onMouseLeave={e => e.currentTarget.style.transform = 'none'}
        >
          Iniciar Sesión
        </button>
      </div>
    </div>
  );
}

function AccessDeniedModal({ onClose }: { onClose: () => void }) {
  return (
    <div style={MODAL_OVERLAY_STYLE} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ ...MODAL_CARD_STYLE, width: 320, textAlign: 'center' }}>
        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(255,91,55,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF5B37', margin: '0 auto 16px' }}>
          <Lock size={24} />
        </div>
        <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 8 }}>Sin acceso</h3>
        <p style={{ color: 'var(--fg-muted)', fontSize: 14, lineHeight: 1.4, marginBottom: 24 }}>
          No tienes los permisos necesarios para acceder al Panel de Control de la sucursal.
        </p>
        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '12px',
            background: '#2c2d33', color: '#fff', border: 'none',
            borderRadius: 12, fontWeight: 600, fontSize: 14, cursor: 'pointer',
            fontFamily: 'inherit', transition: 'background 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
          onMouseLeave={e => e.currentTarget.style.background = '#2c2d33'}
        >
          Entendido
        </button>
      </div>
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar({ 
  hidden,
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  onNavigate
}: { 
  hidden?: boolean;
  zoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onReset?: () => void;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const { isAdmin, logout, refreshUser } = useAuth();
  const { pendingReminders } = useRecordatorios();
  const { setIsCreationModalOpen, showFilters, setShowFilters, pageSize, setPageSize, totalResults, filters, limpiarFiltros, toggleEstado } = useFilter();
  const { permisosConfig } = useSettings();
  const { registros } = useRegistros(true);

  const countsByState = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const r of registros) {
      if (r.estado) {
        const key = r.estado.toLowerCase();
        counts[key] = (counts[key] || 0) + 1;
      }
    }
    return counts;
  }, [registros]);

  const canCreate = isAdmin || permisosConfig.find(p => p.rol === 'analista' && p.permiso === 'crear_registros')?.activo !== false;
  const canExport = isAdmin || permisosConfig.find(p => p.rol === 'analista' && p.permiso === 'exportar_excel')?.activo !== false;

  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showAccessDenied, setShowAccessDenied] = useState(false);
  const [showXlsxModal, setShowXlsxModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const pageSizeSelectorRef = useRef<HTMLDivElement>(null);
  const isRegistros = pathname === '/registros';
  const [showPageSizeSelector, setShowPageSizeSelector] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [reportesOpen, setReportesOpen] = useState(true);

  useEffect(() => {
    if (showAdminModal) {
      setAdminPassword('');
      setAdminError(false);
      setTimeout(() => passwordInputRef.current?.focus(), 50);
    }
  }, [showAdminModal]);

  useEffect(() => {
    if (!showPageSizeSelector) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (pageSizeSelectorRef.current && !pageSizeSelectorRef.current.contains(e.target as Node)) {
        setShowPageSizeSelector(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showPageSizeSelector]);

  const handleAdminLogin = async () => {
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: adminPassword }),
      });
      if (res.ok) {
        setSession({ username: 'admin', rol: 'admin' });
        refreshUser();
        setShowAdminModal(false);
      } else {
        setAdminError(true);
        setAdminPassword('');
        setTimeout(() => passwordInputRef.current?.focus(), 50);
      }
    } catch {
      setAdminError(true);
    }
  };

  return (
    <aside className={`main-sidebar ${hidden ? 'sidebar-hidden' : ''} ${showFilters ? 'sidebar-expanded-filters' : ''}`}
      style={{
        background: 'transparent',
        borderRight: 'none',
        boxShadow: 'none',
        display: 'flex', flexDirection: 'row',
        alignItems: 'stretch',
        width: (showFilters || showCalculator) ? 'var(--sidebar-filters-width)' : 'var(--sidebar-width)',
        zIndex: 150,
        position: 'relative',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Text + Icon Column */}
      <div style={{
        width: 'var(--sidebar-width)',
        display: 'flex', flexDirection: 'column',
        padding: '2px 16px 20px',
        flexShrink: 0,
        borderRight: (showFilters || showCalculator) ? '1px solid var(--border)' : 'none',
        overflowY: 'hidden',
        overflowX: 'hidden'
      }}>


        {/* Header MENU */}
        <div style={{ fontSize: 10, fontWeight: 800, color: '#555', letterSpacing: '1px', marginBottom: 8, paddingLeft: 16 }}>MENU</div>

        {/* Highlight Action (Like Personal/Business switch) */}
        {isRegistros && canCreate && (
          <div style={{ marginBottom: 8 }}>
            <div style={{
              background: 'transparent', borderRadius: 16, display: 'flex', alignItems: 'center'
            }}>
              <button
                onClick={() => setIsCreationModalOpen(true)}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 12,
                  background: '#10b981', color: '#000',
                  border: 'none', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = '0 6px 16px rgba(16, 185, 129, 0.3)';
                  e.currentTarget.style.background = '#34d399';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = 'none';
                  e.currentTarget.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.15)';
                  e.currentTarget.style.background = '#10b981';
                }}
              >
                <Plus size={18} strokeWidth={3} />
                Nuevo Registro
              </button>
            </div>
          </div>
        )}

        {/* Main Navigation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <NavItem href="/registros" icon={Database} label="Registros" active={pathname === '/registros' && filters.estados.length === 0} onClick={() => limpiarFiltros()} />
          <NavItem href="/recordatorios" icon={Bell} label="Notificaciones" active={pathname === '/recordatorios'} badge={pendingReminders > 0 ? pendingReminders : undefined} badgeColor="#10b981" />
        </div>

        {/* Reports Submenu */}
        <div style={{ marginTop: 2, display: 'flex', flexDirection: 'column', gap: 0 }}>
          <NavItem
            href="#"
            icon={BarChart2}
            label="Reportes"
            active={pathname.includes('/reportes') || pathname.includes('/analistas')}
            onClick={(e) => { e.preventDefault(); setReportesOpen(!reportesOpen); }}
            rightIcon={reportesOpen ? ChevronUp : ChevronDown}
            badge={reportesOpen ? '' : '3'}
            badgeColor="#484B52"
          />
          {reportesOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <NavItem href="/analistas" icon={Users} label="Analistas" active={pathname === '/analistas'} indent onNavigate={onNavigate} />
              <NavItem href="/reportes/cobranzas" icon={DollarSign} label="Cobranzas" active={pathname === '/reportes/cobranzas'} indent onNavigate={onNavigate} />
            </div>
          )}
        </div>

        <div style={{ marginTop: 2, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {isAdmin ? (
            <NavItem href="/ajustes" icon={Settings} label="Ajustes" active={pathname.startsWith('/ajustes')} />
          ) : (
            <NavItem href="#" icon={Lock} label="Acceso Admin" onClick={(e) => { e.preventDefault(); setShowAdminModal(true); }} />
          )}
        </div>

        <div style={{ fontSize: 10, fontWeight: 800, color: '#555', letterSpacing: '1px', marginTop: 16, marginBottom: 8, paddingLeft: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          CLIENTES EN REVISIÓN
          <div style={{ display: 'flex', gap: 8, paddingRight: 16 }}>
             <ChevronDown size={12} style={{ transform: 'rotate(90deg)' }} />
             <ChevronDown size={12} style={{ transform: 'rotate(-90deg)' }} />
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 20, padding: '12px 8px', marginBottom: 12 }}>
          {[
            { label: 'Proyección', value: 'proyeccion', color: '#60a5fa' },
            { label: 'Venta', value: 'venta', color: '#10b981' },
            { label: 'En seguimiento', value: 'en seguimiento', color: '#fbbf24' },
            { label: 'Score bajo', value: 'score bajo', color: '#f87171' },
            { label: 'Afectaciones', value: 'afectaciones', color: '#c084fc' },
            { label: 'Aprobado CC', value: 'derivado / aprobado cc', color: '#34d399' },
            { label: 'Rechazado CC', value: 'derivado / rechazado cc', color: '#ef4444' }
          ].map(s => (
            <NavItem 
              key={s.value} 
              href="/registros" 
              label={s.label} 
              isMessage 
              avatarColor={s.color} 
              onClick={() => {
                limpiarFiltros();
                toggleEstado(s.value);
              }}
              active={pathname === '/registros' && filters.estados.length === 1 && filters.estados[0] === s.value}
              badge={countsByState[s.value] > 0 ? countsByState[s.value] : undefined}
              badgeColor="rgba(255,255,255,0.1)"
            />
          ))}
        </div>

        <div style={{ flex: 1, minHeight: 12 }} />

        {/* Zoom Controls */}
        <div style={{
          padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginTop: 'auto', background: 'rgba(255,255,255,0.02)', borderRadius: 16,
        }}>
          <button onClick={onZoomOut} style={{ background: 'transparent', border: 'none', color: '#777', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="Reducir resolución">
            <ZoomOut size={16} />
          </button>
          <span style={{ color: '#aaa', fontSize: 11, fontWeight: 700, letterSpacing: '1px', userSelect: 'none', cursor: 'pointer' }} onClick={onReset} title="Restablecer">
            {Math.round((zoom || 1) * 100)}%
          </span>
          <button onClick={onZoomIn} style={{ background: 'transparent', border: 'none', color: '#777', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, transition: 'background 0.2s' }} onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'} onMouseLeave={e => e.currentTarget.style.background = 'transparent'} title="Aumentar resolución">
            <ZoomIn size={16} />
          </button>
        </div>
      </div>

      {/* Expanded Filters Panel */}
      {showFilters && (
        <div style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-elev-1)',
          borderLeft: '1px solid rgba(255,255,255,0.05)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            padding: '32px 24px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>Filtros Avanzados</span>
            <button onClick={() => setShowFilters(false)} style={{ background: 'transparent', border: 'none', color: '#90929a', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ flex: 1, overflow: 'hidden', padding: '16px 20px' }}>
            <FiltersContent />
          </div>
        </div>
      )}

      {/* Incentive Calculator Panel */}
      {showCalculator && isAdmin && (
        <div style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-elev-1)',
          borderLeft: '1px solid rgba(255,255,255,0.05)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
        }}>
          <div style={{
            padding: '32px 24px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>Calculadora Sucursal B</span>
            <button onClick={() => setShowCalculator(false)} style={{ background: 'transparent', border: 'none', color: '#90929a', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            <CalculadoraContent />
          </div>
        </div>
      )}

      {showAdminModal && (
        <AdminLoginModal
          passwordRef={passwordInputRef}
          password={adminPassword}
          error={adminError}
          onChange={v => { setAdminPassword(v); setAdminError(false); }}
          onSubmit={handleAdminLogin}
          onClose={() => setShowAdminModal(false)}
        />
      )}

      {showAccessDenied && (
        <AccessDeniedModal onClose={() => setShowAccessDenied(false)} />
      )}
    </aside>
  );
}

// ── Components for expanded filters ──────────────────────────────────────────

const FilterAccordion = ({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 12, background: 'rgba(255,255,255,0.01)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          background: isOpen ? 'rgba(255,255,255,0.02)' : 'transparent', border: 'none', color: isOpen ? '#fff' : '#666',
          fontSize: '10px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', cursor: 'pointer', transition: 'all 0.2s'
        }}
      >
        {title}
        {isOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {isOpen && <div style={{ padding: '16px' }}>{children}</div>}
    </div>
  );
};

const FiltersContent = () => {
  const { filters, setFilter, toggleEstado, toggleAcuerdoPrecios, limpiarFiltros, hayFiltros } = useFilter();
  const { registros } = useRegistros();
  const { isAdmin } = useAuth();
  const allAcuerdos = React.useMemo(() => {
    const set = new Set<string>();
    registros.forEach(r => { if (r.acuerdo_precios) set.add(r.acuerdo_precios); });
    return Array.from(set).sort();
  }, [registros]);

  const chipStyle = (active: boolean) => ({
    padding: '8px 14px', borderRadius: '10px', fontSize: '11px', fontWeight: 700, cursor: 'pointer',
    background: active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.02)',
    color: active ? '#10b981' : '#8f929d',
    border: `1px solid ${active ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.06)'}`,
    transition: 'all 0.2s', whiteSpace: 'nowrap'
  } as React.CSSProperties);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      <div style={{ background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <label style={{ display: 'block', fontSize: '9px', color: 'var(--fg-muted)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>BÚSQUEDA GENERAL</label>
        <input
          className="form-input"
          placeholder="Nombre, CUIL..."
          value={filters.search}
          onChange={e => setFilter('search', e.target.value)}
          style={{ width: '100%', height: 42, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px' }}
        />
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <FilterAccordion title="Gestión" defaultOpen>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '8px', color: 'var(--fg-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>ANALISTA</label>
            <select
              value={filters.analista}
              onChange={e => setFilter('analista', e.target.value)}
              style={{ width: '100%', height: 40, background: '#0c0c0c', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', color: '#eaeaea', outline: 'none', cursor: 'pointer' }}
            >
              <option value="">Todos los analistas</option>
              {ANALISTAS.map(an => <option key={an} value={an}>{an}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '8px', color: 'var(--fg-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>ESTADOS</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {ESTADOS.map(st => (
                <span key={st} onClick={() => toggleEstado(st)} style={chipStyle(filters.estados.includes(st))}>{STATUS_LABEL[st] || st}</span>
              ))}
            </div>
          </div>
        </FilterAccordion>

        <FilterAccordion title="Sistema" defaultOpen>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '8px', color: 'var(--fg-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>ACUERDO DE PRECIOS</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {allAcuerdos.length > 0 ? allAcuerdos.map(a => (
                <span key={a} onClick={() => toggleAcuerdoPrecios(a)} style={chipStyle(filters.acuerdoPrecios.includes(a))}>{a}</span>
              )) : <span style={{ fontSize: '11px', color: '#64748b' }}>Sin acuerdos registrados</span>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '8px', color: 'var(--fg-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>SCORE MIN/MAX</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" placeholder="Mín" className="form-input" value={filters.scoreMin} onChange={e => setFilter('scoreMin', e.target.value)} style={{ height: 38, fontSize: '12px', borderRadius: '8px' }} />
                <input type="number" placeholder="Máx" className="form-input" value={filters.scoreMax} onChange={e => setFilter('scoreMax', e.target.value)} style={{ height: 38, fontSize: '12px', borderRadius: '8px' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '8px', color: 'var(--fg-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>MONTO MIN/MAX</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" placeholder="Mín" className="form-input" value={filters.montoMin} onChange={e => setFilter('montoMin', e.target.value)} style={{ height: 38, fontSize: '12px', borderRadius: '8px' }} />
                <input type="number" placeholder="Máx" className="form-input" value={filters.montoMax} onChange={e => setFilter('montoMax', e.target.value)} style={{ height: 38, fontSize: '12px', borderRadius: '8px' }} />
              </div>
            </div>
          </div>
        </FilterAccordion>

        <div style={{ marginBottom: 12, background: 'rgba(255,255,255,0.01)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.06)', padding: '16px' }}>
          <label style={{ display: 'block', fontSize: '10px', color: '#fff', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>PERÍODO</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '8px', color: 'var(--fg-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>FECHA DESDE</label>
              <input type="date" className="form-input" value={filters.fechaDesde} onChange={e => setFilter('fechaDesde', e.target.value)} style={{ height: 38, fontSize: '12px', borderRadius: '8px' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '8px', color: 'var(--fg-muted)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>FECHA HASTA</label>
              <input type="date" className="form-input" value={filters.fechaHasta} onChange={e => setFilter('fechaHasta', e.target.value)} style={{ height: 38, fontSize: '12px', borderRadius: '8px' }} />
            </div>
          </div>
        </div>
      </div>

      {hayFiltros && (
        <button
          onClick={limpiarFiltros}
          style={{
            width: '100%', padding: '14px', background: 'rgba(248,113,113,0.06)',
            border: '1px solid rgba(248,113,113,0.12)', color: '#ff3366', borderRadius: '12px',
            fontSize: '11px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px',
            cursor: 'pointer', transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px'
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(248,113,113,0.12)'}
          onMouseLeave={e => e.currentTarget.style.background = 'rgba(248,113,113,0.06)'}
        >
          <X size={14} strokeWidth={3} /> Limpiar Filtros
        </button>
      )}
    </div>
  );
};

// ── Calculator Content ───────────────────────────────────────────────────────

const CalculadoraContent = () => {
  const SUELDO_FIJO = 1641799.18;
  const [pacts, setPacts] = useState({
    capital: '',
    operacion: '',
    recupero90: '',
    recupero120: '',
    refi: ''
  });

  const calculate = (type: string, val: string) => {
    const pct = parseFloat(val);
    if (isNaN(pct) || pct < 80) return 0;
    
    // Valores para SUCURSAL B
    const values: Record<string, { c1: number; c2: number; c3: number }> = {
      capital: { c1: 62055, c2: 93703, c3: 141492 },
      operacion: { c1: 42836, c2: 64682, c3: 97671 },
      recupero90: { c1: 40801, c2: 52633, c3: 67897 },
      recupero120: { c1: 40801, c2: 52633, c3: 67897 },
      refi: { c1: 20400, c2: 26521, c3: 37129 }
    };

    const v = values[type];
    if (pct < 100) return v.c1;
    if (pct < 110) return v.c2;
    return v.c3;
  };

  const results = {
    capital: calculate('capital', pacts.capital),
    operacion: calculate('operacion', pacts.operacion),
    recupero90: calculate('recupero90', pacts.recupero90),
    recupero120: calculate('recupero120', pacts.recupero120),
    refi: calculate('refi', pacts.refi)
  };

  const comisiones = Object.values(results).reduce((s, v) => s + v, 0);
  const totalGeneral = comisiones + SUELDO_FIJO;

  const inputRow = (label: string, key: keyof typeof pacts) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: '9px', color: 'var(--fg-muted)', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{label} (%)</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <input
          type="number"
          placeholder="%"
          value={pacts[key]}
          onChange={e => setPacts(p => ({ ...p, [key]: e.target.value }))}
          style={{ width: '64px', height: 40, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', color: '#fff', textAlign: 'center', fontSize: 13, outline: 'none' }}
        />
        <div style={{ flex: 1, textAlign: 'right', fontSize: 13, fontWeight: 800, color: results[key] > 0 ? '#10b981' : '#64748b' }}>
          {results[key] > 0 ? `$ ${results[key].toLocaleString('es-AR')}` : '—'}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: '#fb923c', textTransform: 'uppercase', marginBottom: 16, letterSpacing: 0.5 }}>Venta</div>
        {inputRow('Capital', 'capital')}
        {inputRow('Operación', 'operacion')}
      </div>

      <div style={{ background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.06)', marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: '#00d4ff', textTransform: 'uppercase', marginBottom: 16, letterSpacing: 0.5 }}>Cobranzas</div>
        {inputRow('Recupero 90-119', 'recupero90')}
        {inputRow('Recupero 120-209', 'recupero120')}
        {inputRow('REFI', 'refi')}
      </div>

      <div style={{ marginTop: 'auto', padding: '20px 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>Sueldo Fijo</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#eaeaea' }}>$ {SUELDO_FIJO.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--fg-muted)', textTransform: 'uppercase' }}>Comisiones</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#10b981' }}>$ {comisiones.toLocaleString('es-AR')}</span>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)', margin: '16px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Cobrar</span>
          <span style={{ fontSize: 18, fontWeight: 900, color: '#fff' }}>$ {totalGeneral.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>
        <div style={{ fontSize: 9, color: '#64748b', textAlign: 'right' }}>Sucursal B</div>
      </div>
    </div>
  );
};


