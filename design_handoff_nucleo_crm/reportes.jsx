/* eslint-disable */
// Núcleo · CRM Ventas — Reportes & Analytics

const Reportes = () => {
  const [tab, setTab] = React.useState('historico');
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Reportes</h1>
          <div className="sub">Analytics avanzados · Objetivos configurables · Histórico mensual</div>
        </div>
        <div className="actions">
          <button className="btn ghost"><Icon name="cal" size={12} /> Mayo 2026 <Icon name="chevdown" size={12} /></button>
          <button className="btn"><Icon name="download" size={12} /> Exportar PDF</button>
          <button className="btn primary"><Icon name="plus" size={12} /> Crear reporte</button>
        </div>
      </div>

      <div className="tabs">
        {[
          { id: 'historico',   l: 'Histórico' },
          { id: 'objetivos',   l: 'Objetivos' },
          { id: 'resumen',     l: 'Resumen mensual' },
          { id: 'conversion',  l: 'Conversión' },
          { id: 'empleadores', l: 'Por empleador' },
        ].map(t => (
          <div key={t.id} className={cls('tab', tab === t.id && 'active')} onClick={() => setTab(t.id)}>{t.l}</div>
        ))}
      </div>

      <div className="page-body">
        {tab === 'historico'   && <Historico />}
        {tab === 'objetivos'   && <Objetivos />}
        {tab === 'resumen'     && <ResumenMensual />}
        {tab === 'conversion'  && <Conversion />}
        {tab === 'empleadores' && <PorEmpleador />}
      </div>
    </>
  );
};

const Historico = () => {
  const meses = ['Jun','Jul','Ago','Sep','Oct','Nov','Dic','Ene','Feb','Mar','Abr','May'];
  return (
    <>
      <div className="panel">
        <div className="panel-header"><span className="panel-title">Evolución mensual de ventas vs objetivo</span><span className="panel-sub">12 meses · jun '25 → may '26</span></div>
        <div className="panel-body">
          <BarChart data={meses.map((m, i) => ({ value: [22,28,24,31,29,35,38,32,36,42,45,48][i] * 1000000, goal: 35000000 }))} height={200} />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 10, color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)' }}>
            {meses.map(m => <span key={m}>{m}</span>)}
          </div>
        </div>
      </div>

      <div className="grid-3" style={{ marginTop: 14 }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Histórico de scoring</span></div>
          <div className="panel-body">
            <LineChart height={140} labels={['Ene','Feb','Mar','Abr','May']}
              series={[
                { name: 'Promedio', color: 'oklch(0.72 0.16 152)', data: [62,64,65,66,67] },
                { name: 'Median',   color: 'oklch(0.72 0.13 240)', data: [60,61,63,64,65] },
              ]} />
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Rendimiento por empleador</span><span className="panel-sub">Top 5</span></div>
          <div className="panel-body">
            {[
              { e: 'YPF S.A.',          v: 8400000, p: 92 },
              { e: 'Banco Galicia',     v: 6200000, p: 78 },
              { e: 'Telecom Argentina', v: 4800000, p: 64 },
              { e: 'Mercado Libre',     v: 3900000, p: 52 },
              { e: 'Globant',           v: 2100000, p: 38 },
            ].map(r => (
              <div key={r.e} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                <div style={{ width: 110, fontSize: 11.5 }}>{r.e}</div>
                <div style={{ flex: 1, height: 5, background: 'var(--bg-elev-2)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: r.p + '%', height: '100%', background: 'oklch(0.62 0.19 25)' }} />
                </div>
                <span className="mono dim" style={{ fontSize: 11 }}>{fmtMoney(r.v)}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Conversión por analista</span></div>
          <div className="panel-body">
            {[
              { a: 'Luciana Romero',  p: 81 },
              { a: 'Victoria Suárez', p: 73 },
            ].map(r => (
              <div key={r.a} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0' }}>
                <Av name={r.a} size="sm" />
                <div style={{ flex: 1, fontSize: 12 }}>{r.a}</div>
                <div style={{ width: 60, height: 5, background: 'var(--bg-elev-2)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ width: r.p + '%', height: '100%', background: r.p > 70 ? 'var(--green)' : 'var(--amber)' }} />
                </div>
                <span className="mono" style={{ fontSize: 11, width: 30, textAlign: 'right' }}>{r.p}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

const Objetivos = () => {
  const objetivos = [
    { tipo: 'Empresa',  label: 'Ventas mayo 2026',  actual: 32.7, meta: 38.0, unit: 'M' },
    { tipo: 'Analista', label: 'Luciana Romero',     actual: 18.42,meta: 20.0, unit: 'M' },
    { tipo: 'Analista', label: 'Victoria Suárez',    actual: 14.26,meta: 18.0, unit: 'M' },
    { tipo: 'Sucursal', label: 'CABA Norte',         actual: 28.4, meta: 32.0, unit: 'M' },
    { tipo: 'Sucursal', label: 'CABA Sur',           actual: 15.2, meta: 20.0, unit: 'M' },
    { tipo: 'Sucursal', label: 'Rosario',            actual: 4.6,  meta: 10.0, unit: 'M' },
  ];
  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">Objetivos configurados · Mayo 2026</span>
        <span className="panel-sub">{objetivos.length} objetivos · 5 días para el cierre</span>
        <div className="panel-actions">
          <button className="btn ghost sm"><Icon name="copy" size={11} /> Duplicar mes</button>
          <button className="btn sm"><Icon name="plus" size={11} /> Nuevo objetivo</button>
        </div>
      </div>
      <table className="dt">
        <thead><tr>
          <th>Tipo</th><th>Objetivo</th>
          <th style={{ textAlign: 'right' }}>Actual</th>
          <th style={{ textAlign: 'right' }}>Meta</th>
          <th style={{ width: 240 }}>Avance</th>
          <th style={{ width: 80, textAlign: 'right' }}>%</th>
          <th style={{ width: 40 }}></th>
        </tr></thead>
        <tbody>
          {objetivos.map((o, i) => {
            const pct = (o.actual / o.meta) * 100;
            const color = pct >= 95 ? 'var(--green)' : pct >= 75 ? 'var(--amber)' : 'var(--red)';
            return (
              <tr key={i}>
                <td><Badge kind={o.tipo === 'Empresa' ? 'violet' : o.tipo === 'Analista' ? 'blue' : 'amber'}>{o.tipo}</Badge></td>
                <td style={{ fontWeight: 500 }}>{o.label}</td>
                <td className="mono" style={{ textAlign: 'right' }}>${o.actual}{o.unit}</td>
                <td className="mono dim" style={{ textAlign: 'right' }}>${o.meta}{o.unit}</td>
                <td>
                  <div style={{ height: 6, background: 'var(--bg-elev-2)', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ width: Math.min(pct, 100) + '%', height: '100%', background: color }} />
                  </div>
                </td>
                <td className="mono" style={{ textAlign: 'right', color, fontWeight: 500 }}>{pct.toFixed(0)}%</td>
                <td><button className="btn ghost icon"><Icon name="edit" size={11} /></button></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

const ResumenMensual = () => {
  const stats = [
    { l: 'Ventas totales',      v: '$48.2M', d: '+12.4%', up: true },
    { l: 'Operaciones',         v: '247',    d: '+8',     up: true },
    { l: 'Monto promedio',      v: '$195K',  d: '+3.2%',  up: true },
    { l: 'Mejor analista',      v: 'Luciana R.', d: '$18.4M', up: true },
    { l: 'Clientes nuevos',     v: '38',     d: '+12',    up: true },
    { l: 'Tasa conversión',     v: '64%',    d: '-2 pts', up: false },
    { l: 'Tiempo cierre prom.', v: '14 días',d: '-2d',    up: true },
    { l: 'Score promedio',      v: '67.4',   d: '+2.1',   up: true },
  ];
  return (
    <>
      <div className="grid-4">
        {stats.map(s => (
          <div key={s.l} className="panel" style={{ padding: 14 }}>
            <div className="mono" style={{ fontSize: 10, color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.l}</div>
            <div style={{ fontSize: 22, fontWeight: 600, marginTop: 8, letterSpacing: '-0.02em' }}>{s.v}</div>
            <div className="mono" style={{ fontSize: 11, color: s.up ? 'var(--green)' : 'var(--red)', marginTop: 4 }}>{s.up ? '↑' : '↓'} {s.d} <span className="dim">vs abril</span></div>
          </div>
        ))}
      </div>

      <div className="grid-2" style={{ marginTop: 14, gridTemplateColumns: '2fr 1fr' }}>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Evolución diaria · Mayo 2026</span></div>
          <div className="panel-body">
            <BarChart data={Array.from({length: 24}, (_, i) => ({ value: 800000 + Math.sin(i / 2) * 400000 + i * 80000 + (i*13%7) * 50000, future: i > 22 }))} height={140} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)' }}>
              <span>01</span><span>05</span><span>10</span><span>15</span><span>20</span><span>24</span>
            </div>
          </div>
        </div>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">Mix por tipo de cliente</span></div>
          <div className="panel-body" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <Donut size={100} thickness={14} data={[
              { value: 38, color: 'oklch(0.62 0.19 25)' },
              { value: 28, color: 'oklch(0.78 0.16 75)' },
              { value: 18, color: 'oklch(0.72 0.13 240)' },
              { value: 12, color: 'oklch(0.70 0.14 290)' },
              { value: 4,  color: 'oklch(0.72 0.16 152)' },
            ]} />
            <div style={{ flex: 1 }}>
              {[
                { l: 'Estándar',    v: 38, c: 'oklch(0.62 0.19 25)' },
                { l: 'Premium',     v: 28, c: 'oklch(0.78 0.16 75)' },
                { l: 'Corporativo', v: 18, c: 'oklch(0.72 0.13 240)' },
                { l: 'Pyme',        v: 12, c: 'oklch(0.70 0.14 290)' },
                { l: 'Particular',  v:  4, c: 'oklch(0.72 0.16 152)' },
              ].map(d => (
                <div key={d.l} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '3px 0', fontSize: 12 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: d.c }} />
                  <span style={{ flex: 1 }}>{d.l}</span>
                  <span className="mono dim">{d.v}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const Conversion = () => {
  const funnel = [
    { stage: 'Leads',       count: 1240, pct: 100 },
    { stage: 'Calificados', count: 820,  pct: 66 },
    { stage: 'En revisión', count: 540,  pct: 43.5 },
    { stage: 'Negociación', count: 340,  pct: 27.4 },
    { stage: 'Aprobados',   count: 247,  pct: 19.9 },
    { stage: 'Concretados', count: 198,  pct: 16.0 },
  ];
  return (
    <div className="grid-2" style={{ gridTemplateColumns: '1.4fr 1fr' }}>
      <div className="panel">
        <div className="panel-header"><span className="panel-title">Embudo de conversión</span><span className="panel-sub">Mayo 2026</span></div>
        <div className="panel-body">
          {funnel.map((f, i) => {
            const drop = i > 0 ? funnel[i-1].pct - f.pct : 0;
            return (
              <div key={f.stage} style={{ marginBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, flex: 1 }}>{f.stage}</span>
                  <span className="mono" style={{ fontSize: 12 }}>{fmtNum(f.count)}</span>
                  <span className="mono dim" style={{ fontSize: 11, width: 50, textAlign: 'right' }}>{f.pct}%</span>
                  {drop > 0 && <span className="mono" style={{ fontSize: 10, color: 'var(--red)', width: 50, textAlign: 'right' }}>−{drop.toFixed(1)}pts</span>}
                </div>
                <div style={{ height: 22, background: 'var(--bg-elev-0)', borderRadius: 4, overflow: 'hidden' }}>
                  <div style={{ width: f.pct + '%', height: '100%', background: 'linear-gradient(90deg, oklch(0.62 0.19 25), oklch(0.55 0.16 18))', opacity: 0.3 + (i * 0.12) }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <div className="panel">
        <div className="panel-header"><span className="panel-title">Conversión × Score × Tipo</span></div>
        <div className="panel-body" style={{ display: 'grid', placeItems: 'center' }}>
          <Heatmap rows={['Alto','Medio','Bajo','Riesgo']} cols={['Prem.','Std.','Corp.','Pyme','Part.']}
            data={[[0.92, 0.82, 0.95, 0.78, 0.68],[0.78, 0.66, 0.81, 0.62, 0.52],[0.58, 0.48, 0.62, 0.41, 0.32],[0.22, 0.14, 0.31, 0.08, 0.05]]}
            colorScale={(v) => `oklch(${0.30 + v * 0.40} ${0.10 + v * 0.10} 25)`} />
        </div>
      </div>
    </div>
  );
};

const PorEmpleador = () => {
  const data = [
    { e: 'YPF S.A.',           ops: 47, vol: 18400000, score: 76, conv: 82 },
    { e: 'Banco Galicia',      ops: 31, vol: 12200000, score: 72, conv: 78 },
    { e: 'Telecom Argentina',  ops: 24, vol:  8800000, score: 68, conv: 64 },
    { e: 'Mercado Libre',      ops: 19, vol:  7100000, score: 81, conv: 86 },
    { e: 'Globant',            ops: 16, vol:  5900000, score: 78, conv: 74 },
    { e: 'Arcor',              ops: 14, vol:  4200000, score: 64, conv: 58 },
    { e: 'Techint',            ops: 12, vol:  3800000, score: 70, conv: 62 },
    { e: 'Banco Santander',    ops: 11, vol:  3500000, score: 74, conv: 70 },
  ];
  return (
    <div className="panel">
      <div className="panel-header"><span className="panel-title">Rendimiento por empleador</span><span className="panel-sub">Top 8</span></div>
      <table className="dt">
        <thead><tr>
          <th>Empleador</th>
          <th style={{textAlign:'right'}}>Operaciones</th>
          <th style={{textAlign:'right'}}>Volumen</th>
          <th style={{textAlign:'right'}}>Score prom.</th>
          <th style={{textAlign:'right'}}>Conv. %</th>
          <th style={{ width: 140 }}>Distribución</th>
        </tr></thead>
        <tbody>
          {data.map(r => (
            <tr key={r.e}>
              <td style={{ fontWeight: 500 }}>{r.e}</td>
              <td className="mono" style={{textAlign:'right'}}>{r.ops}</td>
              <td className="mono" style={{textAlign:'right', fontWeight: 500}}>{fmtMoney(r.vol)}</td>
              <td className="mono" style={{textAlign:'right', color: scoreTier(r.score).color}}>{r.score}</td>
              <td className="mono" style={{textAlign:'right'}}>{r.conv}%</td>
              <td><Sparkline data={[r.ops * 0.6, r.ops * 0.8, r.ops * 0.7, r.ops * 0.9, r.ops * 1.1, r.ops]} color="oklch(0.62 0.19 25)" width={120} height={20} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

Object.assign(window, { Reportes });
