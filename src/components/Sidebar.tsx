'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useFilter, ESTADOS } from '@/context/FilterContext';
import { useAnalistas } from '@/features/settings/SettingsProvider';
import { useRegistros } from '@/features/registros/RegistrosProvider';
import { STATUS_LABEL } from '@/lib/utils';
import {
  AlignJustify, BarChart2,
  DollarSign, Settings, Bell, Lock, Plus,
  SlidersHorizontal, ChevronDown, ChevronUp, ChevronLeft, X, Calculator,
  ZoomIn, ZoomOut, FileSpreadsheet, Users, Database, TrendingUp, FolderSearch
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRecordatorios } from '@/features/recordatorios/RecordatoriosProvider';
import { setSession } from '@/lib/auth';
import { ExportXlsxModal } from '@/components/ExportXlsxModal';
import { useSettings } from '@/features/settings/SettingsProvider';

const REGISTRO_STATES = [
  { label: 'Proyección', value: 'proyeccion', color: '#60a5fa' },
  { label: 'Venta', value: 'venta', color: '#10b981' },
  { label: 'En seguimiento', value: 'en seguimiento', color: '#fbbf24' },
  { label: 'Score bajo', value: 'score bajo', color: '#f87171' },
  { label: 'Afectaciones', value: 'afectaciones', color: '#c084fc' },
  { label: 'Aprobado CC', value: 'derivado / aprobado cc', color: '#34d399' },
  { label: 'Rechazado CC', value: 'derivado / rechazado cc', color: '#ef4444' }
];

// ── NavItem — Pure CSS tooltip via data-label ─────────────────────────────────

function NavItem({
  href, icon: Icon, label, active, badge, onClick, indent, rightIcon: RightIcon, badgeColor = '#10b981',
  isMessage = false, avatarColor = '#ccc', isTreeItem = false, isLastTreeItem = false, isDoubleTreeItem = false, iconColor
}: {
  href: string; icon?: React.ElementType; label: string; active?: boolean; badge?: number | string; onClick?: (e: React.MouseEvent) => void; indent?: boolean; rightIcon?: React.ElementType; badgeColor?: string;
  isMessage?: boolean; avatarColor?: string; isTreeItem?: boolean; isLastTreeItem?: boolean; isDoubleTreeItem?: boolean; iconColor?: string;
}) {
  return (
    <Link
      href={href}
      onClick={(e) => {
        if (onClick) onClick(e);
      }}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '8px 16px', paddingLeft: indent ? (isDoubleTreeItem ? '66px' : (isTreeItem ? '46px' : '40px')) : '16px',
        borderRadius: 16,
        color: active ? '#ffffff' : '#9a9a9a',
        background: 'transparent',
        textDecoration: 'none',
        outline: 'none',
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
      {isTreeItem && (
        <>
          <div style={{
            position: 'absolute',
            left: 24,
            top: 0,
            bottom: isLastTreeItem && !isDoubleTreeItem ? '50%' : -2,
            borderLeft: '1px solid rgba(255,255,255,0.15)',
            borderBottomLeftRadius: isLastTreeItem && !isDoubleTreeItem ? 12 : 0,
            zIndex: 0
          }} />
          {!isDoubleTreeItem && (
            <>
              <div style={{
                position: 'absolute',
                left: 24,
                top: '50%',
                width: 10,
                borderTop: '1px solid rgba(255,255,255,0.15)',
                zIndex: 0
              }} />
              <div style={{
                position: 'absolute',
                left: 34,
                top: '50%',
                transform: 'translateY(-50%)',
                width: 4,
                height: 4,
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.2)',
                zIndex: 0
              }} />
            </>
          )}
        </>
      )}
      {isDoubleTreeItem && (
        <>
          <div style={{
            position: 'absolute',
            left: 24,
            top: 0,
            bottom: -2,
            borderLeft: '1px solid rgba(255,255,255,0.15)',
            zIndex: 0
          }} />
          <div style={{
            position: 'absolute',
            left: 44,
            top: 0,
            bottom: isLastTreeItem ? '50%' : -2,
            borderLeft: '1px solid rgba(255,255,255,0.15)',
            borderBottomLeftRadius: isLastTreeItem ? 12 : 0,
            zIndex: 0
          }} />
          <div style={{
            position: 'absolute',
            left: 44,
            top: '50%',
            width: 10,
            borderTop: '1px solid rgba(255,255,255,0.15)',
            zIndex: 0
          }} />
          <div style={{
            position: 'absolute',
            left: 54,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 4,
            height: 4,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.2)',
            zIndex: 0
          }} />
        </>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, zIndex: 1, position: 'relative' }}>
        {isMessage ? (
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111', fontWeight: 800, fontSize: 11 }}>
            {label.substring(0, 1)}
          </div>
        ) : (
          Icon && (
            iconColor ? (
              <div style={{ width: 30, height: 30, borderRadius: 8, background: active ? `${iconColor}30` : `${iconColor}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `1px solid ${iconColor}${active ? '40' : '20'}` }}>
                <Icon size={16} strokeWidth={2.5} color={iconColor} />
              </div>
            ) : (
              <Icon size={21} strokeWidth={2} style={{ color: active ? '#ffffff' : '#777777' }} fill={active ? '#ffffff' : 'transparent'} />
            )
          )
        )}
        <span style={{ fontSize: 21, fontWeight: 600, letterSpacing: '0.1px' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, zIndex: 1, position: 'relative' }}>
        {badge ? (
          <span style={{
            background: badgeColor, color: '#ffffff',
            fontSize: 11, fontWeight: 700,
            padding: '0 7px', borderRadius: 4,
            height: 20, minWidth: 22,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 0 8px rgba(255, 255, 255, 0.4)',
            border: '1px solid rgba(255, 255, 255, 0.5)',
            textShadow: '0 1px 2px rgba(0,0,0,0.8)'
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

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar({ 
  hidden,
  zoom,
  onZoomIn,
  onZoomOut,
  onReset,
  onHide,
}: {
  hidden?: boolean;
  zoom?: number;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onReset?: () => void;
  onHide?: () => void;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAdmin, refreshUser } = useAuth();
  const currentAnalistaPage = searchParams?.get('analista') || 'PDV';
  const { pendingReminders } = useRecordatorios();
  const { setIsCreationModalOpen, showFilters, setShowFilters, pageSize, setPageSize, filters, limpiarFiltros, toggleEstado, setFilter } = useFilter();
  const { permisosConfig, alertasConfig } = useSettings();
  const { nombres: analistaNombres } = useAnalistas();
  const { registros } = useRegistros(true);

  // Los badges cuentan solo los registros que superan el límite de días configurado en alertas
  const countsByState = useMemo(() => {
    const counts: Record<string, number> = {};
    const nowTime = new Date().getTime();
    for (const r of registros) {
      if (!r.estado) continue;
      const key = r.estado.toLowerCase();
      const config = alertasConfig?.find(a => a.estado.toLowerCase() === key);
      if (config) {
        const dateStr = r.fecha || r.created_at;
        if (!dateStr) continue;
        const daysDiff = Math.floor((nowTime - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
        if (daysDiff < config.dias) continue;
      }
      counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [registros, alertasConfig]);

  const canCreate = isAdmin || permisosConfig.find(p => p.rol === 'analista' && p.permiso === 'crear_registros')?.activo !== false;

  const [showAdminModal, setShowAdminModal] = useState(false);
  const [showXlsxModal, setShowXlsxModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const pageSizeSelectorRef = useRef<HTMLDivElement>(null);
  const isRegistros = pathname === '/registros';
  const [showPageSizeSelector, setShowPageSizeSelector] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);
  const [reportesOpen, setReportesOpen] = useState(false);
  const [ventasOpen, setVentasOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [registrosOpen, setRegistrosOpen] = useState(false);

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

  useEffect(() => {
    setShowFilters(false);
    setShowCalculator(false);
  }, [pathname, setShowFilters]);

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
    <aside className={`main-sidebar ${hidden ? 'sidebar-hidden' : ''}`}
      style={{
        // Sidebar fija (no escala con el zoom del contenido).
        '--current-zoom': 1,
        background: 'transparent',
        borderRight: 'none',
        boxShadow: 'none',
        display: 'flex', flexDirection: 'row',
        alignItems: 'stretch',
        width: 'var(--sidebar-width)',
        zIndex: 150,
        position: 'relative',
        transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
      } as React.CSSProperties}
    >
      {/* Pestaña flotante para cerrar la sidebar (espejo de la pestaña de abrir) */}
      {onHide && (!showFilters && !showCalculator) && (
        <button
          onClick={onHide}
          title="Ocultar menú"
          style={{
            position: 'absolute', top: '50%', right: 0, zIndex: 300,
            transform: 'translateY(-50%)',
            background: 'var(--bg-elev-1)',
            border: '1px solid rgba(255,255,255,0.1)', borderRight: 'none',
            borderRadius: '12px 0 0 12px',
            width: 28, height: 56,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', cursor: 'pointer',
            boxShadow: '-4px 0 24px rgba(0,0,0,0.5)',
            transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
          onMouseEnter={e => { e.currentTarget.style.width = '36px'; e.currentTarget.style.background = 'var(--bg-elev-2)'; }}
          onMouseLeave={e => { e.currentTarget.style.width = '28px'; e.currentTarget.style.background = 'var(--bg-elev-1)'; }}
        >
          <ChevronLeft size={18} strokeWidth={3} />
        </button>
      )}
      <div style={{
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        width: '100%',
        height: '100%',
        transformOrigin: 'top left',
      }}>
      {/* Text + Icon Column — tamaño de letra fijo; scrollea si no entra en el alto */}
      <div className="hide-scrollbar" style={{
        width: 'var(--sidebar-width)',
        display: (showFilters || showCalculator) ? 'none' : 'block',
        flexShrink: 0,
        borderRight: 'none',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>
        <div style={{
          minHeight: '100%',
          display: 'flex', flexDirection: 'column',
          padding: '2px 16px 20px',
        }}>


        {/* Header MENU */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8, paddingLeft: 16, paddingRight: 8 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: '#555', letterSpacing: '1px' }}>MENU</div>
        </div>

        {/* Highlight Action (Like Personal/Business switch) */}
        {canCreate && (
          <div style={{ marginBottom: 8 }}>
            <div style={{
              background: 'transparent', borderRadius: 16, display: 'flex', alignItems: 'center'
            }}>
              <button
                onClick={() => {
                  if (pathname !== '/registros') {
                    router.push('/registros?create=true');
                  } else {
                    setIsCreationModalOpen(true);
                  }
                }}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 12,
                  background: '#10b981', color: '#000',
                  border: 'none', boxShadow: '0 4px 12px rgba(16, 185, 129, 0.15)',
                  fontSize: 15, fontWeight: 700, cursor: 'pointer', transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
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
          <NavItem
            href="#"
            icon={Database}
            iconColor="#10b981"
            label="Registros"
            active={pathname === '/registros'}
            onClick={(e) => { e.preventDefault(); setRegistrosOpen(!registrosOpen); }}
            rightIcon={registrosOpen ? ChevronUp : ChevronDown}
          />
          {registrosOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <NavItem href="/registros" icon={AlignJustify} label="Total" active={pathname === '/registros' && filters.analista === ''} onClick={() => { limpiarFiltros(); }} indent isTreeItem />
              {analistaNombres.map(nombre => (
                <NavItem
                  key={nombre}
                  href="/registros"
                  icon={Users}
                  label={nombre}
                  active={pathname === '/registros' && filters.analista.toLowerCase() === nombre.toLowerCase() && filters.estados.length === 0}
                  onClick={() => { limpiarFiltros(); setFilter('analista', nombre); }}
                  indent
                  isTreeItem
                />
              ))}
              <NavItem
                href="#"
                icon={FolderSearch}
                iconColor="#f472b6"
                label="Clientes en revisión" 
                onClick={(e) => { e.preventDefault(); setRevisionOpen(!revisionOpen); }} 
                indent 
                isTreeItem 
                isLastTreeItem={!revisionOpen}
                rightIcon={revisionOpen ? ChevronUp : ChevronDown}
              />
              {revisionOpen && REGISTRO_STATES.map((s, idx) => (
                <NavItem 
                  key={s.value}
                  href="/registros" 
                  label={s.label} 
                  isMessage
                  avatarColor={s.color}
                  badge={countsByState[s.value] > 0 ? countsByState[s.value] : undefined} 
                  badgeColor="rgba(255,255,255,0.1)" 
                  active={pathname === '/registros' && filters.revisionMode && filters.estados.includes(s.value)}
                  onClick={() => { limpiarFiltros(); toggleEstado(s.value); setFilter('revisionMode', true); }}
                  indent
                  isDoubleTreeItem 
                  isLastTreeItem={idx === REGISTRO_STATES.length - 1 && !(pathname === '/registros' && filters.estados.length === 0)} 
                />
              ))}
            </div>
          )}



        </div>

        {/* Reports Submenu */}
        <div style={{ marginTop: 2, display: 'flex', flexDirection: 'column', gap: 0 }}>
          <NavItem
            href="#"
            icon={BarChart2}
            iconColor="#3b82f6"
            label="Reportes"
            active={pathname.includes('/reportes') || pathname.includes('/analistas')}
            onClick={(e) => { e.preventDefault(); setReportesOpen(!reportesOpen); }}
            rightIcon={reportesOpen ? ChevronUp : ChevronDown}
            badge={reportesOpen ? '' : '3'}
            badgeColor="#484B52"
          />
          {reportesOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <NavItem 
                href="/analistas?analista=PDV" 
                icon={TrendingUp} 
                iconColor="#8b5cf6"
                label="Ventas" 
                active={pathname === '/analistas'} 
                indent 
                isTreeItem 
                onClick={(e) => { e.preventDefault(); setVentasOpen(!ventasOpen); }}
                rightIcon={ventasOpen ? ChevronUp : ChevronDown}
              />
              {ventasOpen && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  <NavItem href="/analistas?analista=PDV" icon={TrendingUp} label="PDV" active={pathname === '/analistas' && currentAnalistaPage === 'PDV'} indent isDoubleTreeItem />
                  {analistaNombres.map((nombre, idx) => (
                    <NavItem
                      key={nombre}
                      href={`/analistas?analista=${encodeURIComponent(nombre)}`}
                      icon={TrendingUp}
                      label={nombre}
                      active={pathname === '/analistas' && currentAnalistaPage === nombre}
                      indent
                      isDoubleTreeItem
                      isLastTreeItem={idx === analistaNombres.length - 1}
                    />
                  ))}
                </div>
              )}
              <NavItem href="/reportes/cobranzas" icon={DollarSign} iconColor="#f59e0b" label="Cobranzas" active={pathname === '/reportes/cobranzas'} indent isTreeItem isLastTreeItem />
            </div>
          )}
        </div>

        <div style={{ marginTop: 2, display: 'flex', flexDirection: 'column', gap: 0 }}>
          {pathname === '/registros' && filters.estados.length === 0 && (
            <NavItem 
              href="#" 
              icon={SlidersHorizontal} 
              iconColor="#a855f7"
              label="Filtros Avanzados" 
              active={showFilters} 
              onClick={(e) => { e.preventDefault(); setShowFilters(!showFilters); setShowCalculator(false); }} 
            />
          )}
          <NavItem href="/recordatorios" icon={Bell} iconColor="#ef4444" label="Notificaciones" active={pathname === '/recordatorios'} badge={pendingReminders > 0 ? pendingReminders : undefined} badgeColor="#10b981" />

          {isRegistros && (
            <div style={{ position: 'relative' }} ref={pageSizeSelectorRef}>
              <NavItem 
                href="#" 
                icon={AlignJustify} 
                iconColor="#06b6d4"
                label={`Mostrar: ${pageSize} reg.`} 
                onClick={(e) => { e.preventDefault(); setShowPageSizeSelector(!showPageSizeSelector); }} 
                rightIcon={showPageSizeSelector ? ChevronUp : ChevronDown}
              />
              {showPageSizeSelector && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '16px',
                  right: '16px',
                  background: 'var(--bg-elev-2)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '12px',
                  padding: '8px',
                  zIndex: 200,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.8)',
                  animation: 'fadeIn 0.2s ease-out'
                }}>
                  {[25, 50, 100, 200].map(size => (
                    <div
                      key={size}
                      onClick={() => { setPageSize(size); setShowPageSizeSelector(false); }}
                      style={{
                        padding: '10px 16px',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '13px',
                        fontWeight: pageSize === size ? 800 : 500,
                        color: pageSize === size ? '#86efac' : '#fff',
                        background: pageSize === size ? 'rgba(134,239,172,0.1)' : 'transparent',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={e => { if (pageSize !== size) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                      onMouseLeave={e => { if (pageSize !== size) e.currentTarget.style.background = 'transparent' }}
                    >
                      {size} registros
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div style={{ flex: 1, minHeight: 12 }} />

        <div style={{ marginTop: 2, display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 8 }}>
          {isAdmin ? (
            <>
              <NavItem href="#" icon={Calculator} label="Calculadora" active={showCalculator} onClick={(e) => { e.preventDefault(); setShowCalculator(!showCalculator); setShowFilters(false); }} />
              <NavItem href="#" icon={FileSpreadsheet} iconColor="#10b981" label="Descargar XLSX" onClick={(e) => { e.preventDefault(); setShowXlsxModal(true); }} />
              <NavItem href="/ajustes" icon={Settings} label="Ajustes" active={pathname.startsWith('/ajustes')} />
            </>
          ) : (
            <div style={{ opacity: 0.5 }}>
              <NavItem 
                href="#" 
                icon={Lock} 
                label="Acceso Admin" 
                onClick={(e) => { e.preventDefault(); setShowAdminModal(true); }} 
              />
            </div>
          )}
        </div>

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
      </div>

      {/* Expanded Filters Panel */}
      {showFilters && (
        <div style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          background: 'var(--bg-elev-1)',
          borderLeft: '1px solid rgba(255,255,255,0.05)',
          borderTopRightRadius: '24px',
          borderBottomRightRadius: '24px',
          overflow: 'hidden',
          animation: 'slideInLeft 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
        }}>
          <div style={{
            padding: '18px 20px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ display: 'inline-block', fontSize: '20px', fontWeight: 600, color: '#ffffff', paddingBottom: '7px', backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.5), rgba(255,255,255,0))', backgroundSize: '50% 1px', backgroundPosition: 'left bottom', backgroundRepeat: 'no-repeat', textShadow: '0 0 8px rgba(255,255,255,0.18)' }}>Filtros Avanzados</span>
            <button onClick={() => setShowFilters(false)} style={{ background: 'transparent', border: 'none', color: '#90929a', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '16px 20px' }}>
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
          borderTopRightRadius: '24px',
          borderBottomRightRadius: '24px',
          overflow: 'hidden',
          animation: 'slideInLeft 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
        }}>
          <div style={{
            padding: '18px 20px 14px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontSize: '17px', fontWeight: 600, color: '#ffffff' }}>Calculadora Sucursal B</span>
            <button onClick={() => setShowCalculator(false)} style={{ background: 'transparent', border: 'none', color: '#90929a', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>

          <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: '16px 20px' }}>
            <CalculadoraContent />
          </div>
        </div>
      )}
      </div>

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

      <ExportXlsxModal open={showXlsxModal} onClose={() => setShowXlsxModal(false)} />
    </aside>
  );
}

// ── Components for expanded filters ──────────────────────────────────────────

// Dropdown custom (mismo look que los demás campos del panel, sin el estilo nativo del SO).
const CustomSelect = ({ value, onChange, options, placeholder }: {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false); };
    if (isOpen) document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [isOpen]);

  const select = (v: string) => { onChange(v); setIsOpen(false); };

  const optStyle = (active: boolean): React.CSSProperties => ({
    padding: '10px 10px', fontSize: '16px', borderRadius: '6px', cursor: 'pointer', margin: '2px 0',
    color: active ? '#10b981' : '#eaeaea',
    background: active ? 'rgba(16,185,129,0.1)' : 'transparent',
    transition: 'background 0.15s'
  });

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <div
        tabIndex={0}
        onClick={() => setIsOpen(o => !o)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsOpen(o => !o); }
          if (e.key === 'Escape') setIsOpen(false);
        }}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          width: '100%', height: 42, padding: '0 12px',
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${isOpen ? 'rgba(16,185,129,0.4)' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: '8px', fontSize: '16.5px',
          color: value ? '#eaeaea' : '#8f929d',
          cursor: 'pointer', outline: 'none', transition: 'all 0.2s'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value || placeholder}</span>
        <ChevronDown size={14} style={{ flexShrink: 0, marginLeft: 8, opacity: 0.5, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0,
          background: '#0c0c0c', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.6)', zIndex: 1000, padding: '4px',
          maxHeight: 240, overflowY: 'auto'
        }}>
          <div onClick={() => select('')} style={optStyle(value === '')}
            onMouseEnter={e => { if (value !== '') e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = value === '' ? 'rgba(16,185,129,0.1)' : 'transparent'; }}
          >{placeholder}</div>
          {options.map(opt => (
            <div key={opt} onClick={() => select(opt)} style={optStyle(opt === value)}
              onMouseEnter={e => { if (opt !== value) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = opt === value ? 'rgba(16,185,129,0.1)' : 'transparent'; }}
            >{opt}</div>
          ))}
        </div>
      )}
    </div>
  );
};

const FiltersContent = () => {
  const { filters, setFilter, toggleEstado, toggleAcuerdoPrecios, limpiarFiltros, hayFiltros } = useFilter();
  const { nombres: analistaNombres } = useAnalistas();
  const { registros } = useRegistros();
  const allAcuerdos = React.useMemo(() => {
    const set = new Set<string>();
    registros.forEach(r => { if (r.acuerdo_precios) set.add(r.acuerdo_precios); });
    return Array.from(set).sort();
  }, [registros]);

  const chipStyle = (active: boolean) => ({
    padding: '6px 10px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
    background: active ? 'rgba(16, 185, 129, 0.15)' : 'rgba(255,255,255,0.02)',
    color: active ? '#10b981' : '#8f929d',
    border: `1px solid ${active ? 'rgba(16, 185, 129, 0.3)' : 'rgba(255,255,255,0.06)'}`,
    transition: 'all 0.2s', whiteSpace: 'nowrap', textAlign: 'center'
  } as React.CSSProperties);

  const secLabel: React.CSSProperties = { display: 'inline-block', fontSize: '13px', color: '#ffffff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: '5px', paddingBottom: '3px', backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.5), rgba(255,255,255,0))', backgroundSize: '50% 1px', backgroundPosition: 'left bottom', backgroundRepeat: 'no-repeat', textShadow: '0 0 6px rgba(255,255,255,0.18)', lineHeight: 1.05 };
  const fieldBase: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '16.5px' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', justifyContent: 'space-between', gap: '10px', paddingBottom: '4px' }}>
      <div>
        <label style={secLabel}>BÚSQUEDA GENERAL</label>
        <input
          placeholder="Nombre, CUIL..."
          value={filters.search}
          onChange={e => setFilter('search', e.target.value)}
          style={{ ...fieldBase, width: '100%', height: 42, padding: '0 12px', color: '#eaeaea', outline: 'none' }}
        />
      </div>

      <div>
        <label style={secLabel}>ANALISTA</label>
        <CustomSelect
          value={filters.analista}
          onChange={v => setFilter('analista', v)}
          options={analistaNombres}
          placeholder="Todos los analistas"
        />
      </div>

      <div>
        <label style={secLabel}>ESTADOS</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
          {ESTADOS.map(st => (
            <span key={st} onClick={() => toggleEstado(st)} style={chipStyle(filters.estados.includes(st))}>{STATUS_LABEL[st] || st}</span>
          ))}
          <span
            onClick={() => setFilter('esRe', filters.esRe === 'si' ? '' : 'si')}
            style={{
              padding: '6px 10px', borderRadius: '8px', fontSize: '14px', fontWeight: 700, cursor: 'pointer',
              background: filters.esRe === 'si' ? 'rgba(167,139,250,0.18)' : 'rgba(255,255,255,0.02)',
              color: filters.esRe === 'si' ? '#a78bfa' : '#8f929d',
              border: `1px solid ${filters.esRe === 'si' ? 'rgba(167,139,250,0.4)' : 'rgba(255,255,255,0.06)'}`,
              transition: 'all 0.2s', whiteSpace: 'nowrap', textAlign: 'center',
            }}
          >RE (Resumen ejecutivo)</span>
        </div>
      </div>

      <div>
        <label style={secLabel}>ACUERDO DE PRECIOS</label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '6px' }}>
          {allAcuerdos.length > 0 ? allAcuerdos.map(a => (
            <span key={a} onClick={() => toggleAcuerdoPrecios(a)} style={chipStyle(filters.acuerdoPrecios.includes(a))}>{a}</span>
          )) : <span style={{ fontSize: '11px', color: '#64748b' }}>Sin acuerdos registrados</span>}
        </div>
      </div>

      <div>
        <label style={secLabel}>SCORE MIN/MAX</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="number" placeholder="Mín" value={filters.scoreMin} onChange={e => setFilter('scoreMin', e.target.value)} style={{ ...fieldBase, flex: 1, minWidth: 0, height: 42, padding: '0 12px', color: '#eaeaea', outline: 'none' }} />
          <input type="number" placeholder="Máx" value={filters.scoreMax} onChange={e => setFilter('scoreMax', e.target.value)} style={{ ...fieldBase, flex: 1, minWidth: 0, height: 42, padding: '0 12px', color: '#eaeaea', outline: 'none' }} />
        </div>
      </div>

      <div>
        <label style={secLabel}>MONTO MIN/MAX</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="number" placeholder="Mín" value={filters.montoMin} onChange={e => setFilter('montoMin', e.target.value)} style={{ ...fieldBase, flex: 1, minWidth: 0, height: 42, padding: '0 12px', color: '#eaeaea', outline: 'none' }} />
          <input type="number" placeholder="Máx" value={filters.montoMax} onChange={e => setFilter('montoMax', e.target.value)} style={{ ...fieldBase, flex: 1, minWidth: 0, height: 42, padding: '0 12px', color: '#eaeaea', outline: 'none' }} />
        </div>
      </div>

      <div>
        <label style={secLabel}>PERÍODO</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="date" value={filters.fechaDesde} onChange={e => setFilter('fechaDesde', e.target.value)} style={{ ...fieldBase, flex: 1, minWidth: 0, height: 42, padding: '0 10px', color: '#eaeaea', outline: 'none', colorScheme: 'dark' }} />
          <input type="date" value={filters.fechaHasta} onChange={e => setFilter('fechaHasta', e.target.value)} style={{ ...fieldBase, flex: 1, minWidth: 0, height: 42, padding: '0 10px', color: '#eaeaea', outline: 'none', colorScheme: 'dark' }} />
        </div>
      </div>

      <button
        onClick={limpiarFiltros}
        disabled={!hayFiltros}
        style={{
          width: '100%', padding: '10px', background: 'rgba(248,113,113,0.06)',
          border: '1px solid rgba(248,113,113,0.12)', color: '#ff3366', borderRadius: '10px',
          fontSize: '13px', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px',
          cursor: hayFiltros ? 'pointer' : 'not-allowed', opacity: hayFiltros ? 1 : 0.45,
          transition: 'all 0.2s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px'
        }}
        onMouseEnter={e => { if (hayFiltros) e.currentTarget.style.background = 'rgba(248,113,113,0.12)'; }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.06)'; }}
      >
        <X size={14} strokeWidth={3} /> Limpiar Filtros
      </button>
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

  const secLabel: React.CSSProperties = { display: 'inline-block', fontSize: '13px', color: '#ffffff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.9px', marginBottom: '5px', paddingBottom: '3px', backgroundImage: 'linear-gradient(90deg, rgba(255,255,255,0.5), rgba(255,255,255,0))', backgroundSize: '50% 1px', backgroundPosition: 'left bottom', backgroundRepeat: 'no-repeat', textShadow: '0 0 6px rgba(255,255,255,0.18)', lineHeight: 1.05 };
  const fieldBase: React.CSSProperties = { background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '16.5px' };

  const inputRow = (label: string, key: keyof typeof pacts) => (
    <div style={{
      background: 'rgba(255,255,255,0.015)',
      padding: '12px 14px',
      borderRadius: '12px',
      border: '1px solid rgba(255,255,255,0.03)',
      transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
    }}
    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.015)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.03)'; e.currentTarget.style.transform = 'none'; }}
    >
      <label style={{ display: 'block', fontSize: '9.5px', color: '#9ca3af', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px', marginBottom: '8px' }}>{label} (%)</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <input
          type="number"
          placeholder="0"
          value={pacts[key]}
          onChange={e => setPacts(p => ({ ...p, [key]: e.target.value }))}
          style={{ ...fieldBase, width: '70px', height: 38, textAlign: 'center', color: '#fff', outline: 'none', fontWeight: 600, background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)' }}
        />
        <div style={{ flex: 1, textAlign: 'right', fontSize: 13.5, fontWeight: 700, color: results[key] > 0 ? '#34d399' : '#4b5563', transition: 'color 0.2s' }}>
          {results[key] > 0 ? `$ ${results[key].toLocaleString('es-AR')}` : '—'}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', paddingBottom: '4px' }}>
      <div>
        <label style={{ ...secLabel, color: '#fb923c', backgroundImage: 'linear-gradient(90deg, rgba(251,146,60,0.5), rgba(251,146,60,0))' }}>VENTA</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {inputRow('Capital', 'capital')}
          {inputRow('Operación', 'operacion')}
        </div>
      </div>

      <div>
        <label style={{ ...secLabel, color: '#00d4ff', backgroundImage: 'linear-gradient(90deg, rgba(0,212,255,0.5), rgba(0,212,255,0))' }}>COBRANZAS</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {inputRow('Recupero 90-119', 'recupero90')}
          {inputRow('Recupero 120-209', 'recupero120')}
          {inputRow('REFI', 'refi')}
        </div>
      </div>

      <div style={{ marginTop: 'auto', padding: '18px 16px', background: 'rgba(0,0,0,0.15)', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '10px', boxShadow: 'inset 0 2px 10px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Sueldo Fijo</span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#e5e7eb' }}>$ {SUELDO_FIJO.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 10.5, fontWeight: 800, color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Comisiones</span>
          <span style={{ fontSize: 13.5, fontWeight: 700, color: '#34d399' }}>$ {comisiones.toLocaleString('es-AR')}</span>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '4px 0' }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 11, fontWeight: 900, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Total Cobrar</span>
          <span style={{ fontSize: 19, fontWeight: 900, background: 'linear-gradient(135deg, #ffffff, #a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.5px' }}>$ {totalGeneral.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
        </div>
        <div style={{ fontSize: 9.5, color: '#6b7280', textAlign: 'right', fontWeight: 600, marginTop: '2px', letterSpacing: '0.5px' }}>SUCURSAL B</div>
      </div>
    </div>
  );
};


