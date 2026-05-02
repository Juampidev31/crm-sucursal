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
  SlidersHorizontal, Download, ChevronDown, ChevronUp, X, Calculator
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useRecordatorios } from '@/features/recordatorios/RecordatoriosProvider';
import { setSession } from '@/lib/auth';

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
        className={`green-hover-btn ${active ? 'active-item' : ''}`}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: 52, height: 52,
          borderRadius: 14,
          color: active ? '#fff' : '#444',
          background: active
            ? 'linear-gradient(145deg, #1a1a1a 0%, #0a0a0a 100%)'
            : 'rgba(255,255,255,0.02)',
          position: 'relative',
          textDecoration: 'none',
          border: `1px solid ${active ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.02)'}`,
          boxShadow: active ? '0 10px 20px rgba(0,0,0,0.4), inset 0 1px 1px rgba(255,255,255,0.05)' : 'none',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
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

function SidebarDivider() {
  return (
    <div style={{
      width: 36, height: 1, flexShrink: 0,
      background: 'transparent', margin: '8px 0',
      position: 'relative', overflow: 'visible',
    }}>
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 24, height: 1,
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 1,
      }} />
      <div style={{
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 4, height: 4,
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '50%',
      }} />
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar({ hidden }: { hidden?: boolean }) {
  const pathname = usePathname();
  const { isAdmin, logout, refreshUser } = useAuth();
  const { pendingReminders } = useRecordatorios();
  const { setIsCreationModalOpen, showFilters, setShowFilters, pageSize, setPageSize, triggerExport, totalResults } = useFilter();
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [adminPassword, setAdminPassword] = useState('');
  const [adminError, setAdminError] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);
  const isRegistros = pathname === '/registros';
  const [showPageSizeSelector, setShowPageSizeSelector] = useState(false);
  const [showCalculator, setShowCalculator] = useState(false);

  useEffect(() => {
    if (showAdminModal) {
      setAdminPassword('');
      setAdminError(false);
      setTimeout(() => passwordInputRef.current?.focus(), 50);
    }
  }, [showAdminModal]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (showPageSizeSelector) {
        const target = e.target as HTMLElement;
        if (!target.closest('[title="Filas por página"]') && !target.closest('[style*="position: absolute"]')) {
          setShowPageSizeSelector(false);
        }
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
        background: '#070707',
        borderRight: '1px solid rgba(255,255,255,0.02)',
        boxShadow: 'inset -20px 0 40px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'row', // Change to row to support side panel
        alignItems: 'stretch',
        width: (showFilters || showCalculator) ? 'var(--sidebar-filters-width)' : 'var(--sidebar-width)',
        zIndex: 150,
        position: 'relative',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Icon Column */}
      <div style={{
        width: 'var(--sidebar-width)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center',
        paddingTop: 24,
        gap: 10,
        flexShrink: 0,
        borderRight: (showFilters || showCalculator) ? '1px solid rgba(255,255,255,0.03)' : 'none',
      }}>
        {isRegistros && (
          <>
            <div className="sidebar-icon-btn" data-label="Nuevo Registro">
              <button
                onClick={() => setIsCreationModalOpen(true)}
                className="green-hover-btn"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 52, height: 52,
                  borderRadius: 13,
                  background: 'rgba(255,255,255,0.04)',
                  color: '#fff',
                  border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer',
                }}
              >
                <Plus size={26} strokeWidth={3} />
              </button>
            </div>
            <SidebarDivider />
          </>
        )}

        <NavItem
          href="/registros"
          icon={AlignJustify}
          label="Registros"
          active={pathname === '/registros'}
        />
        <NavItem href="/analistas" icon={BarChart2} label="Reportes" active={pathname === '/analistas'} />
        <NavItem href="/recordatorios" icon={Bell} label="Recordatorios" active={pathname === '/recordatorios'} badge={pendingReminders} />

        <SidebarDivider />

        <NavItem href="/reportes/ventas" icon={FileText} label="Ventas" active={pathname === '/reportes/ventas'} />
        <NavItem href="/reportes/cobranzas" icon={DollarSign} label="Cobranzas" active={pathname === '/reportes/cobranzas'} />

        <SidebarDivider />

        {isRegistros && (
          <>
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowPageSizeSelector(s => !s)}
                className="green-hover-btn"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 52, height: 52,
                  borderRadius: 13,
                  background: showPageSizeSelector ? 'rgba(134, 239, 172, 0.15)' : 'rgba(255,255,255,0.04)',
                  color: showPageSizeSelector ? '#86efac' : '#888',
                  border: `1px solid ${showPageSizeSelector ? 'rgba(134, 239, 172, 0.2)' : 'rgba(255,255,255,0.05)'}`,
                  cursor: 'pointer',
                }}
                title={`Filas por página: ${totalResults} registros`}
              >
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <span style={{ fontSize: 10, fontWeight: 800, color: '#666', textTransform: 'uppercase' }}>Ver</span>
                  <span style={{ fontSize: pageSize >= 1000 ? 18 : 14, fontWeight: 900 }}>{pageSize >= 1000 ? '∞' : pageSize}</span>
                </div>
              </button>
              {showPageSizeSelector && (
                <div style={{
                  position: 'absolute', left: '60px', bottom: 0,
                  background: '#111', border: '1px solid rgba(255,255,255,0.15)',
                  borderRadius: 10, padding: 8, zIndex: 1000,
                  boxShadow: '0 10px 40px rgba(0,0,0,0.8)',
                  display: 'flex', flexDirection: 'column', gap: 4,
                  minWidth: 120,
                }}>
                  <div style={{
                    fontSize: 9, fontWeight: 800, color: '#555',
                    textTransform: 'uppercase', letterSpacing: '0.5px',
                    padding: '4px 8px', marginBottom: 4,
                  }}>
                    {totalResults} registros
                  </div>
                  <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '0 8px 4px' }} />
                  {[25, 50, 100, 200, 999999].map(size => (
                    <button
                      key={size}
                      onClick={() => { setPageSize(size); setShowPageSizeSelector(false); }}
                      style={{
                        padding: '8px 16px',
                        background: pageSize === size ? 'rgba(255,255,255,0.15)' : 'transparent',
                        border: 'none', borderRadius: 6,
                        color: pageSize === size ? '#fff' : '#888',
                        fontSize: 12, fontWeight: 700,
                        cursor: 'pointer', textAlign: 'left',
                        transition: 'all 0.15s',
                      }}
                    >
                      {size >= 1000 ? '∞ Todo' : `${size} filas`}
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="sidebar-icon-btn" data-label="Exportar CSV">
              <button
                onClick={triggerExport}
                className="green-hover-btn"
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: 52, height: 52,
                  borderRadius: 13,
                  background: 'rgba(255,255,255,0.04)', color: '#888',
                  border: '1px solid rgba(255,255,255,0.05)', cursor: 'pointer',
                }}
              >
                <Download size={22} strokeWidth={2} />
              </button>
            </div>
          </>
        )}

        <SidebarDivider />

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
            <SidebarDivider />
            <NavItem
              href="#"
              icon={Calculator}
              label="Calculadora Incentivos"
              active={showCalculator}
              onClick={(e) => {
                e.preventDefault();
                setShowCalculator(s => !s);
                if (showFilters) setShowFilters(false);
              }}
            />
            <NavItem href="/ajustes" icon={Settings} label="Ajustes" active={pathname === '/ajustes'} />
          </>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ padding: '0 0 32px' }}>
          {isAdmin ? (
            <button
              onClick={() => { logout(); }}
              title="Salir del modo admin"
              className="green-hover-btn"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#333', width: '100%', height: 40,
              }}
            >
              <LogOut size={18} strokeWidth={2} style={{ opacity: 0.5 }} />
            </button>
          ) : (
            <button
              onClick={() => setShowAdminModal(true)}
              title="Acceso unico JUAN PABLO"
              className="green-hover-btn"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#333', width: '100%', height: 40,
              }}
            >
              <Lock size={18} strokeWidth={2} style={{ opacity: 0.5 }} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded Filters Panel */}
      {showFilters && (
        <div style={{
          flex: 1,
          display: 'flex', flexDirection: 'column',
          background: 'rgba(255,255,255,0.005)',
          overflow: 'hidden',
          animation: 'fadeIn 0.4s ease-out'
        }}>
          <div style={{
            padding: '28px 24px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontSize: '13px', fontWeight: 900, color: '#fff', letterSpacing: '1px', textTransform: 'uppercase' }}>Filtros Avanzados</span>
            <button onClick={() => setShowFilters(false)} style={{ background: 'transparent', border: 'none', color: '#444', cursor: 'pointer' }}>
              <SlidersHorizontal size={16} />
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
          background: 'rgba(255,255,255,0.005)',
          overflow: 'hidden',
          animation: 'fadeIn 0.4s ease-out'
        }}>
          <div style={{
            padding: '28px 24px 20px',
            borderBottom: '1px solid rgba(255,255,255,0.04)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontSize: '13px', fontWeight: 900, color: '#fff', letterSpacing: '1px', textTransform: 'uppercase' }}>Calculadora Sucursal B</span>
            <button onClick={() => setShowCalculator(false)} style={{ background: 'transparent', border: 'none', color: '#444', cursor: 'pointer' }}>
              <Calculator size={16} />
            </button>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            <CalculadoraContent />
          </div>
        </div>
      )}

      {showAdminModal && (
        <div
          className="modal-overlay"
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
            overflowY: 'auto', padding: '20px 16px',
          }}
          onClick={e => { if (e.target === e.currentTarget) setShowAdminModal(false); }}
        >
          <div style={{
            background: '#111', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 12, padding: '32px 28px', width: 320,
            boxShadow: '0 20px 60px rgba(0,0,0,0.8)', margin: 'auto',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <Lock size={18} style={{ color: '#fff' }} />
              <span style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Acceso unico JUAN PABLO</span>
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

// ── Components for expanded filters ──────────────────────────────────────────

const FilterAccordion = ({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  return (
    <div style={{ marginBottom: 12, background: 'rgba(255,255,255,0.01)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.02)', overflow: 'hidden' }}>
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
    background: active ? '#fff' : 'rgba(255,255,255,0.03)',
    color: active ? '#000' : '#666',
    border: `1px solid ${active ? '#fff' : 'rgba(255,255,255,0.06)'}`,
    transition: 'all 0.2s', whiteSpace: 'nowrap'
  } as React.CSSProperties);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: '16px' }}>
      <div style={{ background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.02)' }}>
        <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>BÚSQUEDA GENERAL</label>
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
            <label style={{ display: 'block', fontSize: '8px', color: '#444', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>ANALISTA</label>
            <select
              value={filters.analista}
              onChange={e => setFilter('analista', e.target.value)}
              style={{ width: '100%', height: 40, background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', color: '#888', outline: 'none', cursor: 'pointer' }}
            >
              <option value="">Todos los analistas</option>
              {ANALISTAS.map(an => <option key={an} value={an}>{an}</option>)}
            </select>
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '8px', color: '#444', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>ESTADOS</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {ESTADOS.map(st => (
                <span key={st} onClick={() => toggleEstado(st)} style={chipStyle(filters.estados.includes(st))}>{STATUS_LABEL[st] || st}</span>
              ))}
            </div>
          </div>
        </FilterAccordion>

        <FilterAccordion title="Sistema" defaultOpen>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', fontSize: '8px', color: '#444', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>ACUERDO DE PRECIOS</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {allAcuerdos.length > 0 ? allAcuerdos.map(a => (
                <span key={a} onClick={() => toggleAcuerdoPrecios(a)} style={chipStyle(filters.acuerdoPrecios.includes(a))}>{a}</span>
              )) : <span style={{ fontSize: '11px', color: '#333' }}>Sin acuerdos registrados</span>}
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: 14 }}>
            <div>
              <label style={{ display: 'block', fontSize: '8px', color: '#444', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>SCORE MIN/MAX</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" placeholder="Mín" className="form-input" value={filters.scoreMin} onChange={e => setFilter('scoreMin', e.target.value)} style={{ height: 38, fontSize: '12px', borderRadius: '8px' }} />
                <input type="number" placeholder="Máx" className="form-input" value={filters.scoreMax} onChange={e => setFilter('scoreMax', e.target.value)} style={{ height: 38, fontSize: '12px', borderRadius: '8px' }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '8px', color: '#444', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>MONTO MIN/MAX</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input type="number" placeholder="Mín" className="form-input" value={filters.montoMin} onChange={e => setFilter('montoMin', e.target.value)} style={{ height: 38, fontSize: '12px', borderRadius: '8px' }} />
                <input type="number" placeholder="Máx" className="form-input" value={filters.montoMax} onChange={e => setFilter('montoMax', e.target.value)} style={{ height: 38, fontSize: '12px', borderRadius: '8px' }} />
              </div>
            </div>
          </div>
        </FilterAccordion>

        <div style={{ marginBottom: 12, background: 'rgba(255,255,255,0.01)', borderRadius: 12, border: '1px solid rgba(255,255,255,0.02)', padding: '16px' }}>
          <label style={{ display: 'block', fontSize: '10px', color: '#fff', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px' }}>PERÍODO</label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '8px', color: '#444', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>FECHA DESDE</label>
              <input type="date" className="form-input" value={filters.fechaDesde} onChange={e => setFilter('fechaDesde', e.target.value)} style={{ height: 38, fontSize: '12px', borderRadius: '8px' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '8px', color: '#444', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>FECHA HASTA</label>
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
            border: '1px solid rgba(248,113,113,0.12)', color: '#f87171', borderRadius: '12px',
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

  const total = Object.values(results).reduce((s, v) => s + v, 0);

  const inputRow = (label: string, key: keyof typeof pacts) => (
    <div style={{ marginBottom: 16 }}>
      <label style={{ display: 'block', fontSize: '9px', color: '#444', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>{label} (%)</label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <input
          type="number"
          placeholder="%"
          value={pacts[key]}
          onChange={e => setPacts(p => ({ ...p, [key]: e.target.value }))}
          style={{ width: '64px', height: 40, background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', color: '#fff', textAlign: 'center', fontSize: 13, outline: 'none' }}
        />
        <div style={{ flex: 1, textAlign: 'right', fontSize: 13, fontWeight: 800, color: results[key] > 0 ? '#34d399' : '#333' }}>
          {results[key] > 0 ? `$ ${results[key].toLocaleString('es-AR')}` : '—'}
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.02)', marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: '#fb923c', textTransform: 'uppercase', marginBottom: 16, letterSpacing: 0.5 }}>Venta</div>
        {inputRow('Capital', 'capital')}
        {inputRow('Operación', 'operacion')}
      </div>

      <div style={{ background: 'rgba(255,255,255,0.01)', padding: '16px', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.02)', marginBottom: 20 }}>
        <div style={{ fontSize: 10, fontWeight: 900, color: '#60a5fa', textTransform: 'uppercase', marginBottom: 16, letterSpacing: 0.5 }}>Cobranzas</div>
        {inputRow('Recupero 90-119', 'recupero90')}
        {inputRow('Recupero 120-209', 'recupero120')}
        {inputRow('REFI', 'refi')}
      </div>

      <div style={{ marginTop: 'auto', padding: '20px 0', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
          <span style={{ fontSize: 10, fontWeight: 900, color: '#444', textTransform: 'uppercase' }}>Total Estimado</span>
          <span style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>$ {total.toLocaleString('es-AR')}</span>
        </div>
        <div style={{ fontSize: 9, color: '#333', textAlign: 'right' }}>Sucursal B</div>
      </div>
    </div>
  );
};


