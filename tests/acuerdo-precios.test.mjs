import test from 'node:test';
import assert from 'node:assert/strict';
import { ACUERDOS, acuerdoSugeridoPorScore, validarAcuerdoVsScore } from '../src/lib/acuerdo-precios.ts';

test('las opciones son las tres de riesgo', () => {
  assert.deepEqual([...ACUERDOS], ['Riesgo Bajo', 'Riesgo Medio', 'Premium']);
});

test('cada tramo de score sugiere su acuerdo', () => {
  assert.equal(acuerdoSugeridoPorScore(550), 'Riesgo Medio');
  assert.equal(acuerdoSugeridoPorScore(600), 'Riesgo Medio');
  assert.equal(acuerdoSugeridoPorScore(601), 'Riesgo Bajo');
  assert.equal(acuerdoSugeridoPorScore(700), 'Riesgo Bajo');
  assert.equal(acuerdoSugeridoPorScore(701), 'Premium');
});

test('de 0 a 549 no hay acuerdo sugerido: no califica por score', () => {
  assert.equal(acuerdoSugeridoPorScore(0), '');
  assert.equal(acuerdoSugeridoPorScore(549), '');
});

test('un score no numérico no sugiere nada', () => {
  assert.equal(acuerdoSugeridoPorScore(NaN), '');
});

test('sin score no se valida nada', () => {
  assert.equal(validarAcuerdoVsScore(NaN, 'Premium', false), null);
});

test('sin acuerdo cargado no se valida nada', () => {
  assert.equal(validarAcuerdoVsScore(400, '', false), null);
  assert.equal(validarAcuerdoVsScore(800, '', false), null);
});

test('acuerdo que coincide con el tramo pasa', () => {
  assert.equal(validarAcuerdoVsScore(560, 'Riesgo Medio', false), null);
  assert.equal(validarAcuerdoVsScore(650, 'Riesgo Bajo', false), null);
  assert.equal(validarAcuerdoVsScore(900, 'Premium', false), null);
});

test('acuerdo que no coincide bloquea y dice cuál corresponde', () => {
  const r = validarAcuerdoVsScore(560, 'Premium', false);
  assert.equal(r.bloquea, true);
  assert.match(r.mensaje, /Riesgo MEDIO \(550-600\)/);
  assert.equal(validarAcuerdoVsScore(650, 'Premium', false).mensaje, 'Debe ser Riesgo BAJO (601-700)');
  assert.equal(validarAcuerdoVsScore(900, 'Riesgo Bajo', false).mensaje, 'Debe ser PREMIUM (+700)');
});

test('score 0-549 con acuerdo cargado bloquea salvo autorización de CC', () => {
  const r = validarAcuerdoVsScore(400, 'Riesgo Medio', false);
  assert.equal(r.bloquea, true);
  assert.match(r.mensaje, /autorizaci[óo]n/i);
});

test('con autorización de CC nunca bloquea, sólo advierte', () => {
  const bajo = validarAcuerdoVsScore(400, 'Riesgo Medio', true);
  assert.equal(bajo.bloquea, false);
  assert.match(bajo.mensaje, /CC/);

  const fuera = validarAcuerdoVsScore(560, 'Premium', true);
  assert.equal(fuera.bloquea, false);
  assert.match(fuera.mensaje, /CC/);
});

test('con autorización de CC, un acuerdo que igual coincide no advierte nada', () => {
  assert.equal(validarAcuerdoVsScore(560, 'Riesgo Medio', true), null);
});

test("el valor histórico 'No califica' sigue siendo válido en 0-549", () => {
  // 3.803 registros viejos lo tienen guardado; ya no se puede elegir, pero
  // tienen que poder editarse sin pedir autorización de CC.
  assert.equal(validarAcuerdoVsScore(491, 'No califica', false), null);
  assert.equal(validarAcuerdoVsScore(0, 'No califica', false), null);
});

test("'No califica' fuera del tramo 0-549 sigue siendo incoherente", () => {
  const r = validarAcuerdoVsScore(700, 'No califica', false);
  assert.equal(r.bloquea, true);
  assert.equal(r.mensaje, 'Debe ser Riesgo BAJO (601-700)');
});
