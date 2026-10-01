import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  RESUMEN_SNAPSHOT_VERSION,
  detectResumenSnapshotVersion,
  parseStoredResumenSnapshot,
  wrapResumenSnapshot,
} from '../src/lib/resumenSnapshot.ts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
const FIXTURE_DIRECTORY = 'tests/fixtures/resumen-mensual';
const FIXTURES = [
  'historical-snapshot-2026-01.html',
  'historical-snapshot-2026-06.html',
];

const classNames = (html) => new Set(
  [...html.matchAll(/class="([^"]*)"/g)]
    .flatMap((match) => match[1].split(/\s+/))
    .filter(Boolean),
);

test('los fixtures provienen de snapshots reales y sólo sanitizan texto', () => {
  const manifest = JSON.parse(read(`${FIXTURE_DIRECTORY}/manifest.json`));
  assert.equal(manifest.source, 'Supabase read-only resumen_mensual.experiencia_cliente.html');
  assert.deepEqual(manifest.fixtures.map((fixture) => fixture.period), ['2026-01', '2026-06']);
  for (const fixture of manifest.fixtures) {
    assert.equal(fixture.originalHtmlLength, fixture.fixtureHtmlLength);
    assert.match(fixture.sanitized, /Text nodes only/);
  }
});

test('los snapshots históricos conservan estructura renderizable y estilos autocontenidos', () => {
  for (const fixture of FIXTURES) {
    const html = read(`${FIXTURE_DIRECTORY}/${fixture}`);
    assert.match(html, /^<div class="data-card"/);
    assert.ok((html.match(/<div\b/g) || []).length > 50);
    assert.ok((html.match(/ style="/g) || []).length > 200);
    assert.doesNotMatch(html, /<(?:script|style)\b/i);
    assert.doesNotMatch(html, /\b[\w-]+-module__[A-Za-z0-9]+__/);
  }
});

test('el contrato histórico real está cubierto por CSS global estable', () => {
  const globals = read('src/app/globals.css');
  const historicalClasses = new Set(FIXTURES.flatMap((fixture) => [...classNames(read(`${FIXTURE_DIRECTORY}/${fixture}`))]));
  assert.ok(historicalClasses.has('data-card'));
  assert.match(globals, /\.legacy-snapshot\s*,\s*\.report-snapshot\s*\{/);
  assert.match(globals, /\.data-card\s*\{/);
  for (const className of historicalClasses) {
    if (className.startsWith('lucide')) continue;
    assert.match(globals, new RegExp(`\\.${className}\\b`), `falta CSS global para .${className}`);
  }
});

test('los snapshots nuevos llevan namespace y versión estable', () => {
  const html = wrapResumenSnapshot('<div class="data-card">ok</div>');
  assert.equal(RESUMEN_SNAPSHOT_VERSION, 2);
  assert.match(html, /^<div class="report-snapshot" data-snapshot-version="2">/);
  assert.equal(detectResumenSnapshotVersion(html), 2);
  assert.doesNotMatch(html, /\b[\w-]+-module__[A-Za-z0-9]+__/);
});

test('el parser conserva los caminos datos, HTML histórico y snapshot v2', () => {
  const legacy = '<div class="data-card" style="display:flex">legacy</div>'.repeat(5);
  assert.equal(parseStoredResumenSnapshot(legacy).html, legacy);

  const structured = parseStoredResumenSnapshot(JSON.stringify({ datos: { total: 1 }, html: legacy }));
  assert.deepEqual(structured.datos, { total: 1 });
  assert.equal(structured.html, legacy);

  const v2 = wrapResumenSnapshot(legacy);
  const parsedV2 = parseStoredResumenSnapshot(JSON.stringify({ html: v2, snapshotVersion: 2 }));
  assert.equal(parsedV2.snapshotVersion, 2);
  assert.equal(detectResumenSnapshotVersion(parsedV2.html), 2);
});

test('el productor y el renderer público mantienen ambos contratos', () => {
  const producer = read('src/app/ajustes/ResumenMensualTab.tsx');
  const publicPage = read('src/app/publico/resumen-mensual/page.tsx');
  assert.match(producer, /wrapResumenSnapshot\(clone\.innerHTML\)/);
  assert.match(producer, /snapshotVersion:\s*RESUMEN_SNAPSHOT_VERSION/);
  assert.match(publicPage, /className="legacy-snapshot"/);
  assert.match(publicPage, /dangerouslySetInnerHTML/);
  assert.match(publicPage, /parsed\.datos/);
  assert.match(publicPage, /parsed\.html/);
  assert.match(publicPage, /snapshotPreview === 'historical'/);
  assert.match(publicPage, /snapshotPreview === 'v2'/);
  assert.match(publicPage, /process\.env\.NODE_ENV === 'development'/);
});
