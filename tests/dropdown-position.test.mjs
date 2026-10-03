import test from 'node:test';
import assert from 'node:assert/strict';
import { calcularPosicionDropdown } from '../src/lib/dropdown-position.ts';

const trigger = (over = {}) => ({ top: 300, bottom: 336, left: 120, width: 240, ...over });
const viewport = { ancho: 1920, alto: 1080 };

test('por defecto se abre hacia abajo, pegado al trigger', () => {
  const p = calcularPosicionDropdown(trigger(), viewport, { conBuscador: true });
  assert.equal(p.haciaArriba, false);
  assert.equal(p.top, 340);          // bottom + 4
  assert.equal(p.left, 120);
  assert.equal(p.width, 240);
});

test('si no entra abajo pero sí arriba, se abre hacia arriba', () => {
  // Trigger al final de la pantalla: 40px abajo contra 980 arriba.
  const p = calcularPosicionDropdown(trigger({ top: 980, bottom: 1016 }), viewport, { conBuscador: true });
  assert.equal(p.haciaArriba, true);
  assert.equal(p.top, 976);          // top - 4
});

test('si no entra en ningún lado, elige el lado con más espacio', () => {
  const p = calcularPosicionDropdown(trigger({ top: 200, bottom: 236 }), { ancho: 1920, alto: 400 }, { conBuscador: true });
  assert.equal(p.haciaArriba, false, 'abajo quedan 164px contra 200 arriba... pero abajo alcanza el mínimo');
  assert.ok(p.maxAlto >= 120);
});

test('el alto disponible nunca deja el panel fuera de la pantalla', () => {
  const p = calcularPosicionDropdown(trigger({ top: 900, bottom: 936 }), viewport, { conBuscador: true });
  const alto = p.haciaArriba ? p.top : viewport.alto - p.top;
  assert.ok(p.maxAlto <= alto, `maxAlto ${p.maxAlto} debe entrar en ${alto}`);
});

test('con buscador se reserva lugar para el campo de búsqueda', () => {
  const sin = calcularPosicionDropdown(trigger(), viewport, { conBuscador: false });
  const con = calcularPosicionDropdown(trigger(), viewport, { conBuscador: true });
  assert.ok(con.maxAlto < sin.maxAlto);
});

test('nunca se sale por la derecha', () => {
  const p = calcularPosicionDropdown(trigger({ left: 1800, width: 240 }), viewport, { conBuscador: false });
  assert.ok(p.left + p.width <= viewport.ancho - 8, `left ${p.left} + ancho ${p.width} debe entrar en 1920`);
});

test('nunca se sale por la izquierda', () => {
  const p = calcularPosicionDropdown(trigger({ left: -50, width: 240 }), viewport, { conBuscador: false });
  assert.ok(p.left >= 8);
});

test('un trigger más ancho que la pantalla no rompe el cálculo', () => {
  const p = calcularPosicionDropdown(trigger({ left: 0, width: 3000 }), viewport, { conBuscador: false });
  assert.ok(p.width <= viewport.ancho - 16);
  assert.ok(p.left >= 8);
});

test('el panel nunca queda más chico que el mínimo legible', () => {
  const p = calcularPosicionDropdown(trigger({ top: 10, bottom: 46 }), { ancho: 1920, alto: 120 }, { conBuscador: true });
  assert.ok(p.maxAlto >= 120);
});
