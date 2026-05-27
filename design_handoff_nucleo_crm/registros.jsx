/* eslint-disable */
// Núcleo · CRM Ventas — Registros (tabla + modales)

const TABS = [
  { id: 'all',  label: 'Todos' },
  { id: 'mios', label: 'Asignados a mí' },
  { id: 'rev',  label: 'En revisión' },
  { id: 'apr',  label: 'Aprobados' },
  { id: 'fav',  label: 'Favoritos' },
];

const Registros = () => {
  const [tab, setTab] = React.useState('all');
  const [q, setQ] = React.useState('');
  const [selected, setSelected] = React.useState(new Set());
  const [sortKey, setSortKey] = React.useState('fecha');
  const [sortDir, setSortDir] = React.useState('desc');
  const [editingCell, setEditingCell] = React.useState(null);
  const [modal, setModal] = React.useState(null);
  const [rowMenu, setRowMenu] = React.useState(null);
  const [filters, setFilters] = React.useState({ estado: null, analista: null, score: null });
  const [page, setPage] = React.useState(0);
  const PAGE_SIZE = 14;
  const [registros, setRegistros] = React.useState(REGISTROS);

  const filtered = React.useMemo(() => {
    let xs = registros;
    if (tab === 'rev') xs = xs.filter(r => r.estado === 'En revisión');
    else if (tab === 'apr') xs = xs.filter(r => r.estado === 'Aprobado' || r.estado === 'Concretado');
    else if (tab === 'mios') xs = xs.filter(r => r.analista === 'María Castro');
    if (q) {
      const Q = q.toLowerCase();
      xs = xs.filter(r => r.nombre.toLowerCase().includes(Q) || r.cuil.includes(q) || r.empleador.toLowerCase().includes(Q) || r.id.toLowerCase().includes(Q));
    }
    if (filters.estado) xs = xs.filter(r => r.estado === filters.estado);
    if (filters.analista) xs = xs.filter(r => r.analista === filters.analista);
    if (filters.score === 'alto') xs = xs.filter(r => r.score >= 80);
    else if (filters.score === 'medio') xs = xs.filter(r => r.score >= 60 && r.score < 80);
    else if (filters.score === 'bajo') xs = xs.filter(r => r.score < 60);
    xs = [...xs].sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return xs;
  }, [registros, tab, q, sortKey, sortDir, filters]);

  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const toggleSort = (k) => {
    if (sortKey === k) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('desc'); }
  };
  const sortIcon = (k) => sortKey !== k ? <Icon name="sort" size={10} style={{ opacity: 0.4 }} /> : (
    sortDir === 'asc' ? <Icon name="arrowup" size={10} stroke={2.5} /> : <Icon name="arrowdown" size={10} stroke={2.5} />
  );
  const toggleAll = () => {
    if (selected.size === pageRows.length) setSelected(new Set());
    else setSelected(new Set(pageRows.map(r => r.id)));
  };
  const toggleOne = (id) => {
    const next = new Set(selected);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelected(next);
  };
  const saveRow = (row) => { setRegistros(rs => rs.map(r => r.id === row.id ? row : r)); setModal(null); };
  const addRow = (row) => {
    const id = 'R-' + String(1000 + registros.length + 1);
    setRegistros(rs => [{ ...row, id }, ...rs]);
    setModal(null);
  };

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Registros</h1>
          <div className="sub">{fmtNum(filtered.length)} de {fmtNum(registros.length)} operaciones · {selected.size > 0 ? `${selected.size} seleccionados` : 'Última sync hace 2 min'}</div>
        </div>
        <div className="actions">
          <button className="btn ghost"><Icon name="upload" size={12} /> Importar</button>
          <button className="btn"><Icon name="download" size={12} /> Exportar</button>
          <button className="btn primary" onClick={() => setModal({ type: 'add' })}>
            <Icon name="plus" size={12} stroke={2.5} /> Nuevo registro
          </button>
        </div>
      </div>

      <div className="tabs">
        {TABS.map(t => (
          <div key={t.id} className={cls('tab', tab === t.id && 'active')} onClick={() => { setTab(t.id); setPage(0); }}>
            {t.label}
            {t.id === 'all' && <span className="count">{registros.length}</span>}
            {t.id === 'rev' && <span className="count">{registros.filter(r => r.estado === 'En revisión').length}</span>}
            {t.id === 'apr' && <span className="count">{registros.filter(r => r.estado === 'Aprobado' || r.estado === 'Concretado').length}</span>}
          </div>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, paddingBottom: 8 }}>
          <button className="btn ghost sm"><Icon name="layout" size={11} /> Columnas</button>
          <button className="btn ghost sm"><Icon name="bookmark" size={11} /> Guardar vista</button>
        </div>
      </div>

      <div className="page-body tight">
        <div className="panel">
          <div className="toolbar">
            <div className="search">
              <Icon name="search" size={12} />
              <input placeholder="Buscar por CUIL, nombre, empleador, ID…" value={q} onChange={(e) => setQ(e.target.value)} />
              {q && <Icon name="x" size={11} style={{ cursor: 'pointer' }} onClick={() => setQ('')} />}
            </div>

            <div className="pill-row" style={{ display: 'flex', gap: 4 }}>
              <FilterChip label="Estado"   value={filters.estado}   options={ESTADOS}                                                             onChange={(v) => setFilters(f => ({ ...f, estado: v }))} />
              <FilterChip label="Analista" value={filters.analista} options={ANALISTAS.map(a => a.nombre)}                                         onChange={(v) => setFilters(f => ({ ...f, analista: v }))} />
              <FilterChip label="Score"    value={filters.score}    options={[{ v: 'alto', l: 'Alto (80+)' }, { v: 'medio', l: 'Medio (60-79)' }, { v: 'bajo', l: 'Bajo (<60)' }]} onChange={(v) => setFilters(f => ({ ...f, score: v }))} />
              <button className="chip"><Icon name="plus" size={10} /> Filtro</button>
            </div>

            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
              {selected.size > 0 && (
                <>
                  <span style={{ fontSize: 11.5, color: 'var(--fg-muted)' }}>{selected.size} seleccionados</span>
                  <button className="btn sm"><Icon name="user" size={11} /> Reasignar</button>
                  <button className="btn sm"><Icon name="edit" size={11} /> Bulk edit</button>
                  <button className="btn sm" style={{ color: 'var(--red)' }}><Icon name="trash" size={11} /> Eliminar</button>
                  <div className="vdivider" style={{ height: 16 }} />
                </>
              )}
              <span style={{ fontSize: 11, color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)' }}>{filtered.length} / {registros.length}</span>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="dt">
              <thead>
                <tr>
                  <th className="checkbox"><Check checked={selected.size > 0 && selected.size === pageRows.length} onChange={toggleAll} /></th>
                  <Th id="id"        label="ID"        onSort={toggleSort} icon={sortIcon('id')} />
                  <Th id="cuil"      label="CUIL"      onSort={toggleSort} icon={sortIcon('cuil')} />
                  <Th id="nombre"    label="Nombre"    onSort={toggleSort} icon={sortIcon('nombre')} />
                  <Th id="analista"  label="Analista"  onSort={toggleSort} icon={sortIcon('analista')} />
                  <Th id="estado"    label="Estado"    onSort={toggleSort} icon={sortIcon('estado')} />
                  <Th id="monto"     label="Monto"     right onSort={toggleSort} icon={sortIcon('monto')} />
                  <Th id="cuotas"    label="Cuotas"    right onSort={toggleSort} icon={sortIcon('cuotas')} />
                  <Th id="fecha"     label="Fecha"     onSort={toggleSort} icon={sortIcon('fecha')} />
                  <Th id="score"     label="Score"     onSort={toggleSort} icon={sortIcon('score')} />
                  <Th id="empleador" label="Empleador" onSort={toggleSort} icon={sortIcon('empleador')} />
                  <Th id="cp"        label="C.P."      onSort={toggleSort} icon={sortIcon('cp')} />
                  <th style={{ width: 40 }}></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r) => (
                  <tr key={r.id} className={cls(selected.has(r.id) && 'selected')} onClick={() => setModal({ type: 'view', row: r })}>
                    <td className="checkbox"><Check checked={selected.has(r.id)} onChange={() => toggleOne(r.id)} /></td>
                    <td className="mono dim">{r.id}</td>
                    <td className="mono">{r.cuil}</td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Av name={r.nombre} size="sm" />
                        <span style={{ fontWeight: 500 }}>{r.nombre}</span>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--fg-muted)' }}>
                        <Av name={r.analista} size="sm" />
                        {r.analista.split(' ')[0]}
                      </div>
                    </td>
                    <td onClick={(e) => { e.stopPropagation(); setEditingCell({ row: r.id, col: 'estado' }); }}>
                      {editingCell?.row === r.id && editingCell.col === 'estado' ? (
                        <select className="select" autoFocus style={{ padding: '2px 18px 2px 6px', height: 22 }}
                          defaultValue={r.estado}
                          onBlur={(e) => { saveRow({ ...r, estado: e.target.value }); setEditingCell(null); }}
                          onClick={(e) => e.stopPropagation()}>
                          {ESTADOS.map(s => <option key={s}>{s}</option>)}
                        </select>
                      ) : <StateBadge state={r.estado} />}
                    </td>
                    <td className="mono" style={{ textAlign: 'right', fontWeight: 500 }}>{fmtMoney(r.monto)}</td>
                    <td className="mono dim" style={{ textAlign: 'right' }}>{r.cuotas}×</td>
                    <td className="mono dim">{fmtDate(r.fecha)}</td>
                    <td style={{ minWidth: 120 }}><ScoreBar value={r.score} /></td>
                    <td style={{ color: 'var(--fg-muted)' }}>{r.empleador}</td>
                    <td className="mono dim">{r.cp}</td>
                    <td>
                      <button className="btn ghost icon" onClick={(e) => { e.stopPropagation(); const rect = e.currentTarget.getBoundingClientRect(); setRowMenu({ x: rect.right - 180, y: rect.bottom + 4, row: r }); }}>
                        <Icon name="more" size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
                {pageRows.length === 0 && (
                  <tr><td colSpan={13} style={{ padding: 36, textAlign: 'center', color: 'var(--fg-dim)' }}>Sin resultados para los filtros aplicados.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', padding: '10px 14px', borderTop: '1px solid var(--border-subtle)', gap: 8 }}>
            <span style={{ fontSize: 11.5, color: 'var(--fg-dim)' }}>Página <span className="mono">{page + 1}</span> de <span className="mono">{totalPages}</span> · {filtered.length} resultados</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <button className="btn sm" disabled={page === 0} onClick={() => setPage(0)}>« Inicio</button>
              <button className="btn sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}><Icon name="chevleft" size={11} /></button>
              <button className="btn sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}><Icon name="chevright" size={11} /></button>
              <button className="btn sm" disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>Fin »</button>
            </div>
          </div>
        </div>
      </div>

      {rowMenu && (
        <Popover anchor={{ x: rowMenu.x, y: rowMenu.y }} onClose={() => setRowMenu(null)} items={[
          { icon: 'eye',  label: 'Ver detalle',     onClick: () => setModal({ type: 'view', row: rowMenu.row }) },
          { icon: 'edit', label: 'Editar registro', onClick: () => setModal({ type: 'edit', row: rowMenu.row }) },
          { icon: 'copy', label: 'Duplicar' },
          { sep: true },
          { icon: 'user',     label: 'Reasignar analista' },
          { icon: 'bookmark', label: 'Marcar favorito' },
          { sep: true },
          { icon: 'trash', label: 'Eliminar', danger: true },
        ]} />
      )}

      {modal?.type === 'add'  && <RegistroFormModal mode="add"  onClose={() => setModal(null)} onSave={addRow} />}
      {modal?.type === 'edit' && <RegistroFormModal mode="edit" row={modal.row} onClose={() => setModal(null)} onSave={saveRow} />}
      {modal?.type === 'view' && <RegistroDetailModal row={modal.row} onClose={() => setModal(null)} onEdit={(r) => setModal({ type: 'edit', row: r })} />}
    </>
  );
};

const FilterChip = ({ label, value, options, onChange }) => {
  const [open, setOpen] = React.useState(false);
  const btnRef = React.useRef(null);
  const [anchor, setAnchor] = React.useState(null);
  const opts = options.map(o => typeof o === 'string' ? { v: o, l: o } : o);
  const display = value ? opts.find(o => o.v === value)?.l : null;
  return (
    <>
      <button ref={btnRef} className={cls('chip', value && 'active')}
        onClick={() => { const r = btnRef.current.getBoundingClientRect(); setAnchor({ x: r.left, y: r.bottom + 4 }); setOpen(true); }}>
        <span style={{ color: value ? 'inherit' : 'var(--fg-dim)' }}>{label}{display ? ': ' : ''}</span>
        {display && <strong style={{ fontWeight: 500 }}>{display}</strong>}
        {value
          ? <span onClick={(e) => { e.stopPropagation(); onChange(null); }}><Icon name="x" size={10} /></span>
          : <Icon name="chevdown" size={10} />}
      </button>
      {open && anchor && <Popover anchor={anchor} onClose={() => setOpen(false)} items={opts.map(o => ({ label: o.l, icon: value === o.v ? 'check' : null, onClick: () => onChange(o.v) }))} />}
    </>
  );
};

const Th = ({ id, label, onSort, icon, right }) => (
  <th style={{ cursor: 'pointer', userSelect: 'none', textAlign: right ? 'right' : 'left' }} onClick={() => onSort(id)}>
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{label} {icon}</span>
  </th>
);

const Field = ({ label, hint, error, span, children }) => (
  <div style={{ gridColumn: span ? `span ${span}` : null }}>
    <label className="field-label">{label}</label>
    {children}
    {error ? <div className="field-hint" style={{ color: 'var(--red)' }}>⚠ {error}</div> : hint ? <div className="field-hint">{hint}</div> : null}
  </div>
);

const RegistroFormModal = ({ mode, row, onClose, onSave }) => {
  const [form, setForm] = React.useState(row || {
    cuil: '', nombre: '', analista: ANALISTAS[0].nombre, estado: 'Pendiente',
    monto: 0, fecha: new Date().toISOString().slice(0,10), fechaScore: new Date().toISOString().slice(0,10),
    score: 50, tipoCliente: 'Estándar', acuerdo: 'Estándar', cuotas: 12,
    rangoEtario: '26-35', sexo: 'M', empleador: '', cp: '', comentarios: '',
  });
  const [errors, setErrors] = React.useState({});
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const validateCUIL = (s) => /^\d{2}-\d{8}-\d$/.test(s);
  const formatCUIL = (s) => {
    const d = s.replace(/\D/g, '').slice(0, 11);
    if (d.length <= 2) return d;
    if (d.length <= 10) return `${d.slice(0,2)}-${d.slice(2)}`;
    return `${d.slice(0,2)}-${d.slice(2,10)}-${d.slice(10)}`;
  };
  const submit = () => {
    const e = {};
    if (!validateCUIL(form.cuil)) e.cuil = 'CUIL formato XX-XXXXXXXX-X';
    if (!form.nombre) e.nombre = 'Requerido';
    if (!form.monto || form.monto <= 0) e.monto = 'Monto > 0';
    if (!form.empleador) e.empleador = 'Requerido';
    setErrors(e);
    if (Object.keys(e).length === 0) onSave(form);
  };
  const t = scoreTier(form.score);
  return (
    <Modal open onClose={onClose} wide
      title={mode === 'add' ? 'Nuevo registro' : 'Editar registro'}
      sub={mode === 'edit' ? form.id : 'Validación en tiempo real'}
      footer={<>
        <div style={{ fontSize: 11.5, color: 'var(--fg-dim)' }}>{mode === 'edit' ? 'Los cambios se registran en auditoría' : 'Será asignado automáticamente al crearse'}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn">Guardar borrador</button>
          <button className="btn primary" onClick={submit}>{mode === 'add' ? 'Crear registro' : 'Guardar cambios'}</button>
        </div>
      </>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <Field label="CUIL" hint="Argentina · XX-XXXXXXXX-X" error={errors.cuil}>
          <input className="input mono" placeholder="20-12345678-9" value={form.cuil} onChange={(e) => set('cuil', formatCUIL(e.target.value))} />
        </Field>
        <Field label="Nombre completo" error={errors.nombre} span={2}>
          <input className="input" value={form.nombre} onChange={(e) => set('nombre', e.target.value)} placeholder="Apellido, Nombre" />
        </Field>
        <Field label="Analista asignado">
          <select className="select" value={form.analista} onChange={(e) => set('analista', e.target.value)}>
            {ANALISTAS.map(a => <option key={a.id}>{a.nombre}</option>)}
          </select>
        </Field>
        <Field label="Estado">
          <select className="select" value={form.estado} onChange={(e) => set('estado', e.target.value)}>
            {ESTADOS.map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Tipo de cliente">
          <select className="select" value={form.tipoCliente} onChange={(e) => set('tipoCliente', e.target.value)}>
            {TIPOS_CLIENTE.map(s => <option key={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Monto" hint="ARS" error={errors.monto}>
          <div style={{ position: 'relative' }}>
            <span style={{ position: 'absolute', left: 10, top: 6, color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)' }}>$</span>
            <input className="input mono" style={{ paddingLeft: 22, textAlign: 'right' }} type="number" value={form.monto} onChange={(e) => set('monto', +e.target.value)} />
          </div>
        </Field>
        <Field label="Cuotas">
          <select className="select" value={form.cuotas} onChange={(e) => set('cuotas', +e.target.value)}>
            {CUOTAS.map(c => <option key={c} value={c}>{c} cuotas</option>)}
          </select>
        </Field>
        <Field label="Acuerdo de precios">
          <select className="select" value={form.acuerdo} onChange={(e) => set('acuerdo', e.target.value)}>
            {ACUERDOS.map(a => <option key={a}>{a}</option>)}
          </select>
        </Field>
        <Field label="Fecha operación">
          <input className="input mono" type="date" value={form.fecha.slice(0,10)} onChange={(e) => set('fecha', e.target.value)} />
        </Field>
        <Field label="Fecha de score">
          <input className="input mono" type="date" value={form.fechaScore.slice(0,10)} onChange={(e) => set('fechaScore', e.target.value)} />
        </Field>
        <Field label={`Score · ${t.label}`}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="range" min="0" max="100" value={form.score} onChange={(e) => set('score', +e.target.value)} style={{ flex: 1, accentColor: t.color }} />
            <span className="mono" style={{ width: 30, textAlign: 'right', color: t.color, fontWeight: 600 }}>{form.score}</span>
          </div>
        </Field>
        <Field label="Empleador" error={errors.empleador} span={2}>
          <input className="input" list="empleadores-list" value={form.empleador} onChange={(e) => set('empleador', e.target.value)} placeholder="Comenzá a tipear…" />
          <datalist id="empleadores-list">{EMPLEADORES.map(e => <option key={e} value={e} />)}</datalist>
        </Field>
        <Field label="C.P. / Localidad">
          <input className="input mono" value={form.cp} onChange={(e) => set('cp', e.target.value)} placeholder="1425" />
        </Field>
        <Field label="Rango etario">
          <div style={{ display: 'flex', gap: 4 }}>
            {RANGOS_ETARIOS.map(r => <button key={r} className={cls('chip', form.rangoEtario === r && 'active')} onClick={() => set('rangoEtario', r)}>{r}</button>)}
          </div>
        </Field>
        <Field label="Sexo">
          <div style={{ display: 'flex', gap: 4 }}>
            {['F','M','X'].map(s => <button key={s} className={cls('chip', form.sexo === s && 'active')} onClick={() => set('sexo', s)}>{s}</button>)}
          </div>
        </Field>
        <Field label="Etiquetas">
          <div style={{ display: 'flex', gap: 4 }}>
            <span className="badge blue">Recurrente</span>
            <span className="badge">+ tag</span>
          </div>
        </Field>
        <Field label="Comentarios internos" span={3}>
          <textarea className="textarea" rows={3} value={form.comentarios} onChange={(e) => set('comentarios', e.target.value)} placeholder="Observaciones, contexto, próximos pasos…" />
        </Field>
      </div>

      {mode === 'edit' && (
        <>
          <div className="divider" style={{ margin: '18px 0' }} />
          <div className="panel-title" style={{ marginBottom: 8 }}>Historial reciente del registro</div>
          <div className="timeline">
            <div className="ev dot-blue">
              <div className="head"><strong style={{ fontWeight: 500 }}>Tú</strong><span className="dim">editaste hace unos segundos</span><span className="when">en curso</span></div>
              <div className="desc">Cambios pendientes de confirmación</div>
            </div>
            <div className="ev dot-green">
              <div className="head"><strong style={{ fontWeight: 500 }}>Victoria Suárez</strong><span className="dim">aprobó score</span><span className="when">23 May · 16:42</span></div>
              <div className="desc">Score actualizado: 64 → 78 · bureau externo</div>
            </div>
            <div className="ev">
              <div className="head"><strong style={{ fontWeight: 500 }}>{form.analista}</strong><span className="dim">creó el registro</span><span className="when">{fmtDate(form.fecha)}</span></div>
              <div className="desc">Operación inicial · {form.tipoCliente}</div>
            </div>
          </div>
        </>
      )}
    </Modal>
  );
};

const RegistroDetailModal = ({ row, onClose, onEdit }) => {
  const t = scoreTier(row.score);
  return (
    <Modal open onClose={onClose} wide title={row.nombre} sub={row.id}
      footer={<>
        <div style={{ fontSize: 11.5, color: 'var(--fg-dim)' }}>Creado por <strong style={{ color: 'var(--fg)', fontWeight: 500 }}>{row.analista}</strong> · {fmtDate(row.fecha)}</div>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button className="btn ghost"><Icon name="download" size={12} /> Exportar</button>
          <button className="btn"><Icon name="message" size={12} /> Comentar</button>
          <button className="btn primary" onClick={() => onEdit(row)}><Icon name="edit" size={12} /> Editar</button>
        </div>
      </>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 14, background: 'var(--bg-elev-0)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 14, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10.5, color: 'var(--fg-dim)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>CUIL</div>
          <div className="mono" style={{ fontSize: 14, marginTop: 4 }}>{row.cuil}</div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: 'var(--fg-dim)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>Monto</div>
          <div className="mono" style={{ fontSize: 18, fontWeight: 600, marginTop: 4 }}>{fmtMoney(row.monto)}</div>
          <div className="mono dim" style={{ fontSize: 10.5 }}>en {row.cuotas} cuotas</div>
        </div>
        <div>
          <div style={{ fontSize: 10.5, color: 'var(--fg-dim)', textTransform: 'uppercase', fontFamily: 'var(--font-mono)', letterSpacing: '0.06em' }}>Score · {t.label}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            <svg width="50" height="50" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke={t.color} strokeWidth="3" strokeDasharray={`${row.score} 100`} strokeLinecap="round" pathLength="100" />
            </svg>
            <div className="mono" style={{ fontSize: 22, fontWeight: 600, color: t.color }}>{row.score}</div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 20 }}>
        <div>
          <div className="panel-title" style={{ marginBottom: 10 }}>Detalle</div>
          <DetailGrid items={[
            ['Estado', <StateBadge state={row.estado} />],
            ['Analista', <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Av name={row.analista} size="sm" /> {row.analista}</span>],
            ['Tipo de cliente', row.tipoCliente],
            ['Acuerdo', row.acuerdo],
            ['Empleador', row.empleador],
            ['Localidad', `${row.cp} · ${row.localidad}`],
            ['Rango etario', row.rangoEtario],
            ['Sexo', row.sexo],
            ['Fecha operación', fmtDate(row.fecha)],
            ['Fecha de score', fmtDate(row.fechaScore)],
          ]} />
          {row.comentarios && (
            <>
              <div className="panel-title" style={{ marginTop: 18, marginBottom: 8 }}>Comentarios internos</div>
              <div style={{ background: 'var(--bg-elev-0)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 10, fontSize: 12.5, color: 'var(--fg-muted)', borderLeft: '2px solid var(--amber)' }}>{row.comentarios}</div>
            </>
          )}
        </div>
        <div>
          <div className="panel-title" style={{ marginBottom: 10 }}>Timeline</div>
          <div className="timeline">
            <div className="ev dot-blue">
              <div className="head"><strong style={{ fontWeight: 500 }}>Sistema</strong><span className="dim">sincronizó score</span><span className="when">Hoy 11:32</span></div>
              <div className="desc">Score actualizado desde bureau · {row.score - 4} → {row.score}</div>
            </div>
            <div className="ev dot-green">
              <div className="head"><strong style={{ fontWeight: 500 }}>{row.analista}</strong><span className="dim">cambió estado</span><span className="when">Ayer 16:21</span></div>
              <div className="desc">Pendiente → {row.estado}</div>
            </div>
            <div className="ev dot-blue">
              <div className="head"><strong style={{ fontWeight: 500 }}>{row.analista}</strong><span className="dim">comentó</span><span className="when">Ayer 09:42</span></div>
              <div className="desc">"Cliente confirmó documentación pendiente"</div>
            </div>
            <div className="ev">
              <div className="head"><strong style={{ fontWeight: 500 }}>{row.analista}</strong><span className="dim">creó el registro</span><span className="when">{fmtDate(row.fecha)}</span></div>
              <div className="desc">Operación inicial · Acuerdo {row.acuerdo}</div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

const DetailGrid = ({ items }) => (
  <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', rowGap: 8, columnGap: 12, fontSize: 12.5 }}>
    {items.map(([k, v], i) => (
      <React.Fragment key={i}>
        <div style={{ color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{k}</div>
        <div>{v}</div>
      </React.Fragment>
    ))}
  </div>
);

Object.assign(window, { Registros });
