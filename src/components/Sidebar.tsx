'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlignJustify, BarChart2, PieChart, FileText,
  DollarSign, Activity, Settings, Target, Copy, Bell,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useFilter } from '@/context/FilterContext';

// ── Nav config ────────────────────────────────────────────────────────────────

const NAV_MAIN = [
  { href: '/registros', icon: AlignJustify, label: 'Registros'   },
  { href: '/analistas', icon: BarChart2,    label: 'Reportes'    },
  { href: '/',          icon: PieChart,     label: 'Métricas'    },
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

// ── NavItem ───────────────────────────────────────────────────────────────────

function NavItem({
  href, icon: Icon, label, active, badge,
}: {
  href: string; icon: React.ElementType; label: string; active?: boolean; badge?: number;
}) {
  return (
    <Link href={href} className={`sidebar-item${active ? ' active' : ''}`} style={{
      color: active ? '#fff' : 'rgba(255,255,255,0.35)',
      fontWeight: active ? 600 : 400,
      fontSize: 13,
      letterSpacing: '-0.1px',
      gap: 10,
      padding: '9px 16px',
    }}>
      <Icon size={14} strokeWidth={active ? 2.2 : 1.6} style={{ flexShrink: 0, opacity: active ? 1 : 0.6 }} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge && badge > 0 ? (
        <span style={{
          fontSize: 10, fontWeight: 700,
          background: 'rgba(255,255,255,0.07)',
          color: 'rgba(255,255,255,0.4)',
          padding: '2px 7px', borderRadius: 20,
        }}>
          {badge > 99 ? '99+' : badge}
        </span>
      ) : null}
    </Link>
  );
}

// ── Section divider ───────────────────────────────────────────────────────────

function Divider({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '18px 16px 8px',
    }}>
      <span style={{
        fontSize: 9, fontWeight: 700,
        letterSpacing: '1.4px', textTransform: 'uppercase',
        color: 'rgba(255,255,255,0.18)',
        flexShrink: 0,
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.05)' }} />
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar({ hidden }: { hidden?: boolean }) {
  const pathname = usePathname();
  const { isAdmin }          = useAuth();
  const { pendingReminders } = useData();

  return (
    <aside className={`main-sidebar${hidden ? ' sidebar-hidden' : ''}`}>

      {/* Brand */}
      <div style={{
        padding: '20px 18px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 28, height: 28,
            background: '#fff', borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <AlignJustify size={13} color="#000" strokeWidth={2.5} />
          </div>
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.2px' }}>
              Proyección
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.22)', fontWeight: 500 }}>
              y Ventas
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="sidebar-content" style={{ paddingTop: 8, paddingBottom: 8 }}>

        {/* Principal */}
        <div style={{ marginBottom: 2 }}>
          {NAV_MAIN.map(item => (
            <NavItem key={item.href} {...item} active={pathname === item.href} />
          ))}
          <NavItem href="/recordatorios" icon={Bell} label="Recordatorios" active={pathname === '/recordatorios'} badge={pendingReminders} />
        </div>

        {/* Informes */}
        <Divider label="Informes" />
        <div style={{ marginBottom: 2 }}>
          {NAV_INFORMES.map(item => (
            <NavItem key={item.href} {...item} active={pathname === item.href} />
          ))}
        </div>

        {/* Admin */}
        {isAdmin && (
          <>
            <Divider label="Admin" />
            <div>
              {NAV_ADMIN.map(item => (
                <NavItem key={item.href} {...item} active={pathname === item.href} />
              ))}
            </div>
          </>
        )}
      </div>

    </aside>
  );
}
