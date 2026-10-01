import 'server-only';
import { parseCSV, parsePct } from '@/lib/csv-utils';

const SHEET_ID = '1RcjEoiOM4PN92fNQv0ZUy-soh7Qa98vdvys0rr9_JlM';
const SHEETS: Record<string, string> = {
  '2025': '1325602277',
  '2026': '666232440',
};

const SNAPSHOTS: Record<string, string> = {
  '2025': `TRAMO 90-119,Objetivo,Recupero,Cumplimiento,,TRAMO 120-209,Objetivo,Recupero,Cumplimiento,,REFINANCIACIONES,Objetivo,Recupero,Cumplimiento
Enero,"761.000,00","110.750,00","14,55%",,Enero,"652.000,00","174.572,00","26,77%",,Enero,"797.000,00","692.370,00","86,87%"
Febrero,"670.000,00","0,00","0,00%",,Febrero,"861.000,00","355.911,00","41,34%",,Febrero,"980.000,00","776.065,00","79,19%"
Marzo,"670.000,00","361.525,00","53,96%",,Marzo,"861.000,00","251.885,00","29,25%",,Marzo,"980.000,00","1.016.771,00","103,75%"
Abril,"402.000,00","206.134,00","51,28%",,Abril,"436.000,00","278.644,00","63,91%",,Abril,"567.000,00","1.280.141,00","225,77%"
Mayo,"951.000,00","637.035,00","66,99%",,Mayo,"725.000,00","73.567,00","10,15%",,Mayo,"900.000,00","150.777,00","16,75%"
Junio,"920.000,00","604.377,00","65,69%",,Junio,"855.000,00","265.284,00","31,03%",,Junio,"900.000,00","0,00","0,00%"
Julio,"1.049.000,00","1.140.881,00","108,76%",,Julio,"923.000,00","860.779,00","93,26%",,Julio,"1.020.000,00","1.151.665,00","112,91%"
Agosto,"930.000,00","718.813,00","77,29%",,Agosto,"1.148.000,00","553.268,00","48,19%",,Agosto,"1.269.000,00","729.718,00","57,50%"
Septiembre,"836.000,00","895.134,00","107,07%",,Septiembre,"1.204.000,00","474.653,50","39,42%",,Septiembre,"1.125.000,00","1.833.112,00","162,94%"
Octubre,"1.114.000,00","929.413,00","83,43%",,Octubre,"741.000,00","334.351,00","45,12%",,Octubre,"855.000,00","861.502,00","100,76%"
Noviembre,"934.000,00","430.908,00","46,14%",,Noviembre,"846.000,00","357.562,00","42,27%",,Noviembre,"936.000,00","680.952,00","72,75%"
Diciembre,"837.000,00","999.452,63","119,41%",,Diciembre,"931.000,00","1.711.231,15","183,81%",,Diciembre,"1.131.000,00","0,00","0,00%"
,,,,,,,,,,,,,
,,,,,,,,,,,,,
,,,,,,,,,,,,,
MOROSIDAD,2025,2024,MEDIA EMP.,,,,,,,,,,
,,,"7,54%",,,,,,,,,,
Enero,"6,41%","6,08%","7,54%"
Febrero,"6,03%","6,58%","7,38%"
Marzo,"6,07%","6,46%","7,55%"
Abril,"6,89%","5,74%","8,64%"
Mayo,"7,15%","6,18%","8,70%"
Junio,"7,67%","6,33%","9,16%"
Julio,"8,38%","7,18%","10,53%"
Agosto,"9,26%","6,33%","11,18%"
Septiembre,"8,65%","6,38%","11,65%"
Octubre,"9,13%","6,54%","12,76%"
Noviembre,"10,59%","6,14%","14,59%"
Diciembre,"10,23%","6,29%","14,06%"`,
  '2026': `TRAMO 90-119,Objetivo,Recupero,Cumplimiento,,TRAMO 120-209,Objetivo,Recupero,Cumplimiento,,REFINANCIACIONES,Objetivo,Recupero,Cumplimiento
Enero,"1.415.000,00","918.478,63","64,91%",,Enero,"1.310.000,00","1.720.149,15","131,31%",,Enero,"1.310.000,00","1.210.252,00","92,39%"
Febrero,"1.551.000,00","1.036.609,45","66,83%",,Febrero,"1.165.000,00","2.677.185,93","229,80%",,Febrero,"1.196.000,00","2.878.916,00","240,71%"
Marzo,"1.903.000,00","808.397,43","42,48%",,Marzo,"1.308.000,00","230.668,88","17,64%",,Marzo,"1.183.000,00","813.506,00","68,77%"
Abril,"2.080.000,00","1.042.850,54","50,14%",,Abril,"1.959.000,00","2.066.461,13","105,49%",,Abril,"1.568.000,00","1.638.526,00","104,50%"
Mayo,"1.213.000,00","1.833.585,79","151,16%",,Mayo,"2.404.000,00","998.381,80","41,53%",,Mayo,"2.020.000,00","933.619,00","46,22%"
Junio,"2.108.000,00","1.630.896,80","77,4%",,Junio,"2.877.000,00","1.620.183,61","56,3%",,Junio,"2.049.000,00","0,00","0,0%"
Julio,"1.933.000,00","1.428.264,26","73,9%",,Julio,"3.445.000,00","1.929.273,73","56,0%",,Julio,"2.584.000,00","1.438.955,00","55,7%"
Agosto,"1.688.000,00","1.234.894,44","73,2%",,Agosto,"3.151.000,00","2.163.811,68","68,7%",,Agosto,"2.528.000,00","6.122.754,00","242,2%"
Septiembre,,,,,Septiembre,,,,,Septiembre,,,
Octubre,,,,,Octubre,,,,,Octubre,,,
Noviembre,,,,,Noviembre,,,,,Noviembre,,,
Diciembre,,,,,Diciembre,,,,,Diciembre,,,
,,,,,,,,,,,,,
,,,,,,,,,,,,,
,,,,,,,,,,,,,
MOROSIDAD,2026,2025,MEDIA EMP.,,,,,,,,,,
,,,"7,54%",,,,,,,,,,
Enero,"11,10%","10,23%","14,31%"
Febrero,"10,77%","6,03%","13,58%"
Marzo,"10,55%","6,07%","13,33%"
Abril,"11,99%","6,89%","14,62%"
Mayo,"13,21%","7,15%","14,61%"
Junio,"13,19%","7,67%","14,30%"
Julio,"14,59%","8,38%","15,03%"
Agosto,"15,65%","9,26%","15,02%"
Septiembre,"14,43%","8,65%","14,42%"
Octubre,,,
Noviembre,,,
Diciembre,,,`,
};

export interface TramoRow { mes: string; objetivo: string; recupero: string; cumplimiento: string; pct: number | null; }
export interface MorosidadRow { mes: string; current: string; currentPct: number | null; anterior: string; anteriorPct: number | null; mediaEmp: string; mediaPct: number | null; }
export interface CobranzasData {
  tramo90: TramoRow[];
  tramo120: TramoRow[];
  refin: TramoRow[];
  morosidad: MorosidadRow[];
  mediaEmpGlobal: string;
  anioCurrent: string;
  anioAnterior: string;
}

export const COBRANZAS_YEARS = Object.keys(SHEETS);

function parseCobranzasData(text: string): CobranzasData {
  const rows = parseCSV(text);

  const tramo90: TramoRow[] = [], tramo120: TramoRow[] = [], refin: TramoRow[] = [];
  for (let i = 1; i <= 12; i++) {
    const r = rows[i];
    if (!r?.[0]) continue;
    tramo90.push({ mes: r[0], objetivo: r[1] || '-', recupero: r[2] || '-', cumplimiento: r[3] || '-', pct: parsePct(r[3]) });
    tramo120.push({ mes: r[5], objetivo: r[6] || '-', recupero: r[7] || '-', cumplimiento: r[8] || '-', pct: parsePct(r[8]) });
    refin.push({ mes: r[10], objetivo: r[11] || '-', recupero: r[12] || '-', cumplimiento: r[13] || '-', pct: parsePct(r[13]) });
  }

  const morosidadStart = rows.findIndex(row => row[0] === 'MOROSIDAD');
  const morosidad: MorosidadRow[] = [];
  let mediaEmpGlobal = '', anioCurrent = '', anioAnterior = '';

  if (morosidadStart >= 0) {
    anioCurrent = rows[morosidadStart][1] || '';
    anioAnterior = rows[morosidadStart][2] || '';
    mediaEmpGlobal = rows[morosidadStart + 1]?.[3] || '';
    for (let i = morosidadStart + 2; i < rows.length; i++) {
      const r = rows[i];
      if (!r?.[0]) continue;
      morosidad.push({
        mes: r[0],
        current: r[1] || '-', currentPct: parsePct(r[1]),
        anterior: r[2] || '-', anteriorPct: parsePct(r[2]),
        mediaEmp: r[3] || '-', mediaPct: parsePct(r[3]),
      });
    }
  }

  return { tramo90, tramo120, refin, morosidad, mediaEmpGlobal, anioCurrent, anioAnterior };
}

function completedValueCount(data: CobranzasData): number {
  return [...data.tramo90, ...data.tramo120, ...data.refin].filter(row => row.pct !== null).length
    + data.morosidad.filter(row => row.currentPct !== null).length;
}

export async function getCobranzasData(year: string): Promise<CobranzasData | null> {
  const gid = SHEETS[year];
  if (!gid) return null;

  const snapshot = parseCobranzasData(SNAPSHOTS[year]);

  let text: string;
  try {
    const res = await fetch(
      `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${gid}`,
      { next: { revalidate: 300 } },
    );
    if (!res.ok) return snapshot;
    text = await res.text();
  } catch {
    return snapshot;
  }

  const live = parseCobranzasData(text);
  return completedValueCount(live) >= completedValueCount(snapshot) ? live : snapshot;
}
