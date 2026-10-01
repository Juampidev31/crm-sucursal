# Gestión diaria (reemplazo de "Gestiones VICTORIA" / Apps Script) — Design

## Contexto

Victoria y Magali llevan hoy un registro diario de gestión de préstamos ("aperturas",
"renovaciones", cancelaciones, tramos de mora) en un sistema separado hecho con Google
Apps Script + Google Sheets ("Gestiones VICTORIA - Sistema Completo" /
"Gestiones MAGALI"), desplegado como web app. Cada una tiene su propia spreadsheet:

- Victoria: `1GVPFJrrX4j0AM3vd4meGWtd6O-IS67Ljx7l_3Enyb_I`
- Magali: `1WUz03tOW-pYVop-cfXYxUlX0wnCxToHUX9V3hU6NGFc`

Ambas comparten el mismo template. La única pestaña alimentada por el formulario web
(Apps Script) es **"Ingreso Diario Ventas"**. Las demás pestañas de cada spreadsheet
("Listado CETRO", "Proy0-Tramo1-29", "Gestion VTA", "Flyers", "Emails") son listas de
contacto mantenidas a mano, con un esquema distinto (Fecha/CUIL/Nombre/Teléfono), y
**quedan fuera de este alcance**.

Este dominio es distinto del embudo de ventas que ya maneja `registros` (proyección →
venta), aunque comparte convenciones del proyecto (columna `analista`, patrón
Provider + Supabase + realtime).

## Decisión

Construir un módulo nuevo y separado — tabla `gestion_diaria`, no extender `registros`
— porque los estados, KPIs y campos no coinciden entre ambos dominios (ver AGENTS.md:
"no duplicar reglas... con significados distintos").

## Alcance

1. Tabla Supabase `gestion_diaria` (genérica por `analista`, no atada a "Victoria").
2. Página `/gestion-diaria`: tabla + filtros + KPIs + modal alta/edición, replicando
   el formulario y el dashboard del Apps Script.
3. Script de migración del histórico (`Gestiones VICTORIA - Ingreso Diario Ventas.csv`,
   1754 filas) hacia la tabla nueva.
4. Entrada en el sidebar.

Fuera de alcance (a pedido explícito, YAGNI): las 5 pestañas auxiliares, apagar el
Apps Script existente (queda corriendo en paralelo hasta que el equipo migre el hábito
de carga), y el CSV de Magali (no se compartió; se migra solo el de Victoria — Magali
arranca con la tabla vacía y carga hacia adelante).

## Mapeo de campos (Apps Script → `gestion_diaria`)

Confirmado contra el CSV histórico real (1754 filas) y el formulario "Agregar
registro" del Apps Script:

| Campo Apps Script | Columna DB | Tipo | Notas |
|---|---|---|---|
| TIPO DE CLIENTE | `tipo_cliente` | text | Ver dropdown vigente abajo. Histórico tiene variantes sueltas (`Consulta VirtuaL`, `Aprobado`, etc.) que no se fuerzan por CHECK — igual que `registros.estado`. |
| FECHA | `fecha` | date | Formato origen `D/M/AAAA`. |
| APELLIDO Y NOMBRE | `nombre` | text | |
| CUIL | `cuil` | text | 11 dígitos, mismo tratamiento que `registros.cuil` (`sanitizarCuil`). |
| ACTIVIDAD | `actividad` | text | Dropdown, ver abajo. |
| Por Donde Nos Conocio | `donde_nos_conocio` | text | Dropdown, ver abajo. |
| ESTADO | `estado` | text | Dropdown, ver abajo. El histórico usa la etiqueta vieja `No Califica (Otros Motivos)` (1497/1754 filas) → se migra a `No califica`. |
| SCORE | `score` | integer | |
| APERTURA/RENOVACION | `tipo_operacion` | text | `Apertura` \| `Renovacion`. |
| MONTO OTORGADO | `monto_otorgado` | numeric(15,2) | Formato origen `$  500.000,000` (AR: miles con `.`, decimales con `,`). |
| (K) X VENTA | `capital_x_venta` | numeric(15,2) | Solo existe en el formulario vigente (no en el CSV histórico) — asunción: K = Capital, I = Interés de la operación. **A confirmar con el usuario**; si la asunción es incorrecta, es un rename de columna sin impacto en el resto del plan. |
| (I) X VENTA | `interes_x_venta` | numeric(15,2) | |
| COMENTARIOS | `comentarios` | text | |
| — | `analista` | text | No existe en el Apps Script (cada analista tiene su propia spreadsheet); se agrega para generalizar. |

## Dropdowns vigentes (formulario actual, fuente de verdad para carga nueva)

- **tipo_cliente**: Proyeccion 0, Tramo 1-29, Cetrogar, Cancelacion, Refinanciaciones, Referido, Jubilado, Centric, Ingreso, Virtual.
- **actividad**: Empleado Privado, Empleado Publico, Jubilado, Sin ingresos Fijos, Pensionado, Monotributista, Emp. Domestica, Retirado, Sin datos.
- **donde_nos_conocio**: Gestion Whatsapp, Paso por el local, Centric, Whatsapp (No Ingreso a Suc), Consulta virtual, Consulta en sucursal, Referido, Referido Con consulta, Flyers.
- **estado**: Aprobado, Rechazado, Falta Documentacion, No califica, Califica, Sueldo bajo.
- **tipo_operacion**: Apertura, Renovacion.

Todos con patrón "agregar otro" (`PremiumSelect` con `onAddCustom`), igual que
`empleador` en `registros`, porque el histórico prueba que la lista crece con el
tiempo.

## KPIs del dashboard a replicar

Monto otorgado (suma), (I) x Venta (suma), Productividad % (aprobados / total),
Aperturas (conteo `tipo_operacion = 'Apertura'`), Renovaciones (conteo
`tipo_operacion = 'Renovacion'`) — todos filtrables por rango de fecha, igual que el
Apps Script.

## Entorno

Todo el trabajo (migración incluida) se hace contra el Supabase ya configurado en
`.env.local` (no hay Supabase local/Docker en este proyecto) y se sirve con
`npm run dev` en `localhost:3000`. Nada se despliega todavía.
