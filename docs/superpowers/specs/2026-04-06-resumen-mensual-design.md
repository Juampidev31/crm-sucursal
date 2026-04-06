# Resumen Mensual — Diseño

**Fecha:** 2026-04-06  
**Contexto:** Tab nueva en la página Ajustes, al lado de Auditoría, que genera un informe mensual de gestión comercial combinando datos automáticos del sistema con campos de ingreso manual.

---

## 1. Objetivo

Proveer un tablero de mando mensual que compile toda la información disponible del sistema (ventas, cumplimiento, actividad) y permita completar manualmente la información que no está en la base de datos (análisis, gestión del equipo, experiencia del cliente, plan de acción).

---

## 2. Arquitectura

### Nueva tab en Ajustes
- Se agrega `'resumen-mensual'` al tipo `ActiveTab` en `src/app/ajustes/page.tsx`
- La lógica del tab vive en un componente separado: `src/app/ajustes/ResumenMensualTab.tsx`
- Se importa y renderiza condicionalmente igual que los demás tabs

### Nueva tabla en Supabase: `resumen_mensual`
```sql
CREATE TABLE resumen_mensual (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  anio            integer NOT NULL,
  mes             integer NOT NULL CHECK (mes BETWEEN 1 AND 12),
  logros          text,
  desvios         text,
  acciones_clave  text,
  gestiones_realizadas     text,
  coordinacion_salidas     text,
  empresas_estrategicas    text,
  analisis_comercial       text,
  dotacion                 text,
  ausentismo               text,
  capacitacion             text,
  evaluacion_desempeno     text,
  operacion_procesos       text,
  experiencia_cliente      text,
  plan_acciones            jsonb DEFAULT '[]'::jsonb,
  updated_at               timestamptz DEFAULT now(),
  UNIQUE (anio, mes)
);
```

### Estructura `plan_acciones` (JSONB array):
```json
[
  {
    "problema": "Bajo alcance en zona norte",
    "accion": "Aumentar visitas semanales",
    "responsable": "Luciana",
    "fecha": "2026-04-15"
  }
]
```

---

## 3. Datos automáticos

Calculados a partir de `ctxRegistros` (DataContext) y `ctxObjetivos` ya disponibles en la página. No requieren fetch adicional.

| Indicador | Fuente | Detalle |
|-----------|--------|---------|
| Ventas capital | `registros` (estado='venta') | Total + por analista |
| Cumplimiento capital % | vs `objetivos.meta_ventas` | Por analista + total |
| Operaciones cerradas | count de ventas del mes | Por analista + total |
| Cumplimiento operaciones % | vs `objetivos.meta_operaciones` | Por analista + total |
| Ticket promedio | capital / operaciones | Por analista + total |
| Conversión | ventas / clientes ingresados del mes | Por analista + total |
| Clientes ingresados | todos los `registros` del mes | Por estado + analista |
| Distribución acuerdo_precios | Bajo Riesgo / Riesgo Medio / Premium | Monto + cantidad |
| Tendencia vs mes anterior | capital y operaciones | % variación |
| Ranking analistas | capital vendido | Mejor/peor del mes |
| Actividad en sistema | tabla `auditoria` del mes | Acciones por analista |

---

## 4. Datos manuales (formulario)

Todos los campos son `text` libre excepto Plan de Acción que es tabla estructurada.

### Sección 1 — Tablero de Mando (complemento narrativo)
- **Principales logros** (textarea)
- **Principales desvíos / problemas** (textarea)
- **Acciones clave a seguir** (textarea)

### Sección 3 — Análisis Comercial
- **Interpretación del período** (textarea): por qué se vendió más/menos, impacto de campañas, comportamiento del cliente

### Sección 4 — Gestión del Equipo
- **Dotación actual** (textarea)
- **Ausentismo / tardanzas** (textarea)
- **Capacitación realizada** (textarea)
- **Evaluación de desempeño** (textarea)

### Sección 5 — Operación y Procesos
- **Cumplimiento de procedimientos / tiempos / stock** (textarea unificado)

### Sección 6 — Experiencia del Cliente
- **Reclamos y satisfacción** (textarea): cantidad, tipo, problemas recurrentes

### Sección 2 extra — Indicadores sin datos en sistema
- **Gestiones realizadas** (textarea): visitas, llamados, coordinación
- **Coordinación de salidas** (textarea)
- **Empresas estratégicas** (textarea)

### Sección 7 — Plan de Acción (tabla estructurada)
Filas dinámicas con 4 campos: Problema | Acción | Responsable | Fecha  
- Botón "Agregar fila"  
- Botón "Eliminar" por fila  
- Se guarda como JSONB en `plan_acciones`

---

## 5. UI del componente

```
ResumenMensualTab
  ├── Selector mes + año (defaults a mes actual)
  ├── Sección 1: Tablero de Mando
  │     ├── KPIs automáticos (cumplimiento capital, operaciones, conversión)
  │     └── Textareas: Logros / Desvíos / Acciones clave
  ├── Sección 2: Indicadores Clave (solo automáticos)
  │     ├── Tabla: Capital vendido (analista + total, vs objetivo, %, tendencia)
  │     ├── Tabla: Operaciones (analista + total, vs objetivo, %)
  │     ├── Ticket promedio + Conversión
  │     ├── Distribución por acuerdo_precios
  │     └── Textareas: Gestiones / Coordinación / Empresas estratégicas
  ├── Sección 3: Análisis Comercial
  │     ├── Ranking analistas (automático)
  │     └── Textarea: Análisis libre
  ├── Sección 4: Gestión del Equipo
  │     ├── Actividad en sistema por analista (automático, de auditoria)
  │     └── Textareas: Dotación / Ausentismo / Capacitación / Evaluación
  ├── Sección 5: Operación y Procesos (textarea)
  ├── Sección 6: Experiencia del Cliente (textarea)
  └── Sección 7: Plan de Acción (tabla dinámica)
        └── Botón Guardar (upsert resumen_mensual por anio+mes)
```

---

## 6. Comportamiento

- Al activar la tab: fetch de `resumen_mensual` para el mes/año actual
- Al cambiar mes/año: nuevo fetch + recalculo de datos automáticos
- Guardar: `upsert` por constraint `UNIQUE(anio, mes)`
- Toast de éxito/error igual al resto de la página
- Si no hay registro guardado para ese mes: campos vacíos, listos para completar
- La actividad de auditoría del mes se fetcha solo cuando se activa la tab (lazy, igual que auditoria)

---

## 7. Archivos a crear/modificar

| Acción | Archivo |
|--------|---------|
| Crear | `src/app/ajustes/ResumenMensualTab.tsx` |
| Modificar | `src/app/ajustes/page.tsx` — agregar tab, import, render |
| DB migration | Crear tabla `resumen_mensual` en Supabase |

---

## 8. Fuera de alcance

- Exportación a PDF del informe
- Encuestas de satisfacción (sistema separado)
- Integración con VISMA (ausentismo externo)
- Notificaciones o recordatorios de completar el informe
