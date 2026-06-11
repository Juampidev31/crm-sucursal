/**
 * Diccionario de palabras comunes que necesitan tilde en español
 * Mapea la forma sin tilde → forma con tilde correcta
 */
const ACCENT_MAP: Record<string, string> = {
  // Palabras básicas
  'parana': 'Paraná',
  'nacion': 'Nación',
  'region': 'Región',
  'administracion': 'Administración',
  'educacion': 'Educación',
  'policia': 'Policía',
  'federacion': 'Federación',
  'union': 'Unión',
  'asociacion': 'Asociación',
  'fundacion': 'Fundación',
  'organizacion': 'Organización',
  'institucion': 'Institución',
  'direccion': 'Dirección',
  'secretaria': 'Secretaría',
  'subsecretaria': 'Subsecretaría',
  'subdireccion': 'Subdirección',
  'coordinacion': 'Coordinación',
  'division': 'División',
  'seccion': 'Sección',
  'area': 'Área',
  'comision': 'Comisión',
  'comite': 'Comité',
  'fiscalia': 'Fiscalía',
  'defensoria': 'Defensoría',
  'procuraduria': 'Procuraduría',
  'tesoreria': 'Tesorería',
  'contaduria': 'Contaduría',
  'auditoria': 'Auditoría',
  'contraloria': 'Contraloría',
  'publico': 'Público',
  'publica': 'Pública',
  'publicos': 'Públicos',
  'publicas': 'Públicas',

  // Nombres comunes argentinos
  'ramirez': 'Ramírez',
  'gomez': 'Gómez',
  'rodriguez': 'Rodríguez',
  'martinez': 'Martínez',
  'lopez': 'López',
  'gonzalez': 'González',
  'garcia': 'García',
  'fernandez': 'Fernández',
  'diaz': 'Díaz',
  'alvarez': 'Álvarez',
  'perez': 'Pérez',
  'sanchez': 'Sánchez',
  'benitez': 'Benítez',
  'vazquez': 'Vázquez',
  'suarez': 'Suárez',
  'chavez': 'Chávez',
  'espindola': 'Espíndola',
  'cordova': 'Córdoba',
  'guzman': 'Guzmán',
  'rios': 'Ríos',
  'juarez': 'Juárez',

  // Palabras con tilde diacrítica
  // NOTA: palabras monosílabas como el/él, mi/mí, de/dé, se/sé, tu/tú, te/té, si/sí
  // se omiten porque la tilde es contextual y la corrección automática
  // genera más errores de los que resuelve.
  'mas': 'más',
  'aun': 'aún',
  'tambien': 'también',
  'despues': 'después',
  'manana': 'mañana',
  'dia': 'día',
  'dias': 'días',
  'anio': 'año',
  'anios': 'años',

  // Verbos comunes
  'esta': 'está',
  'estas': 'estás',
  'estan': 'están',
  'sera': 'será',
  'seran': 'serán',
  'estara': 'estará',
  'estaran': 'estarán',
  'salio': 'salió',
  'llego': 'llegó',

  // Otras palabras frecuentes
  'numero': 'número',
  'telefono': 'teléfono',
  'electronico': 'electrónico',
  'electronica': 'electrónica',
  'automatico': 'automático',
  'automatica': 'automática',
  'practico': 'práctico',
  'practica': 'práctica',
  'tecnico': 'técnico',
  'tecnica': 'técnica',
  'analisis': 'análisis',
  'metodo': 'método',
  'metodos': 'métodos',
  'diagnostico': 'diagnóstico',
  'diagnosticos': 'diagnósticos',
  'pronostico': 'pronóstico',
  'pronosticos': 'pronósticos',
  'deposito': 'depósito',
  'depositos': 'depósitos',
  'credito': 'crédito',
  'creditos': 'créditos',
  'debito': 'débito',
  'debitos': 'débitos',
  'interes': 'interés',
  'proyeccion': 'Proyección',
  'gestion': 'gestión',
  'conversion': 'conversión',
  'atencion': 'atención',
  'evaluacion': 'evaluación',
  'revision': 'revisión',
  'aprobacion': 'aprobación',
  'autorizacion': 'autorización',
  'cancelacion': 'cancelación',
  'confirmacion': 'confirmación',
  'notificacion': 'notificación',
  'observacion': 'observación',
  'resumenes': 'Resúmenes',
  'descripcion': 'Descripción',
  'relacion': 'Relación',
  'ubicacion': 'Ubicación',
  'posicion': 'Posición',
  'situacion': 'Situación',
  'condicion': 'Condición',
  'decision': 'Decisión',
  'accion': 'Acción',
  'satisfaccion': 'satisfacción',
  'desempeno': 'desempeño',
  'desvios': 'desvíos',
  'desvio': 'desvío',
  'periodo': 'período',
  'periodos': 'períodos',
};

// ── Pre-compiled regex entries (built once at module load) ─────────────────
const COMPILED_ENTRIES: Array<{ regex: RegExp; replacement: string }> = Object.entries(ACCENT_MAP).map(
  ([sinTilde, conTilde]) => ({
    regex: new RegExp(`\\b${sinTilde}\\b`, 'gi'),
    replacement: conTilde,
  })
);


/**
 * Corrige automáticamente las tildes en un texto
 * Busca palabras en el diccionario y las reemplaza por su forma correcta
 * NOTA: Los regex se pre-compilan una sola vez al cargar el módulo.
 */
export function corregirTildes(texto: string): string {
  if (!texto) return texto;

  let resultado = texto;

  for (const { regex, replacement: conTilde } of COMPILED_ENTRIES) {
    // Reset lastIndex for global regex reuse
    regex.lastIndex = 0;
    resultado = resultado.replace(regex, (match) => {
      // Mantener el case original
      if (match === match.toUpperCase()) {
        return conTilde.toUpperCase();
      }
      if (match[0] === match[0].toUpperCase()) {
        return conTilde.charAt(0).toUpperCase() + conTilde.slice(1);
      }
      return conTilde.toLowerCase();
    });
  }

  return resultado;
}
