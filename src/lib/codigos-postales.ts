// CP → localidades. Un mismo CP puede mapear a varias localidades.

export type CPMap = Record<string, string[]>;

const BUILTIN: Array<[string, string]> = [
  ['3100', 'Paraná'],
  ['3107', 'San Benito'],
  ['3101', 'Colonia Avellaneda'],
  ['3100', 'Oro Verde'],
  ['3101', 'Sauce Montrull'],
  ['3190', 'La Paz'],
  ['3105', 'Diamante'],
  ['3113', 'Villa Urquiza'],
  ['3133', 'María Grande'],
  ['3127', 'Hernandarias'],
  ['3111', 'Colonia Ensayo'],
  ['3109', 'Aldea Brasilera'],
  ['3101', 'Villa Gobernador Etchevehere'],
  ['3111', 'Tezanos Pintos'],
  ['3153', 'Victoria'],
  ['3116', 'Crespo'],
  ['3109', 'Viale'],
  ['3117', 'Seguí'],
  ['3146', 'Hasenkamp'],
  ['3150', 'Nogoyá'],
];

const STORAGE_KEY = 'cp_localidad_custom_v1';

function buildMap(pairs: Array<[string, string]>): CPMap {
  const map: CPMap = {};
  for (const [cp, loc] of pairs) {
    const key = cp.trim();
    const value = loc.trim();
    if (!key || !value) continue;
    if (!map[key]) map[key] = [];
    if (!map[key].includes(value)) map[key].push(value);
  }
  return map;
}

function readCustom(): Array<[string, string]> {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x: unknown): x is [string, string] =>
      Array.isArray(x) && x.length === 2 && typeof x[0] === 'string' && typeof x[1] === 'string'
    );
  } catch {
    return [];
  }
}

function writeCustom(pairs: Array<[string, string]>) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(pairs));
}

export function getCPMap(): CPMap {
  return buildMap([...BUILTIN, ...readCustom()]);
}

export function getLocalidadesByCP(cp: string): string[] {
  if (!cp) return [];
  return getCPMap()[cp.trim()] || [];
}

export function addCustomMapping(cp: string, localidad: string) {
  const key = cp.trim();
  const value = localidad.trim();
  if (!key || !value) return;
  const current = readCustom();
  if (current.some(([c, l]) => c === key && l.toLowerCase() === value.toLowerCase())) return;
  current.push([key, value]);
  writeCustom(current);
}

export function getCPByLocalidad(localidad: string): string | null {
  if (!localidad) return null;
  const target = localidad.trim().toLowerCase();
  const all: Array<[string, string]> = [...BUILTIN, ...readCustom()];
  const hit = all.find(([, l]) => l.toLowerCase() === target);
  return hit ? hit[0] : null;
}
