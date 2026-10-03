type IdentidadCliente = { cuil?: string | null; nombre?: string | null };

const norm = (v?: string | null) => (v ?? '').trim().toLowerCase();

// El chequeo de duplicados existe para no dar de alta dos veces al mismo
// cliente. En una EDICIÓN no hay nada que duplicar: el registro ya existe, y
// buscar por CUIL/nombre encuentra los demás registros del mismo cliente —algo
// perfectamente normal— y bloqueaba guardar un simple cambio de estado.
//
// Sólo vuelve a tener sentido si la edición cambia la identidad del cliente
// (CUIL o nombre), porque ahí sí el registro puede pasar a pisar a otra persona.
export function requiereChequeoDuplicado(
  editingId: string | null,
  form: IdentidadCliente,
  original: IdentidadCliente,
): boolean {
  if (!editingId) return true;
  return norm(form.cuil) !== norm(original.cuil) || norm(form.nombre) !== norm(original.nombre);
}
