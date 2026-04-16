# Revisión técnica — `src/context/DataContext.tsx`

**Fecha:** 2026-04-16
**Archivo:** `src/context/DataContext.tsx` (292 líneas)
**Stack:** Next.js 16 (App Router) + React 19 + Supabase + TypeScript

---

## TL;DR

El archivo **funciona pero es un "god context"**: mezcla 6 dominios de datos, realtime dual (broadcast + postgres_changes), recordatorios con timers y alertas UI, todo en un único provider. Los consumidores se re-renderizan por cambios que no les importan, el contrato de actualización está roto (los setters crudos están expuestos), y hay redundancia de sincronización que abre race conditions. Es el punto #1 a refactorizar del proyecto.

---

## Problemas por severidad

### 🔴 CRÍTICO

#### 1. God Context — 6 dominios en uno
Líneas 18–43. El contexto expone `registros`, `objetivos`, `diasConfig`, `historicoVentas`, `alertasConfig`, `recordatorios` + UI de alerta + loading global + 7 pushers + 6 setters crudos. Cualquier componente que use `useData()` se re-renderiza cuando CUALQUIERA de esos cambia, incluso si solo lee `objetivos`.

**Impacto:** performance degradada conforme crece el proyecto. Un cambio en un registro vía broadcast dispara re-render en toda página que llame `useData()` para mirar objetivos.

#### 2. `value` del Provider NO está memoizado
Líneas 273–281:
```tsx
<DataContext.Provider value={{ registros, objetivos, ... }}>
```
Object literal nuevo en cada render → referencia cambia → todos los consumidores re-renderean aunque los datos sean idénticos. Falta `useMemo`.

#### 3. Setters crudos expuestos rompen la encapsulación
Líneas 27–32 exponen `setRegistros`, `setObjetivos`, etc. como `Dispatch<SetStateAction>`. Cualquier componente puede mutar estado local sin pasar por los `push*Change` → la sincronización broadcast queda bypassed → estados inconsistentes entre clientes.

Si existe el contrato "toda mutación usa `pushRegistroChange`", no exponer `setRegistros` debería ser regla dura.

#### 4. Doble canal de sincronización (broadcast + postgres_changes)
- Broadcast (líneas 159–232): updates quirúrgicos (INSERT/UPDATE/DELETE por item).
- postgres_changes (líneas 237–264): `refreshRef.current(true)` → recarga TODO.

Las dos subscripciones se disparan en la misma mutación. Secuencia típica:
1. Cliente A inserta registro → broadcast llega a B → B actualiza surgical.
2. postgres_changes también llega a B → B hace full refresh → pisa cualquier estado local.
3. Si hay latencia distinta, B ve parpadeos o estados transitorios inconsistentes.

**Solución:** elegir UNO. Broadcast si querés low-latency y sos dueño de todas las escrituras. postgres_changes si querés tolerancia a escrituras externas.

#### 5. `refresh()` trae TODO en cada llamada
Línea 92. `limit(2000)` en `registros` + 5 tablas más en paralelo. Cualquier cambio en `objetivos`/`dias_habiles_config`/`historico_ventas`/`alertas_config` gatilla un full refresh (líneas 249–260). Bomba de tiempo: cuando haya >2000 registros se rompe silenciosamente.

---

### 🟠 ALTO

#### 6. Race condition en `markReminderCompleted`
Líneas 84–88:
```tsx
setReminderAlert(null);
setPendingReminders(n => Math.max(0, n - 1));
await supabase.from('recordatorios').update({ mostrado: true })...
```
- Decremento optimista local.
- El postgres_changes (línea 240) también llega y re-cuenta desde la DB → doble decremento posible según timing.
- Sin manejo de error: si el UPDATE falla, el contador queda desincronizado.

#### 7. Composite-key lookup frágil en `alertas_config`
Líneas 192–200. El check de "exists" usa `nombre + estado`. Si un UPDATE modifica cualquiera de los dos, el check falla → crea duplicado en vez de actualizar. Mismo patrón frágil en `objetivos` (analista+mes+anio) y `historico_ventas` — mejor usar `id` siempre.

#### 8. Sin manejo de errores en Supabase
Todo el archivo: `const { data } = await supabase...`. Los `error` se descartan. Fallas de red, RLS, permisos → silencio total. El usuario no se entera.

#### 9. Payload de broadcast sin validación
Líneas 162–227. `payload as { type: string; registro: Registro }` — cast crudo. Un broadcast malformado (versión vieja de cliente, bug de deploy) corrompe el estado sin aviso.

#### 10. Memory leak en `shownIds`
Línea 57: `useRef(new Set<string>())` acumula IDs indefinidamente. En sesiones largas (usuario deja la pestaña abierta días), crece sin límite. Debería limpiarse por edad o al marcar completed.

---

### 🟡 MEDIO

#### 11. Stale-closure defendido con refs (síntoma)
Líneas 117–120: `refreshRef`, `checkDueRef` para evitar que los effects dependan de callbacks. Funciona, pero es patching arquitectural. El diseño correcto es que el effect no necesite referenciar estas funciones (o usar un event emitter).

#### 12. Loading binario global
Un solo `loading` para 6 dominios. No se puede mostrar UI parcial mientras carga solo uno. El usuario ve pantalla en blanco hasta que los 6 queries resuelven en paralelo.

#### 13. Provider 100% client-side
292 líneas con `'use client'`. No aprovecha Server Components de App Router. El initial load podría venir renderizado desde el server, reduciendo TTI y evitando el blink de loading inicial.

#### 14. `pushBulkRefresh` sin `.catch()`
Línea 154. Inconsistente con `pushBroadcast` (línea 125) que sí lo tiene.

#### 15. `initialized.current = true` bloquea remounts
Líneas 56, 109–114. En dev (StrictMode) evita doble-fetch, pero en prod si el provider se desmonta y remonta (ej. cambio de layout raíz), no refetchea. El cleanup de channels sí se ejecuta, dejando el state sin datos vivos.

---

### 🟢 MENOR / STYLE

#### 16. `select` con 18 columnas hardcoded (línea 93)
Difícil de mantener. Si agregás columna en DB, hay que recordar actualizarla acá. Mejor un tipo generado por Supabase (`database.types.ts`) y `select('*')` tipado.

#### 17. Cast `as Registro[]` sin parseo (línea 100)
El retorno de Supabase no se valida. Si la DB devuelve algo distinto al tipo, TypeScript miente.

#### 18. `reminderAlert` tipo separado innecesario
`ReminderAlertData` (líneas 9–16) es un subset de `Recordatorio`. Podrías reusar `Pick<Recordatorio, ...>`.

---

## Arquitectura del proyecto (panorámica)

Estructura actual (`src/`):
```
app/
  api/          # rutas API (cobranzas, historico, luciana, pdv, admin/login)
  ajustes/      # página con sub-tabs como archivos
  ...           # resto de páginas
components/     # AppShell, Sidebar, CustomSelect, ...
context/        # 3 contexts
hooks/          # 1 hook (useToast)
lib/            # supabase, auth, utils, csv-utils, correccion-tildes, audit
types/          # index.ts
```

### Observaciones
- **Sin capa de dominio/servicios.** La lógica de negocio vive mezclada en los `page.tsx` + contexts + route handlers. No hay `services/` o `domain/` donde centralizar reglas (cálculo de proyecciones, validaciones de registros, etc.).
- **Carpeta `ajustes/` con tabs como siblings de `page.tsx`.** `ResumenMensualTab.tsx`, `BulkModifyTab.tsx`, `AnalisisTemporalTab.tsx` cuelgan del mismo nivel que la ruta. Mejor: `app/ajustes/_components/` (underscore evita que sean rutas) o `components/ajustes/`.
- **`api/` sin naming consistente.** `luciana` y `pdv` son nombres internos; no describen el recurso. Un futuro dev no sabe qué hacen.
- **3 contexts (Auth, Data, Filter) encadenados** probablemente en `layout.tsx`. Cuanto más crece `DataContext`, más castiga a los consumidores de los otros dos.
- **`hooks/` casi vacío.** Indica que la lógica reusable aún no se extrajo — está inline en páginas.

---

## Estructura propuesta (para producción)

```
src/
├── app/
│   ├── (dashboard)/              # route group con shell
│   │   ├── layout.tsx            # Providers (server-hydrated)
│   │   ├── registros/
│   │   │   ├── page.tsx          # Server Component (fetch inicial)
│   │   │   └── _components/      # Client Components específicos
│   │   └── ...
│   ├── api/
│   │   ├── registros/route.ts    # naming por recurso
│   │   └── ...
│   └── layout.tsx                # root
├── features/                     # dominio (o domains/)
│   ├── registros/
│   │   ├── store.tsx             # context + realtime para ESTE dominio
│   │   ├── hooks.ts              # useRegistros, useCreateRegistro
│   │   ├── services.ts           # createRegistro(), etc — con error handling
│   │   ├── types.ts
│   │   └── schema.ts             # zod para validar payloads de broadcast
│   ├── objetivos/
│   ├── historico/
│   ├── recordatorios/
│   └── ...
├── lib/
│   ├── supabase/
│   │   ├── client.ts             # browser client
│   │   ├── server.ts             # server client (para RSC)
│   │   └── database.types.ts     # generado
│   ├── realtime/
│   │   └── broadcast.ts          # wrapper único, un solo canal
│   └── ...
├── components/ui/                # AppShell, Sidebar (presentacionales)
└── hooks/
```

### Principios detrás de esto

1. **Feature-sliced, no technical-sliced.** `features/registros/` contiene TODO lo de registros: store, hooks, services, tipos. Escala mejor.
2. **Un context por dominio.** `useRegistros()` no re-renderiza cuando cambia `objetivos`.
3. **Un solo canal realtime.** `lib/realtime/broadcast.ts` centraliza la suscripción; cada feature registra sus handlers.
4. **Server Components para fetch inicial.** `page.tsx` hace el fetch server-side (Supabase server client), pasa data hidratada al provider cliente.
5. **Validación en el borde.** `schema.ts` con Zod valida los payloads de broadcast ANTES de tocar el estado.
6. **Services con error handling.** Toda llamada a Supabase va por un service que retorna `Result<T, Error>` o tira tipado.

---

## Refactor prioritizado (por qué cambiarías primero qué)

| Prioridad | Cambio | Impacto | Esfuerzo |
|-----------|--------|---------|----------|
| 1 | Memoizar `value` del Provider | Elimina re-renders masivos ya | 5 min |
| 2 | Esconder setters, exponer solo actions | Fixes encapsulación + contrato broadcast | 30 min |
| 3 | Eliminar canal postgres_changes redundante | Elimina race conditions | 15 min |
| 4 | Split en 6 contexts por dominio | Escalabilidad + performance | 2–4 h |
| 5 | Validar payloads con Zod | Robustez de realtime | 1 h |
| 6 | Mover fetch inicial a Server Component | TTI + arquitectura correcta Next 16 | 2 h |
| 7 | Manejo de errores + toasts | UX + debugging | 1–2 h |
| 8 | Paginación real en `registros` | Evita límite de 2000 | 2 h |
| 9 | Services por dominio | Testabilidad | 3 h |
| 10 | Reestructurar carpetas a features | Longevidad del proyecto | 1 día |

---

## Ver `DataContext.refactored.tsx`

La versión refactorizada está en `src/context/DataContext.refactored.tsx` (sibling, no pisa el original). Implementa prioridades 1–5 y deja hooks listos para 6–7.
