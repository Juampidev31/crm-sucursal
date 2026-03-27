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
  { href: '/metricas',  icon: PieChart,     label: 'Métricas'    },
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

  return (
    <Link
      href={href}
      style={{
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '12px 24px',
        margin: '1px 0',
        borderRadius: 0,
        color: active ? '#fff' : hovered ? '#ccc' : '#555',
        fontWeight: active ? 600 : 500,
        fontSize: 14,
        textDecoration: 'none',
        transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
        cursor: 'pointer',
        background: active 
          ? 'linear-gradient(90deg, rgba(255, 255, 255, 0.04) 0%, transparent 100%)' 
          : 'transparent',
        position: 'relative',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Indicator pill */}
      {active && (
        <div style={{
          position: 'absolute',
          left: 0,
          top: '50%',
          transform: 'translateY(-50%)',
          width: 3,
          height: 20,
          background: '#0078d4',
          borderRadius: '0 2px 2px 0',
          boxShadow: '0 0 10px rgba(0, 120, 212, 0.3)',
        }} />
      )}

      <Icon 
        size={18} 
        strokeWidth={active ? 2.5 : 2} 
        style={{ opacity: active ? 1 : 0.4 }}
      />
      <span style={{ flex: 1, letterSpacing: '0.2px' }}>{label}</span>

      {badge && badge > 0 ? (
        <span style={{
          background: '#f59e0b',
          color: '#000',
          fontSize: 10, fontWeight: 800,
          padding: '2px 7px', borderRadius: 20,
          minWidth: 20, textAlign: 'center', flexShrink: 0,
        }}>
          {badge}
        </span>
      ) : null}
    </Link>
  );
}

// ── Section divider ───────────────────────────────────────────────────────────

function Divider({ label }: { label: string }) {
  return (
    <div style={{
      padding: '24px 32px 10px',
      fontSize: 10,
      fontWeight: 800,
      textTransform: 'uppercase',
      color: '#333',
      letterSpacing: '1.5px',
    }}>
      {label}
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
      style={{ 
        background: 'linear-gradient(180deg, #0a0a0b 0%, #000 100%)',
        borderRight: '1px solid rgba(255,255,255,0.03)',
        boxShadow: '20px 0 50px rgba(0,0,0,0.5)',
      }}
    >

      {/* Nav */}
      <div className="sidebar-content" style={{ padding: '30px 0' }}>

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
