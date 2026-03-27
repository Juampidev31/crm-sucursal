const CSV_URL =
  'https://docs.google.com/spreadsheets/d/1RcjEoiOM4PN92fNQv0ZUy-soh7Qa98vdvys0rr9_JlM/export?format=csv&gid=1325602277';

interface TramoRow { mes: string; objetivo: string; recupero: string; cumplimiento: string; }
interface MorosidadRow { mes: string; anio2025: string; anio2024: string; mediaEmp: string; }

function parseCSV(text: string): string[][] {
  return text.split('\n').map(line => {
    const cols: string[] = [];
    let inQuote = false, cur = '';
    for (const c of line) {
      if (c === '"') { inQuote = !inQuote; }
      else if (c === ',' && !inQuote) { cols.push(cur); cur = ''; }
      else cur += c;
    }
    cols.push(cur);
    return cols;
  });
}

function parsePct(val: string): number {
  return parseFloat((val || '0').replace('%', '').replace(',', '.')) || 0;
}

function cumplColor(val: string): string {
  const n = parsePct(val);
  if (n >= 100) return '#34d399';
  if (n >= 75) return '#fbbf24';
  return '#f87171';
}

async function getData() {
  const res = await fetch(CSV_URL, { cache: 'no-store' });
  const text = await res.text();
  const rows = parseCSV(text);

  const tramo90: TramoRow[] = [];
  const tramo120: TramoRow[] = [];
  const refin: TramoRow[] = [];

  for (let i = 1; i <= 12; i++) {
    const r = rows[i];
    if (!r?.[0]) continue;
    tramo90.push({ mes: r[0], objetivo: r[1], recupero: r[2], cumplimiento: r[3] });
    tramo120.push({ mes: r[5], objetivo: r[6], recupero: r[7], cumplimiento: r[8] });
    refin.push({ mes: r[10], objetivo: r[11], recupero: r[12], cumplimiento: r[13] });
  }

  let morosidadStart = -1;
  for (let i = 0; i < rows.length; i++) {
    if (rows[i][0] === 'MOROSIDAD') { morosidadStart = i; break; }
  }

  const morosidad: MorosidadRow[] = [];
  let mediaEmpGlobal = '';

  if (morosidadStart >= 0) {
    mediaEmpGlobal = rows[morosidadStart + 1]?.[3] || '';
    for (let i = morosidadStart + 2; i < rows.length; i++) {
      const r = rows[i];
      if (!r?.[0]) continue;
      morosidad.push({ mes: r[0], anio2025: r[1], anio2024: r[2], mediaEmp: r[3] });
    }
  }

  return { tramo90, tramo120, refin, morosidad, mediaEmpGlobal };
}

function TramoTable({ titulo, rows }: { titulo: string; rows: TramoRow[] }) {
  const thStyle: React.CSSProperties = {
    padding: '10px 14px', textAlign: 'left', color: '#555',
    fontWeight: 700, fontSize: '11px', textTransform: 'uppercase',
    letterSpacing: '0.5px', whiteSpace: 'nowrap',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  };
  return (
    <div style={{
      background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)',
      borderRadius: '14px', overflow: 'hidden', flex: 1,
    }}>
      <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <span style={{ fontSize: '11px', fontWeight: 800, color: '#666', letterSpacing: '1px', textTransform: 'uppercase' }}>
          {titulo}
        </span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
        <thead>
          <tr>
            <th style={thStyle}>Mes</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Objetivo</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Recupero</th>
            <th style={{ ...thStyle, textAlign: 'right' }}>Cumpl.</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const color = cumplColor(r.cumplimiento);
            return (
              <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                <td style={{ padding: '9px 14px', color: '#888', fontWeight: 600 }}>{r.mes}</td>
                <td style={{ padding: '9px 14px', color: '#555', textAlign: 'right' }}>{r.objetivo}</td>
                <td style={{ padding: '9px 14px', color: '#fff', fontWeight: 600, textAlign: 'right' }}>{r.recupero}</td>
                <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                  <span style={{
                    color, fontWeight: 800, fontSize: '12px',
                    background: `${color}18`, padding: '2px 8px', borderRadius: '6px',
                  }}>
                    {r.cumplimiento}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

import React from 'react';

export default async function ReporteCobranzasPage() {
  const { tramo90, tramo120, refin, morosidad, mediaEmpGlobal } = await getData();

  const thStyle: React.CSSProperties = {
    padding: '10px 14px', textAlign: 'left', color: '#555',
    fontWeight: 700, fontSize: '11px', textTransform: 'uppercase',
    letterSpacing: '0.5px', whiteSpace: 'nowrap',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  };

  return (
    <div className="dashboard-container">
      <header className="dashboard-header">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <h1 style={{ fontSize: '24px', fontWeight: 800 }}>Reporte de Cobranzas</h1>
        </div>
        {mediaEmpGlobal && (
          <div style={{
            background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)',
            borderRadius: '10px', padding: '10px 18px', textAlign: 'center',
          }}>
            <div style={{ fontSize: '10px', color: '#444', fontWeight: 800, letterSpacing: '1px', marginBottom: '2px' }}>MEDIA EMP.</div>
            <div style={{ fontSize: '20px', fontWeight: 900, color: '#f87171' }}>{mediaEmpGlobal}</div>
          </div>
        )}
      </header>

      {/* Tres tramos */}
      <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
        <TramoTable titulo="Tramo 90-119" rows={tramo90} />
        <TramoTable titulo="Tramo 120-209" rows={tramo120} />
        <TramoTable titulo="Refinanciaciones" rows={refin} />
      </div>

      {/* Morosidad */}
      {morosidad.length > 0 && (
        <div style={{
          background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.04)',
          borderRadius: '14px', overflow: 'hidden',
        }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
            <span style={{ fontSize: '11px', fontWeight: 800, color: '#666', letterSpacing: '1px', textTransform: 'uppercase' }}>
              Morosidad
            </span>
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr>
                <th style={thStyle}>Mes</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>2025</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>2024</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Media Emp.</th>
              </tr>
            </thead>
            <tbody>
              {morosidad.map((r, i) => {
                const val2025 = parsePct(r.anio2025);
                const valMedia = parsePct(r.mediaEmp);
                const color2025 = val2025 > 0 ? (val2025 < valMedia ? '#34d399' : '#f87171') : '#555';
                return (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                    <td style={{ padding: '9px 14px', color: '#888', fontWeight: 600 }}>{r.mes}</td>
                    <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                      <span style={{
                        color: color2025, fontWeight: 800, fontSize: '12px',
                        background: `${color2025}18`, padding: '2px 8px', borderRadius: '6px',
                      }}>
                        {r.anio2025}
                      </span>
                    </td>
                    <td style={{ padding: '9px 14px', color: '#555', textAlign: 'right' }}>{r.anio2024}</td>
                    <td style={{ padding: '9px 14px', color: '#666', textAlign: 'right' }}>{r.mediaEmp}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
