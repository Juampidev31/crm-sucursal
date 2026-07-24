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
  DollarSign, Settings, Lock, Plus,
  SlidersHorizontal, ChevronDown, ChevronUp, ChevronLeft, X, Calculator,
  ZoomIn, ZoomOut, FileSpreadsheet, Users, Database, TrendingUp, FolderSearch,
  UserCheck, Bell, Tag
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { setSession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
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
  const { isAdmin, user, refreshUser } = useAuth();
  const currentAnalistaPage = searchParams?.get('analista') || 'PDV';
  const { setIsCreationModalOpen, showFilters, setShowFilters, pageSize, setPageSize, filters, limpiarFiltros, toggleEstado, setFilter } = useFilter();
  const { permisosConfig, alertasConfig } = useSettings();
  const { nombres: analistaNombres } = useAnalistas();
  const { registros } = useRegistros(true);

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
  const [recordatorios, setRecordatorios] = useState<any[]>([]);

  useEffect(() => {
    const fetchRecs = () => {
      supabase
        .from('recordatorios')
        .select('id, nombre, nota, fecha_hora')
        .eq('mostrado', false)
        .order('fecha_hora', { ascending: true })
        .then(({ data }) => {
          if (data) setRecordatorios(data);
        });
    };

    fetchRecs();

    const channel = supabase
      .channel('recordatorios-sidebar')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recordatorios' }, fetchRecs)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const etiquetasList = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of registros) {
      for (const et of (r as any).etiquetas || []) {
        map.set(et, (map.get(et) || 0) + 1);
      }
    }
    const colors: Record<string, string> = {
      'Nuevo': '#34d399', 'Contactado': '#60a5fa', 'Interesado': '#f59e0b',
      'No responde': '#f87171', 'No interesa': '#a78bfa', 'Llamar': '#f472b6',
    };
    return Array.from(map.entries()).map(([name, count]) => ({
      name, count,
      color: colors[name] || '#94a3b8',
    })).sort((a, b) => b.count - a.count);
  }, [registros]);

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

  const [activeHover, setActiveHover] = useState<string | null>(null);
  const hoverTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = (key: string) => {
    if (hoverTimeout.current) clearTimeout(hoverTimeout.current);
    setActiveHover(key);
  };

  const handleMouseLeave = () => {
    hoverTimeout.current = setTimeout(() => {
      setActiveHover(null);
    }, 180);
  };

  const flyoutStyle: React.CSSProperties = {
    position: 'absolute',
    left: 74,
    zIndex: 500,
    background: 'rgba(14, 14, 18, 0.96)',
    backdropFilter: 'blur(20px)',
    WebkitBackdropFilter: 'blur(20px)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    padding: '16px',
    minWidth: 230,
    boxShadow: '0 20px 50px rgba(0,0,0,0.9), 0 0 30px rgba(16, 185, 129, 0.08)',
    animation: 'flyoutPopIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
  };

  return (
    <>
      <style>{`
        @keyframes flyoutPopIn {
          0% { opacity: 0; transform: translateX(-12px) scale(0.95); }
          100% { opacity: 1; transform: translateX(0) scale(1); }
        }
        @keyframes slidePanelIn {
          0% { opacity: 0; transform: translateX(-20px); }
          100% { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <aside className={`main-sidebar ${hidden ? 'sidebar-hidden' : ''}`}
        style={{
          '--current-zoom': 1,
          '--sidebar-width': showFilters ? '340px' : showCalculator ? '370px' : '68px',
          background: 'transparent',
          boxShadow: 'none',
          display: 'flex', flexDirection: 'row',
          alignItems: 'stretch',
          zIndex: 150,
          position: 'relative',
          flexShrink: 0,
          transition: 'all 0.3s cubic-bezier(0.25, 1, 0.5, 1)',
          height: '100%',
        } as React.CSSProperties}
      >
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
          flex: 1,
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'stretch',
          height: '100%',
          minWidth: 0,
        }}>
          {/* ── Fixed 68px Vertical Icon Strip ── */}
          {!showFilters && !showCalculator && (
            <div
              style={{
                width: 68,
                minWidth: 68,
                background: 'var(--bg-elev-1)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '8px 0 12px',
                height: '100%',
                boxSizing: 'border-box',
                position: 'relative',
                zIndex: 10,
                overflow: 'visible',
              }}
            >
            {/* 0. Nuevo Registro */}
            {canCreate && (
              <div
                onMouseEnter={() => handleMouseEnter('nuevo')}
                onMouseLeave={handleMouseLeave}
                style={{ position: 'relative', marginBottom: 12 }}
              >
                <button
                  type="button"
                  onClick={() => {
                    if (pathname !== '/registros') {
                      router.push('/registros?create=true');
                    } else {
                      setIsCreationModalOpen(true);
                    }
                  }}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: '#10b981',
                    border: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#09090b',
                    cursor: 'pointer',
                    transition: 'all 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                    boxShadow: '0 4px 16px rgba(16, 185, 129, 0.35)',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.background = '#059669';
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(16, 185, 129, 0.5)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background = '#10b981';
                    e.currentTarget.style.color = '#09090b';
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(16, 185, 129, 0.35)';
                  }}
                >
                  <Plus size={26} strokeWidth={2.8} />
                </button>
                {activeHover === 'nuevo' && (
                  <div style={{ ...flyoutStyle, top: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#34d399', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Nuevo Registro
                    </div>
                    <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
                      Agregar un nuevo cliente o lead al sistema.
                    </div>
                  </div>
                )}
              </div>
            )}

            <div style={{ width: 36, height: 1, background: 'rgba(255, 255, 255, 0.08)', marginBottom: 12 }} />
            {/* 1. Registros */}
            <div
              onMouseEnter={() => handleMouseEnter('registros')}
              onMouseLeave={handleMouseLeave}
              style={{ position: 'relative' }}
            >
              <button
                type="button"
                onClick={() => {
                  limpiarFiltros();
                  if (pathname !== '/registros') router.push('/registros');
                }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: pathname === '/registros' ? 'rgba(16, 185, 129, 0.18)' : 'transparent',
                  border: pathname === '/registros' ? '1px solid #10b981' : '1px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: pathname === '/registros' ? '#34d399' : 'rgba(255, 255, 255, 0.65)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                  if (pathname !== '/registros') {
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                  }
                }}
                onMouseLeave={e => {
                  if (pathname !== '/registros') {
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
                title=""
              >
                <Database size={24} />
              </button>

              {activeHover === 'registros' && (
                <div
                  onMouseEnter={() => { if (hoverTimeout.current) clearTimeout(hoverTimeout.current); }}
                  onMouseLeave={handleMouseLeave}
                  style={{ ...flyoutStyle, top: 0, minWidth: 250 }}
                >
                  <div style={{ fontSize: 11, fontWeight: 900, color: '#34d399', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '1px' }}>
                    Registros
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    <button
                      onClick={() => {
                        limpiarFiltros();
                        if (pathname !== '/registros') router.push('/registros');
                      }}
                      style={{
                        background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)',
                        color: '#fff', fontSize: 13, textAlign: 'left', padding: '8px 12px', borderRadius: 8,
                        cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8,
                        transition: 'all 0.2s ease'
                      }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(16,185,129,0.12)'; e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.05)'; }}
                    >
                      <span>📊</span> Todos los Registros
                    </button>

                    <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 0' }} />
                    <div style={{ fontSize: 10, fontWeight: 900, color: '#f472b6', padding: '2px 4px 4px', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                      Clientes en Revisión
                    </div>

                    {REGISTRO_STATES.map(s => {
                      const count = countsByState[s.value] || 0;
                      return (
                        <button
                          key={s.value}
                          onClick={() => {
                            limpiarFiltros();
                            toggleEstado(s.value);
                            setFilter('revisionMode', true);
                            if (pathname !== '/registros') router.push('/registros');
                          }}
                          style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            background: 'transparent', border: '1px solid transparent', color: 'rgba(255,255,255,0.7)',
                            fontSize: 12, textAlign: 'left', padding: '6px 10px', borderRadius: 8, cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                            e.currentTarget.style.color = '#fff';
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.background = 'transparent';
                            e.currentTarget.style.color = 'rgba(255,255,255,0.7)';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color, boxShadow: `0 0 6px ${s.color}` }} />
                            <span>{s.label}</span>
                          </div>
                          {count > 0 && (
                            <span style={{ background: 'rgba(255,255,255,0.08)', color: '#fff', fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 4 }}>
                              {count}
                            </span>
                          )}
                        </button>
                      );
                    })}

                    {isAdmin && (
                      <>
                        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)', margin: '6px 0' }} />
                        <button
                          onClick={() => router.push('/duplicados')}
                          style={{
                            background: 'rgba(251,191,36,0.06)', border: '1px solid rgba(251,191,36,0.15)',
                            color: '#fbbf24', fontSize: 12, textAlign: 'left', padding: '7px 10px', borderRadius: 8,
                            cursor: 'pointer', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8,
                            transition: 'all 0.2s ease'
                          }}
                          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(251,191,36,0.15)'; e.currentTarget.style.borderColor = 'rgba(251,191,36,0.3)'; }}
                          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(251,191,36,0.06)'; e.currentTarget.style.borderColor = 'rgba(251,191,36,0.15)'; }}
                        >
                          <span>📁</span> Duplicados y Cartera
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ width: 36, height: 1, background: 'rgba(255, 255, 255, 0.08)', margin: '10px 0' }} />

            {/* 2. Reportes */}
            <div
              onMouseEnter={() => handleMouseEnter('reportes')}
              onMouseLeave={handleMouseLeave}
              style={{ position: 'relative' }}
            >
              <button
                type="button"
                onClick={() => router.push('/analistas?analista=PDV')}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: pathname.includes('/reportes') || pathname.includes('/analistas') ? 'rgba(59, 130, 246, 0.18)' : 'transparent',
                  border: pathname.includes('/reportes') || pathname.includes('/analistas') ? '1px solid #3b82f6' : '1px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: pathname.includes('/reportes') || pathname.includes('/analistas') ? '#3b82f6' : 'rgba(255, 255, 255, 0.65)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                  if (!pathname.includes('/reportes')) {
                    e.currentTarget.style.color = '#fff';
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                  }
                }}
                onMouseLeave={e => {
                  if (!pathname.includes('/reportes')) {
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <BarChart2 size={24} />
              </button>

              {activeHover === 'reportes' && (
                <div
                  onMouseEnter={() => { if (hoverTimeout.current) clearTimeout(hoverTimeout.current); }}
                  onMouseLeave={handleMouseLeave}
                  style={{ ...flyoutStyle, top: 0 }}
                >
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#60a5fa', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Reportes
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <button
                      onClick={() => router.push('/analistas?analista=PDV')}
                      style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 13, textAlign: 'left', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 8 }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <TrendingUp size={14} style={{ color: '#60a5fa' }} /> Reporte PDV
                    </button>
                    {analistaNombres.map(nombre => (
                      <button
                        key={nombre}
                        onClick={() => router.push(`/analistas?analista=${encodeURIComponent(nombre)}`)}
                        style={{ background: 'transparent', border: 'none', color: 'var(--fg-dim)', fontSize: 12.5, textAlign: 'left', padding: '5px 8px', borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#fff'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--fg-dim)'; }}
                      >
                        <UserCheck size={14} style={{ color: 'rgba(255,255,255,0.4)' }} /> {nombre}
                      </button>
                    ))}
                    <button
                      onClick={() => router.push('/reportes/cobranzas')}
                      style={{ background: 'transparent', border: 'none', color: '#f59e0b', fontSize: 12.5, textAlign: 'left', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', fontWeight: 600, marginTop: 4, display: 'flex', alignItems: 'center', gap: 8 }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(245,158,11,0.1)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <DollarSign size={14} style={{ color: '#f59e0b' }} /> Cobranzas
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ width: 36, height: 1, background: 'rgba(255, 255, 255, 0.08)', margin: '10px 0' }} />

            {/* 3. Filtros avanzados */}
            <div
              onMouseEnter={() => handleMouseEnter('filtros')}
              onMouseLeave={handleMouseLeave}
              style={{ position: 'relative' }}
            >
              <button
                type="button"
                onClick={() => {
                  setActiveHover(null);
                  setShowFilters(!showFilters);
                  setShowCalculator(false);
                }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: showFilters ? 'rgba(168, 85, 247, 0.22)' : 'transparent',
                  border: showFilters ? '1.5px solid #a855f7' : '1px solid transparent',
                  boxShadow: showFilters ? '0 0 16px rgba(168, 85, 247, 0.3)' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: showFilters ? '#c084fc' : 'rgba(255, 255, 255, 0.65)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                  if (!showFilters) {
                    e.currentTarget.style.color = '#c084fc';
                    e.currentTarget.style.background = 'rgba(168, 85, 247, 0.12)';
                  }
                }}
                onMouseLeave={e => {
                  if (!showFilters) {
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
                title=""
              >
                <SlidersHorizontal size={24} />
              </button>

              {activeHover === 'filtros' && !showFilters && (
                <div style={{ ...flyoutStyle, top: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#c084fc', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Filtros avanzados
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-dim)', lineHeight: 1.4 }}>
                    Abrir el panel completo para filtrar por Analista, Estado o Montos.
                  </div>
                </div>
              )}
            </div>

            <div style={{ width: 36, height: 1, background: 'rgba(255, 255, 255, 0.08)', margin: '10px 0' }} />

            {/* 4. Recordatorios & Etiquetas */}
            <div
              onMouseEnter={() => handleMouseEnter('recordatorios')}
              onMouseLeave={handleMouseLeave}
              style={{ position: 'relative' }}
            >
              <button
                type="button"
                onClick={() => {
                  if (pathname !== '/registros') router.push('/registros');
                }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'transparent',
                  border: '1px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255, 255, 255, 0.65)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.color = '#f59e0b';
                  e.currentTarget.style.background = 'rgba(245, 158, 11, 0.12)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <Bell size={20} />
              </button>

              {activeHover === 'recordatorios' && (
                <div style={{ ...flyoutStyle, bottom: 0, minWidth: 280 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#f59e0b', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Bell size={14} /> Recordatorios
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-dim)', lineHeight: 1.4, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {recordatorios.length === 0 ? (
                      <span style={{ fontStyle: 'italic', color: '#666' }}>Sin recordatorios pendientes</span>
                    ) : (
                      recordatorios.slice(0, 5).map(rec => (
                        <div key={rec.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <Bell size={12} style={{ color: '#f59e0b', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: '#fff', fontWeight: 600, fontSize: 12, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rec.nombre}</div>
                            {rec.nota && <div style={{ color: '#888', fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{rec.nota}</div>}
                          </div>
                          <div style={{ fontSize: 10, color: '#888', whiteSpace: 'nowrap' }}>{rec.fecha_hora ? new Date(rec.fecha_hora).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : ''}</div>
                        </div>
                      ))
                    )}
                    {recordatorios.length > 5 && (
                      <div style={{ fontSize: 11, color: '#888', textAlign: 'center', marginTop: 2 }}>+{recordatorios.length - 5} más</div>
                    )}
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#818cf8', margin: '14px 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag size={14} /> Etiquetas
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {etiquetasList.length === 0 ? (
                      <span style={{ fontStyle: 'italic', color: '#666', fontSize: 12 }}>Sin etiquetas</span>
                    ) : (
                      etiquetasList.map(et => (
                        <span key={et.name} style={{
                          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 6,
                          background: et.color + '20', border: '1px solid ' + et.color + '40',
                          color: et.color, letterSpacing: '0.3px'
                        }}>
                          {et.name} ({et.count})
                        </span>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            <div style={{ width: 36, height: 1, background: 'rgba(255, 255, 255, 0.08)', margin: '10px 0' }} />

            {/* 5. Mostrar */}
            <div
              onMouseEnter={() => handleMouseEnter('mostrar')}
              onMouseLeave={handleMouseLeave}
              style={{ position: 'relative' }}
            >
              <button
                type="button"
                onClick={() => {
                  const sizes = [25, 50, 100, 200];
                  const next = sizes[(sizes.indexOf(pageSize || 25) + 1) % sizes.length];
                  setPageSize(next);
                }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#34d399',
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = 'rgba(16, 185, 129, 0.15)';
                  e.currentTarget.style.transform = 'scale(1.05)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)';
                  e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {pageSize || 25}
              </button>

              {activeHover === 'mostrar' && (
                <div style={{ ...flyoutStyle, top: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#34d399', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Mostrar Registros
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-dim)', lineHeight: 1.4 }}>
                    Actualmente mostrando <strong>{pageSize || 25}</strong> filas por página. Hacé clic para cambiar a 25, 50, 100 o 200.
                  </div>
                </div>
              )}
            </div>

            <div style={{ flex: 1 }} />

            {/* 6. Calculadora (Solo Admin) */}
            {isAdmin && (
              <div
                onMouseEnter={() => handleMouseEnter('calculadora')}
                onMouseLeave={handleMouseLeave}
                style={{ position: 'relative', marginBottom: 8 }}
              >
                <button
                  type="button"
                  onClick={() => {
                    setShowCalculator(!showCalculator);
                    setShowFilters(false);
                  }}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: showCalculator ? 'rgba(0, 212, 255, 0.2)' : 'transparent',
                    border: showCalculator ? '1px solid #00d4ff' : '1px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: showCalculator ? '#00d4ff' : 'rgba(255, 255, 255, 0.65)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => {
                    if (!showCalculator) {
                      e.currentTarget.style.color = '#fff';
                      e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                    }
                  }}
                  onMouseLeave={e => {
                    if (!showCalculator) {
                      e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <Calculator size={24} />
                </button>

                {activeHover === 'calculadora' && !showCalculator && (
                  <div style={{ ...flyoutStyle, bottom: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#00d4ff', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Calculadora
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--fg-dim)', lineHeight: 1.4 }}>
                      Simulador de sueldo e incentivos de ventas y cobranzas.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 7. Descargar xlsx (Solo Admin) */}
            {isAdmin && (
              <div
                onMouseEnter={() => handleMouseEnter('xlsx')}
                onMouseLeave={handleMouseLeave}
                style={{ position: 'relative', marginBottom: 8 }}
              >
                <button
                  type="button"
                  onClick={() => setShowXlsxModal(true)}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: 12,
                    background: 'transparent',
                    border: '1px solid transparent',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'rgba(255, 255, 255, 0.65)',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.color = '#10b981';
                    e.currentTarget.style.background = 'rgba(16, 185, 129, 0.12)';
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)';
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <FileSpreadsheet size={24} />
                </button>

                {activeHover === 'xlsx' && (
                  <div style={{ ...flyoutStyle, bottom: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#10b981', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Descargar XLSX
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--fg-dim)', lineHeight: 1.4 }}>
                      Exportar reporte en planilla Excel.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* 8. Ajustes */}
            <div
              onMouseEnter={() => handleMouseEnter('ajustes')}
              onMouseLeave={handleMouseLeave}
              style={{ position: 'relative', marginBottom: 8 }}
            >
              <button
                type="button"
                onClick={() => {
                  if (isAdmin) router.push('/ajustes');
                  else setShowAdminModal(true);
                }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: pathname.startsWith('/ajustes') ? 'rgba(255,255,255,0.1)' : 'transparent',
                  border: '1px solid transparent',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'rgba(255, 255, 255, 0.65)',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={e => (e.currentTarget.style.color = '#fff')}
                onMouseLeave={e => (e.currentTarget.style.color = 'rgba(255, 255, 255, 0.65)')}
              >
                {isAdmin ? <Settings size={24} /> : <Lock size={24} />}
              </button>

              {activeHover === 'ajustes' && (
                <div style={{ ...flyoutStyle, bottom: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {isAdmin ? 'Ajustes' : 'ACCESO'}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--fg-dim)', lineHeight: 1.4 }}>
                    {isAdmin ? 'Configuración general del sistema.' : 'Ingresar clave.'}
                  </div>
                </div>
              )}
            </div>

            {/* 9. Zoom controls */}
            <div style={{ width: 36, height: 1, background: 'rgba(255, 255, 255, 0.08)', margin: '10px 0' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'center' }}>
              <button
                onClick={onZoomIn}
                title="Acercar (Ctrl++)"
                style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
              >
                <ZoomIn size={14} />
              </button>
              <div
                onClick={onReset}
                title="Restablecer zoom (Ctrl+0)"
                style={{
                  width: 30, height: 20,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.4)', cursor: 'pointer',
                  fontSize: 9, fontWeight: 700, transition: 'all 0.2s',
                  borderTop: '1px solid rgba(255,255,255,0.06)',
                  borderBottom: '1px solid rgba(255,255,255,0.06)',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#fff'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)'; }}
              >
                {zoom ? Math.round(zoom * 100) : 100}%
              </div>
              <button
                onClick={onZoomOut}
                title="Alejar (Ctrl+-)"
                style={{
                  width: 30, height: 30, borderRadius: 8,
                  background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'rgba(255,255,255,0.5)', cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)'; e.currentTarget.style.background = 'rgba(255,255,255,0.03)'; }}
              >
                <ZoomOut size={14} />
              </button>
            </div>
            </div>
          )}

          {/* Expanded Filters Panel */}
          {showFilters && (
            <div style={{
              flex: 1,
              display: 'flex', flexDirection: 'column',
              background: 'var(--bg-elev-1)',
              borderLeft: '1px solid rgba(255,255,255,0.05)',
              overflow: 'hidden',
              animation: 'slideInLeft 0.3s cubic-bezier(0.25, 1, 0.5, 1)'
            }}>
              <div style={{
                padding: '18px 20px 14px',
                borderBottom: '1px solid rgba(255,255,255,0.06)',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <span style={{ fontSize: '20px', fontWeight: 600, color: '#ffffff' }}>Filtros Avanzados</span>
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
    </>
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
    transition: 'all 0.2s', textAlign: 'center', display: 'block', width: '100%', boxSizing: 'border-box',
    overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
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
              transition: 'all 0.2s', textAlign: 'center', display: 'block', width: '100%', boxSizing: 'border-box',
              overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
            }}
          >RE</span>
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
          <input type="number" placeholder="Mín" value={filters.scoreMin} onChange={e => setFilter('scoreMin', e.target.value)} style={{ ...fieldBase, flex: 1, minWidth: 0, padding: '6px 12px', color: '#eaeaea', outline: 'none', textAlign: 'center' }} />
          <input type="number" placeholder="Máx" value={filters.scoreMax} onChange={e => setFilter('scoreMax', e.target.value)} style={{ ...fieldBase, flex: 1, minWidth: 0, padding: '6px 12px', color: '#eaeaea', outline: 'none', textAlign: 'center' }} />
        </div>
      </div>

      <div>
        <label style={secLabel}>MONTO MIN/MAX</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="number" placeholder="Mín" value={filters.montoMin} onChange={e => setFilter('montoMin', e.target.value)} style={{ ...fieldBase, flex: 1, minWidth: 0, padding: '6px 12px', color: '#eaeaea', outline: 'none', textAlign: 'center' }} />
          <input type="number" placeholder="Máx" value={filters.montoMax} onChange={e => setFilter('montoMax', e.target.value)} style={{ ...fieldBase, flex: 1, minWidth: 0, padding: '6px 12px', color: '#eaeaea', outline: 'none', textAlign: 'center' }} />
        </div>
      </div>

      <div>
        <label style={secLabel}>PERÍODO</label>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input type="date" value={filters.fechaDesde} onChange={e => setFilter('fechaDesde', e.target.value)} style={{ ...fieldBase, flex: 1, minWidth: 0, padding: '6px 12px', color: '#eaeaea', outline: 'none', colorScheme: 'dark', textAlign: 'center' }} />
          <input type="date" value={filters.fechaHasta} onChange={e => setFilter('fechaHasta', e.target.value)} style={{ ...fieldBase, flex: 1, minWidth: 0, padding: '6px 12px', color: '#eaeaea', outline: 'none', colorScheme: 'dark', textAlign: 'center' }} />
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
