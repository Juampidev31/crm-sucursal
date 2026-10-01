import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';

const FIXTURES = [
  { anio: 2026, mes: 1, file: 'historical-snapshot-2026-01.html' },
  { anio: 2026, mes: 6, file: 'historical-snapshot-2026-06.html' },
];

const outputDirectory = path.join(process.cwd(), 'tests', 'fixtures', 'resumen-mensual');

function sanitizeTextNodes(html) {
  return html.replace(/>([^<]+)</gu, (_, text) => {
    const sanitized = text
      .split(/(&[a-zA-Z0-9#]+;)/gu)
      .map((part) => part.startsWith('&') && part.endsWith(';')
        ? part
        : part.replace(/\p{L}/gu, 'M').replace(/\p{N}/gu, '0'))
      .join('');
    return `>${sanitized}<`;
  });
}

function parseStoredSnapshot(raw) {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return typeof parsed.html === 'string' ? parsed.html : null;
  } catch {
    return raw.trimStart().startsWith('<') ? raw : null;
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error('Faltan NEXT_PUBLIC_SUPABASE_URL/NEXT_PUBLIC_SUPABASE_ANON_KEY');

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

await fs.mkdir(outputDirectory, { recursive: true });
const manifest = [];

for (const fixture of FIXTURES) {
  const { data, error } = await supabase
    .from('resumen_mensual')
    .select('anio,mes,updated_at,experiencia_cliente')
    .eq('anio', fixture.anio)
    .eq('mes', fixture.mes)
    .maybeSingle();

  if (error) throw new Error(`No se pudo leer ${fixture.anio}-${fixture.mes}: ${error.message}`);
  const html = parseStoredSnapshot(data?.experiencia_cliente);
  if (!html) throw new Error(`La fila ${fixture.anio}-${fixture.mes} no contiene HTML histórico`);
  if (/<(?:script|style)\b/iu.test(html)) throw new Error('El fixture contiene tags ejecutables inesperados');

  const sanitized = sanitizeTextNodes(html);
  await fs.writeFile(path.join(outputDirectory, fixture.file), `${sanitized}\n`, 'utf8');
  manifest.push({
    file: fixture.file,
    period: `${fixture.anio}-${String(fixture.mes).padStart(2, '0')}`,
    sourceUpdatedAt: data.updated_at,
    sanitized: 'Text nodes only; DOM, class, id, style and visual attributes preserved.',
    originalHtmlLength: html.length,
    fixtureHtmlLength: sanitized.length,
  });
}

await fs.writeFile(
  path.join(outputDirectory, 'manifest.json'),
  `${JSON.stringify({ capturedAt: new Date().toISOString(), source: 'Supabase read-only resumen_mensual.experiencia_cliente.html', fixtures: manifest }, null, 2)}\n`,
  'utf8',
);

console.log(JSON.stringify(manifest, null, 2));
