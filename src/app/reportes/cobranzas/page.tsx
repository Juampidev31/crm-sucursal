'use client';

export default function ReporteCobranzasPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', padding: '24px', gap: '16px' }}>
      <header>
        <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Reporte de Cobranzas</h1>
      </header>
      <iframe
        src="https://docs.google.com/spreadsheets/d/1RcjEoiOM4PN92fNQv0ZUy-soh7Qa98vdvys0rr9_JlM/htmlview?gid=1325602277&single=true"
        style={{ flex: 1, border: 'none', borderRadius: '12px', width: '100%' }}
        allowFullScreen
      />
    </div>
  );
}
