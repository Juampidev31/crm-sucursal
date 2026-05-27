/* eslint-disable */
// Núcleo · CRM Ventas — Admin: Roles, Días hábiles, Config

const ROLES = [
  { id: 'sa',  name: 'Super Admin', members: 2,  color: 'oklch(0.62 0.19 25)',  desc: 'Acceso total al sistema' },
  { id: 'ad',  name: 'Admin',       members: 4,  color: 'oklch(0.78 0.16 75)',  desc: 'Gestión de configuración y usuarios' },
  { id: 'sup', name: 'Supervisor',  members: 7,  color: 'oklch(0.72 0.13 240)', desc: 'Supervisa equipos de analistas' },
  { id: 'an',  name: 'Analista',    members: 24, color: 'oklch(0.72 0.16 152)', desc: 'Operación comercial diaria' },
  { id: 'au',  name: 'Auditor',     members: 3,  color: 'oklch(0.70 0.14 290)', desc: 'Solo lectura · acceso a logs' },
];
const PERMS = [
  { group: 'Registros',      items: ['Crear', 'Editar', 'Eliminar', 'Exportar', 'Importar', 'Reasignar'] },
  { group: 'Análisis',       items: ['Ver dashboards', 'Ver reportes', 'Crear reportes', 'Exportar PDF'] },
  { group: 'Gestión masiva', items: ['Corrector empleadores', 'Corrector localidades', 'Merge duplicados', 'Bulk edit'] },
  { group: 'Administración', items: ['Gestionar usuarios', 'Configurar roles', 'Días hábiles', 'Reglas de alertas'] },
  { group: 'Auditoría',      items: ['Ver logs', 'Exportar logs', 'Eliminar logs'] },
];
const ROLE_PERMS = {
  sa: PERMS.flatMap(g => g.items),
  ad: ['Crear','Editar','Eliminar','Exportar','Importar','Reasignar','Ver dashboards','Ver reportes','Crear reportes','Exportar PDF','Corrector empleadores','Corrector localidades','Merge duplicados','Bulk edit','Gestionar usuarios','Días hábiles','Reglas de alertas','Ver logs','Exportar logs'],
  sup: ['Crear','Editar','Exportar','Importar','Reasignar','Ver dashboards','Ver reportes','Crear reportes','Exportar PDF','Bulk edit','Ver logs','Exportar logs'],
  an:  ['Crear','Editar','Exportar','Ver dashboards','Ver reportes','Exportar PDF'],
  au:  ['Ver dashboards','Ver reportes','Exportar PDF','Ver logs','Exportar logs'],
};

const Roles = () => {
  const [active, setActive] = React.useState('sa');
  const cur = ROLES.find(r => r.id === active);
  const perms = new Set(ROLE_PERMS[active]);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Roles y permisos</h1>
          <div className="sub">RBAC · {ROLES.length} roles · {ROLES.reduce((s, r) => s + r.members, 0)} usuarios totales</div>
        </div>
        <div className="actions">
          <button className="btn ghost"><Icon name="download" size={12} /> Exportar matriz</button>
          <button className="btn primary"><Icon name="plus" size={12} /> Nuevo rol</button>
        </div>
      </div>
      <div className="page-body" style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 14 }}>
        <div className="panel" style={{ padding: 4, alignSelf: 'start' }}>
          {ROLES.map(r => (
            <div key={r.id} className={cls('nav-item', active === r.id && 'active')} onClick={() => setActive(r.id)} style={{ padding: '10px 10px', gap: 10 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: r.color }} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 12.5 }}>{r.name}</div>
                <div style={{ fontSize: 11, color: 'var(--fg-dim)' }}>{r.members} usuario{r.members === 1 ? '' : 's'}</div>
              </div>
              <Icon name="chevright" size={11} style={{ opacity: 0.4 }} />
            </div>
          ))}
        </div>
        <div className="panel">
          <div className="panel-header">
            <span style={{ width: 10, height: 10, borderRadius: 2, background: cur.color, marginRight: 4 }} />
            <span className="panel-title">{cur.name}</span>
            <span className="panel-sub">{cur.desc}</span>
            <div className="panel-actions">
              <button className="btn ghost sm"><Icon name="users" size={11} /> Ver miembros ({cur.members})</button>
              <button className="btn ghost sm"><Icon name="copy" size={11} /> Duplicar</button>
            </div>
          </div>
          <div className="panel-body" style={{ padding: 0 }}>
            {PERMS.map((g, gi) => (
              <div key={g.group} style={{ borderBottom: gi < PERMS.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                <div style={{ padding: '10px 14px 4px', fontSize: 10.5, fontFamily: 'var(--font-mono)', color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{g.group}</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)' }}>
                  {g.items.map(p => (
                    <label key={p} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', cursor: 'pointer', fontSize: 12.5, borderRight: '1px solid var(--border-subtle)' }}>
                      <Toggle on={perms.has(p)} />
                      <span style={{ color: perms.has(p) ? 'var(--fg)' : 'var(--fg-dim)' }}>{p}</span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
};

const FERIADOS = [
  { date: '2026-05-25', name: 'Día de la Revolución de Mayo',          type: 'nacional' },
  { date: '2026-06-15', name: 'Paso a la Inmortalidad Gral. Güemes',   type: 'nacional' },
  { date: '2026-06-20', name: 'Paso a la Inmortalidad Gral. Belgrano', type: 'nacional' },
  { date: '2026-07-09', name: 'Día de la Independencia',               type: 'nacional' },
  { date: '2026-07-13', name: 'Asueto bancario',                       type: 'sectorial' },
  { date: '2026-08-17', name: 'Paso a la Inmortalidad Gral. San Martín', type: 'nacional' },
  { date: '2026-10-12', name: 'Día del Respeto a la Diversidad Cultural', type: 'nacional' },
];

const Calendario = () => {
  const [year, setYear] = React.useState(2026);
  const [month, setMonth] = React.useState(4);
  const [excludeSat, setExcludeSat] = React.useState(true);
  const [excludeSun, setExcludeSun] = React.useState(true);
  const firstDay = new Date(year, month, 1);
  const startDow = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const feriadosInMonth = FERIADOS.filter(f => {
    const d = new Date(f.date);
    return d.getMonth() === month && d.getFullYear() === year;
  });
  const feriadoDates = new Set(feriadosInMonth.map(f => new Date(f.date).getDate()));
  let habil = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month, d).getDay();
    if (excludeSat && dow === 6) continue;
    if (excludeSun && dow === 0) continue;
    if (feriadoDates.has(d)) continue;
    habil++;
  }
  const MES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Días hábiles</h1>
          <div className="sub">Configuración de calendario · Feriados · Cierres mensuales</div>
        </div>
        <div className="actions">
          <button className="btn ghost"><Icon name="download" size={12} /> Exportar .ics</button>
          <button className="btn"><Icon name="upload" size={12} /> Importar feriados</button>
          <button className="btn primary"><Icon name="plus" size={12} /> Nuevo feriado</button>
        </div>
      </div>
      <div className="page-body" style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: 14 }}>
        <div className="panel">
          <div className="panel-header">
            <button className="btn ghost icon" onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }}>
              <Icon name="chevleft" size={12} />
            </button>
            <span className="panel-title" style={{ minWidth: 140 }}>{MES[month]} {year}</span>
            <button className="btn ghost icon" onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }}>
              <Icon name="chevright" size={12} />
            </button>
            <div className="panel-actions"><span className="mono dim" style={{ fontSize: 11 }}>{habil} días hábiles</span></div>
          </div>
          <div className="panel-body">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
              {['L','M','X','J','V','S','D'].map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: 10, color: 'var(--fg-dim)', fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.05em', padding: '6px 0' }}>{d}</div>
              ))}
              {Array.from({ length: startDow }).map((_, i) => <div key={'e' + i} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const dow = new Date(year, month, day).getDay();
                const isWeekend = dow === 0 || dow === 6;
                const isFeriado = feriadoDates.has(day);
                const isHabil = !((excludeSat && dow === 6) || (excludeSun && dow === 0) || isFeriado);
                const isToday = year === 2026 && month === 4 && day === 24;
                const feriado = feriadosInMonth.find(f => new Date(f.date).getDate() === day);
                return (
                  <div key={i} style={{
                    height: 60,
                    background: isToday ? 'oklch(0.22 0.06 25 / 0.4)' : isHabil ? 'var(--bg-elev-1)' : 'var(--bg-elev-0)',
                    border: `1px solid ${isToday ? 'var(--red)' : isFeriado ? 'oklch(0.30 0.18 75 / 0.5)' : 'var(--border-subtle)'}`,
                    borderRadius: 4, padding: 6, fontSize: 11, opacity: isHabil ? 1 : 0.5,
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: isToday ? 'var(--red)' : isFeriado ? 'var(--amber)' : isWeekend ? 'var(--fg-dim)' : 'var(--fg)', fontWeight: isToday ? 600 : 400, fontFamily: 'var(--font-mono)' }}>
                      {String(day).padStart(2, '0')}
                      {isFeriado && <Icon name="flag" size={9} style={{ color: 'var(--amber)' }} />}
                    </div>
                    {feriado && <div style={{ fontSize: 9, color: 'var(--amber)', marginTop: 2, lineHeight: 1.2, fontWeight: 500 }}>{feriado.name.split(' ').slice(0, 3).join(' ')}…</div>}
                    {isToday && <div style={{ fontSize: 9, color: 'var(--red)', marginTop: 2, fontFamily: 'var(--font-mono)' }}>HOY</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="panel">
            <div className="panel-header"><span className="panel-title">Reglas de cálculo</span></div>
            <div className="panel-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <SettingRow label="Excluir sábados" sub="Sábados no cuentan como hábiles" on={excludeSat} onChange={setExcludeSat} />
              <SettingRow label="Excluir domingos" sub="Domingos no cuentan como hábiles" on={excludeSun} onChange={setExcludeSun} />
              <SettingRow label="Excluir feriados nacionales" sub="Cargados manualmente" on={true} />
              <SettingRow label="Cierre el último día hábil" sub="Cierre automático mensual" on={true} />
              <SettingRow label="Notificar 3 días antes del cierre" sub="Email + push a supervisores" on={true} />
              <div className="divider" />
              <div>
                <div className="field-label">Hora de cierre diaria</div>
                <input className="input mono" type="time" defaultValue="18:00" style={{ maxWidth: 120 }} />
              </div>
            </div>
          </div>

          <div className="panel">
            <div className="panel-header"><span className="panel-title">Feriados próximos</span><span className="panel-sub">{FERIADOS.length} cargados</span></div>
            <div>
              {FERIADOS.map(f => (
                <div key={f.date} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderTop: '1px solid var(--border-subtle)', fontSize: 12 }}>
                  <span style={{ width: 30, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--fg-dim)' }}>{new Date(f.date).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' }).replace('.','')}</span>
                  <div style={{ flex: 1 }}>{f.name}</div>
                  <Badge kind={f.type === 'nacional' ? 'red' : 'amber'}>{f.type}</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

const SettingRow = ({ label, sub, on, onChange }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: 12.5, fontWeight: 500 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--fg-dim)' }}>{sub}</div>}
    </div>
    <span onClick={() => onChange?.(!on)}><Toggle on={on} /></span>
  </div>
);

const Config = () => {
  const [section, setSection] = React.useState('general');
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Configuración</h1>
          <div className="sub">Empresa · API · Backup · Integraciones · Multiempresa</div>
        </div>
      </div>
      <div className="page-body" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 14 }}>
        <div className="panel" style={{ padding: 6, alignSelf: 'start' }}>
          {[
            { id: 'general',   l: 'General',     i: 'building' },
            { id: 'api',       l: 'API REST',    i: 'database' },
            { id: 'webhooks',  l: 'Webhooks',    i: 'link' },
            { id: 'backup',    l: 'Backup',      i: 'shield' },
            { id: 'multi',     l: 'Multiempresa',i: 'layers' },
            { id: 'seguridad', l: 'Seguridad',   i: 'lock' },
            { id: 'tema',      l: 'Apariencia',  i: 'panel' },
          ].map(s => (
            <div key={s.id} className={cls('nav-item', section === s.id && 'active')} onClick={() => setSection(s.id)} style={{ padding: '8px 10px', fontSize: 12.5 }}>
              <Icon name={s.i} size={13} />{s.l}
            </div>
          ))}
        </div>
        <div className="panel">
          <div className="panel-header"><span className="panel-title">{section === 'general' ? 'Configuración general' : section === 'api' ? 'API REST · Tokens' : section === 'webhooks' ? 'Webhooks' : section === 'backup' ? 'Backup automático' : section === 'multi' ? 'Multiempresa' : section === 'seguridad' ? 'Seguridad' : 'Apariencia'}</span></div>
          <div className="panel-body">
            {section === 'general' && <ConfigGeneral />}
            {section === 'api' && <ConfigApi />}
            {section === 'webhooks' && <ConfigWebhooks />}
            {section === 'backup' && <ConfigBackup />}
            {section === 'multi' && <ConfigMulti />}
            {section === 'seguridad' && <ConfigSeguridad />}
            {section === 'tema' && <ConfigTema />}
          </div>
        </div>
      </div>
    </>
  );
};

const FieldC = ({ label, hint, children }) => (
  <div>
    <label className="field-label">{label}</label>
    {children}
    {hint && <div className="field-hint">{hint}</div>}
  </div>
);

const ConfigGeneral = () => (
  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
    <FieldC label="Razón social"><input className="input" defaultValue="FederAR S.A. · PDV 713" /></FieldC>
    <FieldC label="CUIT"><input className="input mono" defaultValue="30-71234567-8" /></FieldC>
    <FieldC label="Dirección"><input className="input" defaultValue="Av. Corrientes 1234, CABA" /></FieldC>
    <FieldC label="Teléfono"><input className="input mono" defaultValue="+54 11 4567-8900" /></FieldC>
    <FieldC label="Zona horaria"><select className="select"><option>America/Argentina/Buenos_Aires (-03:00)</option></select></FieldC>
    <FieldC label="Moneda primaria"><select className="select"><option>ARS · Peso Argentino</option></select></FieldC>
    <FieldC label="Formato fecha"><select className="select"><option>DD/MM/YYYY</option></select></FieldC>
    <FieldC label="Locale"><select className="select"><option>es-AR · Español (Argentina)</option></select></FieldC>
  </div>
);

const ConfigApi = () => (
  <div>
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10, alignItems: 'center', padding: '8px 0' }}>
      <Icon name="check" size={14} style={{ color: 'var(--green)' }} />
      <div>
        <div style={{ fontWeight: 500, fontSize: 13 }}>API REST · v2</div>
        <div style={{ fontSize: 11.5, color: 'var(--fg-dim)' }}>https://api.federar.app/v2 · Documentación OpenAPI</div>
      </div>
      <button className="btn"><Icon name="external" size={12} /> Ver docs</button>
    </div>
    <div className="divider" style={{ margin: '14px 0' }} />
    <div style={{ marginBottom: 10, display: 'flex', alignItems: 'center' }}>
      <span style={{ fontWeight: 500 }}>Access tokens</span>
      <button className="btn primary sm" style={{ marginLeft: 'auto' }}><Icon name="plus" size={11} /> Generar token</button>
    </div>
    <table className="dt">
      <thead><tr><th>Nombre</th><th>Token</th><th>Creado</th><th>Último uso</th><th style={{width: 60}}></th></tr></thead>
      <tbody>
        {[
          { n: 'Producción · Backend',  t: 'sk_live_••••••••••••a8c2', c: '12 Ene 2026', u: 'Hace 2 min' },
          { n: 'Mobile App · iOS',      t: 'sk_live_••••••••••••f4e1', c: '03 Mar 2026', u: 'Hace 14 min' },
          { n: 'Reportes BI · staging', t: 'sk_test_••••••••••••29bd', c: '21 Abr 2026', u: 'Ayer' },
        ].map((t, i) => (
          <tr key={i}>
            <td style={{ fontWeight: 500 }}>{t.n}</td>
            <td className="mono dim">{t.t}</td>
            <td className="mono dim" style={{ fontSize: 11 }}>{t.c}</td>
            <td className="mono dim" style={{ fontSize: 11 }}>{t.u}</td>
            <td><button className="btn ghost icon" style={{ color: 'var(--red)' }}><Icon name="trash" size={11} /></button></td>
          </tr>
        ))}
      </tbody>
    </table>
    <div className="divider" style={{ margin: '14px 0' }} />
    <SettingRow label="Rate limit" sub="1000 req/min por token" on={true} />
    <SettingRow label="WebSockets en tiempo real" sub="Push de cambios en /v2/stream" on={true} />
  </div>
);

const ConfigWebhooks = () => (
  <div>
    <table className="dt">
      <thead><tr><th>URL</th><th>Eventos</th><th>Estado</th><th>Último</th></tr></thead>
      <tbody>
        {[
          { u: 'https://crm.acme.com/hooks/sales', e: 'registro.created · registro.updated', s: 'OK', t: 'Hace 4 min' },
          { u: 'https://slack.com/api/incoming/...', e: 'alerta.critical',                   s: 'OK', t: 'Hace 1 h' },
          { u: 'https://bi.empresa.io/ingest',     e: 'registro.* · audit.*',                s: 'Fallando', t: 'Ayer 18:42' },
        ].map((w, i) => (
          <tr key={i}>
            <td className="mono" style={{ fontSize: 11 }}>{w.u}</td>
            <td className="mono dim" style={{ fontSize: 11 }}>{w.e}</td>
            <td>{w.s === 'OK' ? <Badge kind="green" dot>OK</Badge> : <Badge kind="red" dot>Fallando</Badge>}</td>
            <td className="mono dim" style={{ fontSize: 11 }}>{w.t}</td>
          </tr>
        ))}
      </tbody>
    </table>
    <button className="btn primary sm" style={{ marginTop: 14 }}><Icon name="plus" size={11} /> Agregar webhook</button>
  </div>
);

const ConfigBackup = () => (
  <div>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
      {[
        { l: 'Último backup', v: 'Hoy 03:00', c: 'green' },
        { l: 'Tamaño',        v: '2.4 GB',    c: 'blue' },
        { l: 'Retención',     v: '30 días',   c: 'amber' },
      ].map(s => (
        <div key={s.l} style={{ background: 'var(--bg-elev-0)', border: '1px solid var(--border-subtle)', borderRadius: 6, padding: 12 }}>
          <div className="mono" style={{ fontSize: 10, color: 'var(--fg-dim)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{s.l}</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginTop: 4, color: `var(--${s.c})` }}>{s.v}</div>
        </div>
      ))}
    </div>
    <SettingRow label="Backup automático diario" sub="03:00 · S3 + Glacier" on={true} />
    <SettingRow label="Cifrado AES-256" sub="Habilitado por defecto" on={true} />
    <SettingRow label="Snapshot semanal completo" sub="Domingos 02:00" on={true} />
    <SettingRow label="Replicación cross-region" sub="us-east-1 → sa-east-1" on={false} />
    <div className="divider" style={{ margin: '14px 0' }} />
    <button className="btn"><Icon name="download" size={12} /> Descargar último backup</button>
    <button className="btn" style={{ marginLeft: 8 }}><Icon name="refresh" size={12} /> Backup manual ahora</button>
  </div>
);

const ConfigMulti = () => (
  <div>
    <div style={{ marginBottom: 14, fontSize: 12.5, color: 'var(--fg-muted)' }}>Trabaja con múltiples organizaciones desde una sola cuenta.</div>
    {[
      { n: 'FederAR · PDV 713', plan: 'Enterprise', m: 47, current: true },
      { n: 'FederAR · PDV 510', plan: 'Pro',        m: 12, current: false },
      { n: 'Demo · Sandbox',    plan: 'Free',       m: 3,  current: false },
    ].map(o => (
      <div key={o.n} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: o.current ? 'oklch(0.22 0.06 25 / 0.15)' : 'var(--bg-elev-0)', border: `1px solid ${o.current ? 'var(--red)' : 'var(--border-subtle)'}`, borderRadius: 6, marginBottom: 8 }}>
        <div style={{ width: 32, height: 32, borderRadius: 6, background: 'linear-gradient(135deg, var(--red), oklch(0.45 0.18 18))', display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 600 }}>{o.n.split(' ').map(w => w[0]).slice(0, 2).join('')}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 500 }}>{o.n} {o.current && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--red)', fontFamily: 'var(--font-mono)' }}>· ACTIVO</span>}</div>
          <div style={{ fontSize: 11, color: 'var(--fg-dim)' }}>{o.m} usuarios · Plan {o.plan}</div>
        </div>
        {!o.current && <button className="btn sm">Cambiar a este</button>}
      </div>
    ))}
    <button className="btn ghost" style={{ marginTop: 6 }}><Icon name="plus" size={12} /> Crear nuevo workspace</button>
  </div>
);

const ConfigSeguridad = () => (
  <div>
    <SettingRow label="Autenticación de dos factores (2FA)" sub="Obligatoria para Super Admin y Admin" on={true} />
    <SettingRow label="Sesión expira en 8 horas" sub="Auto-logout por inactividad" on={true} />
    <SettingRow label="Restricción por IP" sub="Solo permitir rangos corporativos" on={false} />
    <SettingRow label="Auditoría de exportaciones" sub="Log de cada PDF/CSV generado" on={true} />
    <SettingRow label="Bloqueo tras 5 intentos fallidos" sub="Por 30 minutos" on={true} />
    <SettingRow label="Force password rotation" sub="Cada 90 días" on={false} />
    <div className="divider" style={{ margin: '14px 0' }} />
    <div className="field-label">Política de contraseñas</div>
    <div style={{ fontSize: 12, color: 'var(--fg-muted)', lineHeight: 1.7 }}>
      • Mínimo 12 caracteres<br/>
      • Al menos 1 mayúscula, 1 número y 1 símbolo<br/>
      • No reutilizar últimas 5 contraseñas<br/>
      • Verificación contra HaveIBeenPwned
    </div>
  </div>
);

const ConfigTema = () => (
  <div>
    <div className="field-label">Modo</div>
    <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
      <button className="btn primary"><Icon name="layout" size={12} /> Oscuro</button>
      <button className="btn">Claro</button>
      <button className="btn">Sistema</button>
    </div>
    <SettingRow label="Glassmorphism" sub="Desenfoque sutil en modales y popovers" on={true} />
    <SettingRow label="Animaciones suaves" sub="Transiciones y entrada de elementos" on={true} />
    <SettingRow label="Densidad compacta" sub="Más datos por pantalla" on={false} />
    <SettingRow label="Tipografía monoespaciada en tablas" sub="Mejor alineación numérica" on={true} />
  </div>
);

Object.assign(window, { Roles, Calendario, Config });
