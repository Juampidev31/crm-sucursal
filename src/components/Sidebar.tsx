'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  AlignJustify, BarChart2, PieChart, FileText,
  DollarSign, Activity, Settings, Target, Copy, Bell,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';

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
  { href: '/analisis-temporal', icon: Activity,  label: 'Análisis Temporal' },
  { href: '/objetivos',         icon: Target,    label: 'Objetivos'         },
  { href: '/duplicados',        icon: Copy,      label: 'Duplicados'        },
  { href: '/auditoria',         icon: BarChart2, label: 'Auditoría'         },
  { href: '/ajustes',           icon: Settings,  label: 'Ajustes'           },
];

// ── NavItem ───────────────────────────────────────────────────────────────────

function NavItem({
  href, icon: Icon, label, active, badge,
}: {
  href: string; icon: React.ElementType; label: string; active?: boolean; badge?: number;
}) {
  const [hovered, setHovered] = useState(false);
  const show = active || hovered;

  return (
    <Link
      href={href}
      style={{
        display: 'flex', alignItems: 'center', gap: 11,
        padding: '7px 10px',
        margin: '2px 10px',
        borderRadius: 10,
        background: active
          ? 'rgba(255,255,255,0.07)'
          : hovered ? 'rgba(255,255,255,0.03)' : 'transparent',
        border: active
          ? '1px solid rgba(255,255,255,0.07)'
          : '1px solid transparent',
        color: active ? '#fff' : hovered ? 'rgba(255,255,255,0.65)' : 'rgba(255,255,255,0.35)',
        fontWeight: active ? 600 : 400,
        fontSize: 13,
        letterSpacing: '-0.1px',
        textDecoration: 'none',
        transition: 'all 0.15s',
        cursor: 'pointer',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Icon box */}
      <div style={{
        width: 30, height: 30, borderRadius: 8, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: active
          ? 'rgba(255,255,255,0.1)'
          : hovered ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.04)',
        transition: 'background 0.15s',
      }}>
        <Icon size={14} strokeWidth={active ? 2.2 : 1.7} />
      </div>

      <span style={{ flex: 1 }}>{label}</span>

      {badge && badge > 0 ? (
        <span style={{
          background: '#f59e0b',
          color: '#000',
          fontSize: 10, fontWeight: 800,
          padding: '2px 7px', borderRadius: 20,
          minWidth: 20, textAlign: 'center', flexShrink: 0,
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
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '14px 20px 6px',
    }}>
      <span style={{
        fontSize: 9, fontWeight: 700, letterSpacing: '1.5px',
        textTransform: 'uppercase', color: 'rgba(255,255,255,0.15)',
        flexShrink: 0,
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.05)' }} />
    </div>
  );
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export default function Sidebar({ hidden }: { hidden?: boolean }) {
  const pathname = usePathname();
  const { isAdmin }          = useAuth();
  const { pendingReminders } = useData();

  return (
    <aside className={`main-sidebar${hidden ? ' sidebar-hidden' : ''}`}
      style={{ background: '#070708' }}
    >

      {/* Brand */}
      <div style={{
        padding: '20px 20px 16px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          {/* Logo box — same style as icon boxes */}
          <div style={{
            width: 34, height: 34,
            background: '#fff', borderRadius: 9,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <AlignJustify size={14} color="#000" strokeWidth={2.5} />
          </div>
          <div style={{ lineHeight: 1.3 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '-0.2px' }}>
              Proyección
            </div>
            <div style={{ fontSize: 10, fontWeight: 500, color: 'rgba(255,255,255,0.2)', letterSpacing: '0.1px' }}>
              y Ventas
            </div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <div className="sidebar-content" style={{ padding: '10px 0 12px' }}>

        {/* Principal */}
        {NAV_MAIN.map(item => (
          <NavItem key={item.href} {...item} active={pathname === item.href} />
        ))}
        <NavItem href="/recordatorios" icon={Bell} label="Recordatorios" active={pathname === '/recordatorios'} badge={pendingReminders} />

        {/* Informes */}
        <Divider label="Informes" />
        {NAV_INFORMES.map(item => (
          <NavItem key={item.href} {...item} active={pathname === item.href} />
        ))}

        {/* Admin */}
        {isAdmin && (
          <>
            <Divider label="Admin" />
            {NAV_ADMIN.map(item => (
              <NavItem key={item.href} {...item} active={pathname === item.href} />
            ))}
          </>
        )}

      </div>
    </aside>
  );
}
