const CSS_VARIABLE = /^var\((--[\w-]+)(?:,\s*([^\)]+))?\)$/;

/** Resolve a design token before passing it to Canvas APIs, which cannot parse var(...). */
export function resolveCssColor(value: string, fallback = value): string {
  const match = value.trim().match(CSS_VARIABLE);
  if (!match) return value;
  if (typeof document === 'undefined') return match[2]?.trim() || fallback;

  const resolved = getComputedStyle(document.documentElement)
    .getPropertyValue(match[1])
    .trim();

  return resolved || match[2]?.trim() || fallback;
}
