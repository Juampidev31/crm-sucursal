'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  AlignJustify,
  PieChart,
  Users,
  FileText,
  DollarSign,
  Activity,
  Settings,
  Calendar,
  Target,
  Copy,
  BarChart2,
  Bell,
  Plus,
  Download,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useFilter } from '@/context/FilterContext';

interface SidebarItemProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  badge?: number;
}

const SidebarItem = ({ href, icon, label, active, badge }: SidebarItemProps) => (
  <Link href={href} className={`sidebar-item ${active ? 'active' : ''} ${badge && badge > 0 ? 'has-badge' : ''}`}>
    <span>{icon}</span>
    <span style={{ flex: 1 }}>{label}</span>
    {badge && badge > 0 ? (
      <span className="sidebar-badge">
        {badge > 99 ? '99+' : badge}
      </span>
    ) : null}
  </Link>
);

export default function Sidebar({ hidden }: { hidden?: boolean }) {
  const pathname = usePathname();
  const { isAdmin } = useAuth();
  const { pendingReminders } = useData();
  const { 
    filters, setFilter, limpiarFiltros, hayFiltros, 
    setIsCreationModalOpen, triggerExport, totalResults 
  } = useFilter();

  return (
    <aside className={`main-sidebar${hidden ? ' sidebar-hidden' : ''}`}>
      <div className="sidebar-header">
        <div className="brand-wrapper">
          <div className="brand-box">
            <LayoutDashboard size={18} />
          </div>
          <span className="brand-text">Proyección y Ventas</span>
        </div>
      </div>

      <div className="sidebar-content">
        {/* Acciones principales */}
        <div style={{ padding: '0 12px 16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="btn-primary" 
              onClick={() => setIsCreationModalOpen(true)}
              style={{ flex: 1, padding: '7px 10px', fontSize: '12px', justifyContent: 'center' }}
            >
              <Plus size={14} /> Nuevo
            </button>
            <button 
              className="btn-secondary" 
              onClick={triggerExport}
              style={{ padding: '7px 10px', fontSize: '12px' }}
            >
              <Download size={14} />
            </button>
          </div>
        </div>

        {/* Menú principal */}
        <div className="nav-group">
          <SidebarItem
            href="/registros"
            icon={<AlignJustify size={18} />}
            label="Registros"
            active={pathname === '/registros'}
          />
          <SidebarItem
            href="/analistas"
            icon={<BarChart2 size={18} />}
            label="Reportes"
            active={pathname === '/analistas'}
          />
          <SidebarItem
            href="/"
            icon={<PieChart size={18} />}
            label="Métricas"
            active={pathname === '/'}
          />
          <SidebarItem
            href="/recordatorios"
            icon={<Bell size={18} />}
            label="Recordatorios"
            active={pathname === '/recordatorios'}
            badge={pendingReminders}
          />
        </div>

        {/* Informes */}
        <div className="nav-group">
          <h4 className="group-label">INFORMES</h4>
          <SidebarItem
            href="/reportes/ventas"
            icon={<FileText size={18} />}
            label="Ventas"
            active={pathname === '/reportes/ventas'}
          />
          <SidebarItem
            href="/reportes/cobranzas"
            icon={<DollarSign size={18} />}
            label="Cobranzas"
            active={pathname === '/reportes/cobranzas'}
          />
        </div>

        {/* Sección admin */}
        {isAdmin && (
          <div className="nav-group">
            <h4 className="group-label">ADMIN</h4>
            <SidebarItem
              href="/analisis-temporal"
              icon={<Activity size={18} />}
              label="Análisis Temporal"
              active={pathname === '/analisis-temporal'}
            />
            <SidebarItem
              href="/objetivos"
              icon={<Target size={18} />}
              label="Objetivos"
              active={pathname === '/objetivos'}
            />
            <SidebarItem
              href="/duplicados"
              icon={<Copy size={18} />}
              label="Duplicados"
              active={pathname === '/duplicados'}
            />
            <SidebarItem
              href="/auditoria"
              icon={<BarChart2 size={18} />}
              label="Auditoría"
              active={pathname === '/auditoria'}
            />
            <SidebarItem
              href="/ajustes"
              icon={<Settings size={18} />}
              label="Ajustes"
              active={pathname === '/ajustes'}
            />
          </div>
        )}
      </div>

      {hayFiltros && (
        <div style={{ padding: '16px', borderTop: '1px solid rgba(255,255,255,0.03)' }}>
          <button 
            onClick={limpiarFiltros} 
            className="btn-clear" 
            style={{ width: '100%', fontSize: '12px', justifyContent: 'center' }}
          >
            <X size={14} /> Limpiar Filtros
          </button>
        </div>
      )}
    </aside>
  );
}
