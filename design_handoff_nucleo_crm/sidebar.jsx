/* eslint-disable */
// Núcleo · CRM Ventas — Sidebar + Topbar

const NAV_SECTIONS = [
  {
    label: 'Comercial',
    items: [
      { id: 'dashboard',  label: 'Dashboard', icon: 'dashboard' },
      { id: 'registros',  label: 'Registros', icon: 'table', badge: '124' },
    ],
  },
  {
    label: 'Administración',
    items: [
      { id: 'alertas',    label: 'Alertas',          icon: 'bell',  badge: '5' },
      { id: 'corrector',  label: 'Corrector masivo', icon: 'layers' },
      { id: 'reportes',   label: 'Reportes',         icon: 'bar' },
      { id: 'scoring',    label: 'Scoring',          icon: 'pulse' },
      { id: 'auditoria',  label: 'Auditoría',        icon: 'history' },
      { id: 'roles',      label: 'Roles y permisos', icon: 'shield' },
      { id: 'calendario', label: 'Días hábiles',     icon: 'cal' },
      { id: 'config',     label: 'Configuración',    icon: 'settings' },
    ],
  },
];

const Sidebar = ({ active, onNavigate }) => (
  <aside className="sidebar">
    <div className="sidebar-brand">
      <div className="logo">N</div>
      <div>
        <div className="name">FederAR - PDV 713</div>
        <div className="sub">CRM · Ventas</div>
      </div>
    </div>
    <div className="sidebar-search">
      <div className="input">
        <Icon name="search" size={12} />
        <span style={{ fontSize: 12 }}>Buscar…</span>
        <span className="kbd">⌘K</span>
      </div>
    </div>
    <nav className="sidebar-nav">
      {NAV_SECTIONS.map((sec, i) => (
        <div key={i}>
          <div className="nav-section-label">{sec.label}</div>
          {sec.items.map(it => (
            <div key={it.id} className={cls('nav-item', active === it.id && 'active')} onClick={() => onNavigate(it.id)}>
              <span className="icon"><Icon name={it.icon} size={14} /></span>
              <span>{it.label}</span>
              {it.badge && <span className="badge">{it.badge}</span>}
            </div>
          ))}
        </div>
      ))}
    </nav>
    <div className="sidebar-user">
      <div className="avatar">MC</div>
      <div className="info">
        <div className="name">María Castro</div>
        <div className="role">Super Admin</div>
      </div>
      <button className="btn ghost icon"><Icon name="external" size={12} /></button>
    </div>
  </aside>
);

const Topbar = ({ crumbs, actions }) => (
  <div className="topbar">
    <div className="crumbs">
      {crumbs.map((c, i) => (
        <React.Fragment key={i}>
          <span className={i === crumbs.length - 1 ? 'current' : ''}>{c}</span>
          {i < crumbs.length - 1 && <Icon name="chevright" size={11} style={{ opacity: 0.5 }} />}
        </React.Fragment>
      ))}
    </div>
    <div className="right">
      {actions}
      <div className="vdivider" style={{ height: 18 }} />
      <button className="btn ghost icon"><Icon name="bell" size={14} /></button>
      <button className="btn ghost icon"><Icon name="info" size={14} /></button>
    </div>
  </div>
);

Object.assign(window, { Sidebar, Topbar });
