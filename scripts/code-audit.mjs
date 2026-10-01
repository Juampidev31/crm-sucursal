#!/usr/bin/env node
/**
 * code-audit.mjs — herramienta de DIAGNÓSTICO del código funcional.
 *
 * Sólo reporta. No modifica ni borra nada.
 * No confiar ciegamente en la salida para eliminar código: las heurísticas de
 * "export muerto" / "archivo huérfano" desconocen convenciones de Next.js
 * (page/layout/route/error/loading), imports dinámicos por string y
 * componentes referenciados desde configuración.
 *
 *   node scripts/code-audit.mjs            # resumen
 *   node scripts/code-audit.mjs --full     # + listados completos
 *   node scripts/code-audit.mjs --json     # salida JSON (para diffs antes/después)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const FULL = process.argv.includes('--full');
const JSON_OUT = process.argv.includes('--json');

/** Ficheros que Next.js instancia por convención: nunca son "huérfanos". */
const NEXT_ENTRY = /(^|\/)(page|layout|loading|error|not-found|route|template|default|global-error)$/;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(e.name)) out.push(p);
  }
  return out;
}

const files = walk(SRC);
const idOf = (f) => path.relative(SRC, f).replace(/\\/g, '/').replace(/\.tsx?$/, '');
const source = Object.fromEntries(files.map((f) => [idOf(f), fs.readFileSync(f, 'utf8')]));
const ids = Object.keys(source);

function resolveSpec(from, spec) {
  let p;
  if (spec.startsWith('@/')) p = spec.slice(2);
  else if (spec.startsWith('.')) p = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  else return null;
  if (ids.includes(p)) return p;
  if (ids.includes(`${p}/index`)) return `${p}/index`;
  return null;
}

// ── Grafo de dependencias ───────────────────────────────────────────────────
const consumers = Object.fromEntries(ids.map((k) => [k, []]));
const deps = Object.fromEntries(ids.map((k) => [k, new Set()]));

for (const id of ids) {
  const s = source[id];
  const importRe = /import\s+(?:type\s+)?([\s\S]*?)\s*from\s*['"]([^'"]+)['"]/g;
  let m;
  while ((m = importRe.exec(s))) {
    const target = resolveSpec(id, m[2]);
    if (!target) continue;
    const clause = m[1];
    const names = [];
    const braced = clause.match(/\{([\s\S]*?)\}/);
    if (braced) {
      for (const part of braced[1].split(',')) {
        const n = part.trim().split(/\s+as\s+/)[0].replace(/^type\s+/, '').trim();
        if (n) names.push(n);
      }
    }
    const bare = clause.replace(/\{[\s\S]*?\}/, '').replace(/,/g, '').trim();
    if (bare.startsWith('*')) names.push('*');
    else if (bare) names.push('default');
    consumers[target].push({ from: id, names });
    deps[id].add(target);
  }
  const dynRe = /import\(\s*['"]([^'"]+)['"]/g;
  while ((m = dynRe.exec(s))) {
    const target = resolveSpec(id, m[1]);
    if (target) {
      consumers[target].push({ from: id, names: ['*'] });
      deps[id].add(target);
    }
  }
}

function exportsOf(id) {
  const s = source[id];
  const out = [];
  let m;
  const decl = /^export\s+(?:async\s+)?(?:function|const|let|class|type|interface|enum)\s+(\w+)/gm;
  while ((m = decl.exec(s))) out.push(m[1]);
  const listed = /^export\s*\{([^}]*)\}/gm;
  while ((m = listed.exec(s))) {
    for (const part of m[1].split(',')) {
      const n = part.trim().split(/\s+as\s+/).pop().trim();
      if (n) out.push(n);
    }
  }
  if (/^export\s+default/m.test(s)) out.push('default');
  return out;
}

const orphanFiles = ids.filter((id) => consumers[id].length === 0 && !NEXT_ENTRY.test(id));

const deadExports = [];
for (const id of ids) {
  if (NEXT_ENTRY.test(id)) continue;
  const used = new Set();
  let wildcard = false;
  for (const c of consumers[id]) for (const n of c.names) (n === '*' ? (wildcard = true) : used.add(n));
  if (wildcard) continue;
  const unused = exportsOf(id).filter((e) => !used.has(e));
  if (unused.length) deadExports.push({ file: id, symbols: unused, orphan: consumers[id].length === 0 });
}

// ── Ciclos de imports ───────────────────────────────────────────────────────
const cycles = [];
{
  const state = {};
  const stack = [];
  const visit = (n) => {
    if (state[n] === 'done') return;
    if (state[n] === 'open') {
      cycles.push([...stack.slice(stack.indexOf(n)), n].join(' -> '));
      return;
    }
    state[n] = 'open';
    stack.push(n);
    for (const d of deps[n]) visit(d);
    stack.pop();
    state[n] = 'done';
  };
  ids.forEach(visit);
}

// ── Métricas por archivo ────────────────────────────────────────────────────
const count = (s, re) => (s.match(re) || []).length;
const metrics = ids.map((id) => {
  const s = source[id];
  return {
    file: `src/${id}`,
    lines: s.split('\n').length,
    imports: count(s, /^import\s/gm),
    exports: exportsOf(id).length,
    useState: count(s, /useState[<(]/g),
    useEffect: count(s, /useEffect\(/g),
    useMemo: count(s, /useMemo\(/g),
    useCallback: count(s, /useCallback\(/g),
    useRef: count(s, /useRef[<(]/g),
    any: count(s, /\bany\b/g),
    consoleLog: count(s, /console\.log\(/g),
    consoleWarn: count(s, /console\.warn\(/g),
    consoleError: count(s, /console\.error\(/g),
    debugger: count(s, /\bdebugger\b/g),
    todo: count(s, /TODO|FIXME|HACK|XXX/g),
    useClient: /^['"]use client['"]/m.test(s) ? 1 : 0,
    supabaseFrom: count(s, /\.from\(\s*['"]/g),
  };
});

const sum = (k) => metrics.reduce((a, r) => a + r[k], 0);
const totals = {
  files: metrics.length,
  lines: sum('lines'),
  imports: sum('imports'),
  exports: sum('exports'),
  useState: sum('useState'),
  useEffect: sum('useEffect'),
  useMemo: sum('useMemo'),
  useCallback: sum('useCallback'),
  useRef: sum('useRef'),
  any: sum('any'),
  consoleLog: sum('consoleLog'),
  consoleWarn: sum('consoleWarn'),
  consoleError: sum('consoleError'),
  debugger: sum('debugger'),
  todo: sum('todo'),
  useClientFiles: sum('useClient'),
  orphanFiles: orphanFiles.length,
  deadExportSymbols: deadExports.reduce((a, d) => a + d.symbols.length, 0),
  importCycles: cycles.length,
};

// ── Nombres de función definidos en más de un archivo ───────────────────────
const defs = {};
for (const id of ids) {
  const re = /(?:^|\n)\s*(?:export\s+)?(?:const|function)\s+([a-zA-Z_$][\w$]*)\s*(?:=\s*(?:async\s*)?\(|\()/g;
  let m;
  while ((m = re.exec(source[id]))) (defs[m[1]] ??= new Set()).add(`src/${id}`);
}
const dupNames = Object.entries(defs)
  .filter(([, s]) => s.size > 1)
  .map(([name, s]) => ({ name, files: [...s] }))
  .sort((a, b) => b.files.length - a.files.length);

if (JSON_OUT) {
  console.log(JSON.stringify({ totals, orphanFiles, deadExports, cycles, dupNames, metrics }, null, 2));
  process.exit(0);
}

const pad = (v, n) => String(v).padStart(n);
console.log('═══ TOTALES ═══');
for (const [k, v] of Object.entries(totals)) console.log(`  ${k.padEnd(20)} ${pad(v, 7)}`);

console.log('\n═══ TOP 20 ARCHIVOS POR LÍNEAS ═══');
console.log('  lines   imp  exp   uS   uE   uM   uC  any  file');
for (const r of [...metrics].sort((a, b) => b.lines - a.lines).slice(0, 20)) {
  console.log(
    `  ${pad(r.lines, 5)} ${pad(r.imports, 5)} ${pad(r.exports, 4)} ${pad(r.useState, 4)} ` +
      `${pad(r.useEffect, 4)} ${pad(r.useMemo, 4)} ${pad(r.useCallback, 4)} ${pad(r.any, 4)}  ${r.file}`,
  );
}

console.log(`\n═══ ARCHIVOS HUÉRFANOS (${orphanFiles.length}) ═══`);
console.log('  (sin importadores y sin nombre de convención Next — verificar a mano)');
for (const f of orphanFiles) console.log(`  src/${f}`);

console.log(`\n═══ EXPORTS SIN CONSUMIDOR (${totals.deadExportSymbols}) ═══`);
for (const d of deadExports.slice(0, FULL ? 1e9 : 25)) {
  console.log(`  src/${d.file}${d.orphan ? ' [huérfano]' : ''} -> ${d.symbols.join(', ')}`);
}

console.log(`\n═══ CICLOS DE IMPORTS (${cycles.length}) ═══`);
for (const c of cycles) console.log(`  ${c}`);

console.log(`\n═══ NOMBRES DEFINIDOS EN >1 ARCHIVO (${dupNames.length}) ═══`);
for (const d of dupNames.slice(0, FULL ? 1e9 : 20)) {
  console.log(`  ${d.name.padEnd(26)} ${d.files.length}x  ${d.files.join(', ')}`);
}
console.log('\n(diagnóstico únicamente — verificar cada hallazgo antes de borrar)');
