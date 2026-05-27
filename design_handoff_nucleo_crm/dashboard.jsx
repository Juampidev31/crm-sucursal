/* eslint-disable */
// Núcleo · CRM Ventas — Dashboard (General + Individual)

const KPI_DATA = [
  { id: 'tot',  label: 'Total vendido',     value: '$48.2M',  delta: '+12.4%', deltaDir: 'up',   spark: [12,14,13,17,16,19,22,21,24,28,26,30] },
  { id: 'proy', label: 'Proyección mensual',value: '$62.5M',  delta: '+18.1%', deltaDir: 'up',   spark: [20,22,21,24,26,28,27,30,32,34,36,38] },
  { id: 'obj',  label: 'Objetivo cumplido', value: '78%',     delta: '−4 pts', deltaDir: 'down', spark: [70,72,75,78,80,78,77,76,78,82,78,78] },
  { id: 'cli',  label: 'Clientes activos',  value: '1.284',   delta: '+3.2%',  deltaDir: 'up',   spark: [1200,1210,1225,1240,1245,1255,1260,1270,1275,1280,1282,1284] },
  { id: 'aler', label: 'Alertas pendientes',value: '23',      delta: '+5',     deltaDir: 'down', spark: [10,12,11,14,16,18,20,22,21,23,22,23] },
  { id: 'sco',  label: 'Score promedio',    value: '67.4',    delta: '+2.1',   deltaDir: 'up',   spark: [62,63,64,63,65,66,65,66,67,68,67,67] },
];

const MESES = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const VENTAS_SERIE = [
  { name: 'Ventas',     color: 'oklch(0.62 0.19 25)',  data: [28, 32, 35, 38, 42, 45, 48, 48, 0, 0, 0, 0] },
  { name: 'Proyección', color: 'oklch(0.72 0.13 240)', data: [30, 33, 36, 40, 43, 47, 50, 52, 56, 60, 62, 65], dashed: true },
  { name: 'Objetivo',   color: 'var(--fg-faint)',      data: [35, 38, 40, 42, 44, 46, 48, 50, 52, 55, 58, 60], dashed: true },
];

const ESTADO_DIST = [
  { label: 'Aprobado',    value: 38, color: 'oklch(0.72 0.16 152)' },
  { label: 'En revisión', value: 22, color: 'oklch(0.78 0.16 75)'  },
  { label: 'Negociación', value: 18, color: 'oklch(0.72 0.13 240)' },
  { label: 'Pendiente',   value: 12, color: 'oklch(0.65 0.10 290)' },
  { label: 'Rechazado',   value: 10, color: 'oklch(0.62 0.19 25)'  },
];

const RANKING = [
  { name: 'Luciana Romero',  role: 'Senior',  ventas: 18420000, ops: 72, win: 81, target: 92, targetMonto: 20000000, score: 74, delta: '+11.8%' },
  { name: 'Victoria Suárez', role: 'Semi-Sr', ventas: 14260000, ops: 52, win: 73, target: 79, targetMonto: 18000000, score: 69, delta: '+6.2%'  },
];

const Dashboard = () => {
  const [view, setView] = React.useState('general');
  const isGeneral = view === 'general';
  const me = !isGeneral ? RANKING.find(r => r.name === view) : null;
  const myRank = me ? RANKING.findIndex(r => r.name === view) + 1 : null;
  const myRegs = !isGeneral ? REGISTROS.filter(r => r.analista === view) : [];

  return (
    <>
      <div className="page-head glow-red" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ flex: '1 1 auto' }}>
          <h1>
            {isGeneral ? '\u00A0'
              : <>Dashboard de <span style={{ color: 'var(--red)' }}>{view}</span></>}
          </h1>
          <div className="sub">
            {isGeneral ? '\u00A0'
              : <>{me.role} · Ranking #{myRank} de {RANKING.length} · {fmtDate(new Date())}</>}
          </div>
        </div>
        <div className="actions">
          <button className="btn ghost"><Icon name="cal" size={12} /> Mayo 2026 <Icon name="chevdown" size={12} /></button>
          <button className="btn"><Icon name="download" size={12} /> Exportar</button>
          <button className="btn primary"><Icon name="plus" size={12} /> Nuevo registro</button>
        </div>

        <div style={{ flex: '1 1 100%', display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, paddingTop: 14, borderTop: '1px solid var(--border-subtle)', flexWrap: 'wrap' }}>
          <div className="mono" style={{ fontSize: 10.5, color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.06em', marginRight: 4 }}>Vista</div>
          <ViewPill active={isGeneral} onClick={() => setView('general')} icon="dashboard" label="General" sub="Toda la operación" />
          {RANKING.map((p) => (
            <ViewPill key={p.name} active={view === p.name} onClick={() => setView(p.name)} avatar={p.name} label={p.name.split(' ')[0]} sub="" />
          ))}
        </div>
      </div>

      <div className="page-body">
        {isGeneral ? <GeneralDashboard /> : <IndividualDashboard analyst={me} rank={myRank} regs={myRegs} />}
      </div>
    </>
  );
};

const ViewPill = ({ active, onClick, icon, avatar, label, sub }) => (
  <button onClick={onClick}
    style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '6px 10px 6px 6px',
      background: active ? 'var(--bg-elev-2)' : 'var(--bg-elev-1)',
      border: `1px solid ${active ? 'var(--red)' : 'var(--border)'}`,
      borderRadius: 99, fontSize: 11.5,
      color: active ? 'var(--fg)' : 'var(--fg-muted)', cursor: 'pointer',
    }}>
    {avatar ? <Av name={avatar} size="sm" /> :
      <span style={{ width: 18, height: 18, borderRadius: 50, background: active ? 'var(--red)' : 'var(--bg-elev-3)', display: 'grid', placeItems: 'center', color: active ? '#fff' : 'var(--fg-muted)' }}>
        <Icon name={icon} size={10} />
      </span>}
    <div style={{ textAlign: 'left', lineHeight: 1.2, whiteSpace: 'nowrap' }}>
      <div style={{ fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 9.5, color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{sub}</div>}
    </div>
  </button>
);

const GeneralDashboard = () => (
  <>
    <div className="kpi-grid">
      {KPI_DATA.map(k => {
        const color = k.deltaDir === 'up' ? 'var(--green)' : 'var(--red)';
        return (
          <div key={k.id} className="kpi">
            <div className="label">{k.label}</div>
            <div className="value">{k.value}</div>
            <div className={cls('delta', k.deltaDir)}>
              <Icon name={k.deltaDir === 'up' ? 'arrowup' : 'arrowdown'} size={11} stroke={2.5}/>
              {k.delta}
              <span className="dim" style={{ marginLeft: 4 }}>vs mes ant.</span>
            </div>
            <div className="spark"><Sparkline data={k.spark} color={color} /></div>
          </div>
        );
      })}
    </div>

    <div className="grid-2" style={{ marginTop: 14 }}>
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Evolución de ventas</span>
          <span className="panel-sub">Últimos 12 meses · YTD</span>
        </div>
        <div className="panel-body" style={{ padding: '10px 14px 4px' }}>
          <LineChart series={VENTAS_SERIE} labels={MESES} height={220} />
        </div>
      </div>

      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Distribución por estado</span>
          <span className="panel-sub">124 registros</span>
        </div>
        <div className="panel-body" style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <Donut data={ESTADO_DIST.map(e => ({ value: e.value, color: e.color }))} size={140} thickness={18} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ESTADO_DIST.map((e) => (
              <div key={e.label} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: e.color }} />
                <span style={{ flex: 1 }}>{e.label}</span>
                <span className="mono dim">{e.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>

    <div className="grid-2" style={{ marginTop: 14 }}>
      <div className="panel">
        <div className="panel-header">
          <span className="panel-title">Ranking de analistas</span>
          <span className="panel-sub">Por ventas YTD</span>
        </div>
        <table className="dt">
          <thead><tr>
            <th style={{ width: 30 }}>#</th><th>Analista</th>
            <th style={{ textAlign: 'right' }}>Ventas</th>
            <th style={{ textAlign: 'right' }}>Ops.</th>
            <th style={{ textAlign: 'right' }}>Win %</th>
            <th style={{ width: 110 }}>Cumplim.</th>
            <th style={{ width: 80, textAlign: 'right' }}>Δ</th>
          </tr></thead>
          <tbody>
            {RANKING.map((p, i) => (
              <tr key={p.name}>
                <td className="mono dim">{String(i + 1).padStart(2, '0')}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Av name={p.name} size="sm" />
                    <div>
                      <div style={{ fontWeight: 500 }}>{p.name}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)' }}>{p.role}</div>
                    </div>
                  </div>
                </td>
                <td className="mono" style={{ textAlign: 'right', fontWeight: 500 }}>{fmtMoney(p.ventas)}</td>
                <td className="mono dim" style={{ textAlign: 'right' }}>{p.ops}</td>
                <td className="mono" style={{ textAlign: 'right' }}>{p.win}%</td>
                <td>
                  <div className="score-bar">
                    <div className="track">
                      <div className="fill" style={{ width: Math.min(p.target, 100) + '%', background: p.target >= 80 ? 'var(--green)' : 'var(--amber)' }} />
                    </div>
                    <span className="val mono">{p.target}%</span>
                  </div>
                </td>
                <td className="mono" style={{ textAlign: 'right', color: p.delta.startsWith('+') ? 'var(--green)' : 'var(--red)' }}>{p.delta}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Actividad reciente</span>
            <div className="panel-actions"><button className="btn ghost sm" onClick={() => window.__navigate?.('auditoria')}>Ver auditoría<Icon name="chevright" size={11} /></button></div>
          </div>
          <div style={{ padding: '14px 16px' }}>
            <div className="timeline">
              {AUDIT.slice(0, 5).map((a, i) => (
                <div key={i} className={cls('ev', 'dot-' + a.kind)}>
                  <div className="head">
                    <strong style={{ fontWeight: 500 }}>{a.user}</strong>
                    <span className="dim" style={{ fontSize: 11.5 }}>{a.action}</span>
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--fg-muted)' }}>{a.target}</span>
                    <span className="when">{fmtDateTime(a.ts)}</span>
                  </div>
                  <div className="desc">{a.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Alertas activas</span>
            <span className="panel-sub">{ALERTAS.filter(a => !a.read).length} sin leer</span>
            <div className="panel-actions"><button className="btn ghost sm" onClick={() => window.__navigate?.('alertas')}>Centro de alertas<Icon name="chevright" size={11} /></button></div>
          </div>
          <div>
            {ALERTAS.slice(0, 4).map((a) => (
              <div className="alert-row" key={a.id}>
                <span className="dot" style={{ background: `var(--${a.level})` }} />
                <div className="text">
                  <div className="t">{a.titulo}</div>
                  <div className="s">{a.sub}</div>
                </div>
                <span className="when">{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </>
);

const IndividualDashboard = ({ analyst, rank, regs }) => {
  const a = analyst;
  const aprobados = regs.filter(r => r.estado === 'Aprobado' || r.estado === 'Concretado');
  const enRevision = regs.filter(r => r.estado === 'En revisión' || r.estado === 'Negociación');
  const pendientes = regs.filter(r => r.estado === 'Pendiente');
  const totalVendido = aprobados.reduce((s, r) => s + r.monto, 0);
  const pipeline = enRevision.reduce((s, r) => s + r.monto, 0);
  const pctTarget = (a.ventas / a.targetMonto) * 100;
  const avgMonto = regs.length ? regs.reduce((s, r) => s + r.monto, 0) / regs.length : 0;
  const monthlyFactor = [0.5, 0.6, 0.7, 0.85, 1.0, 0, 0, 0, 0, 0, 0, 0];
  const personalSerie = [
    { name: 'Ventas', color: 'oklch(0.62 0.19 25)', data: monthlyFactor.map(f => f * a.ventas / 1000000) },
    { name: 'Objetivo', color: 'var(--fg-faint)', data: Array(12).fill(a.targetMonto / 5 / 1000000).map((v, i) => v * (i + 1)), dashed: true },
  ];
  const t = scoreTier(a.score);
  const personalKPIs = [
    { label: 'Ventas YTD', value: fmtMoney(a.ventas), spark: monthlyFactor.slice(0, 5).map(f => f * a.ventas / 1000000), delta: a.delta, deltaDir: a.delta.startsWith('+') ? 'up' : 'down' },
    { label: 'Cumplimiento', value: pctTarget.toFixed(0) + '%', spark: [60, 64, 68, 72, pctTarget], delta: pctTarget >= 90 ? 'On track' : 'Cerca', deltaDir: 'up' },
    { label: 'Operaciones', value: String(a.ops), spark: [a.ops*0.4, a.ops*0.55, a.ops*0.7, a.ops*0.85, a.ops], delta: '+' + Math.round(a.ops * 0.12), deltaDir: 'up' },
    { label: 'Win rate', value: a.win + '%', spark: [a.win-8, a.win-5, a.win-3, a.win-1, a.win], delta: '+3 pts', deltaDir: 'up' },
    { label: 'Score promedio', value: String(a.score), spark: [a.score-6, a.score-4, a.score-2, a.score-1, a.score], delta: '+2.1', deltaDir: 'up' },
    { label: 'Ranking', value: '#' + rank, spark: [rank+2, rank+1, rank+1, rank, rank], delta: 'de ' + RANKING.length, deltaDir: 'up' },
  ];
  const myActivity = AUDIT.filter(au => au.user === a.name);
  const myActivityPadded = myActivity.length ? myActivity : [
    { ts: '2026-05-24T14:32:00', user: a.name, action: 'Aprobó', target: regs[0]?.id || 'R-1087', kind: 'green', desc: `Operación aprobada — ${fmtMoney(regs[0]?.monto || 4250000)}` },
    { ts: '2026-05-24T11:18:00', user: a.name, action: 'Editó',  target: regs[1]?.id || 'R-1102', kind: 'blue',  desc: 'Actualizó documentación del cliente' },
    { ts: '2026-05-23T16:55:00', user: a.name, action: 'Comentó',target: regs[2]?.id || 'R-1054', kind: 'blue',  desc: '"Cliente confirmó documentación pendiente"' },
    { ts: '2026-05-23T13:42:00', user: a.name, action: 'Creó',   target: regs[3]?.id || 'R-1115', kind: 'blue',  desc: 'Nuevo registro · Premium' },
  ];
  return (
    <>
      <div className="panel" style={{ padding: 20, marginBottom: 14, background: 'linear-gradient(135deg, var(--bg-elev-1) 0%, var(--bg-elev-0) 60%)', display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 24, alignItems: 'center' }}>
        <div style={{ position: 'relative' }}>
          <Av name={a.name} size="lg" />
          <div style={{ position: 'absolute', bottom: -4, right: -4, background: 'var(--bg-elev-0)', border: '2px solid var(--bg-elev-1)', borderRadius: 99, padding: '1px 6px', fontSize: 10, fontWeight: 600, color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>#{rank}</div>
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{a.name}</div>
            <Badge>{a.role}</Badge>
            <span className="mono dim" style={{ fontSize: 11 }}>· Mayo 2026</span>
          </div>
          <div style={{ marginTop: 14, display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center' }}>
            <div>
              <div className="mono" style={{ fontSize: 10, color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Vendido / Objetivo</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 2 }}>
                <span style={{ fontSize: 20, fontWeight: 600, fontFamily: 'var(--font-mono)' }}>{fmtMoney(a.ventas)}</span>
                <span className="mono dim" style={{ fontSize: 12 }}>/ {fmtMoney(a.targetMonto)}</span>
              </div>
            </div>
            <div style={{ height: 8, background: 'var(--bg-elev-2)', borderRadius: 99, overflow: 'hidden', minWidth: 120, alignSelf: 'flex-end', marginBottom: 4 }}>
              <div style={{ width: Math.min(pctTarget, 100) + '%', height: '100%', background: pctTarget >= 90 ? 'var(--green)' : pctTarget >= 75 ? 'var(--amber)' : 'var(--red)' }} />
            </div>
            <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: pctTarget >= 90 ? 'var(--green)' : 'var(--amber)' }}>{pctTarget.toFixed(0)}%</div>
          </div>
        </div>
        <div>
          <div className="mono" style={{ fontSize: 10, color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Score personal</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
            <svg width="56" height="56" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke={t.color} strokeWidth="3" strokeDasharray={`${a.score} 100`} strokeLinecap="round" pathLength="100" />
            </svg>
            <div>
              <div className="mono" style={{ fontSize: 24, fontWeight: 600, color: t.color, lineHeight: 1 }}>{a.score}</div>
              <div className="mono dim" style={{ fontSize: 10, marginTop: 2 }}>{t.label}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="kpi-grid">
        {personalKPIs.map((k, i) => {
          const color = k.deltaDir === 'up' ? 'var(--green)' : 'var(--red)';
          return (
            <div key={i} className="kpi">
              <div className="label">{k.label}</div>
              <div className="value">{k.value}</div>
              <div className={cls('delta', k.deltaDir)}>
                {k.deltaDir === 'up' ? <Icon name="arrowup" size={11} stroke={2.5}/> : <Icon name="arrowdown" size={11} stroke={2.5}/>}
                {k.delta}
              </div>
              <div className="spark"><Sparkline data={k.spark} color={color} /></div>
            </div>
          );
        })}
      </div>

      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Tu evolución mensual</span>
            <span className="panel-sub">vs objetivo proporcional</span>
          </div>
          <div className="panel-body" style={{ padding: '10px 14px 4px' }}>
            <LineChart series={personalSerie} labels={MESES} height={220} />
          </div>
        </div>
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Tu pipeline</span>
            <span className="panel-sub">{regs.length} registros activos</span>
          </div>
          <div className="panel-body">
            {[
              { l: 'Aprobado / Concretado', count: aprobados.length, monto: totalVendido, color: 'var(--green)' },
              { l: 'En revisión / Negociación', count: enRevision.length, monto: pipeline, color: 'var(--blue)' },
              { l: 'Pendiente', count: pendientes.length, monto: pendientes.reduce((s,r)=>s+r.monto,0), color: 'var(--amber)' },
              { l: 'Rechazado / Cancelado', count: regs.filter(r => r.estado === 'Rechazado' || r.estado === 'Cancelado').length, monto: regs.filter(r => r.estado === 'Rechazado' || r.estado === 'Cancelado').reduce((s,r)=>s+r.monto,0), color: 'var(--red)' },
            ].map((p, i) => {
              const max = regs.length || 1;
              return (
                <div key={i} style={{ padding: '8px 0' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 4 }}>
                    <span style={{ width: 8, height: 8, borderRadius: 2, background: p.color, marginRight: 8 }} />
                    <span style={{ fontSize: 12, flex: 1 }}>{p.l}</span>
                    <span className="mono" style={{ fontSize: 12, fontWeight: 500 }}>{p.count}</span>
                    <span className="mono dim" style={{ fontSize: 10.5, marginLeft: 8, width: 80, textAlign: 'right' }}>{fmtMoney(p.monto)}</span>
                  </div>
                  <div style={{ height: 4, background: 'var(--bg-elev-2)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: (p.count / max * 100) + '%', height: '100%', background: p.color }} />
                  </div>
                </div>
              );
            })}
            <div className="divider" style={{ margin: '14px 0' }} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Monto promedio</div>
                <div className="mono" style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{fmtMoney(avgMonto)}</div>
              </div>
              <div>
                <div className="mono" style={{ fontSize: 10, color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Tickets abiertos</div>
                <div className="mono" style={{ fontSize: 16, fontWeight: 600, marginTop: 4 }}>{enRevision.length + pendientes.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2" style={{ marginTop: 14 }}>
        <div className="panel">
          <div className="panel-header">
            <span className="panel-title">Tus registros recientes</span>
            <span className="panel-sub">{regs.length} totales</span>
          </div>
          {regs.length === 0 ? (
            <div style={{ padding: 30, textAlign: 'center', color: 'var(--fg-dim)', fontSize: 12 }}>Sin registros este mes</div>
          ) : (
            <table className="dt">
              <thead><tr>
                <th>ID</th><th>Cliente</th>
                <th style={{ textAlign: 'right' }}>Monto</th>
                <th>Estado</th>
                <th style={{ width: 80 }}>Score</th>
              </tr></thead>
              <tbody>
                {regs.slice(0, 7).map(r => (
                  <tr key={r.id}>
                    <td className="mono dim">{r.id}</td>
                    <td style={{ fontWeight: 500 }}>{r.nombre}</td>
                    <td className="mono" style={{ textAlign: 'right' }}>{fmtMoney(r.monto)}</td>
                    <td><StateBadge state={r.estado} /></td>
                    <td><ScoreBar value={r.score} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="panel">
          <div className="panel-header"><span className="panel-title">Tu actividad reciente</span></div>
          <div style={{ padding: '14px 16px' }}>
            <div className="timeline">
              {myActivityPadded.slice(0, 6).map((au, i) => (
                <div key={i} className={cls('ev', 'dot-' + au.kind)}>
                  <div className="head">
                    <span className="dim" style={{ fontSize: 11.5 }}>{au.action}</span>
                    <span className="mono" style={{ fontSize: 11.5, color: 'var(--fg-muted)' }}>{au.target}</span>
                    <span className="when">{fmtDateTime(au.ts)}</span>
                  </div>
                  <div className="desc">{au.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

Object.assign(window, { Dashboard });
