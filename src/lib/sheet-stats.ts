// Conteos por columna de las planillas de Google (pestaña "Ingreso Diario Ventas").
//
// Las planillas se cargan a mano, así que la misma categoría aparece escrita de
// varias formas ("Consulta virtual" / "Consulta VirtuaL", "Centric" / "CENTRIC")
// y se contaba como dos categorías distintas. Acá se agrupan por una clave
// normalizada y se muestra la variante más usada.

const SIN_ESPECIFICAR = 'No especificado';

const clave = (valor: string) =>
  valor
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export function contarColumna(rows: string[][], colIdx: number): Array<{ label: string; cantidad: number }> {
  // Por clave normalizada: total del grupo y cuántas veces se escribió cada variante.
  const grupos = new Map<string, { total: number; variantes: Map<string, number> }>();

  for (let i = 1; i < rows.length; i++) {
    const valor = rows[i]?.[colIdx]?.trim() || SIN_ESPECIFICAR;
    const k = clave(valor);
    let grupo = grupos.get(k);
    if (!grupo) {
      grupo = { total: 0, variantes: new Map() };
      grupos.set(k, grupo);
    }
    grupo.total++;
    grupo.variantes.set(valor, (grupo.variantes.get(valor) ?? 0) + 1);
  }

  return Array.from(grupos.values())
    .map(({ total, variantes }) => {
      // La etiqueta es la variante más frecuente; en empate, la primera que
      // apareció (los Map conservan el orden de inserción).
      let label = '';
      let mejor = -1;
      for (const [variante, veces] of variantes) {
        if (veces > mejor) { mejor = veces; label = variante; }
      }
      return { label, cantidad: total };
    })
    .sort((a, b) => b.cantidad - a.cantidad);
}
