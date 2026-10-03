import test from 'node:test';
import assert from 'node:assert/strict';
import { aplicarCambiosRegistros, mismoRegistro } from '../src/features/registros/realtime-batch.ts';

const base = (over = {}) => ({
  id: 'a', cuil: '1', nombre: 'Ana', puntaje: 700, es_re: false, analista: 'Magali',
  fecha: '2026-01-01', fecha_score: null, monto: 1000, interes: null, estado: 'venta',
  comentarios: '', telefono: '', fijado: false, etiquetas: [],
  updated_at: '2026-01-01T00:00:00Z', ...over,
});

test('un lote vacío devuelve la misma referencia', () => {
  const prev = [base()];
  assert.equal(aplicarCambiosRegistros(prev, []), prev);
});

test('un UPDATE idéntico no provoca re-render (misma referencia)', () => {
  const prev = [base(), base({ id: 'b' })];
  const out = aplicarCambiosRegistros(prev, [{ type: 'UPDATE', registro: base() }]);
  assert.equal(out, prev);
});

test('un UPDATE que sólo mueve updated_at no provoca re-render', () => {
  // El trigger de la DB toca updated_at en cada escritura: si eso contara como
  // cambio, el eco de una modificación masiva re-renderizaría la app N veces.
  const prev = [base()];
  const eco = base({ updated_at: '2026-10-02T14:45:00Z' });
  assert.equal(aplicarCambiosRegistros(prev, [{ type: 'UPDATE', registro: eco }]), prev);
});

test('etiquetas iguales por valor no cuentan como cambio', () => {
  const prev = [base({ etiquetas: ['vip', 'mora'] })];
  const eco = base({ etiquetas: ['vip', 'mora'] });
  assert.equal(aplicarCambiosRegistros(prev, [{ type: 'UPDATE', registro: eco }]), prev);
});

test('un UPDATE real reemplaza sólo esa fila', () => {
  const prev = [base(), base({ id: 'b' })];
  const nuevo = base({ analista: 'Victoria' });
  const out = aplicarCambiosRegistros(prev, [{ type: 'UPDATE', registro: nuevo }]);
  assert.notEqual(out, prev);
  assert.equal(out.length, 2);
  assert.equal(out[0], nuevo);
  assert.equal(out[1], prev[1], 'las filas no tocadas conservan su referencia');
});

test('varios cambios del mismo id en un lote: gana el último', () => {
  const prev = [base()];
  const out = aplicarCambiosRegistros(prev, [
    { type: 'UPDATE', registro: base({ analista: 'Victoria' }) },
    { type: 'UPDATE', registro: base({ analista: 'Luciana' }) },
  ]);
  assert.equal(out.length, 1);
  assert.equal(out[0].analista, 'Luciana');
});

test('un lote mezcla altas, bajas y modificaciones en una sola pasada', () => {
  const prev = [base(), base({ id: 'b' }), base({ id: 'c' })];
  const out = aplicarCambiosRegistros(prev, [
    { type: 'UPDATE', registro: base({ id: 'b', estado: 'proyeccion' }) },
    { type: 'DELETE', registro: base({ id: 'c' }) },
    { type: 'INSERT', registro: base({ id: 'd' }) },
  ]);
  assert.deepEqual(out.map(r => r.id), ['d', 'a', 'b']);
  assert.equal(out[2].estado, 'proyeccion');
});

test('un UPDATE de un id desconocido se agrega (como hacía applyRegistroChange)', () => {
  const prev = [base()];
  const out = aplicarCambiosRegistros(prev, [{ type: 'UPDATE', registro: base({ id: 'z' }) }]);
  assert.deepEqual(out.map(r => r.id), ['z', 'a']);
});

test('un DELETE de un id que no está no cambia nada', () => {
  const prev = [base()];
  assert.equal(aplicarCambiosRegistros(prev, [{ type: 'DELETE', registro: base({ id: 'z' }) }]), prev);
});

test('alta y baja del mismo id dentro del lote se cancelan', () => {
  const prev = [base()];
  const out = aplicarCambiosRegistros(prev, [
    { type: 'INSERT', registro: base({ id: 'n' }) },
    { type: 'DELETE', registro: base({ id: 'n' }) },
  ]);
  assert.equal(out, prev);
});

test('mismoRegistro distingue campos y tolera claves ausentes', () => {
  assert.equal(mismoRegistro(base(), base()), true);
  assert.equal(mismoRegistro(base(), base({ monto: 2000 })), false);
  const sinOpcional = base();
  delete sinOpcional.localidad;
  assert.equal(mismoRegistro(sinOpcional, base({ localidad: undefined })), true);
  assert.equal(mismoRegistro(sinOpcional, base({ localidad: 'Córdoba' })), false);
});
