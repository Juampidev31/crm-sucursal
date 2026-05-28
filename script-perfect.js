const fs = require('fs');
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

// 1. Fix NavItem
const navItemRegex = /function NavItem\(\{\s*href, icon: Icon, label, active, badge, onClick, indent, rightIcon: RightIcon, badgeColor = '#ff5b37'\s*\}\: \{\s*href\: string; icon\: React\.ElementType; label\: string; active\?: boolean; badge\?: number \| string; onClick\?: \(e\: React\.MouseEvent\) => void; indent\?: boolean; rightIcon\?: React\.ElementType; badgeColor\?: string;\s*\}\) \{[\s\S]*?return \([\s\S]*?<\/Link>\s*\);\s*\}/;

const newNavItem = `function NavItem({
  href, icon: Icon, label, active, badge, onClick, indent, rightIcon: RightIcon, badgeColor = '#10b981', onNavigate,
  isMessage = false, avatarColor = '#ccc'
}: {
  href: string; icon?: React.ElementType; label: string; active?: boolean; badge?: number | string; onClick?: (e: React.MouseEvent) => void; indent?: boolean; rightIcon?: React.ElementType; badgeColor?: string; onNavigate?: () => void;
  isMessage?: boolean; avatarColor?: string;
}) {
  return (
    <Link
      href={href}
      onClick={(e) => {
        if (onClick) onClick(e);
        else if (onNavigate) onNavigate();
      }}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%', padding: '10px 16px', paddingLeft: indent ? '40px' : '16px',
        borderRadius: 16,
        color: active ? '#ffffff' : '#9a9a9a',
        background: 'transparent',
        textDecoration: 'none',
        transition: 'all 0.2s ease',
        marginBottom: 2
      }}
      onMouseEnter={(e) => {
        if (!active) e.currentTarget.style.color = '#ffffff';
      }}
      onMouseLeave={(e) => {
        if (!active) e.currentTarget.style.color = '#9a9a9a';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        {isMessage ? (
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111', fontWeight: 800, fontSize: 11 }}>
            {label.substring(0, 1)}
          </div>
        ) : (
          Icon && <Icon size={18} strokeWidth={2} style={{ color: active ? '#ffffff' : '#777777' }} fill={active ? '#ffffff' : 'transparent'} />
        )}
        <span style={{ fontSize: 13, fontWeight: 600, letterSpacing: '0.1px' }}>{label}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        {badge ? (
          <span style={{
            background: badgeColor, color: '#fff',
            fontSize: 10, fontWeight: 800,
            padding: '2px 8px', borderRadius: 12,
            minWidth: 22, textAlign: 'center'
          }}>
            {badge}
          </span>
        ) : null}
        {RightIcon && <RightIcon size={14} style={{ color: '#555' }} />}
      </div>
    </Link>
  );
}`;
code = code.replace(navItemRegex, newNavItem);

// 2. Add FileText
if (!code.includes('FileText,')) {
  code = code.replace(/AlignJustify, BarChart2,/, 'AlignJustify, BarChart2, FileText,');
}

// 3. Replace the entire return of Sidebar
const returnRegex = /return \([\s\S]*?\);\n\}/;
const newReturn = `return (
    <aside className={\`main-sidebar \${hidden ? 'sidebar-hidden' : ''} \${showFilters ? 'sidebar-expanded-filters' : ''}\`}
      style={{
        background: 'transparent',
        borderRight: '1px solid rgba(255,255,255,0.07)',
        boxShadow: 'none',
        display: 'flex', flexDirection: 'row',
        alignItems: 'stretch',
        width: (showFilters || showCalculator) ? 'var(--sidebar-filters-width)' : 'var(--sidebar-width)',
        zIndex: 150,
        position: 'relative',
        transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      {/* Text + Icon Column */}
      <div style={{
        width: 'var(--sidebar-width)',
        display: 'flex', flexDirection: 'column',
        padding: '20px 16px',
        flexShrink: 0,
        borderRight: (showFilters || showCalculator) ? '1px solid var(--border)' : 'none',
        overflowY: 'hidden', /* Changed to hidden to prevent scroll */
        overflowX: 'hidden'
      }}>
        {/* Traffic Lights & Back */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, padding: '0 4px' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ff5f56' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#ffbd2e' }} />
            <div style={{ width: 12, height: 12, borderRadius: '50%', background: '#27c93f' }} />
          </div>
          <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            <ChevronDown size={14} style={{ transform: 'rotate(90deg)', color: '#aaa' }} />
          </div>
        </div>

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, padding: '0 4px' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 900, fontSize: 20 }}>
            <div style={{ width: 0, height: 0, borderLeft: '6px solid transparent', borderRight: '6px solid transparent', borderBottom: '10px solid #000' }} />
          </div>
          <span style={{ fontSize: 16, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>Sistema.Ventas</span>
        </div>

        {/* Header MENU */}
        <div style={{ fontSize: 10, fontWeight: 800, color: '#555', letterSpacing: '1px', marginBottom: 8, paddingLeft: 16 }}>MENU</div>

        {/* Highlight Action (Like Personal/Business switch) */}
        {isRegistros && canCreate && (
          <div style={{ marginBottom: 8 }}>
            <div style={{
              background: 'transparent', borderRadius: 16, display: 'flex', alignItems: 'center'
            }}>
              <button
                onClick={() => setIsCreationModalOpen(true)}
                style={{
                  flex: 1, padding: '10px 16px', borderRadius: 16,
                  background: 'rgba(255,255,255,0.03)', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.06)', boxShadow: 'none',
                  fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: 14
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              >
                <Plus size={16} strokeWidth={2} style={{ color: '#777' }} />
                Nuevo Registro
              </button>
            </div>
          </div>
        )}

        {/* Main Navigation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <NavItem href="/registros" icon={Database} label="Registros" active={pathname === '/registros'} />
          <NavItem href="/recordatorios" icon={Bell} label="Notificaciones" active={pathname === '/recordatorios'} badge={pendingReminders > 0 ? pendingReminders : undefined} badgeColor="#10b981" />
        </div>

        {/* Reports Submenu */}
        <div style={{ marginTop: 2, display: 'flex', flexDirection: 'column', gap: 0 }}>
          <NavItem
            href="#"
            icon={BarChart2}
            label="Reportes"
            active={pathname.includes('/reportes') || pathname.includes('/analistas')}
            onClick={(e) => { e.preventDefault(); setReportesOpen(!reportesOpen); }}
            rightIcon={reportesOpen ? ChevronUp : ChevronDown}
            badge={reportesOpen ? '' : '3'}
            badgeColor="#484B52"
          />
          {reportesOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
              <NavItem href="/analistas" icon={Users} label="Analistas" active={pathname === '/analistas'} indent />
              <NavItem href="/reportes/ventas" icon={FileText} label="Ventas" active={pathname === '/reportes/ventas'} indent />
              <NavItem href="/reportes/cobranzas" icon={DollarSign} label="Cobranzas" active={pathname === '/reportes/cobranzas'} indent />
            </div>
          )}
        </div>

        
        <div style={{ fontSize: 10, fontWeight: 800, color: '#555', letterSpacing: '1px', marginTop: 16, marginBottom: 8, paddingLeft: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          MESSAGES
          <div style={{ display: 'flex', gap: 8, paddingRight: 16 }}>
             <ChevronDown size={12} style={{ transform: 'rotate(90deg)' }} />
             <ChevronDown size={12} style={{ transform: 'rotate(-90deg)' }} />
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 20, padding: '12px 8px', marginBottom: 12 }}>
          <NavItem href="#" label="Lucas Analista" isMessage avatarColor="#ffc1cb" badge="2" badgeColor="#555" />
          <NavItem href="#" label="Maria Lopez" isMessage avatarColor="#c1e1ff" badge="1" badgeColor="#555" />
          <NavItem href="#" label="Admin Sistema" isMessage avatarColor="#ffd5a1" />
          
          <div style={{ marginTop: 8, padding: '0 8px' }}>
            <button style={{ width: '100%', background: '#10b981', color: '#fff', borderRadius: 12, padding: '8px', border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
               <ChevronDown size={14} /> All messages
            </button>
          </div>
        </div>

        {/* User Profile Footer */}
        <div style={{
          padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 14,
          marginTop: 'auto', borderRadius: 24, cursor: 'pointer'
        }}
        onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.04)'}
        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
        onClick={() => {
          if (!isAdmin) {
            setShowAccessDenied(true);
          }
        }}
        >
          <div style={{ width: 36, height: 36, borderRadius: '50%', background: isAdmin ? 'linear-gradient(135deg, #10b981, #34d399)' : '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0, fontSize: 12, fontWeight: 700 }}>
            {isAdmin ? 'AD' : 'US'}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isAdmin ? 'Admin Sistema' : 'Usuario Central'}
            </span>
            <span style={{ fontSize: 11, color: '#777', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isAdmin ? 'Product Designer' : 'Área Restringida'}
            </span>
          </div>
        </div>
      </div>

      {/* Expanded Sections */}
      {showFilters && (
        <div style={{
          width: 'var(--sidebar-expanded-width)',
          background: 'var(--bg-elev-1)',
          borderLeft: '1px solid var(--border)',
          overflowY: 'auto'
        }}>
          <FiltersPanel />
        </div>
      )}

      {showCalculator && (
        <div style={{
          width: 'var(--sidebar-expanded-width)',
          background: 'var(--bg-elev-1)',
          borderLeft: '1px solid var(--border)',
          overflowY: 'auto'
        }}>
          <CalculatorPanel />
        </div>
      )}

      {/* Access Denied Modal */}
      {showAccessDenied && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(8px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }} onClick={() => setShowAccessDenied(false)}>
          <div style={{
            background: 'var(--bg-elev-2)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 24, padding: '32px', maxWidth: 400, textAlign: 'center'
          }} onClick={e => e.stopPropagation()}>
            <Lock size={48} style={{ color: '#ff3366', margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: 20, color: '#fff', marginBottom: 8 }}>Acceso Restringido</h3>
            <p style={{ color: 'var(--fg-dim)', fontSize: 14 }}>
              Esta función es exclusiva para el perfil de Administrador de Sistema.
            </p>
          </div>
        </div>
      )}
    </aside>
  );
}`;

code = code.replace(returnRegex, newReturn);
fs.writeFileSync('src/components/Sidebar.tsx', code);
console.log('Sidebar perfectly replaced.');
