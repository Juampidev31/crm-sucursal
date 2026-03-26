'use client';

import React from 'react';
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
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';

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

  return (
    <aside className={`main-sidebar${hidden ? ' sidebar-hidden' : ''}`}>
      <div className="sidebar-header">
        <div className="brand-wrapper">
          <div className="brand-box">
            <LayoutDashboard size={18} />
          </div>
          <span className="brand-text">Gestión de Clientes</span>
        </div>
      </div>

      <div className="sidebar-content">


        {/* Menú principal */}
        <div className="nav-group" style={{ marginTop: '8px' }}>
          <SidebarItem
            href="/registros"
            icon={<AlignJustify size={18} />}
            label="Registros"
            active={pathname === '/registros'}
          />
          <SidebarItem
            href="/analistas"
            icon={<Users size={18} />}
            label="Reportes"
            active={pathname === '/analistas'}
          />
          <SidebarItem
            href="/"
            icon={<PieChart size={18} />}
            label="Métricas y estados"
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

        {/* Reportes externos */}
        <div className="nav-group">
          <h4 className="group-label">REPORTES EXTERNOS</h4>
          <SidebarItem
            href="/reportes/ventas"
            icon={<FileText size={18} />}
            label="Reporte de Ventas"
            active={pathname === '/reportes/ventas'}
          />
          <SidebarItem
            href="/reportes/cobranzas"
            icon={<DollarSign size={18} />}
            label="Reporte de Cobranzas"
            active={pathname === '/reportes/cobranzas'}
          />
        </div>

        {/* Sección admin — solo visible para el administrador */}
        {isAdmin && (
          <div className="nav-group">
            <h4 className="group-label">ADMINISTRATION</h4>
            <SidebarItem
              href="/analisis-temporal"
              icon={<Activity size={18} />}
              label="Análisis Temporal"
              active={pathname === '/analisis-temporal'}
            />
            <SidebarItem
              href="/ajustes"
              icon={<Settings size={18} />}
              label="Configuración"
              active={pathname === '/ajustes'}
            />
            <SidebarItem
              href="/ajustes#dias"
              icon={<Calendar size={18} />}
              label="Configurar Días Hábiles"
              active={false}
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
              label="Detectar Duplicados"
              active={pathname === '/duplicados'}
            />
            <SidebarItem
              href="/auditoria"
              icon={<BarChart2 size={18} />}
              label="Reportes"
              active={pathname === '/auditoria'}
            />
          </div>
        )}
      </div>

    </aside>
  );
}
