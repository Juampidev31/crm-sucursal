'use client';

export default function ReporteCobranzasPage() {
  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Reporte de Cobranzas</h1>
        </div>
      </header>

      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: '60px' }}>
        <a
          href="https://script.google.com/macros/s/AKfycbxDyRmqW7NSU_ZLRgN7JJ8vcU_nR2TVN6nLitfXXneQp6SonXtQmLwBM6tQ0m0mz6Kh/exec"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            padding: '14px 28px', borderRadius: '10px', fontSize: '15px', fontWeight: 700,
            background: '#f7e479', color: '#000', textDecoration: 'none',
          }}
        >
          Ver Informe de Cobranzas
        </a>
      </div>
    </div>
  );
}
