const LOWERCASE_PARTICLES = new Set(['da', 'das', 'de', 'del', 'do', 'dos', 'e', 'la', 'las', 'los', 'y']);

function normalizeWord(word: string, isFirst: boolean): string {
  return word
    .toLocaleLowerCase('es-AR')
    .split(/([-'])/)
    .map((part, index) => {
      if (part === '-' || part === "'") return part;
      if (!part) return part;
      if (!isFirst && index === 0 && LOWERCASE_PARTICLES.has(part)) return part;
      return `${part.charAt(0).toLocaleUpperCase('es-AR')}${part.slice(1)}`;
    })
    .join('');
}

function normalizeWords(value: string): string {
  return value
    .split(' ')
    .filter(Boolean)
    .map((word, index) => normalizeWord(word, index === 0))
    .join(' ');
}

function surnameTokenCount(tokens: string[]): number {
  const first = tokens[0]?.toLocaleLowerCase('es-AR');
  const second = tokens[1]?.toLocaleLowerCase('es-AR');
  const third = tokens[2]?.toLocaleLowerCase('es-AR');

  if (first === 'de') return ['la', 'las', 'los'].includes(second) ? Math.min(3, tokens.length) : Math.min(2, tokens.length);
  if (first === 'del') return Math.min(2, tokens.length);
  if (['de', 'da', 'do'].includes(second)) {
    return ['la', 'las', 'los'].includes(third) ? Math.min(4, tokens.length) : Math.min(3, tokens.length);
  }
  if (second === 'del') return Math.min(3, tokens.length);
  return 1;
}

/**
 * Uniforma nombres históricos escritos en mayúsculas/minúsculas dispares.
 * Cuando no hay coma, el primer término se interpreta como apellido porque
 * las fuentes de ambas tablas almacenan "APELLIDO Y NOMBRE".
 */
export function normalizePersonName(value: string): string {
  const clean = value
    .replace(/\s+(?:CUIL|DNI)\b[\s:.-]*[\d-].*$/iu, '')
    .replace(/\s*\|.*$/u, '')
    .replace(/\s+/g, ' ')
    .replace(/^\s*[,;.-]+|[,;.-]+\s*$/g, '')
    .trim();

  if (!clean) return '';

  const commaIndex = clean.indexOf(',');
  if (commaIndex >= 0) {
    const surname = normalizeWords(clean.slice(0, commaIndex).trim());
    const givenNames = normalizeWords(clean.slice(commaIndex + 1).replace(/,+/g, ' ').trim());
    return givenNames ? `${surname}, ${givenNames}` : surname;
  }

  const tokens = clean.split(' ');
  const splitAt = surnameTokenCount(tokens);
  const normalizedSurname = normalizeWords(tokens.slice(0, splitAt).join(' '));
  const normalizedGivenNames = normalizeWords(tokens.slice(splitAt).join(' '));
  return normalizedGivenNames ? `${normalizedSurname}, ${normalizedGivenNames}` : normalizedSurname;
}
