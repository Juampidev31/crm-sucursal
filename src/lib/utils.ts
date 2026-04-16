/**
 * Formatters cacheados — se crean una sola vez al cargar el módulo
 * (en lugar de crear nuevas instancias en cada llamada)
 */
const currencyFmt = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const dateFmt = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dateTimeFmt = new Intl.DateTimeFormat('es-AR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

export const formatCurrency = (value: number): string =>
  currencyFmt.format(value);

function parseDateLocal(str: string): Date {
  // "YYYY-MM-DD" → hora local para evitar el desfase UTC-3
  // "YYYY-MM-DDTHH:mm:ss..." → incluye hora, usar parse completo
  const parts = str.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (parts && !str.includes('T')) {
    // Solo fecha, sin hora → usar mediodía para evitar problemas de zona horaria
    return new Date(+parts[1], +parts[2] - 1, +parts[3], 12, 0, 0);
  }
  // Tiene hora (formato ISO completo) → parsear normalmente
  return new Date(str);
}

export const formatDate = (date: string | Date | null): string => {
  if (!date) return '-';
  const d = typeof date === 'string' ? parseDateLocal(date) : date;
  if (isNaN(d.getTime())) return '-';
  return dateFmt.format(d);
};

export const formatDateTime = (date: string | Date | null): string => {
  if (!date) return '-';
  const d = typeof date === 'string' ? parseDateLocal(date) : date;
  if (isNaN(d.getTime())) return '-';
  return dateTimeFmt.format(d);
};

export const STATUS_LABEL: Record<string, string> = {
  'venta': 'Venta',
  'proyeccion': 'Proyección',
  'en seguimiento': 'En seguimiento',
  'score bajo': 'Score bajo',
  'afectaciones': 'Afectaciones',
  'derivado / aprobado cc': 'Aprob. CC',
  'derivado / rechazado cc': 'Rechaz. CC',
  'no califica': 'No califica',
};

export const getStatusLabel = (status: string): string =>
  STATUS_LABEL[status?.toLowerCase()] || status;

export const calcularDiasHabilesEntreFechas = (fechaInicio: Date, fechaFin: Date): number => {
  if (!fechaInicio || !fechaFin) return 0;
  let inicio = new Date(fechaInicio);
  let fin = new Date(fechaFin);
  if (isNaN(inicio.getTime()) || isNaN(fin.getTime())) return 0;
  if (inicio > fin) [inicio, fin] = [fin, inicio];
  let diasHabiles = 0;
  const diaActual = new Date(inicio);
  while (diaActual <= fin) {
    const ds = diaActual.getDay();
    if (ds >= 1 && ds <= 5) diasHabiles++;
    diaActual.setDate(diaActual.getDate() + 1);
  }
  return diasHabiles;
};

export const calcularDiasHabilesAutomaticos = (mes?: number, anio?: number) => {
  const hoy = new Date();
  const targetAnio = anio ?? hoy.getFullYear();
  const targetMes = mes ?? hoy.getMonth();
  const ultimoDia = new Date(targetAnio, targetMes + 1, 0);
  let diasHabiles = 0, diasTranscurridos = 0;
  const esPasado = (targetAnio < hoy.getFullYear()) ||
    (targetAnio === hoy.getFullYear() && targetMes < hoy.getMonth());
  const esActual = (targetAnio === hoy.getFullYear() && targetMes === hoy.getMonth());
  for (let dia = 1; dia <= ultimoDia.getDate(); dia++) {
    const ds = new Date(targetAnio, targetMes, dia).getDay();
    if (ds >= 1 && ds <= 5) {
      diasHabiles++;
      if (esPasado || (esActual && dia <= hoy.getDate())) diasTranscurridos++;
    }
  }
  return { diasHabiles, diasTranscurridos, diasRestantes: Math.max(0, diasHabiles - diasTranscurridos), sonManuales: false };
};

export const calcularComisiones = (
  ventasMensuales: number,
  cantidadVentas: number,
  objetivoVentas: number,
  objetivoOperaciones: number
) => {
  const pctV = ventasMensuales / (objetivoVentas || 1);
  const pctO = cantidadVentas / (objetivoOperaciones || 1);

  let comisionCapital = 0;
  if (pctV >= 0.75) {
    let coeficiente = 0;
    if (pctV >= 1.20) coeficiente = 0.0045;
    else if (pctV >= 1.10) coeficiente = 0.0037;
    else if (pctV >= 0.90) coeficiente = 0.0030;
    else if (pctV >= 0.75) coeficiente = 0.0020;
    comisionCapital = ventasMensuales * coeficiente;
  }

  let porcentajeAdicional = 0;
  if (pctO >= 1.00) porcentajeAdicional = 0.30;
  else if (pctO >= 0.80) porcentajeAdicional = 0.20;
  const comisionOperaciones = comisionCapital * porcentajeAdicional;

  const comisionTotal = Math.min(comisionCapital + comisionOperaciones, 200_000) + 21_742;

  return {
    comisionCapital,
    comisionOperaciones,
    comisionTotal,
  };
};

/**
 * Capitaliza texto genérico: primera letra de cada palabra en mayúscula.
 * Ej: "jubilado" → "Jubilado" | "PAraná" → "Paraná"
 */
export const capitalizarTexto = (value: string): string => {
  return value
    .trim()
    .split(/\s+/)
    .map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
};

/**
 * Capitaliza la primera letra de cada palabra y agrega coma después del primer nombre.
 * Ej: "garcia juan pablo" → "Garcia, Juan Pablo"
 * Ej: "garcia"            → "Garcia"  (una sola palabra, sin coma)
 * Preserva el espacio final para que el cursor no se pegue al escribir.
 */
export const capitalizarNombre = (value: string): string => {
  const trailingSpace = value.endsWith(' ') ? ' ' : '';
  // 1. Strip leading/trailing dots, commas, dashes, spaces
  let cleaned = value.replace(/^[.,\-\s]+/, '').replace(/[.\-]+$/g, '');
  // 2. Normalize multiple spaces and commas
  cleaned = cleaned.replace(/,+/g, ',').replace(/\s+/g, ' ').trim();
  // 3. If there's a comma, split into "Apellido, Nombre" parts
  if (cleaned.includes(',')) {
    const [apellido, ...rest] = cleaned.split(',');
    const nombre = rest.join(' ').trim();
    const capApellido = apellido.trim().split(' ').filter(Boolean)
      .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
    if (!nombre) return capApellido + ',' + trailingSpace;
    const capNombre = nombre.split(' ').filter(Boolean)
      .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()).join(' ');
    return capApellido + ', ' + capNombre + trailingSpace;
  }
  // 4. No comma — first word is apellido, rest is nombre
  const partes = cleaned.split(' ').filter(Boolean);
  if (partes.length === 0) return '';
  const cap = partes.map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase());
  if (cap.length === 1) return cap[0] + trailingSpace;
  return cap[0] + ', ' + cap.slice(1).join(' ') + trailingSpace;
};

/**
 * Sanitiza un CUIL: elimina todo lo que no sea dígito y limita a 11 caracteres
 * Ej: "20-12345678-9" → "20123456789"
 * Ej: "abc123" → "123"
 */
export const sanitizarCuil = (value: string): string => {
  return value.replace(/\D/g, '').slice(0, 11);
};

/**
 * Mapeo de valores internos de analista → nombre de display
 * "Column5" es el nombre interno en la BD para PDV (Punto de Venta)
 */
const ANALISTA_ALIAS: Record<string, string> = {
  'Column 5': 'PDV',
  'Column5': 'PDV',  // fallback sin espacio
};

export const displayAnalista = (raw: string): string => ANALISTA_ALIAS[raw] ?? raw;
