/**
 * Script de Migración: Google Sheets CSV → Supabase
 * 
 * USO:
 *   node scripts/migrate-csv.mjs datos.csv
 * 
 * El CSV debe tener las columnas de la hoja original:
 *   CUIL | Nombre | Puntaje | esRE | Analista | Fecha | FechaScore | Monto | Estado | Comentarios
 * 
 * Acepta separadores: coma (,) o punto y coma (;)
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { parse } from 'csv-parse/sync';

// ─── CONFIG ────────────────────────────────────
const SUPABASE_URL = 'https://cnjqjvqgmclwkuswjzzf.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNuanFqdnFnbWNsd2t1c3dqenpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ0NjY5NjEsImV4cCI6MjA5MDA0Mjk2MX0.LI-74p-ctrQN2mNfp2s53WO-xtLFiUd1n3xHqIo0sBg';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ─── HELPERS ───────────────────────────────────
function limpiarMonto(raw) {
  if (raw == null || raw === '') return 0;
  let str = String(raw).trim();
  // Quitar signos de moneda y espacios
  str = str.replace(/[$\s]/g, '');
  // Formato argentino: 1.500.000,50 → 1500000.50
  if (str.includes(',') && str.includes('.')) {
    // Si hay puntos como separadores de miles y coma como decimal
    if (str.lastIndexOf('.') < str.lastIndexOf(',')) {
      str = str.replace(/\./g, '').replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes(',') && !str.includes('.')) {
    // Solo coma → podría ser decimal
    const parts = str.split(',');
    if (parts.length === 2 && parts[1].length <= 2) {
      str = str.replace(',', '.');
    } else {
      str = str.replace(/,/g, '');
    }
  } else if (str.includes('.')) {
    // Solo puntos → verificar si es separador de miles
    const parts = str.split('.');
    if (parts.length > 2 || (parts.length === 2 && parts[1].length === 3)) {
      str = str.replace(/\./g, '');
    }
  }
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

function parseFecha(raw) {
  if (!raw || raw === '' || raw === '-') return null;
  const str = String(raw).trim();
  
  // dd/mm/yyyy
  const match1 = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (match1) {
    const [, d, m, y] = match1;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  
  // yyyy-mm-dd (ya está en formato ISO)
  const match2 = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match2) {
    const y = parseInt(match2[1]);
    if (y >= 2000 && y <= 2050) return `${match2[1]}-${match2[2]}-${match2[3]}`;
    return null; // año fuera de rango (ej: "20025" → typo en el CSV)
  }

  // mm/dd/yyyy (formato US)
  const match3 = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2})$/);
  if (match3) {
    const [, m, d, y] = match3;
    const fullYear = parseInt(y) > 50 ? `19${y}` : `20${y}`;
    return `${fullYear}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }

  // Intentar con Date() — solo para formatos razonables
  if (str.length <= 20) {
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      return d.toISOString().split('T')[0];
    }
  }

  return null;
}

function parseEsRE(raw) {
  if (!raw) return false;
  const s = String(raw).trim().toUpperCase();
  return s === 'SI' || s === 'SÍ' || s === 'TRUE' || s === '1' || s === 'VERDADERO' || s === 'RE';
}

function normalizarEstado(raw) {
  if (!raw) return 'proyeccion';
  const s = String(raw).trim().toLowerCase();
  const map = {
    'venta': 'venta',
    'proyeccion': 'proyeccion',
    'proyección': 'proyeccion',
    'en seguimiento': 'en seguimiento',
    'score bajo': 'score bajo',
    'afectaciones': 'afectaciones',
    'derivado / aprobado cc': 'derivado / aprobado cc',
    'aprobado cc': 'derivado / aprobado cc',
    'derivado / rechazado cc': 'derivado / rechazado cc',
    'rechazado cc': 'derivado / rechazado cc',
  };
  return map[s] || s;
}

// ─── DETECTAR COLUMNAS ─────────────────────────
function detectarColumnas(headers) {
  const mapa = {};
  const headersLower = headers.map(h => h.toLowerCase().trim());
  
  const patrones = {
    cuil: ['cuil', 'cuit', 'dni', 'documento'],
    nombre: ['nombre', 'cliente', 'name', 'razon social'],
    puntaje: ['puntaje', 'score', 'puntuacion', 'puntuación', 'punt'],
    es_re: ['esre', 'es_re', 'es re', 're', 'refinanciamiento'],
    analista: ['analista', 'vendedor', 'asesor', 'ejecutivo'],
    fecha: ['fecha', 'date', 'fecha registro', 'fechareg'],
    fecha_score: ['fechascore', 'fecha_score', 'fecha score', 'fecha puntaje'],
    monto: ['monto', 'importe', 'valor', 'amount', 'capital'],
    estado: ['estado', 'status', 'situacion', 'situación'],
    comentarios: ['comentarios', 'comentario', 'observaciones', 'notas', 'obs'],
  };

  for (const [campo, opciones] of Object.entries(patrones)) {
    const idx = headersLower.findIndex(h => opciones.some(p => h.includes(p)));
    if (idx !== -1) mapa[campo] = idx;
  }

  return mapa;
}

// ─── MAIN ──────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const cleanMode = args.includes('--clean');
  const csvFile = args.find(a => !a.startsWith('--'));

  if (!csvFile) {
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║  MIGRACIÓN: Google Sheets CSV → Supabase                ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('  USO:  node scripts/migrate-csv.mjs <archivo.csv> [--clean]');
    console.log('');
    console.log('  --clean   Borra TODOS los registros existentes antes de');
    console.log('            insertar. Útil para re-migrar desde cero.');
    console.log('');
    console.log('  El CSV debe contener las columnas de tu hoja:');
    console.log('  CUIL | Nombre | Puntaje | esRE | Analista | Fecha |');
    console.log('  FechaScore | Monto | Estado | Comentarios');
    console.log('');
    console.log('  Pasos:');
    console.log('  1. Abrí tu Google Sheet');
    console.log('  2. Archivo → Descargar → CSV (.csv)');
    console.log('  3. Guardá el archivo en esta carpeta');
    console.log('  4. Ejecutá: node scripts/migrate-csv.mjs nombre.csv --clean');
    console.log('');
    process.exit(1);
  }

  console.log('\n🔄 Leyendo archivo:', csvFile, '\n');

  // Leer CSV
  const content = readFileSync(csvFile, 'utf-8');
  
  // Detectar delimitador
  const firstLine = content.split('\n')[0];
  const delimiter = firstLine.split(';').length > firstLine.split(',').length ? ';' : ',';
  console.log(`📋 Delimitador detectado: "${delimiter === ';' ? 'punto y coma' : 'coma'}"`);

  const records = parse(content, {
    delimiter,
    columns: false,
    skip_empty_lines: true,
    relax_column_count: true,
    bom: true, // Manejo de BOM en archivos UTF-8
  });

  if (records.length < 2) {
    console.log('❌ El archivo no tiene datos (solo encabezados o vacío)');
    process.exit(1);
  }

  // Detectar columnas
  const headers = records[0];
  console.log(`📊 Encabezados encontrados: ${headers.join(' | ')}`);
  
  const mapa = detectarColumnas(headers);
  console.log(`🔍 Columnas mapeadas:`, mapa);

  // Si no se detectan columnas, asumir orden original de la hoja
  if (Object.keys(mapa).length < 3) {
    console.log('⚠️  No se detectaron suficientes columnas por nombre.');
    console.log('📌 Asumiendo orden original: CUIL | Nombre | Puntaje | esRE | Analista | Fecha | FechaScore | Monto | Estado | Comentarios');
    Object.assign(mapa, { cuil: 0, nombre: 1, puntaje: 2, es_re: 3, analista: 4, fecha: 5, fecha_score: 6, monto: 7, estado: 8, comentarios: 9 });
  }

  const datos = records.slice(1); // Saltar encabezados
  console.log(`\n📦 Total de filas a procesar: ${datos.length}\n`);

  // Transformar datos
  const registros = [];
  let errores = 0;

  for (let i = 0; i < datos.length; i++) {
    const fila = datos[i];
    try {
      const cuil = String(fila[mapa.cuil] || '').trim();
      const nombre = String(fila[mapa.nombre] || '').trim();
      const analista = String(fila[mapa.analista] || '').trim();

      // Saltar filas vacías o filas de totales/subtotales del spreadsheet
      if (!cuil && !nombre) continue;
      if (analista.startsWith('$') || analista.includes('%') || /^\d/.test(analista)) {
        console.log(`⏭️  Fila ${i + 2} ignorada (fila de totales): ${nombre || cuil}`);
        continue;
      }

      registros.push({
        cuil,
        nombre,
        puntaje: parseInt(fila[mapa.puntaje]) || 0,
        es_re: parseEsRE(fila[mapa.es_re]),
        analista: String(fila[mapa.analista] || '').trim(),
        fecha: parseFecha(fila[mapa.fecha]),
        fecha_score: mapa.fecha_score !== undefined ? parseFecha(fila[mapa.fecha_score]) : null,
        monto: limpiarMonto(fila[mapa.monto]),
        estado: normalizarEstado(fila[mapa.estado]),
        comentarios: String(fila[mapa.comentarios] || '').trim(),
      });
    } catch (err) {
      errores++;
      if (errores <= 5) console.log(`⚠️  Error en fila ${i + 2}: ${err.message}`);
    }
  }

  console.log(`✅ Registros válidos: ${registros.length}`);
  if (errores > 0) console.log(`⚠️  Filas con errores: ${errores}`);

  if (registros.length === 0) {
    console.log('❌ No hay registros para migrar');
    process.exit(1);
  }

  // Preview primeros 3 registros
  console.log('\n📋 Preview (primeros 3 registros):');
  registros.slice(0, 3).forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.nombre} | CUIL: ${r.cuil} | ${r.analista} | $${r.monto.toLocaleString()} | ${r.estado}`);
  });

  // Limpiar tabla si --clean
  if (cleanMode) {
    console.log('\n⚠️  MODO --clean: se borrarán TODOS los registros existentes.');
    console.log('   Presioná Ctrl+C en los próximos 5 segundos para cancelar...');
    await new Promise(r => setTimeout(r, 5000));
    console.log('\n🗑️  Borrando registros existentes...');
    const { error: delErr } = await supabase.from('registros').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (delErr) {
      console.log('❌ Error al borrar registros:', delErr.message);
      process.exit(1);
    }
    console.log('✅ Tabla limpia.\n');
  }

  // Insertar en batches de 50
  console.log('\n🚀 Insertando en Supabase...\n');
  const BATCH_SIZE = 50;
  let insertados = 0;
  let fallos = 0;

  for (let i = 0; i < registros.length; i += BATCH_SIZE) {
    const batch = registros.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('registros').insert(batch);
    
    if (error) {
      console.log(`❌ Error en batch ${Math.floor(i / BATCH_SIZE) + 1}: ${error.message}`);
      fallos += batch.length;
      
      // Intentar uno por uno si falla el batch
      for (const reg of batch) {
        const { error: singleErr } = await supabase.from('registros').insert(reg);
        if (singleErr) {
          fallos++;
          console.log(`  ⚠️  Fallo: ${reg.nombre} - ${singleErr.message}`);
        } else {
          insertados++;
          fallos--; // Compensar el conteo del batch
        }
      }
    } else {
      insertados += batch.length;
      const pct = Math.round((Math.min(i + BATCH_SIZE, registros.length) / registros.length) * 100);
      process.stdout.write(`\r  Progreso: ${pct}% (${insertados} insertados)`);
    }
  }

  console.log('\n');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log(`║  ✅ MIGRACIÓN COMPLETADA                                ║`);
  console.log(`║  📊 Insertados: ${String(insertados).padEnd(6)} | Fallos: ${String(fallos).padEnd(6)}         ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  
  // Auditoría
  await supabase.from('auditoria').insert({
    analista: 'Sistema',
    accion: 'Migración',
    campo_modificado: 'CSV Import',
    valor_anterior: '',
    valor_nuevo: `Migrados ${insertados} registros desde CSV`,
    id_analista: 'Sistema',
  });

  console.log('\n📝 Registrado en auditoría.');
  console.log('🌐 Abrí http://localhost:3000 para ver los datos.\n');
}

main().catch(err => {
  console.error('❌ Error fatal:', err.message);
  process.exit(1);
});
