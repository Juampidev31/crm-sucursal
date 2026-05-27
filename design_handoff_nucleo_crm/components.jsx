/* eslint-disable */
// Núcleo · CRM Ventas — Shared components, icons, helpers

const Icon = ({ name, size = 14, stroke = 1.6, style }) => {
  const paths = ICONS[name];
  if (!paths) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={stroke}
      strokeLinecap="round" strokeLinejoin="round" style={style}>
      {paths}
    </svg>
  );
};

const ICONS = {
  dashboard: <><rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/></>,
  table:     <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></>,
  layers:    <><path d="M12 2 2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></>,
  bell:      <><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></>,
  bar:       <><path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/></>,
  history:   <><path d="M3 3v6h6"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L3 8"/><path d="M12 7v5l4 2"/></>,
  shield:    <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11z"/></>,
  cal:       <><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/></>,
  settings:  <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82 1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></>,
  users:     <><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>,
  search:    <><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></>,
  plus:      <><path d="M12 5v14M5 12h14"/></>,
  x:         <><path d="m18 6-12 12M6 6l12 12"/></>,
  check:     <><path d="m5 12 5 5L20 7"/></>,
  chevdown:  <><path d="m6 9 6 6 6-6"/></>,
  chevright: <><path d="m9 6 6 6-6 6"/></>,
  chevleft:  <><path d="m15 6-6 6 6 6"/></>,
  chevup:    <><path d="m6 15 6-6 6 6"/></>,
  filter:    <><path d="M22 3H2l8 9.46V19l4 2v-8.54L22 3z"/></>,
  sort:      <><path d="M3 6h18M6 12h12M10 18h4"/></>,
  download:  <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M7 10l5 5 5-5"/><path d="M12 15V3"/></>,
  upload:    <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></>,
  edit:      <><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></>,
  trash:     <><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></>,
  more:      <><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></>,
  eye:       <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></>,
  arrowup:   <><path d="M12 19V5M5 12l7-7 7 7"/></>,
  arrowdown: <><path d="M12 5v14M5 12l7 7 7-7"/></>,
  arrowright:<><path d="M5 12h14M12 5l7 7-7 7"/></>,
  refresh:   <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></>,
  warning:   <><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/></>,
  info:      <><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></>,
  user:      <><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></>,
  building:  <><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M9 22V12h6v10M9 6h.01M9 9h.01M9 12h.01M15 6h.01M15 9h.01M15 12h.01"/></>,
  flag:      <><path d="M4 22V4a2 2 0 0 1 2-2h11l-3 5 3 5H6a2 2 0 0 0-2 2"/></>,
  link:      <><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></>,
  merge:     <><circle cx="18" cy="18" r="3"/><circle cx="6" cy="6" r="3"/><path d="M6 21V9a9 9 0 0 0 9 9"/></>,
  zap:       <><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></>,
  target:    <><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></>,
  message:   <><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></>,
  pin:       <><path d="M12 17v5M5 9a7 7 0 1 1 14 0c0 4-3 6-7 11-4-5-7-7-7-11z"/></>,
  bookmark:  <><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></>,
  panel:     <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18"/></>,
  external:  <><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></>,
  copy:      <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>,
  layout:    <><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></>,
  pulse:     <><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></>,
  lock:      <><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></>,
  database:  <><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/></>,
};

const cls = (...xs) => xs.filter(Boolean).join(' ');
const fmtMoney = (n) => '$' + new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n);
const fmtNum = (n) => new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 }).format(n);
const fmtDate = (d) => {
  if (!d) return '—';
  const x = new Date(d);
  return x.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' }).replace('.', '');
};
const fmtDateTime = (d) => {
  if (!d) return '—';
  const x = new Date(d);
  return x.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' ' +
         x.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
};

const scoreTier = (s) => {
  if (s >= 80) return { tier: 'alto', color: 'var(--score-alto)', label: 'Alto', cls: 'green' };
  if (s >= 60) return { tier: 'medio', color: 'var(--score-medio)', label: 'Medio', cls: 'amber' };
  if (s >= 35) return { tier: 'bajo', color: 'var(--score-bajo)', label: 'Bajo', cls: 'red' };
  return { tier: 'riesgo', color: 'var(--score-riesgo)', label: 'Riesgo', cls: 'red' };
};

const STATE_META = {
  Aprobado:    { cls: 'green' },
  'En revisión':{ cls: 'amber' },
  Negociación: { cls: 'blue' },
  Pendiente:   { cls: 'amber' },
  Rechazado:   { cls: 'red' },
  Concretado:  { cls: 'green' },
  Cancelado:   { cls: 'red' },
};

const Badge = ({ children, kind, dot }) => (
  <span className={cls('badge', kind)}>
    {dot && <span className="dot" />}
    {children}
  </span>
);
const StateBadge = ({ state }) => {
  const m = STATE_META[state] || { cls: '' };
  return <Badge kind={m.cls} dot>{state}</Badge>;
};
const ScoreBar = ({ value }) => {
  const t = scoreTier(value);
  return (
    <div className="score-bar">
      <div className="track">
        <div className="fill" style={{ width: value + '%', background: t.color }} />
      </div>
      <span className="val mono" style={{ color: t.color }}>{value}</span>
    </div>
  );
};

const hashColor = (s) => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
  return `linear-gradient(135deg, oklch(0.5 0.12 ${h}), oklch(0.4 0.16 ${(h+40)%360}))`;
};
const Av = ({ name, size = '' }) => {
  const initials = name.split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
  return <span className={cls('av', size)} style={{ background: hashColor(name) }}>{initials}</span>;
};

const Check = ({ checked, onChange }) => (
  <span className={cls('checkbox', checked && 'checked')}
    onClick={(e) => { e.stopPropagation(); onChange?.(!checked); }}>
    {checked && <Icon name="check" size={10} stroke={3} />}
  </span>
);

const Sparkline = ({ data, color = 'var(--fg-muted)', width = 56, height = 22 }) => {
  if (!data || !data.length) return null;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const pts = data.map((v, i) => [i * step, height - ((v - min) / range) * (height - 2) - 1]);
  const path = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
  const id = `sg-${color.replace(/[^a-z]/gi, '')}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <defs>
        <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.30" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path + ` L${width},${height} L0,${height} Z`} fill={`url(#${id})`} />
      <path d={path} fill="none" stroke={color} strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

const BarChart = ({ data, height = 140, barColor = 'var(--red)', goalColor = 'var(--fg-faint)' }) => {
  const max = Math.max(...data.map(d => Math.max(d.value, d.goal || 0))) * 1.1;
  const W = 100;
  const barW = W / data.length;
  return (
    <svg viewBox={`0 0 ${W} 100`} width="100%" height={height} preserveAspectRatio="none">
      {[0.25, 0.5, 0.75].map(g => (
        <line key={g} x1="0" y1={g*100} x2={W} y2={g*100} stroke="var(--border-subtle)" strokeWidth="0.2" strokeDasharray="0.5 0.5" />
      ))}
      {data.map((d, i) => {
        const x = i * barW + barW * 0.18;
        const w = barW * 0.64;
        const h = (d.value / max) * 96;
        const y = 100 - h;
        const gh = d.goal ? (d.goal / max) * 96 : 0;
        const gy = 100 - gh;
        return (
          <g key={i}>
            {d.goal && <line x1={x - 0.5} x2={x + w + 0.5} y1={gy} y2={gy} stroke={goalColor} strokeWidth="0.3" strokeDasharray="0.6 0.4" />}
            <rect x={x} y={y} width={w} height={h} fill={barColor} rx="0.4" opacity={d.future ? 0.35 : 1} />
          </g>
        );
      })}
    </svg>
  );
};

const LineChart = ({ series, height = 180, labels = [] }) => {
  const W = 600, H = 180;
  const padL = 36, padR = 12, padT = 10, padB = 22;
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const allVals = series.flatMap(s => s.data);
  const max = Math.max(...allVals) * 1.1;
  const n = series[0].data.length;
  const step = innerW / (n - 1);
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(t => max * t);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={height} preserveAspectRatio="xMidYMid meet">
      {yTicks.map((tv, i) => {
        const y = padT + innerH - (tv / max) * innerH;
        return (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth="1" strokeDasharray={i === 0 ? "0" : "3 3"} />
            <text x={padL - 6} y={y + 3} fontSize="9" fill="var(--fg-faint)" textAnchor="end" fontFamily="var(--font-mono)">
              {tv >= 1000000 ? (tv/1000000).toFixed(1) + 'M' : tv >= 1000 ? Math.round(tv/1000) + 'k' : Math.round(tv)}
            </text>
          </g>
        );
      })}
      {labels.map((l, i) => {
        const x = padL + i * step;
        return <text key={i} x={x} y={H - 6} fontSize="9" fill="var(--fg-faint)" textAnchor="middle" fontFamily="var(--font-mono)">{l}</text>;
      })}
      {series.map((s, si) => {
        const pts = s.data.map((v, i) => [padL + i * step, padT + innerH - (v / max) * innerH]);
        const path = pts.map(([x, y], i) => (i === 0 ? `M${x},${y}` : `L${x},${y}`)).join(' ');
        const area = path + ` L${pts[pts.length-1][0]},${padT + innerH} L${pts[0][0]},${padT + innerH} Z`;
        const id = `lc-${si}`;
        return (
          <g key={si}>
            <defs>
              <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.color} stopOpacity="0.25" />
                <stop offset="100%" stopColor={s.color} stopOpacity="0" />
              </linearGradient>
            </defs>
            <path d={area} fill={`url(#${id})`} />
            <path d={path} fill="none" stroke={s.color} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={s.dashed ? "3 3" : "0"} />
          </g>
        );
      })}
    </svg>
  );
};

const Donut = ({ data, size = 120, thickness = 16 }) => {
  const total = data.reduce((s, d) => s + d.value, 0);
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  let acc = 0;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {data.map((d, i) => {
        const startAngle = (acc / total) * Math.PI * 2 - Math.PI / 2;
        acc += d.value;
        const endAngle = (acc / total) * Math.PI * 2 - Math.PI / 2;
        const large = endAngle - startAngle > Math.PI ? 1 : 0;
        const x1 = cx + Math.cos(startAngle) * r;
        const y1 = cy + Math.sin(startAngle) * r;
        const x2 = cx + Math.cos(endAngle) * r;
        const y2 = cy + Math.sin(endAngle) * r;
        return (
          <path key={i}
            d={`M${x1},${y1} A${r},${r} 0 ${large} 1 ${x2},${y2}`}
            fill="none" stroke={d.color} strokeWidth={thickness} />
        );
      })}
    </svg>
  );
};

const Heatmap = ({ rows, cols, data, colorScale }) => (
  <table style={{ borderSpacing: 2, borderCollapse: 'separate' }}>
    <tbody>
      {rows.map((r, ri) => (
        <tr key={ri}>
          <td style={{ fontSize: 10, color: 'var(--fg-dim)', paddingRight: 8, fontFamily: 'var(--font-mono)' }}>{r}</td>
          {cols.map((c, ci) => (
            <td key={ci} style={{ width: 22, height: 18, background: colorScale(data[ri][ci]), borderRadius: 2 }} />
          ))}
        </tr>
      ))}
      <tr>
        <td></td>
        {cols.map((c, ci) => (
          <td key={ci} style={{ fontSize: 9, color: 'var(--fg-faint)', textAlign: 'center', fontFamily: 'var(--font-mono)' }}>{c}</td>
        ))}
      </tr>
    </tbody>
  </table>
);

const Modal = ({ open, onClose, title, sub, wide, children, footer }) => {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className={cls('modal', wide && 'wide')} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <span className="title">{title}</span>
          {sub && <span className="sub">{sub}</span>}
          <button className="close" onClick={onClose}><Icon name="x" size={14} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
};

const Popover = ({ anchor, items, onClose }) => {
  const ref = React.useRef(null);
  React.useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose?.(); };
    setTimeout(() => window.addEventListener('click', onClick), 0);
    return () => window.removeEventListener('click', onClick);
  }, [onClose]);
  return (
    <div ref={ref} className="popover" style={{ left: anchor.x, top: anchor.y }}>
      {items.map((it, i) => it.sep ? <div key={i} className="sep" /> : (
        <div key={i} className={cls('pi', it.danger && 'danger')} onClick={() => { it.onClick?.(); onClose?.(); }}>
          {it.icon && <Icon name={it.icon} size={12} />}
          {it.label}
        </div>
      ))}
    </div>
  );
};

Object.assign(window, {
  Icon, ICONS, cls,
  fmtMoney, fmtNum, fmtDate, fmtDateTime,
  scoreTier, STATE_META,
  Badge, StateBadge, ScoreBar, Av, Check,
  Sparkline, BarChart, LineChart, Donut, Heatmap,
  Modal, Popover,
});
