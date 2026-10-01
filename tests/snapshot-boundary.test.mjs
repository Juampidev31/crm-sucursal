/**
 * Guarda del SNAPSHOT STYLE BOUNDARY.
 *
 * El reporte mensual se persiste como HTML crudo en Supabase
 * (ResumenMensualTab -> clone.innerHTML -> resumen_mensual.experiencia_cliente)
 * y la ruta publica lo re-inyecta con dangerouslySetInnerHTML. cloneNode conserva
 * markup, class y `style=` pero NO las hojas de estilo, y los snapshots ya
 * guardados son datos inmutables: su markup no se puede regenerar.
 *
 * Estos tests fallan si una migracion de estilos rompe alguna de las invariantes
 * que mantienen ese HTML legible. Son analisis estatico: no necesitan DOM ni red.
 *
 *   node --test tests/
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

const TAB = 'src/app/ajustes/ResumenMensualTab.tsx';
const PUBLIC_PAGE = 'src/app/publico/resumen-mensual/page.tsx';
const GLOBALS = 'src/app/globals.css';

/** Componentes que se renderizan dentro de #resumen-reporte-body y terminan serializados. */
const PROTECTED_FILES = [
  TAB,
  'src/app/ajustes/MetricasTab.tsx',
  'src/app/analistas/NuevaSeccionSheets.tsx',
  'src/app/ajustes/SeccionGraficosResumen.tsx',
  'src/components/charts/DistBlock.tsx',
  'src/components/charts/ModernDoughnut.tsx',
  'src/components/CustomSelect.tsx',
];

/**
 * Piso de inline styles dentro del boundary. El inventario exacto lo calcula el
 * auditor; este piso detecta una
 * migracion masiva a clases, no cambios normales de maquetado: subirlo o bajarlo
 * requiere revisar antes el pipeline de snapshot.
 */
const MIN_INLINE_IN_BOUNDARY = 150;

/** var(--x) que el pipeline materializa a literal antes de persistir (paso "CSS vars fix"). */
const TOKENS_MATERIALIZED_BY_PIPELINE = ['--text-primary', '--state-danger'];

/**
 * Clases que aparecen en snapshots historicos ya guardados. Aunque el markup vivo
 * deje de emitirlas, sus reglas deben sobrevivir o los reportes viejos se degradan.
 */
const LEGACY_SNAPSHOT_CLASSES = [
  'data-card', 'kpi-card', 'kpi-title', 'kpi-sub',
  'kpi-val', 'chart-card', 'cards-container', 'modal-title',
];

/**
 * Clases globales estables que el productor actual puede persistir. Esta lista es
 * deliberadamente explicita: agregar una clase requiere demostrar que existe en
 * globals.css y que no depende de un hash de build.
 */
const CURRENT_SNAPSHOT_CLASSES = [
  'analistas-autogrid',
  'analistas-categories-card',
  'category-sheet-block',
  'category-sheet-chart',
  'category-sheet-footer',
  'category-sheet-list',
  'category-sheet-panel',
  'category-sheet-row',
  'category-sheet-value',
  'custom-select',
  'custom-select__chevron',
  'custom-select__menu',
  'custom-select__option',
  'custom-select__trigger',
  'custom-select__value',
  'data-card',
  'data-card-header',
  'is-active',
  'is-disabled',
  'is-expanded',
  'is-negative',
  'is-open',
  'is-positive',
  'is-selected',
  'metricas-state-chart',
  'metricas-state-list',
  'metricas-state-name',
  'metricas-state-row',
  'metricas-state-value',
  'metricas-state-view',
  'modern-doughnut',
  'modern-doughnut__center',
  'modern-doughnut__label',
  'modern-doughnut__value',
  'report-dist-block',
  'report-dist-block--elevated',
  'report-dist-block--standard',
  'report-dist-block__amount',
  'report-dist-block__button',
  'report-dist-block__chevron',
  'report-dist-block__count',
  'report-dist-block__footer',
  'report-dist-block__heading',
  'report-dist-block__icon',
  'report-dist-block__label',
  'report-dist-block__list',
  'report-dist-block__metrics',
  'report-dist-block__panel',
  'report-dist-block__percentage',
  'report-dist-block__progress',
  'report-dist-block__row',
  'report-dist-block__row-head',
  'report-dist-block__title',
  'report-dist-block__track',
  'report-dist-block__unspecified',
  'report-dist-block__unspecified-amount',
  'report-dist-block__unspecified-label',
  'report-period-toggle',
  'report-trend-direction',
];

// El modificador standard hereda intencionalmente toda su apariencia de la
// clase base; aun asi forma parte del contrato persistido y queda inventariado.
const SNAPSHOT_CLASSES_WITH_BASE_ONLY_STYLING = new Set(['report-dist-block--standard']);

/** Devuelve el rango de lineas [inicio, fin] del subarbol #resumen-reporte-body. */
function boundaryRange(text) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.includes('id="resumen-reporte-body"'));
  assert.notEqual(start, -1, 'no se encontro el root #resumen-reporte-body');
  const indent = lines[start].search(/\S/);
  for (let i = start + 1; i < lines.length; i++) {
    if (lines[i].search(/\S/) === indent && lines[i].trim().startsWith('</div>')) {
      return [start + 1, i + 1];
    }
  }
  assert.fail('no se encontro el cierre del subarbol #resumen-reporte-body');
}

function sliceBoundary(text) {
  const [from, to] = boundaryRange(text);
  return text.split(/\r?\n/).slice(from - 1, to).join('\n');
}

const SNAPSHOT_FRAGMENT_MARKER = 'data-snapshot-fragment';

const countInline = (text) => (text.match(/style=\{\{/g) || []).length;

test('el root del snapshot sigue existiendo', () => {
  assert.match(read(TAB), /id="resumen-reporte-body"/);
});

test('el boundary sigue documentado en el codigo', () => {
  assert.match(
    read(TAB),
    /SNAPSHOT STYLE BOUNDARY/,
    'se borro el comentario que impide migrar estos inline a clases',
  );
});

test('el snapshot se guarda junto a datos estructurados', () => {
  // `datos` es lo que permite a la ruta publica re-renderizar en React en vez de
  // depender del HTML congelado. Si se deja de guardar, todo vuelve a colgar del HTML.
  const src = read(TAB);
  assert.match(src, /html:\s*snapshotHtml/, 'ya no se persiste el HTML del snapshot');
  assert.match(src, /datos:\s*datosParaCompartir/, 'ya no se persisten los datos estructurados');
  assert.match(src, /wrapResumenSnapshot\(clone\.innerHTML\)/, 'el snapshot nuevo perdió el namespace estable');
  assert.match(src, /snapshotVersion:\s*RESUMEN_SNAPSHOT_VERSION/, 'el snapshot nuevo perdió su versión');
});

test('la rama de HTML historico conserva el boundary .legacy-snapshot', () => {
  const src = read(PUBLIC_PAGE);
  assert.match(src, /dangerouslySetInnerHTML=\{\{\s*__html:\s*result\.html/);
  const idx = src.indexOf('__html: result.html');
  const around = src.slice(Math.max(0, idx - 400), idx + 200);
  assert.match(
    around,
    /className="legacy-snapshot"/,
    'el HTML historico ya no cuelga de .legacy-snapshot',
  );
});

test('los componentes serializados no importan CSS Modules', () => {
  // Los nombres de clase de un CSS Module llevan hash por build: un snapshot guardado
  // con el hash de hoy deja de matchear despues del proximo build.
  for (const file of PROTECTED_FILES.slice(1)) {
    const hits = read(file).match(/from\s+['"][^'"]*\.module\.css['"]/g) || [];
    assert.deepEqual(hits, [], `${file} importa un CSS Module dentro del boundary`);
  }
  assert.doesNotMatch(
    sliceBoundary(read(TAB)),
    /\bstyles\s*\./,
    `${TAB} usa una clase de CSS Module dentro del boundary serializable`,
  );
  const source = read(TAB);
  const fragmentRegion = source.slice(source.indexOf('const ManualTextarea'), source.indexOf('const mesPrev'))
    + source.slice(source.indexOf('const badgeDiasRestantes'), source.indexOf('// ── Distribuciones demográficas'));
  assert.match(fragmentRegion, new RegExp(SNAPSHOT_FRAGMENT_MARKER));
  assert.doesNotMatch(fragmentRegion, /\bstyles\s*\./, 'un helper serializado usa CSS Module');
});

test('el subarbol del snapshot sigue llevando sus estilos inline', () => {
  const inBoundary = countInline(sliceBoundary(read(TAB)));
  const inChildren = PROTECTED_FILES.slice(1).reduce((n, f) => n + countInline(read(f)), 0);
  const total = inBoundary + inChildren;
  assert.ok(
    total >= MIN_INLINE_IN_BOUNDARY,
    `solo quedan ${total} inline en el boundary (minimo ${MIN_INLINE_IN_BOUNDARY}): ` +
      'los estilos dejaron de ser autocontenidos y el HTML persistido saldria sin estilo',
  );
});

test('todo var(--x) del boundary resuelve en la pagina publica', () => {
  const globals = read(GLOBALS);
  const defined = new Set([...globals.matchAll(/^\s*(--[\w-]+)\s*:/gm)].map((m) => m[1]));
  const used = new Set();
  for (const chunk of [sliceBoundary(read(TAB)), ...PROTECTED_FILES.slice(1).map(read)]) {
    for (const m of chunk.matchAll(/var\(\s*(--[\w-]+)/g)) used.add(m[1]);
  }
  for (const token of used) {
    if (TOKENS_MATERIALIZED_BY_PIPELINE.includes(token)) continue;
    assert.ok(
      defined.has(token),
      `${token} se serializa en el snapshot pero no esta definido en globals.css: ` +
        'los reportes publicos lo renderizarian sin valor',
    );
  }
});

test('las clases de snapshots historicos siguen definidas', () => {
  const globals = read(GLOBALS);
  for (const cls of LEGACY_SNAPSHOT_CLASSES) {
    assert.match(
      globals,
      new RegExp(`\\.${cls}\\b`),
      `.${cls} aparece en HTML ya guardado en Supabase y ya no tiene reglas`,
    );
  }
});

test('las clases que puede emitir el productor actual tienen CSS global estable', () => {
  const globals = read(GLOBALS);
  for (const cls of CURRENT_SNAPSHOT_CLASSES) {
    if (SNAPSHOT_CLASSES_WITH_BASE_ONLY_STYLING.has(cls)) continue;
    assert.match(
      globals,
      new RegExp(`\\.${cls.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\b`),
      `.${cls} puede persistirse pero no tiene reglas estables en globals.css`,
    );
  }
  assert.match(read('src/components/charts/DistBlock.tsx'), /'report-dist-block--standard'/);
  for (const file of PROTECTED_FILES) {
    assert.doesNotMatch(
      read(file),
      /\b[\w-]+-module__[A-Za-z0-9]+__/,
      `${file} contiene un hash de CSS Module persistible`,
    );
  }
});
