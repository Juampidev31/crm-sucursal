/* eslint-disable */
// Núcleo · CRM Ventas — Alertas + Auditoría + Scoring

const ALERTA_TYPES = [
  { id: 'all',    label: 'Todas',    count: 8 },
  { id: 'unread', label: 'Sin leer', count: 5 },
  { id: 'red',    label: 'Críticas', count: 3 },
  { id: 'amber',  label: 'Atención', count: 2 },
];

const ALERTA_RULES = [
  { id: 1, label: 'Score vencido > 60 días',                  enabled: true,  trigger: 'Cron diario · 06:00',   channel: 'Push + Email',           last: '12 disparos hoy' },
  { id: 2, label: 'Objetivo mensual < 80%',                   enabled: true,  trigger: 'Cada 4 hs',             channel: 'Push',                   last: 'Hace 22 min' },
  { id: 3, label: 'Cliente sin seguimiento > 15 días',        enabled: true,  trigger: 'Cron diario · 09:00',   channel: 'Email',                  last: 'Hoy 09:00' },
  { id: 4, label: 'Duplicados detectados por CUIL',           enabled: true,  trigger: 'Tiempo real',           channel: 'Push',                   last: 'Hace 1 h' },
  { id: 5, label: 'Operación de riesgo (score<35 + monto>3M)',enabled: true,  trigger: 'Tiempo real',           channel: 'Push + Email + SMS',     last: 'Ayer 17:22' },
  { id: 6, label: 'Backup automático',                        enabled: true,  trigger: 'Cron diario · 03:00',   channel: 'Email',                  last: 'Hoy 03:00' },
  { id: 7, label: 'Registros incompletos > 48h',              enabled: false, trigger: 'Cron diario · 18:00',   channel: 'Push',                   last: '—' },
];

const Alertas = () => {
  const [tab, setTab] = React.useState('all');
  const [showRules, setShowRules] = React.useState(false);
  const filtered = ALERTAS.filter(a => {
    if (tab === 'unread') return !a.read;
    if (tab === 'red' || tab === 'amber') return a.level === tab;
    return true;
  });
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Centro de alertas</h1>
          <div className="sub">{ALERTAS.filter(a => !a.read).length} sin leer · {ALERTA_RULES.filter(r => r.enabled).length} reglas activas</div>
        </div>
        <div className="actions">
          <button className="btn ghost"><Icon name="check" size={12} /> Marcar todas leídas</button>
          <button className="btn" onClick={() => setShowRules(true)}><Icon name="settings" size={12} /> Configurar reglas</button>
        </div>
      </div>

      <div className="tabs">
        {ALERTA_TYPES.map(t => (
          <div key={t.id} className={cls('tab', tab === t.id && 'active')} onClick={() => setTab(t.id)}>
            {t.label} <span className="count">{t.count}</span>
          </div>
        ))}
      </div>

      <div className="page-body tight">
        <div className="grid-2" style={{ gridTemplateColumns: '2fr 1fr' }}>
          <div className="panel">
            <div className="panel-header">
              <span className="panel-title">Notificaciones</span>
              <span className="panel-sub">{filtered.length} resultados</span>
            </div>
            <div>
              {filtered.map((a) => (
                <div key={a.id} style={{
                  display: 'grid', gridTemplateColumns: '36px 1fr auto', gap: 12,
                  padding: '14px 16px', borderBottom: '1px solid var(--border-subtle)',
                  cursor: 'pointer', background: a.read ? 'transparent' : 'oklch(0.20 0.04 25 / 0.06)',
                  position: 'relative',
                }}>
                  {!a.read && <span style={{ position: 'absolute', left: 6, top: 22, width: 4, height: 4, borderRadius: 50, background: `var(--${a.level})` }} />}
                  <div style={{ width: 32, height: 32, borderRadius: 8, background: `var(--${a.level}-bg)`, color: `var(--${a.level})`, display: 'grid', placeItems: 'center' }}>
                    <Icon name={a.icon} size={15} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: a.read ? 400 : 500 }}>{a.titulo}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--fg-dim)', marginTop: 2 }}>{a.sub}</div>
                    <div style={{ marginTop: 8, display: 'flex', gap: 6 }}>
                      <button className="btn ghost sm">Ver registros</button>
                      {a.level === 'red' && <button className="btn sm">Atender ahora</button>}
                      <button className="btn ghost sm" style={{ color: 'var(--fg-dim)' }}>Descartar</button>
                    </div>
                  </div>
                  <div style={{ fontSize: 10.5, color: 'var(--fg-faint)', fontFamily: 'var(--font-mono)' }}>{a.time}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div className="panel">
              <div className="panel-header"><span className="panel-title">Resumen</span></div>
              <div className="panel-body" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10 }}>
                {[
                  { l: 'Críticas hoy',    v: '3',  c: 'red'   },
                  { l: 'Atención',        v: '2',  c: 'amber' },
                  { l: 'Resueltas (7d)',  v: '24', c: 'green' },
                  { l: 'Tasa de atención',v: '94%',c: 'blue'  },
                ].map(s => (
                  <div key={s.l} style={{ background: 'var(--bg-elev-0)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 10 }}>
                    <div className="mono" style={{ fontSize: 10, color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.l}</div>
                    <div style={{ fontSize: 22, fontWeight: 600, color: `var(--${s.c})`, marginTop: 4 }}>{s.v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel">
              <div className="panel-header"><span className="panel-title">Por prioridad · 7 días</span></div>
              <div className="panel-body">
                <BarChart data={[{value:5},{value:8},{value:3},{value:12},{value:6},{value:9},{value:4}]} height={100} barColor="oklch(0.62 0.19 25)" />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)' }}>
                  {['L','M','X','J','V','S','D'].map(d => <span key={d}>{d}</span>)}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {showRules && <RulesModal onClose={() => setShowRules(false)} />}
    </>
  );
};

const RulesModal = ({ onClose }) => (
  <Modal open onClose={onClose} wide title="Reglas de alertas" sub={`${ALERTA_RULES.length} configuradas`}
    footer={<>
      <button className="btn ghost"><Icon name="plus" size={12} /> Nueva regla</button>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <button className="btn ghost" onClick={onClose}>Cerrar</button>
        <button className="btn primary">Guardar cambios</button>
      </div>
    </>}>
    <table className="dt">
      <thead><tr><th style={{ width: 50 }}></th><th>Regla</th><th>Disparador</th><th>Canal</th><th>Último</th><th style={{ width: 40 }}></th></tr></thead>
      <tbody>
        {ALERTA_RULES.map(r => (
          <tr key={r.id}>
            <td><Toggle on={r.enabled} /></td>
            <td style={{ fontWeight: 500 }}>{r.label}</td>
            <td className="mono dim" style={{ fontSize: 11 }}>{r.trigger}</td>
            <td className="dim" style={{ fontSize: 11.5 }}>{r.channel}</td>
            <td className="mono dim" style={{ fontSize: 11 }}>{r.last}</td>
            <td><button className="btn ghost icon"><Icon name="more" size={12} /></button></td>
          </tr>
        ))}
      </tbody>
    </table>
  </Modal>
);

const Toggle = ({ on }) => (
  <span style={{ display: 'inline-block', width: 28, height: 16, borderRadius: 99, background: on ? 'var(--red)' : 'var(--bg-elev-3)', position: 'relative', cursor: 'pointer' }}>
    <span style={{ position: 'absolute', top: 2, left: on ? 14 : 2, width: 12, height: 12, borderRadius: 50, background: '#fff', transition: 'left 0.15s' }} />
  </span>
);

const ALL_AUDIT = (() => {
  const out = [];
  const actions = ['Aprobó', 'Editó', 'Creó', 'Comentó', 'Rechazó', 'Exportó', 'Reasignó', 'Importó', 'Sincronizó', 'Eliminó'];
  const users = ['Luciana Romero', 'Victoria Suárez', 'María Castro', 'Sistema'];
  let r = (s => () => { s = (s * 9301 + 49297) % 233280; return s / 233280; })(7);
  const now = new Date('2026-05-24T15:00:00').getTime();
  for (let i = 0; i < 80; i++) {
    const u = users[Math.floor(r() * users.length)];
    const a = actions[Math.floor(r() * actions.length)];
    const t = new Date(now - i * 1000 * 60 * (5 + Math.floor(r() * 60)));
    out.push({
      ts: t.toISOString(), user: u, action: a,
      target: 'R-' + String(1000 + Math.floor(r() * 200)),
      kind: a === 'Aprobó' ? 'green' : a === 'Rechazó' || a === 'Eliminó' ? 'red' : 'blue',
      desc: a === 'Sincronizó' ? `${Math.floor(r() * 50)} scores actualizados desde bureau`
          : a === 'Importó' ? `${Math.floor(r() * 500)} registros · ${Math.floor(r() * 20)} con error`
          : a === 'Comentó' ? '"Cliente solicita extensión de plazo"'
          : `${a} operación · monto ${fmtMoney(Math.floor(r() * 8000000))}`,
      ip: `190.${Math.floor(r() * 255)}.${Math.floor(r() * 255)}.${Math.floor(r() * 255)}`,
    });
  }
  return out;
})();

const Auditoria = () => {
  const [q, setQ] = React.useState('');
  const [userFilter, setUserFilter] = React.useState(null);
  const [actionFilter, setActionFilter] = React.useState(null);
  const filtered = ALL_AUDIT.filter(a => {
    if (q && !(a.user.toLowerCase().includes(q.toLowerCase()) || a.target.includes(q) || a.desc.toLowerCase().includes(q.toLowerCase()))) return false;
    if (userFilter && a.user !== userFilter) return false;
    if (actionFilter && a.action !== actionFilter) return false;
    return true;
  });
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Auditoría</h1>
          <div className="sub">Logs del sistema · Registro completo de cambios · Retención 24 meses</div>
        </div>
        <div className="actions">
          <button className="btn ghost"><Icon name="filter" size={12} /> Filtros avanzados</button>
          <button className="btn"><Icon name="download" size={12} /> Exportar logs</button>
        </div>
      </div>

      <div className="page-body tight">
        <div className="panel">
          <div className="toolbar">
            <div className="search">
              <Icon name="search" size={12} />
              <input placeholder="Buscar por usuario, ID, descripción…" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
            <FilterChip label="Usuario" value={userFilter}   options={['Luciana Romero','Victoria Suárez','María Castro','Sistema']} onChange={setUserFilter} />
            <FilterChip label="Acción"  value={actionFilter} options={['Aprobó','Editó','Creó','Comentó','Rechazó','Exportó','Reasignó','Importó','Sincronizó','Eliminó']} onChange={setActionFilter} />
            <button className="chip"><Icon name="cal" size={10} /> Últimas 24h</button>
            <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)' }}>{filtered.length} eventos</div>
          </div>

          <table className="dt">
            <thead><tr>
              <th style={{ width: 130 }}>Timestamp</th>
              <th style={{ width: 150 }}>Usuario</th>
              <th style={{ width: 100 }}>Acción</th>
              <th style={{ width: 80 }}>Target</th>
              <th>Descripción</th>
              <th style={{ width: 110 }}>IP</th>
              <th style={{ width: 40 }}></th>
            </tr></thead>
            <tbody>
              {filtered.slice(0, 30).map((a, i) => (
                <tr key={i}>
                  <td className="mono dim" style={{ fontSize: 11 }}>{fmtDateTime(a.ts)}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {a.user === 'Sistema'
                        ? <span style={{ width: 18, height: 18, borderRadius: 50, background: 'var(--bg-elev-3)', display: 'grid', placeItems: 'center' }}><Icon name="zap" size={10} style={{ color: 'var(--blue)' }} /></span>
                        : <Av name={a.user} size="sm" />}
                      <span style={{ fontSize: 12 }}>{a.user}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontFamily: 'var(--font-mono)', color: `var(--${a.kind})` }}>
                      <span style={{ width: 5, height: 5, borderRadius: 50, background: `var(--${a.kind})` }} />
                      {a.action}
                    </span>
                  </td>
                  <td className="mono dim">{a.target}</td>
                  <td style={{ color: 'var(--fg-muted)', maxWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.desc}</td>
                  <td className="mono dim" style={{ fontSize: 10.5 }}>{a.ip}</td>
                  <td><button className="btn ghost icon"><Icon name="eye" size={11} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
};

const Scoring = () => {
  const tiers = [
    { id: 'alto',    label: 'Alto',       range: '80 — 100', color: 'oklch(0.72 0.16 152)', count: 412, pct: 33.2, desc: 'Cliente confiable · Aprobación automática' },
    { id: 'medio',   label: 'Medio',      range: '60 — 79',  color: 'oklch(0.78 0.16 75)',  count: 348, pct: 28.1, desc: 'Revisión estándar · Documentación regular' },
    { id: 'bajo',    label: 'Bajo',       range: '35 — 59',  color: 'oklch(0.65 0.20 30)',  count: 286, pct: 23.1, desc: 'Doble verificación requerida' },
    { id: 'riesgo',  label: 'Riesgo alto',range: '0 — 34',   color: 'oklch(0.55 0.22 18)',  count: 192, pct: 15.6, desc: '⚠ Comité de riesgo · Aprobación manual' },
  ];
  const dist = Array.from({ length: 20 }, (_, i) => Math.floor(50 + Math.sin(i / 3) * 30 + (i * 7 % 11) * 2));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Scoring</h1>
          <div className="sub">Motor de calificación crediticia · 1.238 registros con score · Última sync hace 22 min</div>
        </div>
        <div className="actions">
          <button className="btn ghost"><Icon name="refresh" size={12} /> Re-sincronizar</button>
          <button className="btn"><Icon name="settings" size={12} /> Configurar bandas</button>
        </div>
      </div>

      <div className="page-body">
        <div className="grid-4">
          {tiers.map(t => (
            <div key={t.id} className="panel" style={{ padding: 16, position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: t.color }} />
              <div className="mono" style={{ fontSize: 10, color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Score · {t.range}</div>
              <div style={{ fontSize: 18, fontWeight: 600, marginTop: 6, color: t.color }}>{t.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
                <span className="mono" style={{ fontSize: 24, fontWeight: 600 }}>{t.count}</span>
                <span className="mono dim" style={{ fontSize: 11 }}>· {t.pct}%</span>
              </div>
              <div style={{ marginTop: 8, height: 4, background: 'var(--bg-elev-3)', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: t.pct + '%', height: '100%', background: t.color }} />
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--fg-dim)', marginTop: 10 }}>{t.desc}</div>
            </div>
          ))}
        </div>

        <div className="panel" style={{ marginTop: 14 }}>
          <div className="panel-header">
            <span className="panel-title">Distribución de score</span>
            <span className="panel-sub">Todos los registros activos</span>
          </div>
          <div className="panel-body">
            <svg viewBox="0 0 600 160" width="100%" height="160" preserveAspectRatio="none">
              {[0, 40, 80, 120, 160].map((y, i) => <line key={i} x1="0" x2="600" y1={y} y2={y} stroke="var(--border-subtle)" strokeWidth="0.5" />)}
              {dist.map((v, i) => {
                const x = i * 30;
                const h = (v / 100) * 150;
                const bin = i * 5;
                const c = bin >= 80 ? 'oklch(0.72 0.16 152)' : bin >= 60 ? 'oklch(0.78 0.16 75)' : bin >= 35 ? 'oklch(0.65 0.20 30)' : 'oklch(0.55 0.22 18)';
                return <rect key={i} x={x + 4} y={160 - h} width="22" height={h} fill={c} rx="1" />;
              })}
            </svg>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)' }}>
              <span>0</span><span>25</span><span>50</span><span>75</span><span>100</span>
            </div>
          </div>
        </div>

        <div className="grid-2" style={{ marginTop: 14, gridTemplateColumns: '1fr 1fr' }}>
          <div className="panel">
            <div className="panel-header"><span className="panel-title">Mayores variaciones (7 días)</span></div>
            <table className="dt">
              <thead><tr><th>ID</th><th>Nombre</th><th style={{textAlign:'right'}}>Score</th><th style={{textAlign:'right'}}>Δ</th></tr></thead>
              <tbody>
                {REGISTROS.slice(0, 6).map((r, i) => {
                  const delta = (i % 2 === 0 ? 1 : -1) * (4 + i * 2);
                  return (
                    <tr key={r.id}>
                      <td className="mono dim">{r.id}</td>
                      <td>{r.nombre}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{r.score}</td>
                      <td className="mono" style={{ textAlign: 'right', color: delta > 0 ? 'var(--green)' : 'var(--red)' }}>{delta > 0 ? '+' : ''}{delta}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="panel">
            <div className="panel-header"><span className="panel-title">Score por tipo de cliente</span></div>
            <div className="panel-body">
              {TIPOS_CLIENTE.map((t, i) => {
                const avg = [74, 68, 81, 62, 58][i];
                return (
                  <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0' }}>
                    <div style={{ width: 100, fontSize: 12 }}>{t}</div>
                    <div style={{ flex: 1, height: 6, background: 'var(--bg-elev-2)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ width: avg + '%', height: '100%', background: scoreTier(avg).color }} />
                    </div>
                    <span className="mono" style={{ width: 30, textAlign: 'right', fontSize: 12, color: scoreTier(avg).color }}>{avg}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

Object.assign(window, { Alertas, Auditoria, Scoring });
