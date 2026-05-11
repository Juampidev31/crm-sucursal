# Corrector — Asignar Empleador desde Excel

## Goal
Dentro del tab Corrector (BulkModifyTab mode="corrector"), agregar una nueva sección que permite pegar un reporte Excel con CUIL + Apellido/Nombre, encontrar todos los registros de DB que matchean esos CUILs, y asignarles un Empleador en masa.

## Architecture
Nueva sección colapsable al final del Corrector. Reutiliza `parsePastedText` y `normalizeCuil` de `verificador-utils.ts`. La lógica vive en un componente separado `AsignarEmpleadorSection` dentro de `BulkModifyTab.tsx` para no agrandar más el archivo principal.

## Flujo

### Paso 1 — Pegar Excel
- Textarea para pegar celdas copiadas de Excel
- Se parsea con `parsePastedText`
- El usuario asigna columnas: CUIL (requerido) y Apellido/Nombre (opcional)
- Preview de las primeras 5 filas con selectores de columna
- Botón "Buscar en registros" (habilitado solo si hay columna CUIL asignada)

### Paso 2 — Resultados
- Busca en `registros` (del provider) todos los registros cuyo CUIL normalizado esté en el set de CUILs pegados
- Muestra tabla: CUIL | Apellido y Nombre (del Excel) | Registros encontrados (count) | Empleador actual
- Si un CUIL no tiene registros en DB → fila en gris "Sin registros"
- Conteo total: "N registros en total de M clientes"

### Paso 3 — Asignar empleador
- Input de texto con datalist autocomplete desde `allEmpleadores` (ya disponible en BulkModifyTab)
- Botón "Asignar a todos (N registros)" → pasa a estado confirming
- Confirmación: "⚠ Confirmar — se actualizarán N registros" + Cancelar
- Al confirmar: `supabase.from('registros').update({ empleador: valor }).in('id', ids)`
- Llama `mutateRegistros` del provider para actualizar estado local
- Mensaje de éxito verde

## Datos
- Input: CUILs del Excel (normalizados)
- Lookup: `registros` del provider (sin query adicional a Supabase)
- Output: `update` de Supabase + `mutateRegistros` local

## Componente
`AsignarEmpleadorSection` — componente funcional dentro de `BulkModifyTab.tsx`, recibe props:
- `registros: Registro[]`
- `allEmpleadores: string[]`
- `mutateRegistros: (fn) => void`

## UI Pattern
Sigue el estilo visual del Corrector existente: mismos colores, tipografía, bordes. Sección con header colapsable igual a las otras secciones del Corrector.
