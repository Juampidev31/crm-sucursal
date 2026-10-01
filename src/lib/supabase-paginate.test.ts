/**
 * Test dirigido de la paginación. Sin dependencias nuevas: usa el runner y las
 * aserciones que trae Node (Node 24 ejecuta TypeScript de forma nativa).
 *
 *   node --test src/lib/supabase-paginate.test.ts
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchAllRows, SUPABASE_PAGE_SIZE } from './supabase-paginate.ts';

/** Backend falso: `total` filas numeradas, servidas en páginas de `pageSize`. */
function fakeBackend(total: number, pageSize = SUPABASE_PAGE_SIZE) {
  const calls: Array<[number, number]> = [];
  const fetchPage = (from: number, to: number) => {
    calls.push([from, to]);
    const slice = Array.from({ length: total }, (_, i) => i).slice(from, Math.min(to + 1, from + pageSize));
    return Promise.resolve({ data: slice, error: null });
  };
  return { fetchPage, calls };
}

test('concatena varias páginas y no pierde la última (parcial)', async () => {
  const { fetchPage, calls } = fakeBackend(6994);
  const { rows, error } = await fetchAllRows<number>(fetchPage);

  assert.equal(error, null);
  assert.equal(rows.length, 6994, 'debe traer el dataset completo');
  assert.equal(calls.length, 7, '6994 filas => 7 páginas de 1000');
  assert.equal(rows.at(-1), 6993, 'la última fila de la página parcial no se pierde');
});

test('no duplica ni reordena filas', async () => {
  const { rows } = await fetchAllRows<number>(fakeBackend(2500).fetchPage);

  assert.equal(new Set(rows).size, rows.length, 'sin duplicados');
  assert.deepEqual(rows.slice(0, 5), [0, 1, 2, 3, 4], 'conserva el orden del backend');
  assert.deepEqual([...rows].sort((a, b) => a - b), rows, 'orden global preservado');
});

test('corta cuando una página devuelve menos del tamaño máximo', async () => {
  const { fetchPage, calls } = fakeBackend(1500);
  const { rows } = await fetchAllRows<number>(fetchPage);

  assert.equal(rows.length, 1500);
  assert.equal(calls.length, 2, 'la 2ª página devuelve 500 (<1000) y se detiene');
});

test('dataset exacto de una página: pide una segunda y para al recibir 0', async () => {
  const { fetchPage, calls } = fakeBackend(1000);
  const { rows } = await fetchAllRows<number>(fetchPage);

  assert.equal(rows.length, 1000);
  assert.equal(calls.length, 2, 'no puede saber que terminó hasta recibir una página vacía');
});

test('dataset vacío', async () => {
  const { rows, error } = await fetchAllRows<number>(fakeBackend(0).fetchPage);
  assert.deepEqual(rows, []);
  assert.equal(error, null);
});

test('devuelve el error y lo acumulado hasta ese punto', async () => {
  let n = 0;
  const { rows, error } = await fetchAllRows<number>((from, to) => {
    if (n++ === 1) return Promise.resolve({ data: null, error: { message: 'boom' } });
    return Promise.resolve({ data: Array.from({ length: to - from + 1 }, (_, i) => from + i), error: null });
  });

  assert.equal(error, 'boom');
  assert.equal(rows.length, SUPABASE_PAGE_SIZE, 'conserva la primera página');
});

test('se detiene si el efecto fue cancelado', async () => {
  const { fetchPage, calls } = fakeBackend(6994);
  let cancelado = false;
  const { rows, cancelled } = await fetchAllRows<number>(
    (from, to) => { cancelado = true; return fetchPage(from, to); },
    { isCancelled: () => cancelado },
  );

  assert.equal(cancelled, true);
  assert.equal(calls.length, 1, 'no sigue pidiendo páginas tras la cancelación');
  assert.equal(rows.length, SUPABASE_PAGE_SIZE);
});

test('respeta el safetyLimit', async () => {
  const { fetchPage, calls } = fakeBackend(6994);
  const { rows } = await fetchAllRows<number>(fetchPage, { safetyLimit: 2000 });

  assert.equal(calls.length, 2);
  assert.equal(rows.length, 2000);
});

// ── Determinismo del orden ──────────────────────────────────────────────────
// No reproduce Postgres: modela lo único que importa para paginar por offset —
// que las filas con el MISMO valor de orden primario pueden salir en distinto
// lugar en cada consulta, porque cada página es una consulta independiente.

type Row = { id: number; fecha: string };

/**
 * Backend con empates en `fecha`. Con `tieBreak` el orden total es único y
 * estable; sin él, las filas empatadas se barajan en cada consulta (que es lo
 * que Postgres puede hacer legítimamente al no haber orden determinista).
 */
function backendConEmpates(total: number, porFecha: number, tieBreak: boolean, pageSize = 10) {
  const base: Row[] = Array.from({ length: total }, (_, i) => ({
    id: i,
    fecha: `2026-01-${String(Math.floor(i / porFecha) + 1).padStart(2, '0')}`,
  }));
  let llamada = 0;
  return (from: number, to: number) => {
    llamada++;
    const ordenado = [...base].sort((a, b) => {
      if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
      // Empate: con desempate único es determinista; sin él, rota según la llamada.
      return tieBreak ? a.id - b.id : ((a.id + llamada) % porFecha) - ((b.id + llamada) % porFecha);
    });
    return Promise.resolve({ data: ordenado.slice(from, Math.min(to + 1, from + pageSize)), error: null });
  };
}

test('orden NO determinista: la paginación duplica y omite filas', async () => {
  const { rows } = await fetchAllRows<Row>(backendConEmpates(60, 6, false), { pageSize: 10 });
  const unicos = new Set(rows.map((r) => r.id)).size;

  assert.equal(rows.length, 60, 'la cantidad de filas parece correcta…');
  assert.ok(unicos < 60, `…pero hay ids repetidos: sólo ${unicos} únicos de 60`);
  assert.ok(rows.length - unicos > 0, 'se confirma la duplicación');
});

test('desempate único: mismo dataset, sin duplicados ni omisiones', async () => {
  const { rows } = await fetchAllRows<Row>(backendConEmpates(60, 6, true), { pageSize: 10 });
  const unicos = new Set(rows.map((r) => r.id)).size;

  assert.equal(rows.length, 60);
  assert.equal(unicos, 60, 'COUNT = ROWS = UNIQUE IDS');
  assert.deepEqual(rows.map((r) => r.id), Array.from({ length: 60 }, (_, i) => i));
});
