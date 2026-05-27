/* eslint-disable */
// Núcleo · CRM Ventas — App shell + Tweaks
const { useState, useEffect } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "accent": "red",
  "density": "regular",
  "showRanking": true,
  "showAlerts": true
}/*EDITMODE-END*/;

const ACCENTS = {
  red:    { red: 'oklch(0.62 0.19 25)',  bg: 'oklch(0.22 0.08 25 / 0.35)', soft: 'oklch(0.30 0.10 25)' },
  amber:  { red: 'oklch(0.74 0.16 65)',  bg: 'oklch(0.26 0.10 65 / 0.35)', soft: 'oklch(0.32 0.10 65)' },
  blue:   { red: 'oklch(0.65 0.17 240)', bg: 'oklch(0.24 0.10 240 / 0.35)', soft: 'oklch(0.30 0.10 240)' },
  green:  { red: 'oklch(0.66 0.16 152)', bg: 'oklch(0.24 0.10 152 / 0.35)', soft: 'oklch(0.30 0.10 152)' },
  violet: { red: 'oklch(0.66 0.16 290)', bg: 'oklch(0.24 0.10 290 / 0.35)', soft: 'oklch(0.30 0.10 290)' },
};

const ACCENT_TO_HEX = { red: '#dc2626', amber: '#f59e0b', blue: '#3b82f6', green: '#22c55e', violet: '#8b5cf6' };

const App = () => {
  const [page, setPage] = useState('dashboard');
  const [tweaks, setTweak] = window.useTweaks ? window.useTweaks(TWEAK_DEFAULTS) : [TWEAK_DEFAULTS, () => {}];

  useEffect(() => { window.__navigate = setPage; }, []);

  useEffect(() => {
    const a = ACCENTS[tweaks.accent] || ACCENTS.red;
    document.documentElement.style.setProperty('--red', a.red);
    document.documentElement.style.setProperty('--red-bg', a.bg);
    document.documentElement.style.setProperty('--red-soft', a.soft);
  }, [tweaks.accent]);

  useEffect(() => {
    if (tweaks.density === 'compact') {
      document.documentElement.style.setProperty('--topbar-h', '44px');
    } else {
      document.documentElement.style.setProperty('--topbar-h', '52px');
    }
  }, [tweaks.density]);

  const CRUMBS = {
    dashboard:  ['Comercial', 'Dashboard'],
    registros:  ['Comercial', 'Registros'],
    alertas:    ['Administración', 'Alertas'],
    corrector:  ['Administración', 'Corrector masivo'],
    reportes:   ['Administración', 'Reportes'],
    scoring:    ['Administración', 'Scoring'],
    auditoria:  ['Administración', 'Auditoría'],
    roles:      ['Administración', 'Roles y permisos'],
    calendario: ['Administración', 'Días hábiles'],
    config:     ['Administración', 'Configuración'],
  };

  return (
    <div className="app">
      <Sidebar active={page} onNavigate={setPage} />
      <main className="main">
        <Topbar crumbs={CRUMBS[page] || ['Núcleo']} />
        <div className="content" data-screen-label={CRUMBS[page]?.join(' / ')}>
          {page === 'dashboard'  && <Dashboard />}
          {page === 'registros'  && <Registros />}
          {page === 'alertas'    && <Alertas />}
          {page === 'corrector'  && <Corrector />}
          {page === 'reportes'   && <Reportes />}
          {page === 'scoring'    && <Scoring />}
          {page === 'auditoria'  && <Auditoria />}
          {page === 'roles'      && <Roles />}
          {page === 'calendario' && <Calendario />}
          {page === 'config'     && <Config />}
        </div>
      </main>

      {window.TweaksPanel && (
        <window.TweaksPanel title="Tweaks">
          <window.TweakSection label="Apariencia">
            <window.TweakColor
              label="Acento"
              value={ACCENT_TO_HEX[tweaks.accent] || '#dc2626'}
              options={['#dc2626','#f59e0b','#3b82f6','#22c55e','#8b5cf6']}
              onChange={(v) => {
                const map = { '#dc2626': 'red', '#f59e0b': 'amber', '#3b82f6': 'blue', '#22c55e': 'green', '#8b5cf6': 'violet' };
                setTweak('accent', map[String(v).toLowerCase()] || 'red');
              }}
            />
            <window.TweakRadio
              label="Densidad"
              value={tweaks.density}
              options={[
                { value: 'regular', label: 'Regular' },
                { value: 'compact', label: 'Compacta' },
              ]}
              onChange={(v) => setTweak('density', v)}
            />
          </window.TweakSection>

          <window.TweakSection label="Dashboard">
            <window.TweakToggle label="Mostrar ranking" value={tweaks.showRanking} onChange={(v) => setTweak('showRanking', v)} />
            <window.TweakToggle label="Mostrar alertas" value={tweaks.showAlerts} onChange={(v) => setTweak('showAlerts', v)} />
          </window.TweakSection>

          <window.TweakSection label="Navegación rápida">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, padding: '0 2px' }}>
              {Object.keys(CRUMBS).map(k => (
                <button key={k} className="btn ghost sm" style={{ justifyContent: 'flex-start', fontSize: 11 }} onClick={() => setPage(k)}>
                  {CRUMBS[k][CRUMBS[k].length - 1]}
                </button>
              ))}
            </div>
          </window.TweakSection>
        </window.TweaksPanel>
      )}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root')).render(<App />);
