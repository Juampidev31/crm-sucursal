/* eslint-disable */
// Núcleo · CRM Ventas — Corrector Masivo

const CORRECTOR_TYPES = [
  { id: 'empleadores',  label: 'Empleadores',   icon: 'building', desc: 'Normalizar y unificar nombres de empleadores', count: 47 },
  { id: 'localidades',  label: 'Localidades',   icon: 'pin',      desc: 'Corregir C.P. y localidades inconsistentes',  count: 23 },
  { id: 'dependencias', label: 'Dependencias',  icon: 'layers',   desc: 'Reasignar sucursales y centros de costo',     count: 11 },
  { id: 'duplicados',   label: 'Duplicados',    icon: 'merge',    desc: 'Detección automática por CUIL / similitud',   count: 9  },
  { id: 'reasignacion', label: 'Reasignación',  icon: 'user',     desc: 'Reasignar analista en bloque',                count: 0  },
  { id: 'importacion',  label: 'Importación',   icon: 'upload',   desc: 'Importar CSV/Excel con vista previa',         count: 0  },
];

const EMPLEADOR_GROUPS = [
  { canon: 'YPF S.A.', total: 200, members: [
    { variant: 'YPF S.A.',      count: 142, status: 'canónico' },
    { variant: 'YPF Sociedad',  count: 28,  status: 'sugerido', match: 0.94 },
    { variant: 'ypf sa',        count: 17,  status: 'sugerido', match: 0.91 },
    { variant: 'Y.P.F.',        count: 9,   status: 'sugerido', match: 0.87 },
    { variant: 'YPF Argentina', count: 4,   status: 'revisar', match: 0.72 },
  ]},
  { canon: 'Banco Galicia', total: 139, members: [
    { variant: 'Banco Galicia',      count: 86, status: 'canónico' },
    { variant: 'Banco de Galicia',   count: 31, status: 'sugerido', match: 0.93 },
    { variant: 'BCO. GALICIA',       count: 14, status: 'sugerido', match: 0.89 },
    { variant: 'Galicia Banco S.A.', count: 8,  status: 'sugerido', match: 0.85 },
  ]},
  { canon: 'Telecom Argentina', total: 97, members: [
    { variant: 'Telecom Argentina', count: 64, status: 'canónico' },
    { variant: 'TELECOM ARG.',      count: 22, status: 'sugerido', match: 0.92 },
    { variant: 'Telecom',           count: 11, status: 'revisar',  match: 0.71 },
  ]},
  { canon: 'Mercado Libre', total: 77, members: [
    { variant: 'Mercado Libre',       count: 52, status: 'canónico' },
    { variant: 'MercadoLibre',        count: 18, status: 'sugerido', match: 0.96 },
    { variant: 'Mercadolibre S.R.L.', count: 7,  status: 'sugerido', match: 0.88 },
  ]},
];

const DUPLICADOS = [
  { cuil: '20-32145678-9', matchScore: 0.98, ops: [
    { id: 'R-1042', nombre: 'Lautaro Bianchi', fecha: '2026-04-12', monto: 2400000, analista: 'Luciana Romero',  score: 72, estado: 'Aprobado' },
    { id: 'R-1067', nombre: 'Lautaro Bianchi', fecha: '2026-04-28', monto: 2400000, analista: 'Victoria Suárez', score: 74, estado: 'Pendiente' },
  ]},
  { cuil: '27-28983412-3', matchScore: 0.93, ops: [
    { id: 'R-1018', nombre: 'Florencia Paz', fecha: '2026-03-18', monto: 1850000, analista: 'Victoria Suárez', score: 68, estado: 'Concretado' },
    { id: 'R-1098', nombre: 'Florencia Paz', fecha: '2026-05-04', monto: 1900000, analista: 'Luciana Romero',  score: 70, estado: 'En revisión' },
    { id: 'R-1112', nombre: 'F. Paz',        fecha: '2026-05-19', monto: 1820000, analista: 'Victoria Suárez', score: 71, estado: 'Pendiente' },
  ]},
  { cuil: '23-30587211-5', matchScore: 0.96, ops: [
    { id: 'R-1054', nombre: 'Martín Iglesias', fecha: '2026-04-02', monto: 5200000, analista: 'Luciana Romero',  score: 81, estado: 'Aprobado' },
    { id: 'R-1089', nombre: 'M. Iglesias',     fecha: '2026-05-11', monto: 5200000, analista: 'Victoria Suárez', score: 79, estado: 'Negociación' },
  ]},
];

const Corrector = () => {
  const [tab, setTab] = React.useState('empleadores');
  const [selected, setSelected] = React.useState(new Set(['YPF S.A.__YPF Sociedad', 'YPF S.A.__ypf sa', 'Banco Galicia__Banco de Galicia', 'Mercado Libre__MercadoLibre']));
  const [preview, setPreview] = React.useState(false);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Corrector masivo</h1>
          <div className="sub">Normalización y limpieza de datos · 90 sugerencias automáticas pendientes</div>
        </div>
        <div className="actions">
          <button className="btn ghost"><Icon name="history" size={12} /> Historial</button>
          <button className="btn"><Icon name="upload" size={12} /> Importar CSV</button>
        </div>
      </div>

      <div className="page-body" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 14, padding: '14px 20px' }}>
        <div className="panel" style={{ padding: 6, alignSelf: 'start' }}>
          {CORRECTOR_TYPES.map(t => (
            <div key={t.id} className={cls('nav-item', tab === t.id && 'active')} onClick={() => setTab(t.id)} style={{ padding: '8px 10px', fontSize: 12.5 }}>
              <Icon name={t.icon} size={13} />
              <div style={{ flex: 1 }}>{t.label}</div>
              {t.count > 0 && <span className="badge">{t.count}</span>}
            </div>
          ))}
        </div>

        <div>
          {tab === 'empleadores' && <EmpleadoresCorrector selected={selected} setSelected={setSelected} onPreview={() => setPreview(true)} />}
          {tab === 'duplicados' && <DuplicadosCorrector />}
          {tab !== 'empleadores' && tab !== 'duplicados' && (
            <div className="panel" style={{ padding: 60, textAlign: 'center', color: 'var(--fg-dim)' }}>
              <Icon name={CORRECTOR_TYPES.find(c => c.id === tab).icon} size={28} stroke={1.2} />
              <div style={{ fontSize: 14, marginTop: 12, color: 'var(--fg)' }}>{CORRECTOR_TYPES.find(c => c.id === tab).label}</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>{CORRECTOR_TYPES.find(c => c.id === tab).desc}</div>
              <button className="btn primary" style={{ marginTop: 16 }}><Icon name="plus" size={11} /> Crear corrección</button>
            </div>
          )}
        </div>
      </div>

      {preview && <PreviewModal onClose={() => setPreview(false)} />}
    </>
  );
};

const EmpleadoresCorrector = ({ selected, setSelected, onPreview }) => {
  const toggle = (key) => {
    const next = new Set(selected);
    next.has(key) ? next.delete(key) : next.add(key);
    setSelected(next);
  };
  const totalSelected = Array.from(selected).length;
  const totalRows = EMPLEADOR_GROUPS.reduce((s, g) => s + g.members.filter(m => selected.has(`${g.canon}__${m.variant}`)).reduce((a, m) => a + m.count, 0), 0);
  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">Sugerencias de unificación · Empleadores</span>
        <span className="panel-sub">4 grupos · 47 variantes</span>
        <div className="panel-actions" style={{ gap: 4 }}>
          <button className="btn ghost sm"><Icon name="refresh" size={11} /> Re-analizar</button>
          <button className="btn ghost sm"><Icon name="filter" size={11} /> Filtros</button>
          <div className="vdivider" style={{ height: 16 }} />
          <span style={{ fontSize: 11, color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)' }}>{totalSelected} variantes · {totalRows} registros</span>
          <button className="btn primary sm" disabled={totalSelected === 0} onClick={onPreview}><Icon name="eye" size={11} /> Vista previa</button>
        </div>
      </div>
      <div>
        {EMPLEADOR_GROUPS.map((g) => (
          <div key={g.canon} style={{ borderBottom: '1px solid var(--border-subtle)', padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <Icon name="building" size={14} style={{ color: 'var(--fg-dim)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>{g.canon}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-dim)' }}>{g.members.length} variantes · {g.total} registros</div>
              </div>
              <button className="btn ghost sm" onClick={() => {
                const next = new Set(selected);
                g.members.forEach(m => { if (m.status !== 'canónico') next.add(`${g.canon}__${m.variant}`); });
                setSelected(next);
              }}>Seleccionar todas</button>
            </div>
            <table className="dt" style={{ marginLeft: 22 }}>
              <thead><tr>
                <th style={{ width: 30 }}></th>
                <th>Variante encontrada</th>
                <th style={{ width: 80, textAlign: 'right' }}>Registros</th>
                <th style={{ width: 90 }}>Similitud</th>
                <th style={{ width: 100 }}>Estado</th>
                <th style={{ width: 200 }}>Reemplazar por</th>
              </tr></thead>
              <tbody>
                {g.members.map((m) => {
                  const key = `${g.canon}__${m.variant}`;
                  const isCanon = m.status === 'canónico';
                  return (
                    <tr key={m.variant} className={cls(selected.has(key) && 'selected')}>
                      <td className="checkbox">{!isCanon && <Check checked={selected.has(key)} onChange={() => toggle(key)} />}</td>
                      <td className={isCanon ? '' : 'mono'} style={{ fontWeight: isCanon ? 500 : 400 }}>
                        {m.variant}
                        {isCanon && <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--green)', fontFamily: 'var(--font-mono)' }}>★ CANÓNICO</span>}
                      </td>
                      <td className="mono dim" style={{ textAlign: 'right' }}>{m.count}</td>
                      <td>
                        {m.match && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div style={{ flex: 1, height: 4, background: 'var(--bg-elev-2)', borderRadius: 99, overflow: 'hidden' }}>
                              <div style={{ width: m.match * 100 + '%', height: '100%', background: m.match > 0.85 ? 'var(--green)' : 'var(--amber)' }} />
                            </div>
                            <span className="mono dim" style={{ fontSize: 10.5 }}>{Math.round(m.match * 100)}%</span>
                          </div>
                        )}
                      </td>
                      <td>{isCanon ? null : m.status === 'sugerido' ? <Badge kind="green" dot>Sugerido</Badge> : <Badge kind="amber" dot>Revisar</Badge>}</td>
                      <td>
                        {!isCanon && (
                          <select className="select" style={{ padding: '3px 18px 3px 8px', height: 24, fontSize: 11.5 }} defaultValue={g.canon}>
                            <option>{g.canon}</option>
                            {EMPLEADORES.filter(e => e !== g.canon).slice(0, 5).map(e => <option key={e}>{e}</option>)}
                          </select>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {totalSelected > 0 && (
        <div style={{ position: 'sticky', bottom: 0, background: 'var(--bg-elev-0)', borderTop: '1px solid var(--border)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <Icon name="info" size={14} style={{ color: 'var(--amber)' }} />
          <div style={{ fontSize: 12.5 }}><strong>{totalRows} registros</strong> se actualizarán · {totalSelected} variantes unificadas</div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
            <button className="btn ghost" onClick={() => setSelected(new Set())}>Limpiar</button>
            <button className="btn" onClick={onPreview}><Icon name="eye" size={12} /> Vista previa</button>
            <button className="btn primary"><Icon name="check" size={12} stroke={3} /> Aplicar cambios</button>
          </div>
        </div>
      )}
    </div>
  );
};

const DuplicadosCorrector = () => {
  const [merged, setMerged] = React.useState(new Set());
  return (
    <div className="panel">
      <div className="panel-header">
        <span className="panel-title">Duplicados detectados</span>
        <span className="panel-sub">{DUPLICADOS.length} grupos · 7 operaciones</span>
      </div>
      <div>
        {DUPLICADOS.map((d) => {
          const isMerged = merged.has(d.cuil);
          return (
            <div key={d.cuil} style={{ padding: '12px 14px', borderBottom: '1px solid var(--border-subtle)', opacity: isMerged ? 0.5 : 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <Icon name="merge" size={14} style={{ color: 'var(--red)' }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500 }}>CUIL <span className="mono">{d.cuil}</span> · {d.ops.length} ocurrencias</div>
                  <div style={{ fontSize: 11, color: 'var(--fg-dim)' }}>Similitud: {Math.round(d.matchScore * 100)}% · misma persona detectada</div>
                </div>
                <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
                  {isMerged ? <Badge kind="green" dot>Merge aplicado</Badge> : <>
                    <button className="btn ghost sm">Ignorar</button>
                    <button className="btn sm"><Icon name="eye" size={11} /> Comparar</button>
                    <button className="btn primary sm" onClick={() => setMerged(new Set([...merged, d.cuil]))}><Icon name="merge" size={11} /> Hacer merge</button>
                  </>}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: `repeat(${d.ops.length}, 1fr)`, gap: 8 }}>
                {d.ops.map((o, oi) => (
                  <div key={o.id} style={{ background: 'var(--bg-elev-0)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 10, fontSize: 11.5, position: 'relative' }}>
                    {oi === 0 && <span style={{ position: 'absolute', top: -6, right: 6, background: 'var(--green)', color: '#fff', fontSize: 9, padding: '1px 6px', borderRadius: 99, fontFamily: 'var(--font-mono)', letterSpacing: '0.05em' }}>★ MASTER</span>}
                    <div className="mono dim" style={{ fontSize: 10.5 }}>{o.id}</div>
                    <div style={{ fontWeight: 500, marginTop: 2 }}>{o.nombre}</div>
                    <div style={{ marginTop: 6, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 8, rowGap: 3, fontSize: 11 }}>
                      <span className="dim">Monto</span><span className="mono">{fmtMoney(o.monto)}</span>
                      <span className="dim">Fecha</span><span className="mono">{fmtDate(o.fecha)}</span>
                      <span className="dim">Analista</span><span>{o.analista.split(' ')[0]}</span>
                      <span className="dim">Score</span><span className="mono">{o.score}</span>
                      <span className="dim">Estado</span><StateBadge state={o.estado} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const PreviewModal = ({ onClose }) => (
  <Modal open onClose={onClose} wide title="Vista previa de cambios" sub="Antes de aplicar"
    footer={<>
      <div style={{ fontSize: 11.5, color: 'var(--amber)', display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon name="warning" size={12} /> Esta acción modifica 58 registros y queda en auditoría
      </div>
      <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
        <button className="btn ghost" onClick={onClose}>Cancelar</button>
        <button className="btn"><Icon name="download" size={12} /> Descargar diff</button>
        <button className="btn primary"><Icon name="check" size={12} stroke={3} /> Confirmar y aplicar</button>
      </div>
    </>}>
    <table className="dt">
      <thead><tr><th>ID</th><th>Campo</th><th>Valor anterior</th><th></th><th>Valor nuevo</th></tr></thead>
      <tbody>
        {[
          { id: 'R-1042', f: 'Empleador', a: 'YPF Sociedad',     b: 'YPF S.A.' },
          { id: 'R-1067', f: 'Empleador', a: 'YPF Sociedad',     b: 'YPF S.A.' },
          { id: 'R-1089', f: 'Empleador', a: 'ypf sa',           b: 'YPF S.A.' },
          { id: 'R-1112', f: 'Empleador', a: 'ypf sa',           b: 'YPF S.A.' },
          { id: 'R-1124', f: 'Empleador', a: 'Y.P.F.',           b: 'YPF S.A.' },
          { id: 'R-1131', f: 'Empleador', a: 'Banco de Galicia', b: 'Banco Galicia' },
          { id: 'R-1145', f: 'Empleador', a: 'BCO. GALICIA',     b: 'Banco Galicia' },
          { id: 'R-1158', f: 'Empleador', a: 'MercadoLibre',     b: 'Mercado Libre' },
        ].map((r, i) => (
          <tr key={i}>
            <td className="mono dim">{r.id}</td>
            <td>{r.f}</td>
            <td className="mono" style={{ color: 'var(--red)', textDecoration: 'line-through' }}>{r.a}</td>
            <td><Icon name="arrowright" size={12} style={{ color: 'var(--fg-dim)' }} /></td>
            <td className="mono" style={{ color: 'var(--green)' }}>{r.b}</td>
          </tr>
        ))}
        <tr><td colSpan={5} style={{ padding: 12, textAlign: 'center', color: 'var(--fg-dim)', fontSize: 11.5 }}>… y 50 cambios más</td></tr>
      </tbody>
    </table>
  </Modal>
);

Object.assign(window, { Corrector });
