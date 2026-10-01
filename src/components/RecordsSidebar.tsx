'use client';

import { usePathname, useRouter } from 'next/navigation';
import { Bell, ClipboardList, FileText, ListChecks, Settings } from 'lucide-react';
import { useAnalistas } from '@/features/settings/SettingsProvider';
import { useAuth } from '@/context/AuthContext';
import AccountActions from './AccountActions';

type RecordsNavItem = {
  label: string;
  icon: typeof ListChecks;
  href: string;
  active?: boolean;
  notification?: boolean;
};

export default function RecordsSidebar() {
  const router = useRouter();
  const pathname = usePathname();
  const { nombres: analistaNombres } = useAnalistas();
  const { realIsAdmin } = useAuth();

  const items: RecordsNavItem[] = [
    { label: 'Registros', icon: ListChecks, href: '/registros', active: pathname === '/registros' },
    { label: 'Gestión diaria', icon: ClipboardList, href: `/gestion-diaria?analista=${encodeURIComponent(analistaNombres[0] || '')}`, active: pathname === '/gestion-diaria' },
    {
      label: 'Reportes',
      icon: FileText,
      href: '/reportes',
      active: pathname === '/analistas' || pathname.startsWith('/reportes'),
    },
    { label: 'Notificaciones', icon: Bell, href: '/registros', notification: true },
  ];

  const item = ({ label, icon: Icon, href, active, notification }: RecordsNavItem) => (
    <button key={label} type="button" className={`records-nav-item${active ? ' is-active' : ''}`} onClick={() => router.push(href)}>
      <span className="records-nav-icon"><Icon size={23} strokeWidth={1.8} />{notification && <i />}</span>
      <span>{label}</span>
    </button>
  );

  return (
    <aside className="records-sidebar">
      <nav className="records-sidebar-main">{items.map(item)}</nav>
      <nav className="records-sidebar-bottom">
        <AccountActions />
        {/* Configuración es la puerta a /ajustes: sólo con sesión de administrador. */}
        {realIsAdmin && (
          <button
            type="button"
            className={`records-nav-item${pathname === '/ajustes' ? ' is-active' : ''}`}
            onClick={() => router.push('/ajustes')}
          >
            <span className="records-nav-icon"><Settings size={23} strokeWidth={1.8} /></span>
            <span>Configuración</span>
          </button>
        )}
      </nav>
    </aside>
  );
}
