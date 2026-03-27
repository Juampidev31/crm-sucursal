'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlignJustify, BarChart2, PieChart, FileText,
  DollarSign, Activity, Settings, Target, Copy, Bell, Plus,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useFilter } from '@/context/FilterContext';

// ── Nav structure ─────────────────────────────────────────────────────────────

const NAV_MAIN = [
  { href: '/registros', icon: AlignJustify, label: 'Registros'  },
  { href: '/analistas', icon: BarChart2,    label: 'Reportes'   },
  { href: '/',          icon: PieChart,     label: 'Métricas'   },
];

const NAV_INFORMES = [
  { href: '/reportes/ventas',    icon: FileText,   label: 'Ventas'    },
  { href: '/reportes/cobranzas', icon: DollarSign, label: 'Cobranzas' },
];

const NAV_ADMIN = [
  { href: '/analisis-temporal', icon: Activity,    label: 'Análisis Temporal' },
  { href: '/objetivos',         icon: Target,      label: 'Objetivos'         },
  { href: '/duplicados',        icon: Copy,        label: 'Duplicados'        },
  { href: '/auditoria',         icon: BarChart2,   label: 'Auditoría'         },
  { href: '/ajustes',           icon: Settings,    label: 'Ajustes'           },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function NavItem({
  href, icon: Icon, label, active, badge,
}: {
  href: string; icon: React.ElementType; label: string; active?: boolean; badge?: number;
}) {
  return (
    <Link href={href} className={`sidebar-item${active ? ' active' : ''}`}>
      <Icon size={15} strokeWidth={active ? 2.5 : 1.8} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge && badge > 0 ? (
        <span style={{
          fontSize: 10, fontWeight: 700,
          background: 'rgba(255,255,255,0.07)',
          color: 'rgba(255,255,255,0.5)',
          padding: '1px 6px', borderRadius: 10,
          minWidth: 18, textAlign: 'center',
        }}>
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </Link>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      padding: '0 16px 6px',
      fontSize: 10, fontWeight: 700,
      textTransform: 'uppercase', letterSpacing: '1px',
      color: '#2a2a2a',
    }}>
      {children}
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar({ hidden }: { hidden?: boolean }) {
  const pathname = usePathname();
  const { isAdmin }          = useAuth();
  const { pendingReminders } = useData();
  const { setIsCreationModalOpen } = useFilter();

  return (
    <aside className={`main-sidebar${hidden ? ' sidebar-hidden' : ''}`}>

      {/* Brand */}
      <div style={{ padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28,
            background: '#fff', borderRadius: 5,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <AlignJustify size={13} color="#000" strokeWidth={2.5} />
          </div>
          <div style={{ lineHeight: 1.2 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', letterSpacing: '-0.2px' }}>Proyección</div>
            <div style={{ fontSize: 10, color: '#333', fontWeight: 600 }}>y Ventas</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="sidebar-content">

        {/* Main */}
        <div className="nav-group">
          <div style={{ padding: '0 8px 8px' }}>
            <button
              onClick={() => setIsCreationModalOpen(true)}
              style={{
                width: '100%', height: 34,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                background: 'var(--azul)',
                border: 'none',
                borderRadius: 6,
                color: '#fff',
                fontSize: 13, fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Plus size={14} /> Nuevo registro
            </button>
          </div>
          {NAV_MAIN.map(item => (
            <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label} active={pathname === item.href} />
          ))}
          <NavItem href="/recordatorios" icon={Bell} label="Recordatorios" active={pathname === '/recordatorios'} badge={pendingReminders} />
        </div>

        {/* Informes */}
        <div className="nav-group">
          <SectionLabel>Informes</SectionLabel>
          {NAV_INFORMES.map(item => (
            <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label} active={pathname === item.href} />
          ))}
        </div>

        {/* Admin */}
        {isAdmin && (
          <div className="nav-group">
            <SectionLabel>Admin</SectionLabel>
            {NAV_ADMIN.map(item => (
              <NavItem key={item.href} href={item.href} icon={item.icon} label={item.label} active={pathname === item.href} />
            ))}
          </div>
        )}
      </div>

    </aside>
  );
}
