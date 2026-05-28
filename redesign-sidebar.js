const fs = require('fs');
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

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
        width: '100%', padding: '12px 16px', paddingLeft: indent ? '40px' : '16px',
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
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: avatarColor, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#111', fontWeight: 800, fontSize: 12 }}>
            {label.substring(0, 1)}
          </div>
        ) : (
          Icon && <Icon size={18} strokeWidth={2} style={{ color: active ? '#ffffff' : '#777777' }} fill={active ? '#ffffff' : '#777777'} />
        )}
        <span style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.1px' }}>{label}</span>
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

code = code.replace(/function NavItem\([\s\S]*?\)\s*\{[\s\S]*?return \([\s\S]*?\);\n\}/, newNavItem);

const oldTop = `<div style={{
        width: 'var(--sidebar-width)',
        display: 'flex', flexDirection: 'column',
        padding: '2px 16px 20px',
        flexShrink: 0,
        borderRight: (showFilters || showCalculator) ? '1px solid var(--border)' : 'none',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>
        {/* Brand Logo Removed */}


        {/* Highlight Action (Like Personal/Business switch) */}
        {isRegistros && canCreate && (
          <div style={{ padding: '0 4px 20px' }}>
            <div style={{
              background: 'var(--bg-elev-1)', borderRadius: 16, padding: 6, display: 'flex', alignItems: 'center'
            }}>
              <button
                onClick={() => setIsCreationModalOpen(true)}
                style={{
                  flex: 1, padding: '12px', borderRadius: 12,
                  background: 'rgba(255,255,255,0.04)', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.06)', boxShadow: 'none',
                  fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8
                }}
                onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                onMouseLeave={e => e.currentTarget.style.transform = 'none'}
              >
                <Plus size={18} strokeWidth={2.5} />
                Nuevo Registro
              </button>
            </div>
          </div>
        )}

        {/* Main Navigation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <NavItem onNavigate={onNavigate} href="/registros" icon={Database} label="Registros" active={pathname === '/registros'} />
          <NavItem onNavigate={onNavigate} href="/recordatorios" icon={Bell} label="Notificaciones" active={pathname === '/recordatorios'} badge={pendingReminders > 0 ? pendingReminders : undefined} badgeColor="#FF6433" />
        </div>`;

const newTop = `<div style={{
        width: 'var(--sidebar-width)',
        display: 'flex', flexDirection: 'column',
        padding: '24px 20px',
        flexShrink: 0,
        borderRight: (showFilters || showCalculator) ? '1px solid var(--border)' : 'none',
        overflowY: 'auto',
        overflowX: 'hidden'
      }}>
        {/* Traffic Lights & Back */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, padding: '0 4px' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 28, padding: '0 4px' }}>
          <div style={{ width: 40, height: 40, borderRadius: 12, background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontWeight: 900, fontSize: 24 }}>
            <div style={{ width: 0, height: 0, borderLeft: '8px solid transparent', borderRight: '8px solid transparent', borderBottom: '14px solid #000' }} />
          </div>
          <span style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>Sistema.Ventas</span>
        </div>

        {/* Header MENU */}
        <div style={{ fontSize: 11, fontWeight: 800, color: '#555', letterSpacing: '1px', marginBottom: 12, paddingLeft: 16 }}>MENU</div>

        {/* Highlight Action (Like Personal/Business switch) */}
        {isRegistros && canCreate && (
          <div style={{ marginBottom: 8 }}>
            <div style={{
              background: 'transparent', borderRadius: 16, display: 'flex', alignItems: 'center'
            }}>
              <button
                onClick={() => setIsCreationModalOpen(true)}
                style={{
                  flex: 1, padding: '12px 16px', borderRadius: 16,
                  background: 'rgba(255,255,255,0.03)', color: '#fff',
                  border: '1px solid rgba(255,255,255,0.06)', boxShadow: 'none',
                  fontSize: 14, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: 14
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              >
                <Plus size={18} strokeWidth={2} style={{ color: '#777' }} />
                Nuevo Registro
              </button>
            </div>
          </div>
        )}

        {/* Main Navigation */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          <NavItem onNavigate={onNavigate} href="/registros" icon={Database} label="Registros" active={pathname === '/registros'} />
          <NavItem onNavigate={onNavigate} href="/recordatorios" icon={Bell} label="Notificaciones" active={pathname === '/recordatorios'} badge={pendingReminders > 0 ? pendingReminders : undefined} badgeColor="#10b981" />
        </div>`;

code = code.replace(oldTop, newTop);

const newMessagesSection = `
        <div style={{ fontSize: 11, fontWeight: 800, color: '#555', letterSpacing: '1px', marginTop: 24, marginBottom: 12, paddingLeft: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          MESSAGES
          <div style={{ display: 'flex', gap: 8, paddingRight: 16 }}>
             <ChevronDown size={12} style={{ transform: 'rotate(90deg)' }} />
             <ChevronDown size={12} style={{ transform: 'rotate(-90deg)' }} />
          </div>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.02)', borderRadius: 24, padding: '16px 8px', marginBottom: 24 }}>
          <NavItem href="#" label="Lucas Analista" isMessage avatarColor="#ffc1cb" badge="2" badgeColor="#555" />
          <NavItem href="#" label="Maria Lopez" isMessage avatarColor="#c1e1ff" badge="1" badgeColor="#555" />
          <NavItem href="#" label="Admin Sistema" isMessage avatarColor="#ffd5a1" />
          
          <div style={{ marginTop: 16, padding: '0 8px' }}>
            <button style={{ width: '100%', background: '#10b981', color: '#fff', borderRadius: 16, padding: '12px', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
               <ChevronDown size={14} /> All messages
            </button>
          </div>
        </div>

        {/* Contextual / Tool Navigation */}
`;
code = code.replace(/<SidebarDivider \/>\s*\{\/\* Contextual \/ Tool Navigation \*\/\}/, newMessagesSection);

const newUserProfile = `{/* User Profile Footer */}
        <div style={{
          padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 14,
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
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: isAdmin ? 'linear-gradient(135deg, #10b981, #34d399)' : '#1a1a1a', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', flexShrink: 0 }}>
            {isAdmin ? 'AD' : 'US'}
          </div>
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 14, fontWeight: 700, color: '#ffffff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isAdmin ? 'Admin Sistema' : 'Usuario Central'}
            </span>
            <span style={{ fontSize: 12, color: '#777', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {isAdmin ? 'Product Designer' : 'Área Restringida'}
            </span>
          </div>
        </div>`;

code = code.replace(/\{\/\* User Profile Footer \(\S+ style\) \*\/\}\s*<div style=\{\{[\s\S]*?\}\s*onMouseEnter=\{e => e\.currentTarget\.style\.background = 'var\(--bg-hover\)'\}\s*onMouseLeave=\{e => e\.currentTarget\.style\.background = 'transparent'\}\s*onClick=\{\(\) => \{\s*if \(\!isAdmin\) \{\s*setShowAccessDenied\(true\);\s*\} else \{\s*\/\/ For admin, maybe open settings or do nothing\s*\}\s*\}\}\s*>\s*<div style=\{\{[\s\S]*?\}\}>\s*<Settings size=\{20\} \/>\s*<\/div>\s*<div style=\{\{[\s\S]*?\}\}>\s*<span style=\{\{[\s\S]*?\}\}>\s*\{isAdmin \? 'Panel de Control' : 'Panel de Control'\}\s*<\/span>\s*<span style=\{\{[\s\S]*?\}\}>\s*\{isAdmin \? 'Modo Administrador' : 'Área Restringida'\}\s*<\/span>\s*<\/div>\s*<\/div>/, newUserProfile);

// Change background color of the sidebar
code = code.replace(/background: '#111111',/g, "background: 'transparent',");

fs.writeFileSync('src/components/Sidebar.tsx', code);
console.log('Sidebar successfully updated');
