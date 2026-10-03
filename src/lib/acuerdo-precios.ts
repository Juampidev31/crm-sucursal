// Regla única de Acuerdo de precios vs Score.
//
// El acuerdo expresa el PRECIO según el score; la autorización especial de CC
// expresa CÓMO se autorizó la operación. Son dos ejes distintos: una operación
// con score bajo puede cerrarse igual con precio Riesgo Medio si CC la autorizó.
// Por eso la validación deja de bloquear cuando el registro tiene el flag.
//
// Antes esta regla estaba escrita dos veces en registros/page.tsx (una en la
// validación y otra en el autocompletado por score) y podían divergir.

export const ACUERDOS = ['Riesgo Bajo', 'Riesgo Medio', 'Premium'] as const;
export type Acuerdo = typeof ACUERDOS[number];

export type AvisoAcuerdo = { mensaje: string; bloquea: boolean };

// Acuerdo que corresponde a un score. De 0 a 549 no corresponde ninguno: el
// registro no califica por score y el campo queda vacío (salvo autorización CC).
export function acuerdoSugeridoPorScore(score: number): Acuerdo | '' {
  if (!Number.isFinite(score)) return '';
  if (score <= 549) return '';
  if (score <= 600) return 'Riesgo Medio';
  if (score <= 700) return 'Riesgo Bajo';
  return 'Premium';
}

// Valor histórico: hasta octubre de 2026 el tramo 0-549 se guardaba como
// 'No califica'. Ya no se puede elegir, pero miles de registros lo tienen y
// tienen que poder editarse sin pedir una autorización que nunca existió.
const LEGADO_NO_CALIFICA = 'No califica';

const EXIGIDO: Record<Acuerdo, string> = {
  'Riesgo Medio': 'Debe ser Riesgo MEDIO (550-600)',
  'Riesgo Bajo': 'Debe ser Riesgo BAJO (601-700)',
  'Premium': 'Debe ser PREMIUM (+700)',
};

// Devuelve null si el acuerdo es consistente con el score (o si no hay nada que
// validar). Si no, el aviso a mostrar y si impide guardar.
export function validarAcuerdoVsScore(
  score: number,
  acuerdo: string,
  autorizacionCC: boolean,
): AvisoAcuerdo | null {
  if (!Number.isFinite(score)) return null;
  if (!acuerdo) return null;

  const esperado = acuerdoSugeridoPorScore(score);
  if (acuerdo === esperado) return null;
  if (esperado === '' && acuerdo === LEGADO_NO_CALIFICA) return null;

  if (autorizacionCC) {
    return { mensaje: 'Autorizado por CC — no coincide con el score', bloquea: false };
  }
  if (esperado === '') {
    return { mensaje: 'Score 0-549: requiere autorización especial de CC', bloquea: true };
  }
  return { mensaje: EXIGIDO[esperado], bloquea: true };
}
