import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import postcss from 'postcss';
import ts from 'typescript';

const root = process.cwd();
const relative = (file) => path.relative(root, file).replaceAll('\\', '/');
const walk = (directory) => fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const absolute = path.join(directory, entry.name);
  if (entry.isDirectory()) return ['node_modules', '.next'].includes(entry.name) ? [] : walk(absolute);
  return [absolute];
});

const files = walk(path.join(root, 'src'));
const cssFiles = files.filter((file) => file.endsWith('.css'));
const tsxFiles = files.filter((file) => file.endsWith('.tsx'));
const sourceFiles = files.filter((file) => /\.(?:tsx?|css)$/.test(file));
const sources = new Map(sourceFiles.map((file) => [file, fs.readFileSync(file, 'utf8')]));
const allSource = [...sources.values()].join('\n');
const colorPattern = /#[\da-f]{3,8}\b|\b(?:rgb|hsl|oklch)a?\([^)]*\)/gi;

const snapshotRoot = 'src/app/ajustes/ResumenMensualTab.tsx';
const snapshotChildren = new Set([
  'src/app/ajustes/MetricasTab.tsx',
  'src/app/analistas/NuevaSeccionSheets.tsx',
  'src/app/ajustes/SeccionGraficosResumen.tsx',
]);

function snapshotLineRange(source) {
  const lines = source.split(/\r?\n/);
  const start = lines.findIndex((line) => line.includes('id="resumen-reporte-body"'));
  if (start < 0) return null;
  const indent = lines[start].search(/\S/);
  for (let index = start + 1; index < lines.length; index++) {
    if (lines[index].search(/\S/) === indent && lines[index].trim().startsWith('</div>')) return [start + 1, index + 1];
  }
  return null;
}

const snapshotRange = snapshotLineRange(sources.get(path.join(root, snapshotRoot)) || '');
const isSnapshotLocation = (file, line) => {
  const name = relative(file);
  if (snapshotChildren.has(name)) return true;
  return name === snapshotRoot && snapshotRange && line >= snapshotRange[0] && line <= snapshotRange[1];
};

const isSnapshotFragment = (node) => {
  let current = node.parent;
  while (current) {
    if (ts.isJsxElement(current)) {
      const marked = current.openingElement.attributes.properties.some((attribute) => (
        ts.isJsxAttribute(attribute) && attribute.name.text === 'data-snapshot-fragment'
      ));
      if (marked) return true;
    }
    current = current.parent;
  }
  return false;
};

const isStaticExpression = (node) => {
  if (!node) return false;
  if (ts.isStringLiteral(node) || ts.isNumericLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return true;
  if ([ts.SyntaxKind.TrueKeyword, ts.SyntaxKind.FalseKeyword, ts.SyntaxKind.NullKeyword].includes(node.kind)) return true;
  return ts.isPrefixUnaryExpression(node) && ts.isNumericLiteral(node.operand);
};

const unwrapExpression = (node) => {
  let current = node;
  while (current && (
    ts.isAsExpression(current)
    || ts.isTypeAssertionExpression(current)
    || ts.isParenthesizedExpression(current)
    || ts.isSatisfiesExpression(current)
  )) current = current.expression;
  return current;
};

const inline = {
  total: 0,
  snapshot: 0,
  live: { total: 0, static: 0, dynamic: 0, mixed: 0, review: 0 },
  byFile: new Map(),
  byComponent: new Map(),
};
let styleTags = 0;
let tsxColors = 0;
const hardcodesByFile = new Map();

for (const file of tsxFiles) {
  const source = sources.get(file);
  const fileColorCount = (source.match(colorPattern) || []).length;
  tsxColors += fileColorCount;
  if (fileColorCount) hardcodesByFile.set(relative(file), fileColorCount);
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const fileMetrics = { total: 0, snapshot: 0, static: 0, dynamic: 0, mixed: 0, review: 0 };
  const componentMetrics = new Map();
  const componentNameFor = (start) => {
    let current = start.parent;
    while (current) {
      if (ts.isFunctionDeclaration(current) && current.name) return current.name.text;
      if ((ts.isArrowFunction(current) || ts.isFunctionExpression(current)) && ts.isVariableDeclaration(current.parent) && ts.isIdentifier(current.parent.name)) {
        return current.parent.name.text;
      }
      current = current.parent;
    }
    return 'default-export';
  };
  const visit = (node) => {
    if (ts.isJsxAttribute(node) && node.name.text === 'style') {
      inline.total++;
      fileMetrics.total++;
      const line = ast.getLineAndCharacterOfPosition(node.getStart(ast)).line + 1;
      if (isSnapshotLocation(file, line) || isSnapshotFragment(node)) {
        inline.snapshot++;
        fileMetrics.snapshot++;
      } else {
        inline.live.total++;
        const rawExpression = node.initializer && ts.isJsxExpression(node.initializer) ? node.initializer.expression : undefined;
        const expression = unwrapExpression(rawExpression);
        let classification = 'review';
        if (expression && ts.isObjectLiteralExpression(expression)) {
          const assignments = expression.properties.filter(ts.isPropertyAssignment);
          const hasUnsupported = assignments.length !== expression.properties.length;
          const staticCount = assignments.filter((property) => isStaticExpression(property.initializer)).length;
          const dynamicCount = assignments.length - staticCount;
          if (!hasUnsupported && assignments.length && staticCount === assignments.length) classification = 'static';
          else if (!hasUnsupported && assignments.length && dynamicCount === assignments.length) classification = 'dynamic';
          else if (assignments.length && staticCount && dynamicCount) classification = 'mixed';
        }
        inline.live[classification]++;
        fileMetrics[classification]++;
        const component = componentNameFor(node);
        const metrics = componentMetrics.get(component) || { total: 0, static: 0, dynamic: 0, mixed: 0, review: 0 };
        metrics.total++;
        metrics[classification]++;
        componentMetrics.set(component, metrics);
      }
    }
    if (ts.isJsxElement(node) && node.openingElement.tagName.getText(ast) === 'style') styleTags++;
    ts.forEachChild(node, visit);
  };
  visit(ast);
  if (fileMetrics.total) inline.byFile.set(relative(file), fileMetrics);
  if (componentMetrics.size) inline.byComponent.set(relative(file), componentMetrics);
}

const selectorDefinitions = new Map();
const tokenDefinitions = new Map();
const tokenUses = new Map();
const legacyTokens = new Set();
const runtimeTokens = new Set(['--font-outfit']);
const importantByFile = new Map();
const keyframes = [];
const hardcodes = new Map();
let cssLines = 0;
let selectors = 0;
let declarations = 0;
let importantTotal = 0;
let importantSnapshot = 0;
let mediaQueries = 0;
let cssColors = 0;
let styleAttributeSelectors = 0;
const styleAttributeDetails = [];
const importantDetails = [];
const isSnapshotSelector = (selector) => /\.(?:legacy-snapshot|report-snapshot|snapshot-producer)\b/.test(selector);

const cssSection = (selector) => {
  if (isSnapshotSelector(selector)) return 'snapshot-compatibility';
  if (/sidebar/i.test(selector)) return 'sidebar';
  if (/records-|record-row|registros/i.test(selector)) return 'registros';
  if (/analistas|category-sheet|metricas-state|report-period|dist-block|reportes-grid/i.test(selector)) return 'analistas';
  if (/modal|overlay|dialog/i.test(selector)) return 'modales';
  if (/ajustes|settings|tab-button|business-days|duplicate-audit|daily-/i.test(selector)) return 'ajustes';
  if (/app-shell|app-topbar|dashboard-container|content-wrapper|main-content/i.test(selector)) return 'shell';
  return 'otros';
};

const declarationSignature = (rule) => rule.nodes
  ?.filter((node) => node.type === 'decl')
  .map((decl) => `${decl.prop}:${decl.value}${decl.important ? '!important' : ''}`)
  .sort()
  .join(';') || '';

for (const file of cssFiles) {
  const source = sources.get(file);
  cssLines += source.split(/\r?\n/).length;
  const colors = source.match(colorPattern) || [];
  cssColors += colors.length;
  if (colors.length) hardcodesByFile.set(relative(file), colors.length);
  for (const value of colors) hardcodes.set(value.toLowerCase(), (hardcodes.get(value.toLowerCase()) || 0) + 1);
  const ast = postcss.parse(source, { from: file });
  ast.walkRules((rule) => {
    if (rule.parent?.type === 'atrule' && rule.parent.name.endsWith('keyframes')) return;
    const selector = rule.selector.replace(/\s+/g, ' ').trim();
    const key = `${relative(file)}::${selector}`;
    const media = rule.parent?.type === 'atrule' && rule.parent.name === 'media' ? rule.parent.params : null;
    const definition = { line: rule.source.start.line, media, signature: declarationSignature(rule) };
    selectorDefinitions.set(key, [...(selectorDefinitions.get(key) || []), definition]);
    selectors += rule.selectors?.length || 1;
    if (selector.includes('[style*=')) {
      const snapshot = isSnapshotSelector(selector);
      styleAttributeSelectors++;
      styleAttributeDetails.push({
        file: relative(file),
        line: rule.source.start.line,
        selector,
        media,
        section: cssSection(selector),
        live: !snapshot,
        snapshot,
        producer: selector.includes('.snapshot-producer'),
        historical: /\.(?:legacy-snapshot|report-snapshot)\b/.test(selector),
        purpose: 'counter-inline compatibility override',
        replaceable: !snapshot,
      });
    }
  });
  ast.walkDecls((decl) => {
    declarations++;
    if (decl.important) {
      importantTotal++;
      const selector = decl.parent?.selector || '';
      const snapshot = isSnapshotSelector(selector);
      if (snapshot) importantSnapshot++;
      const name = relative(file);
      const current = importantByFile.get(name) || { live: 0, snapshot: 0 };
      current[snapshot ? 'snapshot' : 'live']++;
      importantByFile.set(name, current);
      const media = decl.parent?.parent?.type === 'atrule' && decl.parent.parent.name === 'media' ? decl.parent.parent.params : null;
      let classification = 'override-review';
      if (snapshot) classification = 'legacy-snapshot';
      else if (selector.includes('[style*=')) classification = 'counter-inline';
      else if (media) classification = 'responsive-review';
      importantDetails.push({ file: name, line: decl.source.start.line, selector, property: decl.prop, media, classification, section: cssSection(selector) });
    }
    if (decl.prop.startsWith('--')) {
      tokenDefinitions.set(decl.prop, (tokenDefinitions.get(decl.prop) || 0) + 1);
      if (isSnapshotSelector(decl.parent?.selector || '')) legacyTokens.add(decl.prop);
    }
    for (const match of decl.value.matchAll(/var\(\s*(--[\w-]+)/g)) tokenUses.set(match[1], (tokenUses.get(match[1]) || 0) + 1);
  });
  ast.walkAtRules((rule) => {
    if (rule.name === 'media') mediaQueries++;
    if (rule.name.endsWith('keyframes')) keyframes.push(rule.params);
  });
}

for (const file of files.filter((candidate) => /\.tsx?$/.test(candidate))) {
  const source = sources.get(file);
  for (const match of source.matchAll(/var\(\s*(--[\w-]+)/g)) tokenUses.set(match[1], (tokenUses.get(match[1]) || 0) + 1);
  for (const match of source.matchAll(/['"](--[\w-]+)['"]\s*:/g)) runtimeTokens.add(match[1]);
}

const duplicateDetails = [...selectorDefinitions.entries()]
  .filter(([, definitions]) => definitions.length > 1)
  .map(([key, definitions]) => {
    const separator = key.indexOf('::');
    const file = key.slice(0, separator);
    const selector = key.slice(separator + 2);
    const signatures = new Set(definitions.map(({ signature }) => signature));
    const hasMedia = definitions.some(({ media }) => media);
    let classification = 'override-review';
    if (signatures.size === 1) classification = 'identical';
    else if (selector.includes('.legacy-snapshot')) classification = 'legacy';
    else if (hasMedia) classification = 'responsive';
    return { file, selector, count: definitions.length, classification, definitions };
  });

const duplicateSummary = duplicateDetails.reduce((summary, item) => {
  summary[item.classification] = (summary[item.classification] || 0) + 1;
  return summary;
}, {});
const duplicateByFile = [...duplicateDetails.reduce((files, item) => {
  const counts = files.get(item.file) || { total: 0, identical: 0, responsive: 0, legacy: 0, overrideReview: 0 };
  counts.total++;
  if (item.classification === 'override-review') counts.overrideReview++;
  else counts[item.classification]++;
  files.set(item.file, counts);
  return files;
}, new Map()).entries()]
  .map(([file, counts]) => ({ file, ...counts }))
  .sort((a, b) => b.total - a.total);
const unusedTokens = [...tokenDefinitions.keys()].filter((token) => !tokenUses.has(token) && !legacyTokens.has(token));
const undefinedTokens = [...tokenUses.keys()].filter((token) => !tokenDefinitions.has(token) && !runtimeTokens.has(token));
const unusedKeyframes = keyframes.filter((name) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withoutDefinition = allSource.replace(new RegExp(`@(?:-webkit-)?keyframes\\s+${escaped}\\b`, 'g'), '');
  return !new RegExp(`\\b${escaped}\\b`).test(withoutDefinition);
});

const inlineRanking = [...inline.byFile.entries()]
  .map(([file, metrics]) => ({ file, ...metrics }))
  .filter(({ static: staticCount, mixed, review }) => staticCount + mixed + review > 0)
  .sort((a, b) => (b.static + b.mixed + b.review) - (a.static + a.mixed + a.review));
const importantRanking = [...importantByFile.entries()]
  .map(([file, counts]) => ({ file, ...counts }))
  .sort((a, b) => b.live - a.live);
const hardcodeRanking = [...hardcodes.entries()]
  .map(([value, count]) => ({ value, count }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 20);
const hardcodeFileRanking = [...hardcodesByFile.entries()]
  .map(([file, count]) => ({ file, count }))
  .sort((a, b) => b.count - a.count)
  .slice(0, 20);
const componentRanking = [...inline.byComponent.entries()].flatMap(([file, components]) =>
  [...components.entries()].map(([component, metrics]) => ({ file, component, ...metrics }))
).sort((a, b) => (b.static + b.mixed + b.review) - (a.static + a.mixed + a.review));
const importantClassification = importantDetails.reduce((summary, item) => {
  summary[item.classification] = (summary[item.classification] || 0) + 1;
  return summary;
}, {});
const importantSections = importantDetails.reduce((summary, item) => {
  summary[item.section] = (summary[item.section] || 0) + 1;
  return summary;
}, {});

console.log(JSON.stringify({
  css: { files: cssFiles.length, lines: cssLines, selectors, declarations, mediaQueries, keyframes: keyframes.length, unusedKeyframes },
  tokens: {
    totalCssDefinitions: tokenDefinitions.size,
    canonical: tokenDefinitions.size - legacyTokens.size,
    snapshotAliases: legacyTokens.size,
    runtime: [...runtimeTokens].sort(),
    duplicateDefinitions: [...tokenDefinitions.values()].filter((count) => count > 1).length,
    unusedCanonical: unusedTokens,
    undefined: undefinedTokens,
  },
  inline: { total: inline.total, snapshot: inline.snapshot, live: inline.live, ranking: inlineRanking, components: componentRanking },
  important: {
    total: importantTotal,
    live: importantTotal - importantSnapshot,
    snapshot: importantSnapshot,
    justifiedThirdParty: 0,
    ranking: importantRanking,
    classification: importantClassification,
    sections: importantSections,
    details: importantDetails,
  },
  duplicates: { total: duplicateDetails.length, summary: duplicateSummary, ranking: duplicateByFile, details: duplicateDetails },
  styleAttributeSelectors,
  styleAttributeDetails,
  boundaries: {
    liveRenderer: {
      inline: inline.live,
      important: importantTotal - importantSnapshot,
      styleAttributeSelectors: styleAttributeDetails.filter((item) => item.live).length,
    },
    snapshotProducer: {
      inline: inline.snapshot,
      important: importantDetails.filter((item) => item.selector.includes('.snapshot-producer')).length,
      styleAttributeSelectors: styleAttributeDetails.filter((item) => item.producer).length,
    },
    historicalCompatibility: {
      fixtures: 2,
      important: importantDetails.filter((item) => /\.(?:legacy-snapshot|report-snapshot)\b/.test(item.selector)).length,
      styleAttributeSelectors: styleAttributeDetails.filter((item) => item.historical).length,
    },
  },
  hardcodes: {
    cssColors,
    tsxColors,
    totalColors: cssColors + tsxColors,
    ranking: hardcodeFileRanking,
    topCssValues: hardcodeRanking,
  },
  styleTags,
}, null, 2));
