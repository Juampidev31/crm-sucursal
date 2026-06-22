# Vista consolidada de proyectados (PDV · Luciana · Victoria)

Fecha: 2026-06-22
Estado: aprobado

## Problema

En el reporte Analistas (`src/app/analistas/page.tsx`) la proyección de fin de
mes se ve de a un analista por vez mediante el selector (PDV / Luciana /
Victoria). El admin necesita ver los 3 proyectados juntos en una sola pantalla
para no revisarlos uno por uno.

## Alcance

- Solo visualización en pantalla. No hay export, link público ni cambios de datos.
- Visible **solo para admin** (`isAdmin` de `useAuth`).
- Nivel de detalle: "Proyección + ritmo" (lo que ya muestra el bloque de
  proyección actual).

## Hallazgo clave

Los datos ya están calculados. Con el selector en `PDV`:
- `kpiTotal` → proyección consolidada PDV.
- `kpiPorAnalista` → array con la proyección individual de Luciana y Victoria.

Cada objeto kpi ya trae: `metaDiariaCapital`, `ventaPorDia`, `metaDiariaOps`,
`opsPorDia`, `proyCapital`, `cumplProyCapital`, `proyOps`, `cumplProyOps`,
`faltaCapital`, `faltaOps`, `esMesActual`, `tieneDiasAdmin`. No se recalcula nada.

## Diseño

### Nuevo modo `'PROYECTADOS'`

1. Agregar al `CustomSelect` de analista (línea ~1158) una opción condicional a
   admin: `📊 Proyectados` con value `'PROYECTADOS'`.
2. En los `useMemo` de datos, tratar `'PROYECTADOS'` igual que `'PDV'`
   (`registros = allRegistros`, `analistasParaMostrar = ANALISTAS_DEFAULT`,
   `cfgDias` consolidado 'Todos'). Así `kpiTotal` y `kpiPorAnalista` quedan
   poblados con los 3 sin tocar la lógica de cálculo.
3. Cuando el modo está activo, en lugar del dashboard completo se renderiza un
   único bloque: grid `repeat(auto-fit, minmax(360px, 1fr))` con una
   `ProyeccionCard` por analista, en orden **PDV · Luciana · Victoria**.

### Componente `ProyeccionCard`

- Presentacional puro. Props: `{ kpi, titulo }`.
- Pinta el bloque de proyección/ritmo que hoy está inline y hardcodeado a
  `kpiTotal` (líneas ~1340-1424): Venta/día (necesario) + ritmo, Ops/día
  (necesario) + ritmo, Proy. fin mes K (% cumpl), Proy. fin mes Q (% cumpl),
  Falta 100% K, Falta 100% Q.
- Conserva el mismo estilo/colores actuales (verde si proy ≥ meta, rojo si no;
  mensaje "Cargá días hábiles" cuando `esMesActual && !tieneDiasAdmin`).
- Se consume tanto en la vista PDV existente (refactor del inline) como en la
  nueva vista consolidada.

### Guardas de seguridad

- La opción del selector solo se agrega si `isAdmin`.
- El render del bloque consolidado va envuelto en `isAdmin` (por si manipulan el
  query param `?analista=PROYECTADOS`).

## Fuera de alcance

- Replicar en Reportes / Resumen mensual / link público (es una vista nueva, no
  un cambio a gráficas existentes).
- Export a PDF/Excel.

## Componentes afectados

- `src/app/analistas/page.tsx` — nuevo modo, opción de selector, render
  consolidado, refactor del bloque inline a `ProyeccionCard`.
- Nuevo: `ProyeccionCard` (archivo propio o local al page; a decidir en el plan).
