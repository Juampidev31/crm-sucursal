/**
 * Migración one-off: CSV histórico de "Gestiones VICTORIA/MAGALI" (Apps Script) → tabla gestion_diaria
 *
 * USO:
 *   node scripts/migrar-gestion-diaria.mjs "Gestiones VICTORIA - Ingreso Diario Ventas.csv" Victoria
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

const SUPABASE_URL = 'https://cnjqjvqgmclwkuswjzzf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuanFqdnFnbWNsd2t1c3dqenpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjY5NjEsImV4cCI6MjA5MDA0Mjk2MX0.LI-74p-ctrQN2mNfp2s53WO-xtLFiUd1n3xHqIo0sBg';
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Detecta si el archivo es UTF-8 válido (exports frescos de Sheets lo son) o si
// viene con bytes fuera de rango (exports viejos guardados en otra codificación,
// como el histórico de Victoria) y en ese caso cae a latin1.
function leerCsvSmart(path) {
  const buf = readFileSync(path);
  const asUtf8 = buf.toString('utf8');
  const roundTrip = Buffer.from(asUtf8, 'utf8');
  if (Buffer.compare(buf, roundTrip) === 0) return asUtf8;
  return buf.toString('latin1');
}

function parseMonto(raw) {
  if (raw == null || raw === '') return null;
  let str = String(raw).replace(/[^0-9.,-]/g, '');
  if (!str) return null;
  const ld = str.lastIndexOf('.');
  const lc = str.lastIndexOf(',');
  if (lc > ld) {
    str = str.replace(/\./g, '');
    const c = str.lastIndexOf(',');
    str = str.substring(0, c) + '.' + str.substring(c + 1);
  } else if (ld > lc && ld !== -1) {
    str = str.replace(/,/g, '');
  }
  const n = parseFloat(str);
  return isNaN(n) ? null : n;
}

function parseFechaDMY(raw) {
  if (!raw) return null;
  const m = String(raw).trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// Estado histórico (etiqueta vieja del Apps Script) → estado vigente
const ESTADO_MAP = {
  'no califica (otros motivos)': 'No califica',
  'aprobado': 'Aprobado',
  'rechazado': 'Rechazado',
  'falta documentacion': 'Falta Documentacion',
  'califica': 'Califica',
  'sueldo bajo': 'Sueldo bajo',
};
function normalizarEstado(raw) {
  if (!raw) return { estado: '', extra: '' };
  const key = raw.trim().toLowerCase();
  const mapped = ESTADO_MAP[key];
  if (mapped) return { estado: mapped, extra: '' };
  // Valor no reconocido (ej. mojibake "Se envía Invitación"): no se pierde,
  // se preserva en comentarios y el estado queda vacío para revisión manual.
  return { estado: '', extra: `[Estado original: ${raw.trim()}] ` };
}

const TIPO_OPERACION_MAP = { 'apertura': 'Apertura', 'renovacion': 'Renovacion', 'renovación': 'Renovacion' };

async function main() {
  const [, , csvFile, analista] = process.argv;
  if (!csvFile || !analista) {
    console.log('USO: node scripts/migrar-gestion-diaria.mjs <archivo.csv> <analista>');
    process.exit(1);
  }

  const content = leerCsvSmart(csvFile);
  const records = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true, bom: true });
  console.log(`Filas leídas: ${records.length}`);

  const filas = [];
  let saltadas = 0;
  for (const r of records) {
    const cuil = String(r['CUIL'] || '').replace(/\D/g, '').slice(0, 11);
    const nombre = String(r['APELLIDO Y NOMBRE'] || '').trim();
    if (!cuil && !nombre) { saltadas++; continue; }

    const { estado, extra } = normalizarEstado(r['ESTADO']);
    const tipoOpRaw = String(r['APERTURA/RENOVACION'] || '').trim().toLowerCase();

    filas.push({
      analista,
      tipo_cliente: String(r['TIPO DE CLIENTE'] || '').trim(),
      fecha: parseFechaDMY(r['FECHA']),
      nombre,
      cuil,
      actividad: String(r['ACTIVIDAD'] || '').trim(),
      donde_nos_conocio: String(r['Por Donde Nos Conocio'] || '').trim(),
      estado,
      score: r['SCORE'] ? (parseInt(r['SCORE'], 10) || null) : null,
      tipo_operacion: TIPO_OPERACION_MAP[tipoOpRaw] || '',
      monto_otorgado: parseMonto(r['MONTO OTORGADO']) ?? 0,
      interes_x_venta: parseMonto(r['(I) X VENTA']),
      comentarios: (extra + String(r['COMENTARIOS'] || '').trim()).trim(),
    });
  }
  console.log(`Filas a insertar: ${filas.length} (saltadas: ${saltadas})`);

  const BATCH = 200;
  let insertados = 0, fallos = 0;
  for (let i = 0; i < filas.length; i += BATCH) {
    const batch = filas.slice(i, i + BATCH);
    const { error } = await supabase.from('gestion_diaria').insert(batch);
    if (error) {
      console.log(`\nError en batch ${i / BATCH + 1}: ${error.message}`);
      fallos += batch.length;
    } else {
      insertados += batch.length;
      process.stdout.write(`\rInsertados: ${insertados}/${filas.length}`);
    }
  }
  console.log(`\nListo. Insertados: ${insertados}, fallos: ${fallos}.`);
}

main().catch(err => { console.error('Error fatal:', err.message); process.exit(1); });
