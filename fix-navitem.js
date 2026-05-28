const fs = require('fs');
let code = fs.readFileSync('src/components/Sidebar.tsx', 'utf8');

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

code = code.replace(navItemRegex, newNavItem);
fs.writeFileSync('src/components/Sidebar.tsx', code);
console.log('Fixed NavItem');
