import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import ts from 'typescript';

const target = process.argv[2];
const write = process.argv.includes('--write');
const protectedId = process.argv.find((argument) => argument.startsWith('--outside-id='))?.split('=')[1];
if (!target) throw new Error('Uso: node scripts/migrate-live-inline-styles.mjs <archivo.tsx> [--write]');

const absolute = path.resolve(process.cwd(), target);
const modulePath = absolute.replace(/\.tsx$/, '.module.css');
const source = fs.readFileSync(absolute, 'utf8');
if (source.includes(".module.css'")) throw new Error(`${target} ya importa un CSS Module`);
const ast = ts.createSourceFile(absolute, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

const unitless = new Set([
  'animationIterationCount', 'aspectRatio', 'borderImageOutset', 'borderImageSlice',
  'borderImageWidth', 'boxFlex', 'boxFlexGroup', 'boxOrdinalGroup', 'columnCount',
  'columns', 'flex', 'flexGrow', 'flexNegative', 'flexOrder', 'flexPositive',
  'flexShrink', 'floodOpacity', 'fontWeight', 'gridArea', 'gridColumn', 'gridColumnEnd',
  'gridColumnSpan', 'gridColumnStart', 'gridRow', 'gridRowEnd', 'gridRowSpan',
  'gridRowStart', 'lineClamp', 'lineHeight', 'opacity', 'order', 'orphans', 'scale',
  'stopOpacity', 'strokeDasharray', 'strokeDashoffset', 'strokeMiterlimit',
  'strokeOpacity', 'strokeWidth', 'tabSize', 'widows', 'zIndex', 'zoom',
]);

const unwrap = (node) => {
  let current = node;
  while (current && (
    ts.isAsExpression(current)
    || ts.isTypeAssertionExpression(current)
    || ts.isParenthesizedExpression(current)
    || ts.isSatisfiesExpression(current)
  )) current = current.expression;
  return current;
};

const isStatic = (node) => {
  const value = unwrap(node);
  return Boolean(value && (
    ts.isStringLiteral(value)
    || ts.isNumericLiteral(value)
    || ts.isNoSubstitutionTemplateLiteral(value)
    || (ts.isPrefixUnaryExpression(value) && ts.isNumericLiteral(value.operand))
  ));
};

const cssName = (name) => name
  .replace(/^ms-/, '-ms-')
  .replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`);

const cssValue = (property, initializer) => {
  const value = unwrap(initializer);
  if (ts.isStringLiteral(value) || ts.isNoSubstitutionTemplateLiteral(value)) return value.text;
  if (ts.isNumericLiteral(value)) {
    const numeric = Number(value.text);
    return numeric === 0 || unitless.has(property) ? value.text : `${value.text}px`;
  }
  if (ts.isPrefixUnaryExpression(value) && ts.isNumericLiteral(value.operand)) {
    const literal = `${value.operator === ts.SyntaxKind.MinusToken ? '-' : ''}${value.operand.text}`;
    return Number(literal) === 0 || unitless.has(property) ? literal : `${literal}px`;
  }
  throw new Error(`Valor CSS estático no soportado: ${value.getText(ast)}`);
};

const replacements = [];
const rules = [];
let index = 0;

function isInsideProtectedBoundary(node) {
  if (!protectedId) return false;
  let current = node.parent;
  while (current) {
    if (ts.isJsxElement(current)) {
      const id = current.openingElement.attributes.properties.find((attribute) => (
        ts.isJsxAttribute(attribute)
        && attribute.name.text === 'id'
        && attribute.initializer
        && ts.isStringLiteral(attribute.initializer)
        && attribute.initializer.text === protectedId
      ));
      if (id) return true;
    }
    current = current.parent;
  }
  return false;
}

function visit(node) {
  if ((ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node))) {
    const attributes = [...node.attributes.properties];
    const styleAttribute = attributes.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.text === 'style');
    if (styleAttribute && !isInsideProtectedBoundary(styleAttribute) && ts.isJsxAttribute(styleAttribute) && styleAttribute.initializer && ts.isJsxExpression(styleAttribute.initializer)) {
      const expression = unwrap(styleAttribute.initializer.expression);
      if (expression && ts.isObjectLiteralExpression(expression) && expression.properties.every(ts.isPropertyAssignment)) {
        const staticProperties = expression.properties.filter((property) => isStatic(property.initializer));
        if (staticProperties.length) {
          const dynamicProperties = expression.properties.filter((property) => !isStatic(property.initializer));
          const className = `liveStyle${String(++index).padStart(3, '0')}`;
          const declarations = staticProperties.map((property) => {
            const propertyName = property.name.getText(ast).replace(/^['"]|['"]$/g, '');
            return `  ${cssName(propertyName)}: ${cssValue(propertyName, property.initializer)};`;
          });
          rules.push(`.${className} {\n${declarations.join('\n')}\n}`);

          const classAttribute = attributes.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.text === 'className');
          const dynamicStyle = dynamicProperties.length
            ? `style={{ ${dynamicProperties.map((property) => property.getText(ast)).join(', ')} }}`
            : '';

          if (classAttribute && ts.isJsxAttribute(classAttribute)) {
            let replacement;
            if (classAttribute.initializer && ts.isStringLiteral(classAttribute.initializer)) {
              replacement = `className={\`${classAttribute.initializer.text} \${styles.${className}}\`}`;
            } else if (classAttribute.initializer && ts.isJsxExpression(classAttribute.initializer)) {
              replacement = `className={[${classAttribute.initializer.expression?.getText(ast)}, styles.${className}].filter(Boolean).join(' ')}`;
            } else {
              replacement = `className={styles.${className}}`;
            }
            replacements.push({ start: classAttribute.getStart(ast), end: classAttribute.getEnd(), text: replacement });
            replacements.push({ start: styleAttribute.getStart(ast), end: styleAttribute.getEnd(), text: dynamicStyle });
          } else {
            const replacement = `className={styles.${className}}${dynamicStyle ? ` ${dynamicStyle}` : ''}`;
            replacements.push({ start: styleAttribute.getStart(ast), end: styleAttribute.getEnd(), text: replacement });
          }
        }
      }
    }
  }
  ts.forEachChild(node, visit);
}

visit(ast);
console.log(JSON.stringify({ target, migratedStyleAttributes: index, cssRules: rules.length, write }, null, 2));
if (!write) process.exit(0);

let nextSource = source;
for (const replacement of replacements.sort((a, b) => b.start - a.start)) {
  nextSource = nextSource.slice(0, replacement.start) + replacement.text + nextSource.slice(replacement.end);
}

const importInsertion = nextSource.indexOf('\n', nextSource.indexOf("'use client'")) + 1;
nextSource = `${nextSource.slice(0, importInsertion)}\nimport styles from './${path.basename(modulePath)}';${nextSource.slice(importInsertion)}`;
fs.writeFileSync(absolute, nextSource, 'utf8');
fs.writeFileSync(modulePath, `${rules.join('\n\n')}\n`, 'utf8');
