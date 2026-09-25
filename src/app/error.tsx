'use client';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', height: '100vh', background: 'var(--surface-input)',
      color: 'var(--text-strong)', fontFamily: 'var(--font-ui)', gap: 16,
    }}>
      <h2 style={{ fontSize: 20, fontWeight: 700 }}>Algo salió mal</h2>
      <p style={{ color: 'var(--text-muted)', fontSize: 14, maxWidth: 400, textAlign: 'center' }}>
        {error.message || 'Ocurrió un error inesperado.'}
      </p>
      <button
        onClick={reset}
        style={{
          marginTop: 8, padding: '10px 24px', borderRadius: 8,
          background: 'var(--accent)', color: 'var(--text-on-accent)', border: 'none',
          fontWeight: 700, fontSize: 14, cursor: 'pointer',
        }}
      >
        Reintentar
      </button>
    </div>
  );
}
