# Reasignar registros entre analistas (reparto con cuotas)

Fecha: 2026-06-25
Módulo: Ajustes → Reportes → **Calif. x SCORE** (`src/app/ajustes/BulkModifyTab.tsx`), solo admin.

## Problema

El admin necesita mover registros de un analista (origen) a uno o varios analistas
(destino), eligiendo cuántos van a cada uno. Ejemplo: de los 200 registros de Luciana,
pasar 100 a Victoria, 50 a Yamil y 50 a Juan Pablo. El estado (Proyección, etc.) es solo
un filtro opcional, no una restricción: por defecto entran todos los registros del origen.

## Alcance

- Nueva tarjeta independiente, colapsable (`<details>`), dentro del tab Calif. x SCORE.
  No modifica el bloque existente "Reasignar Empleador / Dependencia".
- Solo visible para admin (el tab ya está detrás de `isAdmin`).
- Reparto por **selección manual con cuotas**: el admin define cuántos van a cada
  destino y tilda los registros; un contador muestra el avance por destino.
- v1 **sin undo dedicado** (el reasignador actual tampoco lo tiene; se revierte
  reasignando de vuelta).

## Flujo (una sola tarjeta, pasos secuenciales)

1. **Analista origen**: selector/chips con la lista dinámica `ANALISTAS`
   (`useAnalistas()`). Al elegir, se calcula el universo.
2. **Acotar (opcional)**:
   - **Estados múltiples**: chips multi-selección (usa `ESTADOS` / `allEstados`).
     Si no hay ninguno seleccionado, entran todos los estados.
   - Score (min/max) y fechas (desde/hasta), opcionales.
   - Se muestra el total disponible (ej. "347 registros disponibles").
3. **Cuotas por destino**: agregar uno o más analistas destino, cada uno con una
   cantidad numérica. Validaciones:
   - un destino no puede ser el origen;
   - no se puede repetir un destino;
   - suma de cuotas ≤ total disponible.
4. **Tildar + progreso**:
   - Lista de registros del universo con checkbox.
   - Se elige un **destino activo** (chip); al tildar una fila, ese registro queda
     asignado al destino activo.
   - Contador por destino (ej. "Victoria 80/100"); chip en verde al completar la cuota.
   - Ayuda **"tildar primeros N"**: llena la cuota restante del destino activo con las
     primeras filas no asignadas.
   - No se puede asignar a un destino más que su cuota.

## Estado interno (React)

```ts
const [raOrigen, setRaOrigen] = useState<string>('');
const [raEstados, setRaEstados] = useState<string[]>([]);   // vacío = todos
const [raScoreMin, setRaScoreMin] = useState('');
const [raScoreMax, setRaScoreMax] = useState('');
const [raFechaDesde, setRaFechaDesde] = useState('');
const [raFechaHasta, setRaFechaHasta] = useState('');
const [raDestinos, setRaDestinos] = useState<{ analista: string; cuota: number }[]>([]);
const [raAsignaciones, setRaAsignaciones] = useState<Map<string, string>>(new Map()); // registroId -> analistaDestino
const [raDestinoActivo, setRaDestinoActivo] = useState<string>('');
const [raExpandido, setRaExpandido] = useState(false);
```

Derivados (`useMemo`):

- `raUniverso = registros.filter(r => r.analista === raOrigen && estadoOk(r) && scoreOk(r) && fechaOk(r))`
  donde `estadoOk` = `raEstados.length === 0 || raEstados.includes(r.estado)`.
- `raAsignadosPorDestino: Record<string, number>` contando `raAsignaciones`.
- `raTotalCuotas = sum(raDestinos.cuota)`.

Al cambiar origen o filtros, limpiar `raAsignaciones` (las filas pueden ya no existir
en el nuevo universo).

## Guardado

Patrón idéntico a `reasignarMasivo` (líneas ~2224–2274):

1. Agrupar `raAsignaciones` por destino → `{ [analista]: string[] ids }`.
2. Por cada grupo, actualizar en chunks de 500:
   `await supabase.from('registros').update({ analista }).in('id', slice)`.
3. Contar `actualizados` y `errores` por chunk.
4. Update optimista local: `mutateRegistros` por grupo + `pushBulkUpdateIds(ids, { analista })`.
5. Toast de resultado (`success`/`error`).
6. Reset del estado del reasignador.

Botón "Reasignar" deshabilitado mientras: `updating`, falta origen, no hay destinos con
cuota > 0, o hay registros tildados de menos respecto a las cuotas (se permite confirmar
parcial: solo se guarda lo efectivamente asignado en `raAsignaciones`).

## Sincronización (memoria del proyecto)

Esta tarjeta vive solo en el tab Calif. x SCORE; no es una gráfica de Ajustes>Analistas,
así que **no aplica** la regla de replicar en Reportes/Resumen/link público. Igual al
guardado actual: el cambio de `analista` se refleja vía `mutateRegistros` + push.

## Fuera de alcance (v1)

- Undo dedicado.
- Reparto automático (orden / round-robin).
- Reasignación cross-origen (varios orígenes a la vez).
