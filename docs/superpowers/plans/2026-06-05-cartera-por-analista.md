# Plan — Tab "Cartera por Analista" (Ajustes › Reportes)

Fecha: 2026-06-05
Estado: Propuesta / pendiente de aprobación

## Contexto

- Nueva sub-tab dentro de **Ajustes › Reportes** (junto a "Histórico y Objetivos",
  "Resumen Mensual", "Calif. x SCORE").
- Fuente de datos: tabla `registros` (modelo `Registro`) vía `useRegistros()`, más
  `useObjetivos()`. **No hay datos de saldo/cobranza por cliente**, así que "cartera"
  = el libro de clientes/operaciones que maneja cada analista (PDV / Luciana / Victoria),
  no una cartera de préstamos vigentes con amortización.
- Campos disponibles en `Registro`: `cuil, nombre, puntaje (score), analista, fecha,
  monto, estado, tipo_cliente, acuerdo_precios (riesgo), cuotas, rango_etario, sexo,
  empleador, dependencia, localidad, es_re (renovación/recompra)`.

## Qué puede incluir (propuesta de contenido)

Filtros arriba: **analista** (PDV = todos, Luciana, Victoria), **período**
(año + mes opcional, o "todo el histórico").

### Núcleo (recomendado para v1)
1. **Tabla comparativa de cartera** — una fila por analista + fila Total PDV:
   - Clientes ingresados (total de registros)
   - Ventas cerradas (Q) y capital (K)  ·  Ticket promedio
   - Pipeline abierto: "En seguimiento" (Q y monto)  ·  "Aprobado CC" pendiente (Q y monto)
   - Tasa de cierre (ventas / casos decididos) y conversión global (ventas / ingresados)
   - Score promedio (`puntaje`)
   - % Renovaciones (`es_re`)
2. **Embudo / pipeline por analista**: Ingresados → En seguimiento → Aprobado CC → Venta,
   con % de conversión entre etapas.
3. **Composición / mix de cartera** (donut o barras, por analista):
   - Por estado  ·  Por riesgo (`acuerdo_precios`: premium / medio / bajo / no califica)
   - Nuevos vs renovaciones (`es_re`)  ·  Por cuotas / rango etario
4. **Pipeline abierto con aging**: oportunidades "En seguimiento" agrupadas por antigüedad
   desde `fecha` (0-7, 8-15, 16-30, 30+ días), con monto y cantidad. Lo más "cartera viva".

### Nice-to-have (v2)
5. **Calidad de cartera**: score promedio, % score bajo, % afectaciones, % rechazos CC,
   con semáforo de color.
6. **Concentración**: top empleadores / dependencias por analista (riesgo de concentración).
7. **Exportar a XLSX** reutilizando el patrón de `api/admin/export-xlsx`.

## Decisiones (confirmadas 2026-06-05)
- [x] **Visibilidad: solo admin** (gate con `...(isAdmin ? [...] : [])`).
- [x] **Vista: comparativa + detalle** — tabla con todos los analistas lado a lado;
      al seleccionar uno se despliega su detalle (mix, embudo, aging).
- [x] **Alcance v1: secciones 1-4** (tabla comparativa, embudo, mix, pipeline con aging).
      Secciones 5-7 (calidad, concentración, export XLSX) quedan para v2.

## Plan de implementación

Sigue el patrón existente de las otras tabs de Reportes (sin cambios de DB).

1. **Tipo**: agregar `'cartera-analista'` a `type ReportesSubTab` en
   [ajustes/page.tsx:42](../../../src/app/ajustes/page.tsx#L42).
2. **Componente**: crear `src/app/ajustes/CarteraAnalistaTab.tsx` (client component).
   - Consume `useRegistros()` + `useObjetivos()`.
   - Toda la agregación es client-side con `useMemo` (no nuevas queries).
   - Reutiliza helpers/estilo de `analistas/page.tsx`: `isVenta`/`isCerrado`,
     patrón `distPor`, `formatCurrency`, componentes `Doughnut`/`Bar` de chart.js,
     y `ModernDoughnut`/`DistBlock` si conviene extraerlos.
3. **Lazy load**: registrar con `dynamic(() => import('./CarteraAnalistaTab'), { ssr:false, loading: TabFallback })`
   junto a las otras en [ajustes/page.tsx:28-33](../../../src/app/ajustes/page.tsx#L28).
4. **Botón de sub-tab**: agregar entrada al array en
   [ajustes/page.tsx:837-839](../../../src/app/ajustes/page.tsx#L837)
   (con `...(isAdmin ? [...] : [])` si es admin-only). Icono sugerido: `Briefcase` o `Wallet` (lucide).
5. **Render**: bloque condicional
   `{activeTab === 'reportes' && reportesSubTab === 'cartera-analista' && <CarteraAnalistaTab />}`.
6. **Lazy-mount opcional**: agregar flag en el `useMemo` de mounts (línea ~99) si se quiere
   diferir el montaje como las otras tabs pesadas.

## Verificación
- `npx tsc --noEmit` sin errores.
- Navegar a Ajustes › Reportes › Cartera por Analista y validar cifras contra
  un mes conocido (cruzar con la página `/analistas`).
- Probar PDV vs un analista individual y período histórico vs mes puntual.
