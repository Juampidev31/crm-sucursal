'use client';

import React, { useState, useRef, useEffect } from 'react';
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
  href, icon: Icon, label, active, badge, onClick, indent, rightIcon: RightIcon, badgeColor = '#ff5b37'
}: {
  href: string; icon: React.ElementType; label: string; active?: boolean; badge?: number | string; onClick?: (e: React.MouseEvent) => void; indent?: boolean; rightIcon?: React.ElementType; badgeColor?: string;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '14px 20px', paddingLeft: indent ? '46px' : '20px',
        borderRadius: 16,
        color: active ? '#ffffff' : '#d4d4d8',
        background: active ? '#1a1a1a' : 'transparent',
        textDecoration: 'none',
        transition: 'all 0.2s ease',
        marginBottom: 4
      }}
      onMouseEnter={(e) => {
        if (!active) {
          e.currentTarget.style.color = '#ffffff';
        }
      }}
      onMouseLeave={(e) => {
        if (!active) {
          e.currentTarget.style.color = '#d4d4d8';
        }
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <Icon size={18} strokeWidth={active ? 2.5 : 2} style={{ color: active ? '#ffffff' : 'currentColor' }} />
        <span style={{ fontSize: 17, fontWeight: active ? 800 : 600, letterSpacing: '0.3px' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {badge ? (
          <span style={{
            background: badgeColor, color: '#fff',
            fontSize: 10, fontWeight: 700,
            padding: '2px 8px', borderRadius: 12,
            minWidth: 24, textAlign: 'center'
          }}>
            {badge}
          </span>
        ) : null}
        {RightIcon && <RightIcon size={16} />}
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
  onReset
}: { 
  hidden?: boolean;
  zoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onReset?: () => void;
}) {
  const pathname = usePathname();
  const { isAdmin, logout, refreshUser } = useAuth();
  const { pendingReminders } = useRecordatorios();
  const { setIsCreationModalOpen, showFilters, setShowFilters, pageSize, setPageSize, totalResults } = useFilter();
  const { permisosConfig } = useSettings();

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
        background: '#111111',
        borderRight: '1px solid rgba(255,255,255,0.07)',
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
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>
        {/* Brand Logo Removed */}


        {/* Highlight Action (Like Personal/Business switch) */}
        {isRegistros && canCreate && (
          <div style={{ padding: '0 4px 20px' }}>
            <div style={{
              background: 'var(--bg-elev-1)', borderRadius: 16, padding: 6, display: 'flex', alignItems: 'center'
            }}>
              <button
                onClick={() => setIsCreationModalOpen(true)}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.06)', boxShadow: 'none',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                <Plus size={18} strokeWidth={2.5} />
                Nuevo Registro
              </button>
            </div>
          </div>
        )}

        {/* Main Navigation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <NavItem href="/registros" icon={Database} label="Registros" active={pathname === '/registros'} />
          <NavItem href="/recordatorios" icon={Bell} label="Notificaciones" active={pathname === '/recordatorios'} badge={pendingReminders > 0 ? pendingReminders : undefined} badgeColor="#FF6433" />
        </div>

        {/* Reports Submenu */}
        <div style={{ marginTop: 4, display: 'flex', flexDirection: 'column', gap: 4 }}>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <NavItem href="/analistas" icon={Users} label="Analistas" active={pathname === '/analistas'} indent />
              <NavItem href="/reportes/ventas" icon={FileText} label="Ventas" active={pathname === '/reportes/ventas'} indent />
              <NavItem href="/reportes/cobranzas" icon={DollarSign} label="Cobranzas" active={pathname === '/reportes/cobranzas'} indent />
            </div>
          )}
        </div>

        <SidebarDivider />

        {/* Contextual / Tool Navigation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {isRegistros && (
            <>
              <NavItem
                href="#"
                icon={SlidersHorizontal}
                label="Filtros"
                active={showFilters}
                onClick={(e) => { e.preventDefault(); setShowFilters(f => !f); }}
              />
              <div ref={pageSizeSelectorRef} style={{ position: 'relative' }}>
                <NavItem
                  href="#"
                  icon={AlignJustify}
                  label="Ver Filas"
                  onClick={(e) => { e.preventDefault(); setShowPageSizeSelector(s => !s); }}
                />
                {showPageSizeSelector && (
                  <div style={{
                    position: 'absolute', left: '100%', top: 0, marginLeft: 8,
                    background: 'var(--bg-elev-1)', border: '1px solid rgba(255,255,255,0.06)',
                    borderRadius: 12, padding: 8, zIndex: 1000,
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
                    display: 'flex', flexDirection: 'column', gap: 4, minWidth: 140,
                  }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--fg-muted)', textTransform: 'uppercase', padding: '4px 8px', marginBottom: 4 }}>
                      {totalResults} registros
                    </div>
                    <div style={{ height: 1, background: 'var(--border)', margin: '0 8px 4px' }} />
                    {[25, 50, 100, 200, 999999].map(size => (
                      <button
                        key={size}
                        onClick={() => { setPageSize(size); setShowPageSizeSelector(false); }}
                        style={{
                          padding: '8px 12px', background: pageSize === size ? 'var(--bg-elev-2)' : 'transparent',
                          border: 'none', borderRadius: 8, color: pageSize === size ? '#fff' : 'var(--fg-muted)',
                          fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left',
                          fontFamily: 'inherit'
                        }}
                      >
                        {size >= 1000 ? '∞ Todo' : `${size} filas`}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {canExport && (
                <NavItem
                  href="#"
                  icon={FileSpreadsheet}
                  label="Exportar"
                  onClick={(e) => { e.preventDefault(); setShowXlsxModal(true); }}
                />
              )}
            </>
          )}

          {isAdmin && (
            <>
              <NavItem
                href="#"
                icon={Calculator}
                label="Incentivos"
                active={showCalculator}
                onClick={(e) => { e.preventDefault(); setShowCalculator(s => !s); if (showFilters) setShowFilters(false); }}
              />
              <NavItem href="/ajustes" icon={Settings} label="Ajustes" active={pathname === '/ajustes'} />
            </>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 32 }} />

        {/* Zoom Controls */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: 12, marginBottom: 16, border: '1px solid rgba(255,255,255,0.06)' }}>
          <button onClick={onZoomOut} style={{ background: 'transparent', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onMouseEnter={e => e.currentTarget.style.color='#fff'} onMouseLeave={e => e.currentTarget.style.color='#8f929d'} title="Alejar">
            <ZoomOut size={16} />
          </button>
          <button onClick={onReset} style={{ background: 'transparent', border: 'none', color: 'var(--fg-muted)', fontSize: 12, fontWeight: 800, cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '0.5px' }} onMouseEnter={e => e.currentTarget.style.color='#fff'} onMouseLeave={e => e.currentTarget.style.color='#8f929d'} title="Restablecer">
            {Math.round((zoom || 1) * 100)}%
          </button>
          <button onClick={onZoomIn} style={{ background: 'transparent', border: 'none', color: 'var(--fg-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }} onMouseEnter={e => e.currentTarget.style.color='#fff'} onMouseLeave={e => e.currentTarget.style.color='#8f929d'} title="Acercar">
            <ZoomIn size={16} />
          </button>
        </div>

        {/* User Profile Footer (Fyneen style) */}
        <div style={{
          padding: '12px', display: 'flex', alignItems: 'center', gap: 12,
          marginTop: 'auto', borderRadius: 16, cursor: 'pointer'
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-hover)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        onClick={() => {
          if (!isAdmin) {
            setShowAccessDenied(true);
          } else {
            // For admin, maybe open settings or do nothing
          }
        }}
        >
          <div style={{ width: 40, height: 40, borderRadius: '12px', background: isAdmin ? 'linear-gradient(135deg, #FF9B42, #FF6433)' : '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, boxShadow: isAdmin ? '0 4px 12px rgba(255, 100, 51, 0.3)' : 'none' }}>
            <Settings size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isAdmin ? 'Panel de Control' : 'Panel de Control'}
            </span>
            <span style={{ fontSize: 12, color: 'var(--fg-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isAdmin ? 'Modo Administrador' : 'Área Restringida'}
            </span>
          </div>
          <div style={{ padding: 4, color: 'var(--fg-muted)' }}>
            {isAdmin ? (
              <LogOut size={16} onClick={(e) => { e.stopPropagation(); logout(); }} />
            ) : (
              <Lock size={16} onClick={(e) => { e.stopPropagation(); setShowAdminModal(true); }} />
            )}
          </div>
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


