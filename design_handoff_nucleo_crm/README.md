# Handoff de diseño — Núcleo CRM Ventas

> **Para aplicar a tu proyecto Next.js + TypeScript + Supabase (crm-sucursal)**

---

## ¿Qué es esto?

Este paquete contiene un **prototipo de UI en HTML + React + JSX** que representa el rediseño visual del CRM. **No es código de producción listo para copiar y pegar** — es una **referencia de diseño** que debés re-implementar dentro de tu proyecto Next.js usando los patrones que ya tenés (componentes React, Tailwind/CSS modules, providers, Supabase, etc.).

El prototipo está montado con `<script type="text/babel">` para iterar visualmente rápido. En producción vas a usar tu stack normal (TSX, ESLint, etc.).

---

## Fidelidad

**Hi-fi.** Los valores de color, tipografía, espaciado y estados son los finales. Tu trabajo es traducir los componentes JSX del prototipo a componentes TSX en tu app respetando esos valores exactos.

---

## Cómo aplicarlo a tu proyecto — Resumen ejecutivo

1. **Importar la fuente** Geist (Google Fonts) y `Geist Mono` en tu `layout.tsx`.
2. **Reemplazar `globals.css`** con los tokens nuevos (ver sección "Design Tokens" abajo).
3. **Refactorizar el sidebar** — cambiar de la barra de íconos 80px que tenés a la barra de 232px con texto + íconos + secciones (Comercial / Administración).
4. **Rediseñar `/registros`** — tabla con paginación, edición inline de estado, modales nuevo/editar/detalle.
5. **Reemplazar `/analistas`** por el nuevo Dashboard con vista General + individual.
6. **Migrar `/ajustes`** y sus tabs a los módulos separados de la nueva estructura: Alertas, Corrector masivo, Reportes, Scoring, Auditoría, Roles, Días hábiles, Configuración.
7. **Mantener tu lógica de negocio** — providers (`RegistrosProvider`, `ObjetivosProvider`, etc.), Supabase, cálculo de comisiones, etc. Solo cambia la UI.

---

## Mapeo: prototipo ↔ tu codebase

| Prototipo (este paquete)                | Tu codebase                                            |
| --------------------------------------- | ------------------------------------------------------ |
| `sidebar.jsx` (sidebar texto 232px)     | `src/components/Sidebar.tsx` (sidebar íconos 80px)     |
| `dashboard.jsx` (General + Individual)  | `src/app/analistas/page.tsx`                           |
| `registros.jsx` (tabla + modales)       | `src/app/registros/page.tsx`                           |
| `corrector.jsx`                         | `src/app/ajustes/BulkModifyTab.tsx` + `duplicados`     |
| `alertas.jsx` (Centro de alertas)       | Nuevo. Reusa `alertas_config` table de Supabase.       |
| `reportes.jsx`                          | `src/app/reportes/*` + `src/app/ajustes/ResumenMensualTab.tsx` |
| `admin.jsx` → Scoring                   | Sub-tab en `ajustes` (Calif. x SCORE)                  |
| `admin.jsx` → Auditoría                 | `src/app/ajustes/AuditoriaTab`                         |
| `admin.jsx` → Roles                     | Nuevo. Implementar tabla `roles` + `role_permissions`. |
| `admin.jsx` → Calendario (días hábiles) | `src/app/ajustes/page.tsx` → tab Días Hábiles          |
| `admin.jsx` → Config (general/API/etc.) | Nuevo. Sub-tabs en `/ajustes`.                         |
| `styles.css`                            | Reemplaza `src/app/globals.css` (mergeando lo que uses)|
| `tweaks-panel.jsx`                      | **No portar** — es para iteración de diseño, no prod.  |

---

## Pasos detallados

### 1. Tipografía

```tsx
// src/app/layout.tsx
import { Geist, Geist_Mono } from 'next/font/google';

const geist = Geist({ subsets: ['latin'], variable: '--font-sans' });
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-mono' });

// Aplicar en <body className={`${geist.variable} ${geistMono.variable}`}>
```

### 2. Reemplazo de tokens en `globals.css`

Copiá el bloque `:root { ... }` de `styles.css` de este paquete a tu `src/app/globals.css`. **Renombrá tus tokens viejos**:

| Tu codebase actual | Nuevo nombre (prototipo) |
| ------------------ | ------------------------ |
| `--background` (#000) | `--bg` (#0a0a0b)       |
| `--card-bg` (#000)    | `--bg-elev-1` (#131316) |
| `--border-color`      | `--border` (#1f1f26)   |
| `--gris` (#666)       | `--fg-muted` (#9a9aa3) |
| `--rojo` (#ef4444)    | `--red` (oklch)        |
| `--verde-pale` (#86efac) | (descontinuar — usar `--green`) |

Las clases utilitarias (`.btn`, `.panel`, `.kpi`, `.dt`, `.modal-*`, `.tabs`, `.toolbar`, `.timeline`, `.badge`, `.score-bar`) están todas en `styles.css`. Podés mantenerlas como clases globales o migrarlas a CSS Modules / Tailwind plugin.

### 3. Sidebar — Componente nuevo

El sidebar pasa de **80px solo-íconos con tooltips** a **232px con texto, secciones agrupadas y badge de notificaciones**. Conservá tu `useAuth` para mostrar/ocultar items según rol.

Mira `sidebar.jsx` en este paquete:
- Brand: logo cuadrado rojo + nombre "FederAR - PDV 713" + subtítulo "CRM · VENTAS"
- Buscador con atajo `⌘K`
- Secciones con label monoespaciado:
  - **Comercial**: Dashboard, Registros (badge "124")
  - **Administración**: Alertas (badge "5"), Corrector masivo, Reportes, Scoring, Auditoría, Roles, Días hábiles, Configuración
- Footer con avatar + nombre + rol del usuario

El item activo usa una barrita roja vertical (3px) en el borde izquierdo.

### 4. Dashboard — Vista General + Individual

Reemplaza `src/app/analistas/page.tsx`. La pieza clave es el **selector de vista en pills**: General + cada analista (Luciana, Victoria). Cuando seleccionás un analista, se renderiza un dashboard individual derivado de `REGISTROS.filter(r => r.analista === viewName)`.

**Vista General**:
- 6 KPI cards con sparkline en esquina inferior-derecha
- Gráfico de líneas (Ventas / Proyección / Objetivo)
- Donut de distribución por estado
- Ranking de analistas (tabla)
- Timeline de actividad reciente (de `auditoria`)
- Lista de alertas activas

**Vista Individual** (por analista):
- Hero card: avatar grande + ranking #, barra de cumplimiento vs objetivo, score donut
- 6 KPIs personales: Ventas YTD / Cumplimiento / Operaciones / Win rate / Score / Ranking
- Evolución mensual personal vs objetivo proporcional
- Pipeline (Aprobado/En revisión/Pendiente/Rechazado)
- Tabla de registros recientes filtrada
- Timeline de actividad personal

### 5. Registros — Tabla + modales

`registros.jsx` muestra:
- **Tabs**: Todos / Asignados a mí / En revisión / Aprobados / Favoritos
- **Toolbar** con buscador y filtros (estado / analista / score)
- **Tabla** de 13 columnas con paginación de 14 filas
- **Modal Nuevo/Editar**: validación CUIL (XX-XXXXXXXX-X), máscara automática, datalist de empleadores, slider de score con tier coloreado dinámicamente, historial al final si es edición
- **Modal Detalle (Ver)**: header strip con CUIL/Monto/Score donut, grilla de detalles, timeline lateral, botones Exportar/Comentar/Editar

Conservá tu validación (`validarForm` de tu código) y tu modal `RegistroModal`. Solo cambiá el layout visual.

### 6. Modales

Todos usan el patrón `Modal` de `components.jsx`:
- Backdrop oscuro con blur (`backdrop-filter: blur(4px)`)
- Contenido en `var(--bg-elev-1)` con borde y radius 10px
- Header con título + subtítulo + cierre (X)
- Footer con acciones (botón ghost Cancelar + botón primary Guardar)
- Cierre con Escape

### 7. Botones — Sistema

| Variante | Uso | Clase |
|---|---|---|
| Primary | Acción principal (Crear, Guardar) | `.btn.primary` |
| Default | Acción secundaria (Exportar, Filtros) | `.btn` |
| Ghost | Sin fondo (cancelar, atrás) | `.btn.ghost` |
| Danger | Eliminar | `.btn.danger` |
| Icon-only | Iconos solos | `.btn.icon` |
| Small | Toolbars internos | `.btn.sm` |

### 8. Iconos

El prototipo usa **iconos SVG hechos a mano** (mirá `ICONS` en `components.jsx`). En tu proyecto **usá `lucide-react`** que ya tenés instalado. Mapeo:

| Prototipo | `lucide-react` |
| --------- | -------------- |
| dashboard | `LayoutDashboard` |
| table     | `Table` |
| layers    | `Layers` |
| bell      | `Bell` |
| bar       | `BarChart3` |
| history   | `History` |
| shield    | `Shield` |
| cal       | `Calendar` |
| settings  | `Settings` |
| building  | `Building2` |
| merge     | `Merge` |
| flag      | `Flag` |
| trash     | `Trash2` |
| edit      | `Edit2` |
| zap       | `Zap` |
| (resto)   | (mismo nombre, en PascalCase) |

---

## Design Tokens (referencia)

### Colores

```css
/* Surfaces (oscuro, escalonado) */
--bg:           #0a0a0b;
--bg-elev-0:    #0e0e10;
--bg-elev-1:    #131316;
--bg-elev-2:    #181820;
--bg-elev-3:    #1f1f28;

/* Borders */
--border:        #1f1f26;
--border-strong: #2a2a33;
--border-subtle: #16161c;

/* Texto */
--fg:        #ededed;
--fg-muted:  #9a9aa3;
--fg-dim:    #6c6c76;
--fg-faint:  #46464e;

/* Accents (oklch para perceptual uniformity) */
--red:    oklch(0.62 0.19 25);   /* equivalente a #dc2626 */
--amber:  oklch(0.78 0.16 75);
--green:  oklch(0.72 0.16 152);
--blue:   oklch(0.72 0.13 240);
--violet: oklch(0.70 0.14 290);

/* Score tiers */
--score-alto:    oklch(0.72 0.16 152);  /* 80-100 */
--score-medio:   oklch(0.80 0.16 75);   /* 60-79  */
--score-bajo:    oklch(0.65 0.20 30);   /* 35-59  */
--score-riesgo:  oklch(0.55 0.22 18);   /* <35    */
```

### Tipografía

| Token            | Valor               |
| ---------------- | ------------------- |
| Sans             | Geist               |
| Mono             | Geist Mono          |
| Tamaño base      | 13px                |
| Line-height base | 1.45                |
| H1 (page-head)   | 20px / 600 / -0.02em letterspacing |
| Panel title      | 12.5px / 600        |
| KPI label        | 10.5px / 500 / uppercase / 0.06em letterspacing |
| KPI value        | 22px / 600 / -0.02em |
| Field label      | 11px / 500 / uppercase / mono |
| Table header     | 10.5px / 500 / uppercase / mono / 0.05em letterspacing |
| Table cell       | 12px / regular      |
| Badge            | 10.5px / 500 / mono |

### Espaciado (4px base)

```
--s-1: 4px   --s-2: 8px   --s-3: 12px  --s-4: 16px
--s-5: 20px  --s-6: 24px  --s-8: 32px  --s-10: 40px  --s-12: 48px
```

### Radii

```
--r-1: 4px   --r-2: 6px   --r-3: 8px   --r-4: 10px   --r-5: 12px
```

### Layout

```
--sidebar-w:  232px
--topbar-h:   52px
```

---

## Animaciones

| Elemento  | Duración | Easing |
|-----------|----------|--------|
| Modal entrada | 160ms | `cubic-bezier(0.2, 0.8, 0.2, 1)` |
| Backdrop fade | 120ms | `ease` |
| Hover de botones | 100ms | `linear` (background / border-color) |
| Tweaks panel (no portar) | — | — |

Conservá tu Framer Motion para transiciones de página actuales.

---

## Estados de UI

- **Hover en filas de tabla** → background `var(--bg-elev-1)` + el CUIL se vuelve `var(--green)` y bold (mirá `.dt tbody tr:hover` en styles.css)
- **Fila seleccionada** → background `oklch(0.22 0.06 25 / 0.25)` (rojo translúcido)
- **Score bajo (< 35)** → color `var(--score-riesgo)` + badge "Riesgo"
- **Estado del registro** → badge coloreado según `STATE_META` en `components.jsx`
- **Acuerdo de precios** (en tu codebase): mantené tu mapeo Riesgo Bajo → verde / Riesgo Medio → rojo / Premium → azul

---

## Datos de ejemplo

`data.jsx` genera 124 registros mock con semilla determinística. **Eliminá esto al integrar** — vas a usar tus tablas reales de Supabase (`registros`, `objetivos`, `historico_ventas`, `recordatorios`, `alertas_config`, `auditoria`).

Los analistas son `Luciana Romero` y `Victoria Suárez` (matching tu `CONFIG.ANALISTAS_DEFAULT`).

---

## Archivos en este paquete

```
design_handoff_nucleo_crm/
├── README.md                  ← este archivo
├── CRM Ventas.html            ← entry point del prototipo
├── styles.css                 ← todos los tokens + clases utilitarias
├── components.jsx             ← Icon, Badge, ScoreBar, Modal, charts, helpers
├── data.jsx                   ← mock data (eliminar al integrar)
├── sidebar.jsx                ← Sidebar + Topbar
├── dashboard.jsx              ← Dashboard general + individual
├── registros.jsx              ← Tabla + modales CRUD
├── corrector.jsx              ← Corrector masivo
├── alertas.jsx                ← Centro de alertas + Auditoría + Scoring
├── reportes.jsx               ← Reportes (5 tabs)
├── admin.jsx                  ← Roles + Calendario + Configuración
├── app.jsx                    ← App shell + router (NO portar — usá Next.js routing)
└── tweaks-panel.jsx           ← NO portar (solo para diseño)
```

---

## Recomendación de orden de implementación

1. **Tokens + tipografía** (1-2h) → ya rinde visualmente
2. **Sidebar + Topbar nuevos** (3-4h)
3. **Botones, badges, modales base** (2-3h)
4. **Tabla de Registros + paginación** (4-6h)
5. **Modal Nuevo/Editar/Detalle de Registro** (6-8h)
6. **Dashboard General** (4-6h)
7. **Dashboard Individual** (3-4h)
8. **Reportes (5 tabs)** (8-10h)
9. **Corrector + Duplicados** (6-8h)
10. **Alertas + Scoring + Auditoría** (8-12h)
11. **Roles + Días hábiles + Config** (10-14h)

**Total estimado: ~70-90h** de desarrollo cuidadoso. Recomendación: implementar en branches independientes y mergear por módulo.

---

## Tips para Claude Code

Si vas a usar Claude Code para hacer la integración, copiá este folder dentro de tu repo y referencialo así:

```
@design_handoff_nucleo_crm/dashboard.jsx
Reescribí src/app/analistas/page.tsx con este diseño, usando lucide-react para los íconos
y manteniendo mi RegistrosProvider y ObjetivosProvider.
```

Para cada módulo, abrí el `.jsx` correspondiente y pedile a Claude Code que lo traduzca a TypeScript + tu stack manteniendo los providers existentes.

---

¿Dudas o querés que detalle algún módulo más? Decime.
