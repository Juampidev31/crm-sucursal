# Resumen Mensual Público idéntico al interno — Design

**Fecha:** 2026-05-30
**Objetivo:** Que el link público (`/publico/resumen-mensual`) se vea EXACTAMENTE igual al resumen interno (Ajustes → Resumen Mensual): mismos colores, diseño, layout y gráficos.

## Problema

Hoy existen **dos (en realidad tres) renders distintos** del mismo reporte, escritos a mano por separado, que han divergido:

- **Interno (fuente de verdad):** `src/app/ajustes/ResumenMensualTab.tsx` (~2493 líneas). Calcula KPIs/charts desde los registros completos y renderiza secciones 1–10.
- **Público:** `src/app/publico/resumen-mensual/ResumenMensualInteractivo.tsx` (~851 líneas). **Re-dibuja todo por su cuenta** a partir de un snapshot. Es el que renderiza `page.tsx`.
- **Muerto:** `src/app/publico/resumen-mensual/ResumenHTML.tsx` (~427 líneas). Ya NO se usa (page.tsx solo importa el Interactivo).

Como son implementaciones independientes, cualquier cambio en el interno no se refleja en el público → divergencia visual.

## Restricción de privacidad (clave)

El link público NO recibe los registros completos. Al generar el link, el interno guarda un snapshot (columna `resumen_mensual.experiencia_cliente`, JSON con `{text, html, datos}`) donde `datos.registros` son **`safeRecords`**: solo `fecha, monto, analista, estado, acuerdo_precios`. Se omiten a propósito `cuil, empleador, sexo, localidad`, etc.

Por eso el snapshot **pre-calcula** y guarda todos los `chart*` y `dist*`. Cualquier gráfico que dependa de un campo omitido (ej. **Empleo Público/Privado** usa `empleador`) debe venir **pre-calculado en el snapshot** (decisión del usuario: pre-calcular, NO exponer datos sensibles).

## Decisiones tomadas (usuario)

1. **Enfoque:** Reutilizar el componente interno extrayendo un render compartido (no copiar/pegar). Elimina la duplicación de raíz para que nunca vuelvan a divergir.
2. **Interactividad:** La vista pública es **solo lectura** — sin toolbar de "Generar Link"/"Guardar"/banner. (Las secciones colapsables pueden mantenerse, pero abiertas por defecto en público.)
3. **Datos faltantes (Empleo, etc.):** **Pre-calcular** los gráficos que requieran campos sensibles y guardarlos agregados en el snapshot.

## Arquitectura propuesta

Crear `src/app/publico/resumen-mensual/ResumenMensualView.tsx` (o en `ajustes/`), un componente **presentacional puro**:

```
ResumenMensualView({ datos, readOnly })
  - datos: TODO ya calculado (kpiTotal, kpiPorAnalista, chart*, dist*, textos del resumen,
           collapsedSections, auditCounts, safeRecords, mes/año/labels, seccion10State)
  - readOnly: oculta cualquier control de edición
  - Renderiza secciones 1–10 (líneas ~2085–2493 del interno) idénticas.
```

Flujo:
- **Interno** (`ResumenMensualTab`): mantiene su toolbar + cálculo desde registros completos, y delega el cuerpo a `<ResumenMensualView datos={...} />`.
- **Público** (`page.tsx`): pasa el snapshot directo → `<ResumenMensualView datos={result.datos} readOnly />`.
- **Borrar** `ResumenMensualInteractivo.tsx` y `ResumenHTML.tsx`.

El snapshot (`datosParaCompartir` en `handleGenerarLink`/`handleGuardar`) debe guardar **exactamente** la forma que `ResumenMensualView` consume, incluyendo el gráfico de Empleo ya agregado.

### Helpers compartidos
Funciones que hoy viven dentro del interno y usa el render (`sectionHeader`, `baseChartOpts`, `labelsPlugin`, `ModernDoughnut`, `formatCurrency`, plugins de chart) se mueven al módulo del view (o a `@/lib/chartPlugins` donde corresponda) para que ambos las compartan.

## Alcance / pasos

1. Leer el render completo del interno (secciones 1–10) y catalogar TODA prop/helper que usa.
2. Crear `ResumenMensualView` con esa interfaz de props + `readOnly`.
3. Reconectar el interno para que use el view (sin cambio visual).
4. Alinear `datosParaCompartir` (snapshot) con la interfaz del view; pre-calcular Empleo y cualquier chart que falte.
5. Cambiar `page.tsx` a `<ResumenMensualView datos readOnly />`.
6. Borrar `ResumenMensualInteractivo.tsx` y `ResumenHTML.tsx`; limpiar imports.
7. `tsc --noEmit` y verificación visual (interno y público lado a lado).

## Riesgos

- **Superficie de props enorme** (~40 objetos). Mitigación: tipar `DatosResumen` y pasar un solo objeto `datos`.
- **Snapshots viejos** en la DB no tendrán los charts nuevos pre-calculados → el view debe degradar con fallback (sección vacía/"sin dato") sin romper. Los links nuevos saldrán completos.
- Refactor grande sobre archivo de 2493 líneas → hacerlo incremental, verificando `tsc` tras cada paso.

## Fuera de alcance

- Rediseño visual. El objetivo es paridad exacta con el interno actual.
- Reescribir el cálculo de KPIs.
