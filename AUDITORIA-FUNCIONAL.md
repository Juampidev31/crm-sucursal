# Auditoría funcional completa — copia aislada

> Documento vivo. Se actualiza a medida que avanzan las fases.
> Última actualización: 2026-10-01

## A. Entorno aislado

| | Valor |
|---|---|
| **Original (CONGELADO, sólo lectura)** | `C:\Users\HP\.gemini\antigravity\scratch\Proyeccion y ventas ORIGINAL\next-ventas` |
| **Copia (auditoría)** | `C:\Users\HP\.gemini\antigravity\scratch\Proyeccion y ventas ORIGINAL\next-ventas-AUDITORIA-FUNCIONAL` |
| **Puerto** | `3200` (`http://127.0.0.1:3200`) |
| **Git original** | `master` @ `19f881e`, 103 entradas modificadas — **idéntico al inicio**, reflog sin entradas de hoy |
| **Git copia** | rama `auditoria` @ `ce372a6` (baseline), repo propio, 210 archivos |
| **Deps** | `npm ci` → 428 paquetes, `package-lock.json` byte-idéntico al original, `next@16.2.1` |

### Prueba de aislamiento (ejecutada y certificada)

| Comprobación | Resultado |
|---|---|
| probe creado en copia | `True` |
| probe visible en original | `False` |
| mismas rutas | `False` |
| `.git` copia | `…next-ventas-AUDITORIA-FUNCIONAL/.git` |
| `.git` original | `…next-ventas/.git` |
| probe eliminado | `True` |

### Snapshot: fidelidad al working tree (no a HEAD)

Borrados en el working tree → **ausentes** en la copia: `fix.js`, `replaceTooltips.js`,
`src/app/proyeccion/{page,ProyeccionClient}.tsx`, `src/components/Sidebar.tsx`,
`src/lib/audit-import-utils.ts`, `src/app/publico/resumen-mensual/ResumenHTML.tsx`.

Nuevos/untracked → **presentes**: `.claude/launch.json`, los 20+ `*.module.css`,
`scripts/*.mjs`, `artifacts/`, los CSV, `.env.local`.

Excluidos: `node_modules`, `.next`, `.git`, `tsconfig.tsbuildinfo`, `build_output.log`, `output.txt`.

---

## ⚠️ Riesgos de entorno detectados y mitigados

### R1 — `predev` podía matar el servidor del ORIGINAL

`scripts/kill-port.js` mata **todo** proceso que escuche en `PORT` (default `3000`), y ese kill
**no está acotado al proyecto** (sí lo está el barrido de huérfanos, vía `PROJECT_ROOT`).
Ejecutar `npm run dev` en la copia habría matado el dev server del original.

**Mitigación (sólo en la copia):** `npm run dev:audit` → `PORT=3200`,
`next dev --hostname 127.0.0.1 -p 3200`. `.claude/launch.json` reducido a una sola config `audit`
en 3200. Sin `--hostname 0.0.0.0` (no se expone a la red).

### R2 — 🔴 LA BASE DE DATOS ES COMPARTIDA

`.env.local` de la copia apunta al **mismo** proyecto Supabase que el original
(`https://cnjq….supabase.co`, misma anon key). **Copia de código ≠ copia de datos.**
Todo write desde `localhost:3200` impacta la base real.

**Régimen de pruebas aplicado:** cero bulk update / delete masivo / import masivo.
Acciones destructivas sólo hasta *preview*, sin confirmar. CRUD individual únicamente sobre
registro de prueba controlado, con valor ANTES → acción → DESPUÉS → restauración documentada.

---

## B. Matriz de funciones

_Pendiente — Fases 2 y 3._

### Fase 1 — Inventario de rutas

| Ruta | Archivo | Rol requerido | Funciones principales |
|---|---|---|---|
| `/` | `src/app/page.tsx` | _por determinar_ | _por determinar_ |
| `/login` | `src/app/login/page.tsx` | público | _por determinar_ |
| `/registros` | `src/app/registros/page.tsx` | _por determinar_ | CRUD, modales, filtros, paginación |
| `/gestion-diaria` | `src/app/gestion-diaria/page.tsx` | _por determinar_ | _por determinar_ |
| `/ajustes` | `src/app/ajustes/page.tsx` | _por determinar_ | 10+ tabs |
| `/analistas` | `src/app/analistas/page.tsx` | _por determinar_ | KPIs, charts, PDV, históricos |
| `/duplicados` | `src/app/duplicados/page.tsx` | _por determinar_ | agrupación, filtros |
| `/reportes` | `src/app/reportes/page.tsx` | _por determinar_ | tablas, export, charts |
| `/reportes/cobranzas` | `src/app/reportes/cobranzas/page.tsx` | _por determinar_ | _por determinar_ |
| `/publico/resumen-mensual` | `src/app/publico/resumen-mensual/page.tsx` | público (RSC) | resumen interactivo |
| 404 | — | — | **sin `not-found.tsx`** → 404 por defecto de Next |

**Route handlers (7):** `api/admin/export-xlsx`, `api/admin/login`, `api/cobranzas`,
`api/historico`, `api/luciana`, `api/nueva-seccion`, `api/pdv`.

**Sin `middleware.ts`** → no hay guardas de ruta a nivel edge; la autorización es client-side.
Verificar en Fase 1 si `/ajustes`, `/registros` etc. son accesibles sin sesión.

Nota: `/proyeccion` **ya no existe** en el working tree (borrado sin commit).

---

## C. Bugs encontrados

### H1 (hipótesis P0) — `ZoomWrapper` rompe el contexto de posicionamiento de los modales

`src/components/ZoomWrapper.module.css` aplica a `.root`:

```css
transform: scale(var(--app-zoom));
will-change: transform;
```

Cualquiera de las dos propiedades convierte `.root` en **containing block de los descendientes
`position: fixed`**. `AppShell.tsx:416` renderiza `<ZoomWrapper>{children}</ZoomWrapper>`
**sin prop `zoom`** → `zoom = 1` → `scale(1)`: la transformación es identidad, pero
**el containing block se crea igual**. Es decir, el defecto está activo siempre, no sólo con zoom ≠ 1.

`ModalPortal` existe precisamente para esquivarlo (su comentario lo dice: _"escapar stacking
contexts rotos por ancestros con transform/will-change/filter (ZoomWrapper, motion.div)"_),
pero **sólo 6 componentes lo usan**:

| Usa `ModalPortal` | No lo usa (candidatos a fallo) |
|---|---|
| `BitacoraModal.tsx` | `ajustes/DiasHabilesTab.tsx` (13 refs a guardar) |
| `AccountActions.tsx` | `ajustes/BulkModifyTab.tsx` |
| `analistas/page.tsx` | `ajustes/ResumenMensualTab.tsx` |
| `gestion-diaria/GestionDiariaClient.tsx` | `reportes/cobranzas/CobranzasClient.tsx` |
| `registros/page.tsx` | `features/settings/SettingsProvider.tsx` |
| `ExportXlsxModal.tsx` | `components/CorporateDatePicker.tsx` |

**Predicción falsable:** en los modales de la columna derecha, el backdrop `position: fixed`
queda mal posicionado/escalado y **intercepta el click sobre Guardar**.
`document.elementFromPoint(x, y)` sobre el centro del botón devolverá el backdrop, no el `<button>`.

**Estado: CONFIRMADA como defecto CSS — DESCARTADA como causa del fallo de Guardar.**

Prueba ejecutada en `http://127.0.0.1:3200/registros`: se insertó un `div` con
`position: fixed; top:0; left:0` como hijo de `ZoomWrapper-module__root` y se midió su
posición en viewport.

| Medición | Valor |
|---|---|
| `transform` computado | `matrix(1, 0, 0, 1, 0, 0)` ← **identidad** |
| `will-change` | `transform` |
| Posición del probe `fixed` | `(104, 74)` |
| Posición esperada si el CB fuese el viewport | `(0, 0)` |
| Posición del host | `(104, 74)` |

**Veredicto: el containing block es el ancestro transformado, no el viewport.** El defecto
está activo con `zoom = 1`, sin que el usuario toque el zoom.

**Pero no causa el fallo de Guardar en los modales probados**, porque éstos usan `ModalPortal`
y se montan como hijos de `<body>`, fuera del `ZoomWrapper`. Medido en el modal de edición de
registros: `esHijoDeBody: true`, `dentroDeZoomWrapper: false`, overlay en `(0,0)` de `1440×900`
= viewport completo.

Queda como **defecto latente**: cualquier modal/popover `position: fixed` que NO use
`ModalPortal` quedará mal posicionado. Pendiente de probar en `DiasHabilesTab`,
`BulkModifyTab`, `ResumenMensualTab`, `CobranzasClient`, `CorporateDatePicker`.

### H2 — Sin guarda de autenticación

`/registros` renderiza **7010 registros reales sin pedir login**: `localStorage` vacío,
sin cookies, `sessionStorage` vacío, `isAdmin: false`. No hay `middleware.ts`.
Cualquiera con acceso al puerto ve los datos. **Severidad alta.**

### H3 — `scripts/kill-port.js`

1. Mata **todo** proceso en `PORT` (default 3000) sin acotar al proyecto → puede matar otro servidor.
2. El barrido de huérfanos falla siempre que se invoque desde un shell que no preserve las
   comillas internas: `Get-CimInstance ... -Filter Name='node.exe'` → `Consulta no válida`,
   `HRESULT 0x80041017`. La función retorna `[]` por el `catch` y el fallo pasa inadvertido.

---

## D. Bugs corregidos

### BUG-01 (P0) — Guardar mudo en Gestión diaria · **CORREGIDO**

`src/app/gestion-diaria/GestionDiariaClient.tsx:491`

El handler `guardar()` abría con una guarda que salía **sin ningún aviso al usuario**:

```js
const guardar = async () => {
  if (!form.tipo_cliente || !form.fecha || !form.nombre?.trim() || !form.cuil?.trim()) return;
  setActionError('');
```

Era el **único `return` del archivo que no setea `actionError`**. Todos los demás caminos de
fallo sí lo hacen (`:521`, `:529`, `:556`, `:575`), y el flujo gemelo `saveEntry()` resuelve
exactamente la misma guarda correctamente (`:820` `setEntryError('Ingresá una fecha.')`).
El canal de error ya existía y estaba renderizado (`.daily-action-error`, prop `error={actionError}`
en `:682`). La guarda simplemente lo salteaba.

**Síntoma para el usuario:** pulsar GUARDAR con un obligatorio vacío → no pasa nada.
Sin mensaje, sin campo marcado, sin request. Literalmente "el botón no funciona".

#### Reproducción (antes)

Ruta `/gestion-diaria` → "Agregar registro" → pulsar GUARDAR con el formulario vacío.

| Medición | Antes |
|---|---|
| Requests | `[]` |
| DOM antes vs después | **idéntico** — 4.048.440 bytes exactos |
| Mensaje de error | ninguno |
| Texto del botón | `Guardar` → `Guardar` (sin estado de carga) |

Categoría de fallo (de las 6 posibles): **4 — early return**.
Descartadas por medición: click interceptado (`elementFromPoint` devolvía el propio botón),
`disabled` (`false`), handler no ejecutado (`onClick` presente y alcanzado),
request no enviada / error de request (no llegaba a enviarse).

#### Corrección

```js
const guardar = async () => {
  const faltantes = [
    !form.tipo_cliente && 'Tipo de cliente',
    !form.fecha && 'Fecha',
    !form.nombre?.trim() && 'Apellido y nombre',
    !form.cuil?.trim() && 'CUIL',
  ].filter(Boolean) as string[];
  if (faltantes.length > 0) {
    setActionError(`Completá los campos obligatorios: ${faltantes.join(', ')}.`);
    return;
  }
  setActionError('');
```

Sigue el patrón ya establecido en el archivo: `setActionError(...)` antes de `return`.

#### Verificación (después)

| Medición | Después |
|---|---|
| Mensaje al usuario | **"Completá los campos obligatorios: Tipo de cliente, Apellido y nombre, CUIL."** |
| Requests | `[]` — sigue sin escribir, la guarda mantiene su función |
| Modal | permanece abierto |
| `Fecha` en el mensaje | correctamente omitida (viene precargada) |
| `tsc --noEmit` | **exit 0** |

Verificado primero en la copia de auditoría y luego en el original (servidor pid 2256,
`127.0.0.1:3200`), ambas veces sin ninguna escritura a la base.

## E. Modales / Guardar

### `/registros` → Editar registro (usa `ModalPortal`) — **PASS**

| Comprobación | Resultado |
|---|---|
| elemento DOM real | `button.btn-primary.modal-btn-save` |
| `disabled` | `false` |
| `type` | ausente → default `submit` |
| `<form>` ancestro | **no hay** (inocuo: no hay submit que disparar) |
| `onSubmit` | n/a |
| `onClick` | `()=>guardar()` ✓ |
| overlay / `elementFromPoint` | devuelve **el propio botón** → sin interceptación |
| `pointer-events` | `auto` en toda la pila |
| z-index | overlay `1000`, botón `auto`, pila limpia |
| handler entra | ✓ |
| early returns | 3 (validación, duplicados, modal teléfono) |
| request sale | ✓ 2 × `GET /rest/v1/registros` (chequeo de duplicados) |
| response | 200 |
| UI actualiza | ✓ abre modal de teléfono (`showPhoneModal → true`, `phoneOverlay` en DOM) |
| error de validación visible | ✓ `Comentarios * — Requerido — ingresá el motivo de rechazo` |

**Veredicto: funciona de punta a punta.** Ninguna de las 6 categorías de fallo aplica.

### Falsos positivos propios (registrados para no repetirlos)

1. **Click por `ref` fuera de cuadro.** Con viewport emulado 1440×900 y panel real 800×500, los
   clicks se calculaban en coordenadas fuera del frame y no llegaban al botón. Se corrigió
   alineando el viewport al panel (`preset: desktop`).
2. **Fiber obsoleto.** Releer `memoizedState` de una referencia de fiber guardada antes del
   click devuelve valores viejos: React alterna `current`/`alternate` al re-renderizar. Hay que
   re-resolver el fiber desde el DOM después de cada interacción. Esto produjo un "no cambió
   nada" falso.
3. **Scroll sobre `<select>` nativo.** Un `scroll` del mouse sobre un select abierto/hover
   cambia su valor. Alteró `estado` del formulario localmente (sin guardar, DB intacta).

---

# CERTIFICACIÓN DE GUARDAR / CREAR / CONFIRMAR

Servidor: original en `127.0.0.1:3200`. **Cero escrituras a la base en toda la fase.**

## A. Inventario total

**44 sitios de escritura** (`insert` / `update` / `upsert` / `delete`) en 13 archivos:

| Archivo | Sitios | Tablas |
|---|---|---|
| `ajustes/BulkModifyTab.tsx` | 6 | registros, auditoria |
| `ajustes/page.tsx` | 8 | alertas_config, permisos_roles, historico_ventas, objetivos |
| `registros/page.tsx` | 7 | registros, recordatorios |
| `ajustes/AnalistasTab.tsx` | 5 | analistas, objetivos, dias_habiles_config |
| `gestion-diaria/GestionDiariaClient.tsx` | 3 | gestion_diaria |
| `ajustes/DiasHabilesTab.tsx` | 3 | dias_habiles_config |
| `components/BitacoraModal.tsx` | 3 | recordatorios, bitacora_notas |
| `ajustes/AvisosTab.tsx` | 2 | recordatorios |
| resto (CargaRapida, Recordatorios, Settings, audit) | 4 | varias |

**12 handlers de guardado:** `guardar` ×2, `guardarComentarios`, `guardarEdicionHoy`, `saveEntry`,
`saveAlertas`, `saveHistorico`, `saveData`, `saveFeriados`, `save`, `handleConfirm` ×2.

## B. PASS

| Ruta | Modal | Acción | Evidencia |
|---|---|---|---|
| `/registros` | Editar registro | GUARDAR | `elementFromPoint`→propio botón · `disabled:false` · `onClick` ✓ · 2 GET 200 (dup check) · abre modal teléfono · error visible `Comentarios * — Requerido…` |
| `/registros` | Agregar teléfono | Guardar | **"El teléfono es obligatorio."** visible · **0 requests** · modal abierto |
| `/registros` | Recordatorios/Bitácora | GUARDAR NOTA | `disabled` inicial correcto · se habilita con nota **y** con fecha · `canSave` coherente |
| `/gestion-diaria` | Agregar registro | Guardar | tras BUG-01: mensaje visible · **0 requests** · modal abierto |
| `/ajustes` → Alertas | (inline) | Guardar | `CLICK_LLEGA:true` · sin interceptación · `onClick`→`alertas_config` ✓ |

En los 5 casos el overlay es hijo de `<body>`, cubre el viewport completo y **queda fuera del ZoomWrapper**.

## C. FAIL

| # | Ubicación | Fallo | Estado |
|---|---|---|---|
| BUG-01 | `gestion-diaria/GestionDiariaClient.tsx:491` | `return` silencioso en `guardar()` | **CORREGIDO Y VERIFICADO** |
| BUG-02 | `registros/page.tsx:1049` | `if (!name) return;` silencioso en "agregar localidad" (C.P.). Sin `disabled`, sin mensaje | **ABIERTO** — fix propuesto, no aplicado |

## D. Returns silenciosos — clasificación completa

30 `return;` de guarda revisados en los 9 archivos con escritura.

| Cat. | Significado | Cantidad | Ejemplos |
|---|---|---|---|
| **A** | Feedback visible ya presente | 7 | `saveEntry:820` `setEntryError('Ingresá una fecha.')` · `handleConfirm:403` `setErrorVisible(true)` · los `if (!confirm(…)) return` de DiasHabiles/Avisos (el diálogo *es* el feedback) |
| **B** | **Silencioso → bug** | 2 | `GestionDiariaClient:491` (corregido) · `registros:1049` (abierto) |
| **C** | Guarda interna no accionable por el usuario | 21 | `if (!commentsTarget) return` · `if (!deleteTarget) return` · `if (!active) return` (cleanup de efectos) · `BitacoraModal:233` y `CargaRapidaTab:67` — **espejo exacto del `disabled` del botón**, inalcanzables desde la UI |
| **D** | Requiere investigación | 0 | — |

Dos casos merecen destacarse como **buena práctica ya presente en el proyecto**:
`BitacoraModal` (`canSave:337` ↔ guarda `:233`) y `CargaRapidaTab`
(`disabled={saving || summary.new === 0}` ↔ guarda `:67`) deshabilitan el botón con la misma
condición de la guarda. Ése es el patrón correcto y hace la guarda inalcanzable.

## E. Fixes propuestos (NO aplicados)

### BUG-02 — `src/app/registros/page.tsx:1049`

```js
onClick={() => {
  const name = cpAddLoc.trim();
  if (!name) return;          // ← mudo: el usuario pulsa y no pasa nada
  addCustomMapping(cp, name);
```

**Propuesta** (sigue el patrón ya usado en el archivo): añadir `disabled={!cpAddLoc.trim()}`
al botón, con lo que la guarda pasa a categoría C sin tocar la lógica.

### Hallazgo de integridad — `src/app/ajustes/page.tsx:261` (`saveAlertas`)

```js
await supabase.from('alertas_config').delete().neq('id', '000…000');  // borra TODO
for (const alerta of alertasConfig) {
  const { error } = await supabase.from('alertas_config').insert(alerta);
  if (error) throw error;                                             // si falla a mitad…
}
```

Borrado total seguido de inserciones una por una, **sin transacción**. Un fallo a mitad del
bucle deja la configuración de alertas parcialmente borrada. No verificable sin escribir.
Propuesta: `upsert` por lote, o RPC transaccional.

## F. Network

En **todos** los estados inválidos ejercitados: **requests = 0**. Ninguna acción inválida
llegó a enviar `INSERT`/`UPDATE`. Las únicas requests observadas en toda la fase fueron
2 × `GET /rest/v1/registros` (chequeo de duplicados) desde un GUARDAR válido, que es lectura.

## G. Modales no testeables sin write

Llegaron al punto donde enviarían `UPDATE`/`INSERT`. **Detenido antes de disparar.**

| Modal | Botón | Por qué no se ejecutó |
|---|---|---|
| `/registros` → Ver comentarios | GUARDAR | `setSaving(true); onClose(true, comentarios)` — **sin validación alguna**: cualquier click escribe |
| `/registros` → Eliminar | ELIMINAR AHORA | destructivo |
| `/registros` → Editar (modo admin) | GUARDAR | con `isAdmin:true`, `persistirRegistro()` es alcanzable directamente |
| `/ajustes` → Alertas | Guardar | escribe `alertas_config` sin estado inválido posible |
| `/ajustes` → Días Hábiles / Analistas / Roles | varios | sin estado inválido que bloquee |

Nota sobre "Ver comentarios": además de no validar, hace `setSaving(true)` sin ninguna ruta
que lo devuelva a `false`; depende de que el desmontaje del modal lo descarte.

---

# CHECKPOINT 2 — Guardados, errores y `saveAlertas`

**Cero escrituras reales a Supabase.** El único write ejercitado fue **interceptado** y nunca
salió a la red (ver BUG-03).

## A. BUG-02 — aplicado y verificado

`src/app/registros/page.tsx:1047` — se añadió `disabled={!cpAddLoc.trim()}`, igualando la
condición del botón a la de la guarda. **No se tocó la lógica de negocio.**

Validación en navegador (modal Editar → C.P. sin coincidencia → "+ Agregar localidad"):

| # | Escenario | Esperado | Obtenido |
|---|---|---|---|
| 1 | campo vacío | `disabled` | ✅ `true` |
| 2 | "Villa Auditoria" | habilitado | ✅ `false` |
| 3 | sólo espacios `"   "` | `disabled` | ✅ `true` |
| 4 | texto borrado | `disabled` | ✅ `true` |
| 5 | cerrar y reabrir la fila | `disabled` | ✅ `true` |

`requests: []` · `erroresJS: []` · `tsc --noEmit` **exit 0**.
Consola: sólo fallos de `webpack-hmr` WebSocket (página vieja contra servidor reiniciado),
clasificados como **ruido de infraestructura**, no de aplicación.

## B. Modales restantes

| Ruta | Modal / Sección | Botón | disabled | click llega | validación | early return | write |
|---|---|---|---|---|---|---|---|
| `/ajustes` → Alertas | inline | Guardar | false | ✅ | ninguna posible | — | **BLOQUEADO EN WRITE** |
| `/ajustes` → Días Hábiles | por analista ×3 | Guardar | false | ✅ | ninguna | — | **BLOQUEADO EN WRITE** |
| `/ajustes` → Días Hábiles | — | Replicar a Todos | false | ✅ | ninguna | — | **BLOQUEADO EN WRITE** |
| `/ajustes` → Días Hábiles | Feriados | Cargar Feriados Oficiales | false | ✅ | `confirm()` | A | **BLOQUEADO EN WRITE** |
| `/ajustes` → Días Hábiles | Feriados | Agregar | false | ✅ `onClick` ✓ | — | — | **BLOQUEADO EN WRITE** |
| `/ajustes` → Analistas | — | Agregar | false | ✅ | — | — | **BLOQUEADO EN WRITE** |
| `/ajustes` → Roles y Permisos | — | **sin botón Guardar** | — | — | — | — | guarda al togglear (`togglePermiso`) |

Observación sobre Roles y Permisos: no existe acción de confirmación; cada toggle escribe
directamente vía `togglePermiso` (`permisos_roles.upsert`). No es un fallo, pero significa que
**no hay forma de descartar un cambio accidental**.

## C. Nuevos returns silenciosos

**Ninguno.** Tras BUG-01 y BUG-02 no queda ningún `return;` de categoría B en acciones de usuario.

## D. Flujo "Comentarios" — BUG-03

### Arquitectura real (hipótesis de "cierra antes de saber" → **DESCARTADA**)

```
ComentariosModal.save()      setSaving(true); onClose(true, comentarios)
         ↓
handleComentariosClose       await supabase.from('registros').update(...).eq('id', …)
  :1667                              ↓
                             error → showToast('Error al guardar comentarios')
                                     y NO limpia comentariosTarget  → el modal SIGUE ABIERTO
                             ok    → showToast + setComentariosTarget(null) + refresh
```

El modal se renderiza como `<ComentariosModal registro={comentariosTarget} …/>`, así que
**permanece montado hasta que el padre lo cierra, y el padre sólo cierra en éxito**.
El diseño es correcto en ese punto.

### BUG-03 (ABIERTO) — loading infinito tras error

`src/app/registros/page.tsx:1239` + `:1274`

```js
const save = async () => { setSaving(true); onClose(true, comentarios); };   // nunca vuelve a false
…
<button onClick={save} disabled={saving}>{saving ? 'GUARDANDO…' : 'GUARDAR'}</button>
```

`saving` sólo se resetea en `useEffect(..., [registro])`. En el camino de error el padre **no
limpia `comentariosTarget`**, así que la prop `registro` conserva la misma referencia, el efecto
no se re-dispara y **`saving` queda en `true` indefinidamente**.

**Reproducción en navegador, con el write interceptado** (nunca llegó a Supabase):

| Medición | Antes del fallo | Después |
|---|---|---|
| Write | — | `PATCH …/rest/v1/registros?id=eq.37296` **bloqueado, no salió a la red** |
| Botón | `GUARDAR`, `disabled:false` | **`GUARDANDO…`, `disabled:true`** |
| Modal | abierto | abierto ✅ |
| Toast de error | — | ✅ visible |
| CANCELAR | usable | usable (única salida) |

**Impacto:** tras un fallo de guardado el usuario ve el error pero **no puede reintentar**;
debe cerrar y reabrir el modal. **Fix no aplicado**, a la espera de tu decisión.

## E. Manejo de errores — clasificación

| Handler | try/catch | revisa error | reset de loading | cierra sólo en éxito | feedback | Cat |
|---|---|---|---|---|---|---|
| `persistirRegistro` `registros:687` | — | ✅ | ✅ | ✅ | `setErrors` | **A** |
| `guardar` `gestion-diaria:490` | — | ✅ | ✅ | ✅ | `setActionError` | **A** (post BUG-01) |
| `guardarComentarios` `gd:545` | — | ✅ | ✅ | ✅ | `setActionError` | **A** |
| `saveEntry` `gd:826` | ✅ finally | ✅ | ✅ | ✅ | `setEntryError` | **A** |
| `saveHistorico` `ajustes:468` | ✅ | ✅ | ✅ | n/a | `showError`/`showSuccess` | **A** |
| `saveData` `cobranzas:257` | ✅ finally | ✅ (`res.ok`) | ✅ | n/a | `setToast` | **A** |
| `saveFeriados` → `guardarFeriadosDB` | ✅ | ✅ vía booleano | ✅ | n/a | los 4 consumidores hacen `if (!ok) throw` → toast | **A** |
| `ComentariosModal.save` + `handleComentariosClose` | ✗ | ✅ | **✗** | ✅ | toast | **B** → BUG-03 |
| `saveAlertas` `ajustes:258` | ✅ | ✅ | ✅ | n/a | `showError`/`showSuccess` | **E** (integridad) |
| `syncDiasTranscurridos` `SettingsProvider:244` | ✗ | **✗ ninguno** | n/a | n/a | ninguno | **D** (ignora error) |

`syncDiasTranscurridos` hace `await supabase.from('dias_habiles_config').upsert(u)` en bucle
**sin revisar `error` ni una sola vez**. Es sincronización de fondo, no una acción de usuario,
pero puede fallar en silencio y dejar los días transcurridos desactualizados.

## F. `saveAlertas` — schema, consumidores y propuesta

### Auditoría de sólo lectura

| Aspecto | Hallazgo |
|---|---|
| PK | `id UUID DEFAULT gen_random_uuid()` |
| UNIQUE | **ninguno** en columnas de negocio (`nombre`, `estado`) |
| FK entrantes | **ninguna** — nada referencia estos IDs |
| Triggers | ninguno (sólo `registros` y `gestion_diaria`) |
| RLS | **comentada** en `supabase-schema.sql:194-197`, no habilitada |
| Filas | **6**, fijas |
| Lectores | `SettingsProvider:60`, `api/admin/export-xlsx:91` |
| Escritores | **sólo** `ajustes/page.tsx:261-263` |
| RPC existente | ninguna |

### ¿Es realmente necesario borrar todo? — **NO**

Dos hechos lo deciden:

1. **El conjunto es fijo.** El editor (`ajustes/page.tsx:737`) renderiza `nombre` y `estado`
   como texto y badge **no editables**; sólo `dias` y `color` tienen inputs. No hay botones de
   alta ni de baja. La operación real es *"actualizar 2 campos en 6 filas existentes"*, no
   *"reemplazar el conjunto"*.

2. **El borrador descarta la identidad.** La siembra en `:249` mapea explícitamente sin `id`:

   ```js
   setAlertasConfig(ctxAlertas.map(a => ({
     nombre: a.nombre, estado: a.estado, dias: a.dias,
     mensaje: a.mensaje, color: a.color,     // ← sin id
   })));
   ```

   Sin identidad no hay nada sobre lo que hacer upsert. **El `delete`-all no es una decisión de
   diseño: es una consecuencia de haber tirado los IDs.** Cada guardado regenera 6 UUIDs nuevos.

### Evaluación de las opciones

| Opción | Veredicto |
|---|---|
| **A — RPC transaccional** | Funciona, pero **sobredimensionada**: cristaliza en la base una semántica de "reemplazar todo" que la UI nunca necesita. Requiere migración. |
| **B — UPSERT por PK** | **Recomendada.** Dejar de descartar el `id` en `:249` y reemplazar `delete`+`insert`×6 por **un único `upsert(rows)`** sobre la PK. Una sola sentencia PostgREST → **una sentencia Postgres → atómica**. Sin migración, sin `UNIQUE(estado)`, sin RPC. Y **nunca borra**: el peor caso pasa de "tabla vaciada" a "actualización parcial". |
| **C — Route handler** | **Rechazada.** Usaría el mismo cliente anon y `supabase-js` no expone transacciones; añade infraestructura sin resolver la atomicidad. |

**Requisito adicional de la opción B:** `resetAlertas` (`:277`) asigna `CONFIG.ALERTAS_DEFAULT`,
que tampoco lleva `id`. Habría que mapear los valores por defecto sobre los IDs ya cargados
(emparejando por `estado`, que el usuario no puede cambiar).

El propio proyecto ya usa este patrón correctamente: `saveHistorico:496` hace
`upsert(..., { onConflict: 'analista,anio,mes' })` sobre tablas que **sí** declaran
`UNIQUE(analista, mes, anio)` (`supabase-schema.sql:60`). `saveAlertas` es el caso atípico.

### Riesgo adicional detectado — ventana de pérdida de datos

`alertasConfig` arranca como `CONFIG.ALERTAS_DEFAULT` (`:195`) y la siembra desde el contexto
está protegida por `alertasSembradas` (`:247`), que **sólo corre cuando `ctxAlertas.length > 0`**.
Si el usuario pulsa Guardar **antes de que el provider resuelva**, se persisten los valores por
defecto sobre la configuración real. Mitigación sugerida: deshabilitar Guardar hasta que
`alertasSembradas.current === true`.

**Nada de esto se ha implementado**, conforme a la instrucción.

## G. Writes que faltaría ejecutar para certificar

Lista exacta de flujos que sólo pueden cerrarse ejecutando una escritura real:

| # | Flujo | Operación | Reversible |
|---|---|---|---|
| 1 | Registros → Ver comentarios → GUARDAR | `registros.update({comentarios})` | ✅ guardar el valor previo y restaurarlo |
| 2 | Registros → Editar → GUARDAR (admin) | `registros.update(payload)` | ✅ ídem |
| 3 | Registros → Fijar / Desfijar | `registros.update({fijado})` | ✅ toggle |
| 4 | Registros → Bitácora → GUARDAR NOTA | `recordatorios.update` / `bitacora_notas` | ⚠️ crea filas; requiere borrado posterior |
| 5 | Gestión diaria → alta con datos válidos | `gestion_diaria.insert` | ⚠️ crea fila |
| 6 | Gestión diaria → edición | `gestion_diaria.update` | ✅ |
| 7 | Ajustes → Alertas → Guardar | `alertas_config` delete+insert | ⚠️ **no ejecutar hasta decidir F** |
| 8 | Ajustes → Días Hábiles → Guardar / Replicar | `dias_habiles_config.upsert` | ✅ |
| 9 | Ajustes → Analistas → Agregar | `analistas.insert` | ⚠️ crea fila |
| 10 | Ajustes → Roles y Permisos → toggle | `permisos_roles.upsert` | ✅ toggle |
| 11 | Cobranzas → Guardar | `POST /api/cobranzas` | ✅ |

Los marcados ✅ admiten el protocolo que propusiste: registro de prueba, valor original
documentado, cambio reversible y restauración posterior.

---

# CHECKPOINT 3 — BUG-03 y `saveAlertas`

**Cero writes reales a Supabase.** Todas las escrituras ejercitadas fueron interceptadas.

## BUG-03 — corregido

### Cambio

Contrato explícito: `onClose` ahora devuelve el resultado, y el modal reacciona.
**Sin timeouts, sin depender del cambio de props.**

`src/app/registros/page.tsx`

```ts
// Tipo del prop
onClose: (saved: boolean, updatedComentarios?: string) => Promise<boolean>;

// ComentariosModal.save()
const save = async () => {
  setSaving(true);
  const ok = await onClose(true, comentarios);   // el padre resuelve el resultado
  if (!ok) setSaving(false);                     // error → rehabilita y permanece abierto
};

// handleComentariosClose (padre)
if (error) { showToast('Error al guardar comentarios', 'error'); return false; }
…
return true;
```

El toast lo sigue mostrando **sólo el padre**: no se duplica.

### Reproducción antes / después

Misma técnica segura: `PATCH` interceptado, nunca llega a Supabase.

| | ANTES | DESPUÉS |
|---|---|---|
| Toast de error | ✅ | ✅ |
| Modal abierto | ✅ | ✅ |
| Botón | **`GUARDANDO…` · `disabled:true` permanente** | **`GUARDAR` · `disabled:false`** |
| Reintento | ❌ imposible | ✅ segundo `PATCH` emitido |
| Writes reales | 0 | 0 |

`tsc --noEmit` **exit 0**.
Lint dirigido sobre `registros/page.tsx`: 8 errores, **todos preexistentes**
(`react-hooks/set-state-in-effect` en líneas 385, 548, 563, 1230, 1387, 1489, 1630 y
`preserve-manual-memoization` en 1353). Ninguno en el código nuevo.

## `saveAlertas` — reescrito

Se resolvieron **A (no atomicidad) y B (hidratación) en el mismo lote**, como pediste.

### 1. Contrato de hidratación (cambio mínimo en el provider)

`SettingsProvider` **no exponía** ningún estado de carga (0 coincidencias de
`loading|loaded|ready|hydrat`). Se añadió el contrato explícito en lugar de inferirlo:

```ts
const [settingsLoaded, setSettingsLoaded] = useState(false);
…
setSettingsLoaded(true);   // al final del primer fetchSettings
```

Expuesto en `SettingsCtx`. **No se usó ningún timeout.** El motivo está documentado en el
código: un array vacío es un estado real (tabla sin filas o error de lectura), no una
invitación a guardar valores por defecto — por eso `ctxAlertas.length > 0` no servía como señal.

### 2. Preservación del `id`

```diff
- setAlertasConfig(ctxAlertas.map(a => ({
-   nombre: a.nombre, estado: a.estado, dias: a.dias,
-   mensaje: a.mensaje, color: a.color,          // ← id descartado
- })));
+ setAlertasConfig(ctxAlertas.map(a => ({
+   id: a.id, nombre: a.nombre, estado: a.estado, dias: a.dias,
+   mensaje: a.mensaje, color: a.color,
+ })));
```

El borrador arranca en `null`, **no** en `CONFIG.ALERTAS_DEFAULT`, y se siembra una sola vez,
sólo cuando `settingsLoaded === true`.

### 3. Bloqueo de Guardar antes de hidratar

```ts
const alertasHidratadas = alertasConfig !== null
  && alertasConfig.length > 0
  && alertasConfig.every(a => !!a.id);
```

`disabled={saving || !alertasHidratadas}` en Guardar y `disabled={!alertasHidratadas}` en
Restaurar. Si el provider termina **sin filas**, `alertasHidratadas` es `false` → Guardar queda
deshabilitado y la tabla se renderiza vacía. **Nunca se persisten los defaults.**
`saveAlertas` además abre con una guarda defensiva `if (!alertasHidratadas || !alertasConfig) return;`.

`resetAlertas` ahora aplica los valores por defecto **sobre los ids ya cargados**, emparejando
por `estado` (que el usuario no puede editar), de modo que el borrador nunca pierde identidad.

### 4. Un único upsert

```diff
- await supabase.from('alertas_config').delete().neq('id', '000…000');
- for (const alerta of alertasConfig) {
-   const { error } = await supabase.from('alertas_config').insert(alerta);
-   if (error) throw error;
- }
+ const { error } = await supabase
+   .from('alertas_config')
+   .upsert(alertasConfig, { onConflict: 'id' });
+ if (error) throw error;
```

### Requests antes / después — payload interceptado

Se modificó `dias` de "Proyecciones" a `99` y se pulsó Guardar con la request interceptada
(respuesta de éxito simulada).

| Criterio | Esperado | Obtenido |
|---|---|---|
| Nº de operaciones | 1 | ✅ **1** |
| Método / URL | upsert | ✅ `POST /rest/v1/alertas_config?on_conflict=id&columns="id","nombre","estado","dias","mensaje","color"` |
| Filas en el payload | 6 | ✅ **6** |
| Todas con `id` | sí | ✅ `true` — p. ej. `da50c12b-439e-4de4-a88d-99ac90c72d3f` |
| Valores actuales, no defaults | sí | ✅ `dias: 99` (el default es 15) |
| **Existe DELETE** | **no** | ✅ **`HAY_DELETE: false`** |
| 6 INSERT separados | no | ✅ ninguno |

**Antes:** 1 `DELETE` + 6 `POST` secuenciales = 7 operaciones, no atómicas.
**Después:** 1 `POST` upsert = 1 operación, una sentencia Postgres.

Verificación de no-escritura: tras recargar, `dias` de "Proyecciones" vuelve a **15**.
El `99` nunca salió del borrador local.

`tsc --noEmit` **exit 0**.
Lint: `ajustes/page.tsx` 34 errores (28 `no-explicit-any`, 5 `set-state-in-effect`,
1 `purity`) y `SettingsProvider.tsx` 2 (`set-state-in-effect` en 211 y 288), todos del
patrón preexistente del archivo. El de la línea 288 es
`useEffect(() => { fetchSettings(); })`, marcado porque `fetchSettings` setea estado — ya lo
hacía con 5 setters antes de este cambio. **No se ejecutó un lint baseline previo al cambio**,
así que esto se afirma por estructura, no por conteo comparado.

### Limitación honesta de la verificación

**No se logró observar directamente la ventana pre-hidratación.** Con servidor local tibio, el
provider resuelve antes de la primera muestra (300 ms) y el botón ni siquiera está montado
todavía. Se verificó el estado post-hidratación (6 filas, todas con `id`, botón habilitado) y
el payload, pero el tramo `alertasConfig === null` → botón deshabilitado queda respaldado por
la estructura del código y por `tsc`, no por una medición en navegador.

---

# CHECKPOINT 4 — Flujos BLOQUEADO EN WRITE

**Writes reales ejecutados: 0.** Todas las escrituras fueron interceptadas antes de salir a la red.

## A. Roles y Permisos

### Arquitectura del write

**No hay botón Guardar.** Cada toggle escribe inmediatamente:

```
click → togglePermiso(rol, permiso, current)
      → setSavingPermiso(`${rol}-${permiso}`)
      → upsert(permisos_roles, { onConflict: 'rol,permiso' })   ← 1 sentencia, atómica
      → if (error) throw
      → applyPermisoConfigChange('UPDATE', config)               ← SÓLO tras éxito
      → showSuccess
   catch → showError
   finally-equivalente → setSavingPermiso(null)
```

| Pregunta | Respuesta |
|---|---|
| ¿Un click dispara write inmediato? | **Sí** |
| ¿Hay confirmación? | **No** |
| ¿Estado optimista? | **No** — el contexto se actualiza sólo tras éxito |
| ¿Se revierte visualmente si falla? | No hace falta: nunca llegó a cambiar |
| ¿Toast de error? | ✅ `Error al actualizar permiso: …` |
| ¿Loading/disabled mientras guarda? | ✅ texto `...` + `disabled` |
| ¿Doble click emite writes concurrentes? | ✅ **bloqueado** — 0 requests extra |
| ¿Dos permisos rápidos seguidos? | ⚠️ ver BUG-04 |

### Error simulado (interceptado, 500)

| Medición | Resultado |
|---|---|
| Request | `POST /rest/v1/permisos_roles?on_conflict=rol,permiso` |
| Estado visual tras el fallo | **"Activado" → "Activado"** (sin estado falso) |
| Feedback | ✅ visible |
| Botón rehabilitado | ✅ |
| Reintento | ✅ segundo request emitido |

**Veredicto: PASS.** No hay rollback porque no hay estado optimista que revertir.

### BUG-04 (ABIERTO, menor) — el indicador de carga miente con toggles concurrentes

`savingPermiso: string | null` sólo representa **un** guardado a la vez.

Reproducción con latencia simulada de 1500 ms: se pulsa el toggle A, a los 200 ms el toggle B.
`savingPermiso` pasa a la clave de B y **A queda `disabled: false` con su request aún en vuelo**
(medido: `t1 → {disabled: false, texto: 'Activado'}` mientras su POST seguía pendiente).
A vuelve a ser clickeable y puede emitir un segundo upsert concurrente sobre la misma fila.

No corrompe datos (el upsert es por `rol,permiso` y es idempotente para el mismo valor), pero
el estado de carga es incorrecto. **Fix propuesto:** `Set<string>` en lugar de `string | null`.
**No aplicado** — bajo impacto, se deja a decisión.

## B. Días Hábiles

### Writes mapeados

| Acción | Handler | Error chequeado | Loading | Veredicto |
|---|---|---|---|---|
| Guardar por entidad | `handleGuardarEntidad:186` | ✅ + `finally` | ✅ `savingKey` | **A** |
| Replicar a Todos | `handleReplicarHabilesATodos:124` | ❌ → **BUG-05** | ✅ `finally` | corregido |
| Editar manual (toggle) | inline `:575` | ❌ → **BUG-05** | — | corregido |
| Sincronizar transcurridos | `syncDiasTranscurridos` (provider) | ❌ → **BUG-05** | ✅ `finally` | corregido |
| Agregar feriado | `handleAgregarFeriado:215` | ✅ vía booleano | ✅ | **A** |
| Editar / Restaurar / Eliminar feriado | `:266 / :320 / :360` | ✅ `if (!ok) throw` | ✅ | **A** |
| Cargar feriados oficiales | `:374` | ✅ `confirm()` + booleano | ✅ | **A** |

### BUG-05 (CORREGIDO) — éxito reportado con todos los writes fallando

**Causa raíz:** `supabase-js` **no lanza** ante un error de PostgREST; devuelve `{ data, error }`.
Tres sitios hacían `await supabase…upsert(…)` sin desestructurar, por lo que el `try/catch`
nunca se activaba.

**Reproducción (antes).** Interceptados los 3 upserts de `dias_habiles_config` con 500:

| Medición | Resultado |
|---|---|
| Filas intentadas | 3 — `Todos`, `Victoria`, `Magali` |
| Todas fallaron | ✅ 500 |
| Toast mostrado | **"Se replicaron 23.5 días hábiles a Punto de Venta y a todos los analistas."** |
| Toast de error | **ninguno** |

**`syncDiasTranscurridos` — respuesta a las preguntas planteadas:**

- *¿Cuántas filas actualiza?* Una por entrada de `diasConfig` filtrada por `forceAll || !d.manual`.
  Con `forceAll = true` (el caso de la UI), **todas**: 3 perfiles activos.
- *¿Qué pasa si falla la fila N?* El bucle continuaba, y además `applyDiasConfigChange('UPDATE', u)`
  se aplicaba igual → el contexto local mostraba valores **nunca persistidos**.
- *¿La UI reporta éxito igualmente?* **Sí.** `handleSincronizarTranscurridos` envuelve la llamada
  en `try/catch`, pero como nada lanzaba, el catch jamás corría.
- *¿Puede quedar estado parcial?* **Sí**, en dos planos: en la base (filas previas a N aplicadas)
  y en pantalla (todas marcadas como actualizadas).

**Corrección** — mismo patrón que ya usaba `handleGuardarEntidad:202`:

```diff
- await supabase.from('dias_habiles_config').upsert(payload, { onConflict: 'analista' });
+ const { error } = await supabase.from('dias_habiles_config').upsert(payload, { onConflict: 'analista' });
+ if (error) throw error;
  applyDiasConfigChange('UPDATE', payload);
```

Aplicado en `DiasHabilesTab:142`, `DiasHabilesTab:575` y `SettingsProvider:244`.
`syncDiasTranscurridos` tiene un único consumidor (`DiasHabilesTab:167`), dentro de `try/catch`
con toast, así que propagar la excepción es seguro.

**Verificación (después):**

| Medición | Resultado |
|---|---|
| Intentos antes de abortar | **1** (antes 3) |
| Mensaje | **"Error al replicar: fallo simulado"** |
| Éxito falso | **no** |
| Botón rehabilitado | ✅ (`finally`) |

`tsc --noEmit` exit 0.

## C. Analistas — **PASS**

El módulo mejor construido del proyecto.

| Acción | Validación | Error | Estado local |
|---|---|---|---|
| `agregar` | nombre vacío → `setError('Ingresá un nombre')`; duplicado → `setError(…)` | ✅ | sólo tras éxito |
| `toggleOculto` | — | ✅ | sólo tras éxito |
| `eliminar` | **verifica integridad referencial**: cuenta `registros` del analista y aborta con mensaje si hay | ✅ en cada paso | sólo tras éxito |

`eliminar` borra las dependencias en orden (`objetivos` → `dias_habiles_config` → `analistas`)
abortando en cada fallo, con el razonamiento documentado en un comentario del propio código.

**Residuo menor:** esos 3 deletes no son transaccionales — si falla el último, quedan los
objetivos y días hábiles ya borrados. El comentario del archivo lo reconoce. Riesgo bajo
(aborta temprano y sólo afecta a un analista sin registros asociados).

## D. Cobranzas — **PASS**

`saveData:257` → `POST /api/cobranzas`, con `try/catch/finally`.

| Medición (POST interceptado, 500) | Resultado |
|---|---|
| `CLICK_LLEGA` | ✅ |
| Durante | **`GUARDANDO…` · `disabled: true`** |
| Después | **`GUARDAR` · `disabled: false`** — el `finally` libera |
| Éxito falso | **no** |
| Mensaje de error | ✅ |
| Requests | 1 |

## E. Bugs nuevos

| # | Ubicación | Estado |
|---|---|---|
| **BUG-04** | `ajustes/page.tsx:202` — `savingPermiso` single-key | **ABIERTO** (menor, fix propuesto) |
| **BUG-05** | `DiasHabilesTab:142`, `:575`, `SettingsProvider:244` — `error` ignorado | **CORREGIDO Y VERIFICADO** |
| **BUG-06** | `registros/page.tsx:1645` — `handleDeleteConfirm` | **CORREGIDO Y VERIFICADO** |

### BUG-06 (CORREGIDO) — eliminación fallida reportada como éxito

Cinco defectos en un solo handler:

```js
setDeleteTarget(null);                                       // 1. cierra el modal ANTES del write
await supabase.from('registros').delete().eq('id', reg.id);  // 2. error ignorado
logAudit({ … accion: 'Eliminación' … });                     // 3. audita un borrado que pudo no ocurrir
applyRegistroChange('DELETE', reg);                          // 4. lo quita de la UI propia…
pushRegistroChange('DELETE', reg);                           //    …y de las demás sesiones, por broadcast
showToast('Registro eliminado', 'success');                  // 5. éxito incondicional
```

**Reproducción (antes).** Bloqueadas todas las escrituras a Supabase:

| Medición | Resultado |
|---|---|
| Writes emitidos | `DELETE registros` (500) **y `POST auditoria`** |
| Toast | **"Registro eliminado"** (éxito) |
| Toast de error | ninguno |
| Modal | cerrado |

La fila reaparecía por el `refresh(true)` posterior, pero el broadcast ya había indicado a las
otras sesiones que la quitaran, y quedaba registrada una auditoría de una eliminación inexistente.

**Corrección:** comprobar `error` antes de todo lo demás; en fallo, toast y `return` dejando el
modal abierto. `setDeleteTarget(null)` se movió después del éxito.

**Verificación (después):**

| Medición | Resultado |
|---|---|
| Writes | sólo `DELETE registros` — **sin `POST auditoria`** |
| Toast de error | ✅ `Error al eliminar el registro` |
| Éxito falso | **no** |
| Modal | **sigue abierto** |
| Reintento | ✅ emite otro DELETE |

### Hallazgos menores sin corregir

`registros/page.tsx:1759` y `:1776` — `recordatorios.update({ mostrado: true })` con `error`
ignorado y eliminación optimista de la lista local. Si falla, el recordatorio desaparece de
pantalla y reaparece al recargar. Severidad baja (estado cosmético).

## F. Writes reales

**0.** Confirmado en cada prueba: toda escritura fue interceptada antes de alcanzar
`supabase.co/rest`, incluidas las de `auditoria`. Donde hubo riesgo de que un handler
escribiera una fila secundaria (la auditoría del borrado), se bloqueó el dominio completo,
no sólo la tabla objetivo.

---

# CHECKPOINT 5 — Cierre de GUARDAR / CREAR / CONFIRMAR / ELIMINAR

**Writes reales: 0.**

## BUG-04 — corregido

### Cambio

`src/app/ajustes/page.tsx:204`

```diff
- const [savingPermiso, setSavingPermiso] = useState<string | null>(null);
+ const [savingPermisos, setSavingPermisos] = useState<Set<string>>(() => new Set());
+ const marcarGuardando   = (key: string) => setSavingPermisos(prev => { const next = new Set(prev); next.add(key);    return next; });
+ const desmarcarGuardando = (key: string) => setSavingPermisos(prev => { const next = new Set(prev); next.delete(key); return next; });
```

Actualización funcional, sin mutar el Set existente. Cada handler añade su clave al iniciar y
elimina **sólo la suya** al terminar. Render: `savingPermisos.has(key)`.
Aplicado a `togglePermiso`, `resetPermisoAnalista` y `resetAllPermisosAnalista`.

### Validación — 2 requests concurrentes con latencias escalonadas

A tarda 4000 ms, B tarda 1200 ms, para que **B termine primero**.

| Paso | Comprobación | Antes | Después |
|---|---|---|---|
| 3 | A `disabled` con A y B en vuelo | ❌ `false` | ✅ `true` |
| 3 | B `disabled` | ✅ | ✅ |
| 3 | ambos muestran `...` | ❌ | ✅ |
| 5 | B habilitado tras terminar | ✅ | ✅ |
| 5 | **A SIGUE `disabled`** | ❌ `false` ← bug | ✅ `true` |
| 7 | ambos habilitados | ✅ | ✅ |
| — | tercer toggle nunca bloqueado | ✅ | ✅ |

Requests reales a Supabase: **0** (ambas interceptadas con 500).

## Recordatorios — corregido, con repro no realizable

### Sitios

`src/app/registros/page.tsx` — dos handlers inline idénticos (badges 🔴 vencido y 🟡 próximo).

```diff
- await supabase.from('recordatorios').update({ mostrado: true }).eq('registro_id', reg.id);
- setRecordatorios(prev => prev.filter(r => r.registro_id !== reg.id));
+ const { error } = await supabase.from('recordatorios').update({ mostrado: true }).eq('registro_id', reg.id);
+ if (error) { showToast('No se pudo marcar el recordatorio', 'error'); return; }
+ setRecordatorios(prev => prev.filter(r => r.registro_id !== reg.id));
```

Matiz respecto del diagnóstico previo: **no era un optimistic update**. El `await` ocurría antes
del `setRecordatorios`; el problema era que la eliminación se hacía **incondicionalmente**, con
éxito o con error. El efecto para el usuario es el mismo (recordatorio desaparece, base con
`mostrado = false`), pero el patrón correcto aquí es esperar el éxito, no añadir rollback — que
es justo lo que pedía la instrucción.

Se usó el `showToast` ya existente en `RegistrosPage`. Al añadirlo, el `useCallback` del render
de fila quedó con una dependencia faltante; se agregó `showToast` a su array (línea 1896).

### ⚠️ Reproducción NO realizada

**No hay ningún recordatorio en el dataset actual**: `document.querySelectorAll('.records-reminder__dismiss').length === 0`
con el filtro de hoy, y tampoco aparecen al ampliar. Crear uno exigiría un write, y la
instrucción es cero writes.

Por tanto este fix está respaldado por lectura de código, `tsc` y por ser **estructuralmente
idéntico** a BUG-05 y BUG-06, ambos sí reproducidos y verificados en navegador. **No está
verificado en navegador.** Queda como candidato para la tanda de writes controlados.

## Barrido Supabase — completo

Escaneo con parser de sentencias sobre todo `src/` (61 writes, no una heurística de líneas).

| Estado | Cantidad |
|---|---|
| `error` desestructurado | **57** |
| Encolados en `ops[]` con agregación posterior | **4** |
| **Que ignoran `error`** | **0** |

| Archivo | Operación | error comprobado | feedback | Acción |
|---|---|---|---|---|
| `ajustes/page.tsx:528` | `upsert(historico_ventas)` | vía `Promise.all` + `results.find(r => r?.error)` → `throw` | `showError` | ninguna |
| `ajustes/page.tsx:531` | `delete(historico_ventas)` | ídem | ídem | ninguna |
| `ajustes/page.tsx:535` | `upsert(objetivos)` | ídem | ídem | ninguna |
| `ajustes/page.tsx:538` | `delete(objetivos)` | ídem | ídem | ninguna |
| resto (57) | insert/update/upsert/delete | ✅ `const { error }` | varía | ninguna |

Los 4 "encolados" son de `saveHistorico`, que agrega los resultados y lanza el primer error:

```js
const results = await Promise.all(ops);
const firstErr = results.find((r: any) => r?.error)?.error;
if (firstErr) throw firstErr;
```

**El patrón quedó eliminado del proyecto.** Los 3 casos que lo tenían (BUG-05 ×3 sitios,
BUG-06, recordatorios ×2 sitios) están corregidos.

## Validación

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit` | **exit 0** |
| Lint `registros/page.tsx` | 8 problemas — **idéntico al baseline**, 0 warnings |
| Lint `ajustes/page.tsx` | 34 — baseline preexistente (28 `no-explicit-any`) |
| Lint `DiasHabilesTab.tsx` | 10 — baseline preexistente |
| Lint `SettingsProvider.tsx` | 2 — baseline preexistente |
| Navegador `/registros` | 50 filas, modal abre y cierra, Guardar presente y habilitado |
| Navegador `/ajustes` | 6 alertas hidratadas, Guardar y Restaurar habilitados, 7 toggles de permisos |
| `settingsLoaded` operativo | ✅ verificado funcionalmente |
| Network | 0 writes reales |

**Nota sobre un warning que introduje y corregí:** el fix de recordatorios añadió
`react-hooks/exhaustive-deps` (`missing dependency: 'showToast'`). Se resolvió añadiendo la
dependencia; el archivo volvió a sus 8 problemas de baseline.

**Nota sobre la consola:** el buffer del panel conserva mensajes entre recargas. Aparece un
`ReferenceError: setSettingsLoaded is not defined` que corresponde a un chunk intermedio de HMR
(se editó `fetchSettings` antes de declarar el `useState`). Descartado funcionalmente: el
provider resuelve, las 6 alertas se hidratan y los permisos cargan. El resto son fallos de
`webpack-hmr` WebSocket por reinicios del servidor — ruido de infraestructura.

## Observación sobre la base compartida

El contador de registros pasó de **7010 a 7011** durante la sesión. Todas las escrituras de la
auditoría estuvieron interceptadas y verificadas como bloqueadas, por lo que lo más probable es
actividad de usuarios reales sobre la base de producción. Se deja anotado.

---

# ESTADO: familia GUARDAR / CREAR / CONFIRMAR / ELIMINAR — **CERRADA**

| Bug | Ubicación | Estado |
|---|---|---|
| BUG-01 | `GestionDiariaClient:491` return mudo | ✅ corregido y verificado |
| BUG-02 | `registros:1049` return mudo | ✅ corregido y verificado |
| BUG-03 | `ComentariosModal` loading infinito | ✅ corregido y verificado |
| BUG-04 | `savingPermiso` single-key | ✅ corregido y verificado |
| BUG-05 | 3 sitios con `error` ignorado | ✅ corregido y verificado |
| BUG-06 | `handleDeleteConfirm` × 5 defectos | ✅ corregido y verificado |
| Recordatorios | 2 sitios con `error` ignorado | ⚠️ corregido, **sin repro en navegador** |
| `saveAlertas` | DELETE-all + hidratación | ✅ reescrito y verificado |

Siguiente familia: **AUTENTICACIÓN / ACCESO SIN LOGIN**.

---

# FAMILIA APARTE — Control de acceso interno basado en cliente

> **Estado: DIAGNOSTICADO, NO INTERVENIDO.**
> Por decisión del responsable del proyecto, esta familia no se corrige en esta auditoría.
> Queda reservada para una *hardening pass* futura. **No se añadió middleware, JWT, RLS ni
> ninguna autenticación nueva.** Todas las pruebas fueron de sólo lectura; **cero writes**.

## A. Modelo actual

```
/login  →  POST /api/admin/login  →  compara ADMIN_PASSWORD server-side (timingSafeEqual)
                                  →  responde { success: true }
        →  el CLIENTE ejecuta setSession({ username:'admin', rol:'admin' })
        →  localStorage['ventas_pro_session'] = JSON plano, sin firma ni token
        →  AuthContext lee ese JSON:  realIsAdmin = user?.rol === 'admin'
        →  AppShell/páginas muestran u ocultan controles
        →  Supabase: cliente SIEMPRE anónimo (supabase.auth nunca se usa)
```

Lo que **sí está bien resuelto**:

- `ADMIN_PASSWORD` se compara **server-side**, con `timingSafeEqual` (resistente a timing).
- **No lleva prefijo `NEXT_PUBLIC_`**: el secreto **no llega al bundle del navegador**.
- No existe ninguna *service-role key* en el proyecto. Las únicas variables son
  `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `ADMIN_PASSWORD`, `NODE_ENV`.

La consecuencia de diseño: el login verifica la contraseña, pero **no emite credencial alguna**.
La "sesión" es un flag en el navegador. El servidor y la base no participan de la autorización.

## B. Sesión anónima — rutas

Sesión certificada limpia: `localStorage` 0 claves, `sessionStorage` 0, 0 cookies.

| Ruta | HTTP | Redirect |
|---|---|---|
| `/`, `/login`, `/registros`, `/gestion-diaria`, `/ajustes`, `/analistas`, `/duplicados`, `/reportes`, `/reportes/cobranzas`, `/publico/resumen-mensual` | **200** | ninguno |
| `/ruta-inexistente` | 404 | — |

No hay `middleware.ts`. Ninguna ruta redirige a login.

## C. Datos sin login

`/registros` en sesión anónima renderizó **7011 registros reales** (nombre completo, CUIL,
empleador, localidad, montos). El menú de administración queda oculto — eso es UI, no autorización.

## D. RLS — estado por tabla

Comprobado en **runtime contra la base real**, con la anon key pública del bundle, usando
`HEAD` + `Prefer: count=exact` (cuenta filas, no las descarga). JWT verificado: `role: "anon"`.

| Tabla | SELECT anon | Filas |
|---|---|---|
| `registros` | ✅ | 7011 |
| `auditoria` | ✅ | 4435 |
| `gestion_diaria` | ✅ | 1956 |
| `objetivos` | ✅ | 186 |
| `historico_ventas` | ✅ | 110 |
| `permisos_roles` | ✅ | 13 |
| `alertas_config` | ✅ | 6 |
| `dias_habiles_config` | ✅ | 6 |
| `analistas` | ✅ | 5 |
| `recordatorios` | ✅ | 5 |
| `configuracion` | ✅ | 3 |
| `cobranzas_data` | ✅ | 1 |
| `bitacora_notas` | ✅ | 0 |

**13 de 13 tablas legibles sin autenticación.**

`supabase-schema.sql:194-197` tiene RLS comentada. Se advirtió explícitamente no confundir
"no veo policy en el repo" con "no hay policy en producción": por eso la tabla anterior es
**evidencia de runtime**, no lectura del repo.

### Escritura anónima — demostrada sin ejecutar ningún write

No hizo falta probarla. `src/lib/supabase.ts` crea el cliente con la anon key y
**`supabase.auth` no se usa en ninguna parte del proyecto**. Por lo tanto *toda* escritura que
la aplicación realiza en producción —cada `insert`, `update`, `upsert` y `delete` auditado en
los checkpoints anteriores— es una escritura anónima. La aplicación funciona a diario, luego
`anon` tiene permisos de escritura sobre esas tablas. Queda demostrado por el funcionamiento
normal del sistema, sin que la auditoría emitiera una sola operación de escritura.

## E. APIs — protección por endpoint

| Endpoint | Métodos | Comprobación | Anónimo | Evidencia |
|---|---|---|---|---|
| `/api/admin/export-xlsx` | POST | header `x-session` enviado por el cliente | **sí** | ver abajo |
| `/api/cobranzas` | GET, POST | **ninguna** | sí | GET 200, 5179 B |
| `/api/historico` | GET | ninguna | sí | 200 |
| `/api/pdv` | GET | ninguna | sí | 200, 9329 B |
| `/api/luciana` | GET | ninguna | sí | 200, 7931 B |
| `/api/nueva-seccion` | GET | ninguna | sí | **200, 416.638 B**, incluye "APELLIDO Y NOMBRE" |

Matiz importante: los route handlers usan **la misma anon key que el navegador**. No conceden
privilegio adicional — exponen lo que un cliente anónimo ya podía pedirle a Supabase
directamente. El problema de fondo sigue siendo la capa de datos, no la capa de API.

`/api/cobranzas` POST hace `upsert` **sin ninguna comprobación**. Auditado estáticamente;
**no se ejecutó**.

### `/api/admin/export-xlsx`

```js
function isAdminSession(req: NextRequest): boolean {
  const header = req.headers.get('x-session');
  const session = JSON.parse(header);
  return session?.rol === 'admin';     // ← el cliente declara su propio rol
}
```

| Petición | Resultado |
|---|---|
| sin `x-session` | **403** `{"error":"Forbidden"}` |
| con `x-session: {"rol":"admin"}` | **200**, **1.160.231 bytes** |

El endpoint es de sólo lectura (`select`), por eso se pudo verificar sin riesgo de escritura.
La comprobación existe pero es declarativa: cualquiera puede afirmar ser admin.

## F. Admin — cliente vs servidor

| Pregunta | Respuesta |
|---|---|
| ¿`isAdmin` es sólo client-side? | **Sí.** `realIsAdmin = user?.rol === 'admin'`, leído de `localStorage` |
| ¿Dónde se valida la contraseña? | **Server-side**, correctamente |
| ¿Se emite cookie o token? | **No** |
| ¿Manipulable desde DevTools? | **Sí**: basta escribir la clave `ventas_pro_session` |
| ¿Los writes verifican admin en backend? | **No.** Ni la API ni la base lo verifican |
| ¿Sólo oculta botones? | **Sí** |

`isAdmin = realIsAdmin && !simulatedAnalista` — la simulación de analista es una función de la
UI, no un control de acceso.

## G. Secretos

**Ninguno llega al navegador.** `ADMIN_PASSWORD` es server-only y nunca se referenció, imprimió
ni copió durante la auditoría. La anon key sí está en el bundle, pero **es pública por diseño**
en Supabase: su rol (`anon`, verificado decodificando el JWT) es exactamente el que RLS debe
acotar. No es un secreto filtrado; es la pieza que depende de RLS para ser inofensiva.

## H. Logout

- **A. Salir del modo administrador** — existe (`AccountActions`).
- **B. Cerrar sesión de aplicación** — `logout()` existe en `AuthContext`: limpia
  `localStorage` y redirige a `/registros`. Pero como `/registros` es accesible sin sesión y
  muestra los datos igualmente, cerrar sesión **no reduce el acceso a la información**.

## I. Hallazgos — todos demostrados

| # | Hallazgo | Evidencia |
|---|---|---|
| AUTH-1 | 13/13 tablas legibles por `anon`, incl. `registros` (7011) y `auditoria` (4435) | runtime, `count=exact` |
| AUTH-2 | `anon` tiene permisos de escritura | funcionamiento normal de la app, sin `supabase.auth` |
| AUTH-3 | `export-xlsx` autoriza con un header del propio cliente | 403 → 200 · 1,1 MB |
| AUTH-4 | 5 endpoints sin ninguna comprobación | HTTP 200 anónimos |
| AUTH-5 | Rol admin almacenado como JSON plano editable en `localStorage` | lectura de `lib/auth.ts` |
| AUTH-6 | Sin `middleware.ts`; ninguna ruta privada redirige | 200 en las 9 rutas |

Lo que **no** es un hallazgo: la contraseña de administrador (bien resuelta, server-side,
`timingSafeEqual`, fuera del bundle) y la ausencia de service-role key (correcta).

## J. Propuesta de corrección — por capas, NO implementada

Ordenada por lo que realmente protege, no por lo que resulta más visible:

1. **Capa de datos (la única que cierra el problema).** Habilitar RLS en las 13 tablas y
   definir policies. Mientras `anon` pueda leer y escribir, ninguna otra capa cambia la
   exposición: un cliente puede hablar con PostgREST directamente, sin pasar por la aplicación.
2. **Identidad real.** Supabase Auth (o equivalente) para que exista un JWT por usuario que las
   policies puedan evaluar. Sin esto, el punto 1 sólo puede distinguir "anon" de "nadie".
3. **Autorización en las APIs.** Validar la sesión server-side en lugar del header `x-session`,
   y proteger `POST /api/cobranzas`.
4. **Guards de ruta.** `middleware.ts` para redirigir a login. **Va al final a propósito:**
   mejora la experiencia y evita exposición accidental de la UI, pero no protege la base.

> **MIDDLEWARE NO ES SEGURIDAD DE BASE DE DATOS. OCULTAR UN BOTÓN NO ES AUTORIZACIÓN.**
> El diagnóstico muestra que la capa rota es la **1**, no la 4.

---

# CHECKPOINT — `1000 → 7011` · **NO ES BUG**

## Cronología de carga

Reconstruida con Resource Timing (la carga completa ocurre en ~4,6 s).

| # | Inicio (ms) | Duración | `order` |
|---|---|---|---|
| 1 | 999 | 1874 ms | `fecha.desc,id.asc` |
| 2–8 | 3532 – 3616 | 391–1081 ms | `fecha.desc,id.asc` |

**Exactamente 8 requests** a `registros` — las 8 páginas esperadas para 7011 filas
(0–999 … 7000–7010). La primera es bloqueante y trae el `count`; **las 7 restantes se disparan
en paralelo** (84 ms de separación entre todas). El desempate determinista está aplicado en las 8.

## Verificación de integridad

| Métrica | Valor |
|---|---|
| COUNT backend (`count=exact`) | **7011** |
| ROWS acumuladas en `RegistrosProvider` | **7011** |
| UNIQUE IDs | **7011** |
| Contador UI | **7011** |
| Duplicados | **0** |
| IDs nulos | **0** |

**Los cuatro coinciden.** No hay filas perdidas ni repetidas. El `1000 → 7011` es carga
progresiva, exactamente como estaba previsto.

## Única observación — UX / data-loading

`RegistrosProvider:103` libera el loading **tras la primera página**, por decisión explícita
documentada en el código (`// Chunk #1: bloqueamos el render hasta tenerlo (≈1 round-trip)`):

```js
setRegistros(firstParsed);
if (!silent) setLoading(false);   // ← aún faltan 7 páginas
```

El contador (`page.tsx:2132`) es `{filteredRegistros.length} registros`, sin calificar.
`loading` sólo se usa en `:2183` para suprimir el falso "sin resultados".

**Consecuencia concreta:** durante ~1,7 s (de ~2873 ms a ~4613 ms) hay 1000 filas con
`loading === false`. Una búsqueda hecha en esa ventana se calcula sobre 1000 de 7011 filas y,
como `loading` ya es `false`, el guard del estado vacío no protege: puede mostrarse
**"sin resultados" siendo falso**.

Clasificado como **UX/data-loading issue**, no como bug de datos. **No se tocó
`RegistrosProvider`, `fetchAllRows` ni los tie-breaks**, conforme a la instrucción.

---

# FASE 6 — `/registros`

## Alta de registros

| Origen | Ruta | UI accesible | Inserta en `registros` |
|---|---|---|---|
| `registros/page.tsx:726` (`persistirRegistro`) | `/registros` | **NO** | ✅ sí |
| `ajustes/CargaRapidaTab.tsx:85` | `/ajustes` → Datos masivos → Carga Rápida | ✅ sí | ✅ sí (importación masiva) |
| `ajustes/BulkModifyTab.tsx:2011` | `/ajustes` → Datos masivos → Corrector | ✅ sí | ✅ sí (flujo masivo) |

### La maquinaria está intacta y es inalcanzable

1. `page.tsx:1365` — `?create=true` → `setIsCreationModalOpen(true)`, y limpia el query param.
2. `page.tsx:1487` — efecto que valida `canPerform('crear_registros')`, hace `setEditingId(null)`,
   carga `initialForm` y abre el modal.
3. `page.tsx:726` — el `insert` real, con `logAudit({ accion: 'Creación' })`.
4. `types/index.ts:126` — el permiso `crear_registros` existe y es configurable en Ajustes.

**Pero nada en el proyecto navega a `?create=true` ni pone `isCreationModalOpen` en `true`.**
El estado vive en `FilterContext` (contexto compartido) justamente para que **otro** componente
lo disparara.

### Clasificación: **D — regresión funcional perdida en la migración del Sidebar**

Evidencia directa del `Sidebar.tsx` eliminado (versión en HEAD):

```
283:  const { setIsCreationModalOpen, showFilters, setShowFilters, pageSize, setPageSize,
             filters, limpiarFiltros, toggleEstado, setFilter } = useFilter();
307:  const canCreate = isAdmin || hasPermiso('crear_registros', currentAnalista);
533:  router.push('/registros?create=true');
535:  setIsCreationModalOpen(true);
```

`git status`: `D  src/components/Sidebar.tsx` (1648 líneas), sustituido por
`RecordsSidebar.tsx` (**61 líneas**), que no porta la función de alta.

### Segunda baja de la misma migración

Productores de estado de `FilterContext` fuera del propio contexto:

| Estado | Consumidores | Situación |
|---|---|---|
| `setFilter` | 25 | ✅ reimplementado en la página |
| `limpiarFiltros` | 7 | ✅ |
| `setShowFilters` | 3 | ✅ |
| `toggleEstado` | 2 | ✅ |
| `setIsCreationModalOpen` | 6 | ❌ ninguno lo pone en `true` |
| **`setPageSize`** | **0** | ❌ **sin productor: el selector de page size desapareció** |

`pageSize` se lee en 6 sitios y queda fijo en su valor inicial de 50. **No se restauró nada.**

## B. Búsqueda — **PASS**

| Caso | Contador | Filas | Requests |
|---|---|---|---|
| `Gimenez` | 62 | 50 | **0** |
| `23-16048204-4` (con guiones) | 1 | 1 | **0** |
| `23160482044` (sin guiones) | 1 | 1 | **0** |
| `zzzzzznoexiste` | 0 | 0 | **0** |
| limpiar | **7011** | 50 | **0** |

Normaliza el CUIL con y sin guiones. Limpiar recupera la huella inicial exacta
(7011 / 50 / misma primera fila). **Filtro 100 % local, cero refetch.**

## C. Filtros — **PASS**

Inventario real del panel: **ANALISTA, ESTADO, DESDE, HASTA, SCORE MÍNIMO, SCORE MÁXIMO,
Limpiar**, más búsqueda, chip de fecha, orden y modo de vista.

| Filtro | ON | OFF | Requests |
|---|---|---|---|
| Score ≥ 700 | 1449 · primera fila cambia | 7011 · fila original | **0** |
| Score mín = 1000000 (fuera de rango) | 0 (correcto: el score llega a 999) | 7011 | **0** |

No existen filtros de monto, acuerdo, etiquetas ni alertas en la UI actual: el viejo Sidebar
destructuraba `setFilter` para más campos. **Se documenta como alcance actual, no se inventa.**

## D. Combinaciones — **PASS**

Score ≥ 900 **+** búsqueda `Gimenez` → **1 resultado** (`Gimenez, Esteban Daniel`), intersección
correcta. Limpieza en **orden inverso** (score primero, búsqueda después):

`1` → `62` (sólo búsqueda) → **`7011` con la primera fila original**.

`RECUPERA_HUELLA_INICIAL: true`. Sin datos stale.

## E. Paginación UI — **PASS**

Controles reales: `← Anterior` / `Siguiente →` (no hay páginas numeradas).

| Acción | Mostrando | Primera fila |
|---|---|---|
| inicio | 50 de 7011 | Gimenez, Angela Beatriz |
| Siguiente | 100 de 7011 | Andrian, Virginia Elizabeth |
| Siguiente | 150 de 7011 | Quiñones, Ezequiel Eduardo |
| Anterior | 100 de 7011 | Andrian, Virginia Elizabeth ✅ coincide |

**Filtro aplicado estando en página 3:** contador 125, "Mostrando **50**" → **se reajusta a la
página 1** correctamente. Sin filas stale ni vacíos artificiales.

## F. Tabs — **PASS**

`Fijados (0)` → el guard de `page.tsx:1630` devuelve automáticamente a `Registros`
(`volvioAutomaticamente: true`). Contador y filas intactos. 0 requests.

## G. Writes bloqueados

| Acción | Estado |
|---|---|
| Fijar / Desfijar | **BLOQUEADO EN WRITE** |
| Editar registro → GUARDAR | auditado en checkpoints previos |
| Teléfono / WhatsApp | auditado (PASS, validación visible) |
| Comentarios | auditado (BUG-03, corregido) |
| Recordatorios | auditado (corregido, sin repro) |
| Eliminar | auditado (BUG-06, corregido) |

Tras los fixes se verificó que el modal de edición abre, cierra y no deja loading stale.

## H. Network

**0 requests a `registros`** provocadas por búsqueda, filtros, combinaciones, paginación o tabs.
Todo el filtrado es local sobre el array ya cargado. El único tráfico de fondo es el polling
conocido de `recordatorios`.

## I. Performance — **única observación de Fase 6**

Long tasks medidas con `PerformanceObserver` (umbral 50 ms):

| Acción | Peor long task |
|---|---|
| Búsqueda `Gimenez` | **531 ms** |
| Búsqueda por CUIL | **408 ms** |
| Limpiar búsqueda | **385 ms** |
| Filtro de score | **410 ms** |
| Score fuera de rango (0 resultados) | 56 ms |

Superan el umbral de 50 ms por un orden de magnitud: el hilo principal se bloquea ~0,4–0,5 s en
cada interacción de filtrado sobre 7011 filas. **No se optimizó nada** — queda medido y
documentado para la fase de performance (16), que es donde corresponde decidirlo.

## Resumen Fase 6

| Sección | Resultado |
|---|---|
| Búsqueda | PASS |
| Filtros | PASS |
| Combinaciones | PASS |
| Paginación | PASS |
| Tabs | PASS |
| Network | PASS (0 refetch) |
| **Alta de registros** | **REGRESIÓN (D) — no corregida** |
| **Selector de page size** | **REGRESIÓN (D) — no corregida** |
| Performance | long tasks 385–531 ms, medidas, sin optimizar |

---

# CHECKPOINT 6 — Regresiones de la migración del Sidebar, corregidas

**No se restauró `Sidebar.tsx`.** Ambas funciones viven ahora en `/registros`.
**Writes reales: 0.** No se ejecutó ningún INSERT.

## A. Nuevo registro

### Antes
Sin punto de entrada. La maquinaria completa (`?create=true` → validación de permiso →
`editingId=null` → modal → INSERT → auditoría `Creación`) existía pero era inalcanzable.

### Después
Botón `+ Nuevo registro` en la toolbar de `/registros` (junto al orden y el selector de vista).
**Reutiliza el flujo existente, sin duplicar la lógica de apertura:**

```jsx
{canPerform('crear_registros') && (
  <button type="button" className="btn-primary records-new-btn"
    onClick={() => setIsCreationModalOpen(true)}>
    <Plus size={16} /> Nuevo registro
  </button>
)}
```

El effect de `page.tsx:1487` sigue siendo el único que valida el permiso, arma el estado inicial
y abre el modal. **No se tocó.**

### Semántica histórica preservada

El Sidebar legacy hacía:

```js
307: const canCreate = isAdmin || hasPermiso('crear_registros', currentAnalista);
533: if (pathname !== '/registros') router.push('/registros?create=true');
535: else setIsCreationModalOpen(true);
```

`canPerform(permiso)` de `page.tsx:1353` ya es `isAdmin || hasPermiso(permiso, target)` — **la
misma condición**. No se inventó ninguna. Y como el botón vive *dentro* de `/registros`, se usa
la rama `setIsCreationModalOpen(true)`, que es exactamente lo que hacía el legacy en esa ruta
(el `router.push` era sólo para llegar desde otras páginas).

### Verificación — 10 puntos

| # | Comprobación | Resultado |
|---|---|---|
| 1 | Botón visible con permiso | ✅ |
| 2 | Click | ✅ |
| 3 | Vía `?create=true` (deep link externo) | ✅ abre y **limpia el query** → URL queda `/registros` |
| 4 | Modal abre | ✅ |
| 5 | Modo creación | ✅ título **"NUEVO REGISTRO"** |
| 6 | Campos vacíos | ✅ **11 de 11 vacíos** |
| 7 | Cancelar presente | ✅ |
| 8 | Modal cierra | ✅ |
| 9 | Query param limpio | ✅ |
| 10 | Writes | ✅ **`[]`** |

## B. Permiso

Condición exacta reutilizada, no reescrita. Nota de la auditoría: en sesión anónima el botón
**sí aparece**, porque `hasPermiso('crear_registros', …)` lo concede al rol por defecto. Eso es
el comportamiento histórico idéntico — el Sidebar legacy mostraba el botón bajo la misma
condición. No es una regresión introducida aquí; depende de la configuración de
`permisos_roles` y del hallazgo ya documentado en la familia de autorización.

## C. Selector de filas por página

### Opciones históricas restauradas, sin inventar

Del Sidebar legacy (`:953-957`): `const sizes = [25, 50, 100, 200]` con **botón cíclico**
(no dropdown), mostrando el valor actual y avanzando con wrap. Reproducido tal cual, incluido
el texto del tooltip.

```jsx
<button className="records-toolbar-btn"
  onClick={() => {
    const sizes = [25, 50, 100, 200];
    setPageSize(sizes[(sizes.indexOf(pageSize || 25) + 1) % sizes.length]);
  }}
  title={`Mostrando ${pageSize || 25} filas por página. Hacé clic para cambiar a 25, 50, 100 o 200.`}>
  <Rows3 size={16} /> {pageSize || 25}
</button>
```

Ubicado junto al contador, el orden y los controles de tabla. **No se puso en `RecordsSidebar`.**

### Corrección sobre la marcha

Se había añadido un clamp manual de `currentPage`. Al probarlo se descubrió que
`FilterContext:117` ya tiene `useEffect(() => setCurrentPage(1), [filters, pageSize])`: **el
reset a página 1 es la semántica histórica preexistente**, vive en el contexto y nunca estuvo en
el Sidebar. El clamp era código muerto y **se eliminó**, dejando el handler en 2 líneas.

### Verificación — las 4 opciones

| Tamaño | Filas renderizadas | Total de páginas | Requests |
|---|---|---|---|
| 50 (inicial) | 50 | 141 | — |
| **100** | 100 | 71 | **0** |
| **200** | 200 | 36 | **0** |
| **25** | 25 | 281 | **0** |
| **50** (vuelve al original) | 50 | 141 | **0** |

`totalPages` recalcula correctamente en los 4 casos (7013/100=71, /200=36, /25=281, /50=141).

| Escenario | Resultado |
|---|---|
| Última página con tamaño 25 (pág. 281, 13 filas) → cambiar a 50 | página **1**, 50 filas, válida ✅ |
| Página inválida | **nunca** — `PAGINA_VALIDA: true`, `SIN_PAGINA_VACIA: true` |
| Con búsqueda activa (`Gimenez`, 62 resultados) → cambiar tamaño | 62 preservados, "Mostrando 25 de 62", 3 páginas ✅ |
| Anterior / Siguiente | ✅ |
| Refetch de `registros` | **0 en todos los casos** |

## D. Browser

| Entorno | Resultado |
|---|---|
| Desktop | ambos controles en la toolbar, junto a orden y vista; layout limpio |
| **390 × 844** | `scrollWidth 390 = innerWidth` → **sin overflow horizontal**; toolbar hace `flex-wrap: wrap`; ambos botones 40 px de alto, `clickLlega: true`, dentro del viewport (197+129=326 < 390) |

No chocan con la búsqueda ni con Filtros.

## E. Network

**0 refetch** de `registros` provocado por el botón de alta o por cualquiera de los 4 cambios de
tamaño de página.

## F. Writes

**0.** El modal de alta se abrió y se canceló; nunca se pulsó Guardar.

## Validación

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit` | **exit 0** |
| Lint `registros/page.tsx` | **8 problemas — idéntico al baseline**, 0 warnings |
| Navegador | ambos flujos verificados |
| Console | sólo `webpack-hmr`, realtime WS y `ERR_NETWORK_IO_SUSPENDED` (suspensión de la máquina) — ruido de infraestructura |
| Diff | 3 archivos: `registros/page.tsx` (import, destructuring, 2 controles), `globals.css` (1 regla `.records-new-btn`) |

Fuera de alcance en este lote, como se indicó: loading progresivo, long tasks, algoritmo de
filtrado, autenticación, ZoomWrapper y el Sidebar antiguo.

---

# FASE 6 — **CERRADA**

| Sección | Resultado |
|---|---|
| Búsqueda | PASS |
| Filtros | PASS |
| Combinaciones | PASS |
| Paginación | PASS |
| Tabs | PASS |
| Network | PASS (0 refetch) |
| Alta de registros | ✅ **regresión corregida y verificada** |
| Selector de page size | ✅ **regresión corregida y verificada** |
| Performance | long tasks 385–531 ms → **diferido a Fase 16** |

Siguiente: **REPORTES → ANALISTAS → DUPLICADOS**.

---

# FASES 9 · 10 · 11 — Reportes, Analistas, Duplicados

**Writes reales: 0.** Todo en sesión anónima (consecuencia de la auditoría de autorización).

## FASE 9 — Reportes

### Navegación

`/reportes` es un hub con 2 tarjetas, sin tablas ni gráficos propios:

| Tarjeta | Destino | Estado |
|---|---|---|
| Rendimiento de Analistas | `/analistas?analista=PDV` | ✅ navega |
| Reporte de Cobranzas | `/reportes/cobranzas` | ✅ navega |

`/reportes/cobranzas` carga 4 tablas, 48 filas y 3 gráficos.

### 🔴 COB-1 — Importes guardados como cadenas con formatos de locale mezclados

`cobranzas_data` almacena `objetivo` y `recupero` como **strings preformateados**, y la UI los
imprime **verbatim** (`CobranzasClient:88,95` renderizan `{r.objetivo}` / `{r.recupero}` sin
formatear). En la misma columna conviven 4 formatos:

| Formato | Ejemplo real | Meses |
|---|---|---|
| es-AR con decimales | `1.310.000,00` | Enero–Mayo |
| **en-US** | `1,833,585.79` · `998,381.80` | Mayo (tramo90 y tramo120) |
| sin separador decimal | `933,619` | Mayo (refin) |
| con símbolo `$` | `$ 2.049.000` | Junio–Agosto |

`pct` también cambia de naturaleza: `92.39` / `64.91` (2 decimales) en Ene–May frente a
`55.68711300309598` / `73.88847697878946` (float crudo) en Jun–Ago → **dos vías de escritura
distintas** produjeron los mismos campos.

### 🔴 COB-2 — `parseNumberRobust` falla en el caso ambiguo, y editar la fila lo propaga

`CobranzasClient:197-207` **recalcula** `cumplimiento` y `pct` cuando se edita `objetivo` o
`recupero`, usando `parseNumberRobust`. Probado contra los 7 formatos reales de la base:

| Valor | Esperado | Obtenido | |
|---|---|---|---|
| `1.310.000,00` | 1310000 | 1310000 | ✅ |
| `1,833,585.79` | 1833585.79 | 1833585.79 | ✅ |
| `$ 2.049.000` | 2049000 | 2049000 | ✅ |
| `2.877.000` | 2877000 | 2877000 | ✅ |
| `998,381.80` | 998381.8 | 998381.8 | ✅ |
| `1.213.000,00` | 1213000 | 1213000 | ✅ |
| **`933,619`** | **933619** | **933.619** | ❌ |

6 de 7 correctos. El fallo es `933,619`, genuinamente ambiguo: el parser lo lee como decimal
es-AR (933,619 → 933.619), pero el `pct` almacenado (46,22) implica 933619.

**Consecuencia medida:** recalcular esa fila da **0,05 %** en lugar de **46,22 %** — un factor
de ~1000. Basta con que alguien edite el objetivo o el recupero de *refin / Mayo* (incluso
reescribiendo el mismo valor) para que el cumplimiento se corrompa, y guardar lo persiste.

La causa raíz no es el parser, es el almacenamiento: importes como texto dependiente de locale
en lugar de números.

**⚠️ Reproducción en navegador BLOQUEADA:** el botón `EDITAR DATOS` requiere admin y la sesión
quedó anónima tras la auditoría de autorización. La demostración es estática (valores reales de
la API + ejecución del parser real) más lectura del cableado en `:197-207`. **No verificado en
navegador.**

## FASE 10 — Analistas

`/analistas?analista=PDV` carga en ~2,2 s con 6 gráficos y 5 selectores.

### KPIs contrastados contra los datos crudos

Datos reales de octubre 2026 (lectura directa a `registros`): 3 filas — dos
`derivado / aprobado cc` de $2.000.000 y $1.000.000, ambas *Apertura*, más una `afectaciones`
sin monto.

| KPI en pantalla | Esperado | ¿Correcto? |
|---|---|---|
| Capital vendido `$ 3.000.000` | 2.000.000 + 1.000.000 | ✅ |
| Operaciones `2` | 2 | ✅ |
| Aperturas `2` / Renovaciones `0` | 2 / 0 | ✅ |
| `3 clientes ingresados` | 3 | ✅ |
| Conversión total `66.7%` | 2/3 | ✅ |
| **Ticket promedio `$ 3.000.000`** | 3.000.000 / 2 = **1.500.000** | ❌ ver KPI-1 |

### 🟠 KPI-1 — "Ticket promedio" designa dos métricas distintas según el módulo

| Módulo | Fórmula | Significado real |
|---|---|---|
| `ComparativaAnalistasTab:150` | `capital / ventasQ` | ticket medio por operación |
| `ResumenMensualTab:633` | `capital / diasTrans` | **capital por día hábil** |
| `analistas/page.tsx:403` | `capital / diasDivisor` | **capital por día hábil** |

No es un error aritmético: con `diasTrans = 1` (hoy es 1 de octubre), 3.000.000 / 1 = 3.000.000,
y el número mostrado es coherente con *su* fórmula.

El problema es de **semántica duplicada y divergente**: la misma etiqueta nombra dos métricas
incompatibles. Y dentro de `analistas/page.tsx` la evidencia es directa —

```js
403:  const ticket      = diasDivisor > 0 ? capital / diasDivisor : 0;
406:  const ventaPorDia = diasDivisor > 0 ? capital / diasDivisor : null;
```

**la misma expresión exacta con dos nombres.** Quien compare "Ticket promedio" entre
`/analistas` y Comparativa de Analistas obtendrá cifras contradictorias sin que nada lo advierta.

Conecta con la duplicación ya conocida entre Ajustes>Analistas, Reportes, Resumen Mensual y el
link público: aquí esa duplicación **ya divergió en la definición**, no sólo en el código.

**No corregido** — requiere definición funcional: decidir qué métrica debe llamarse así.

## FASE 11 — Duplicados

| Medición | Valor |
|---|---|
| Casos detectados | **1351** |
| Filas en el DOM | **4122** (todos los grupos expandidos, sin virtualización) |
| Tiempo hasta contenido | ~5,5 s |
| Long tasks > 50 ms al filtrar | **0** |
| Filtro `afectaciones` | 1351 → **6 casos**, 4122 → **12 filas** |
| Desactivar el filtro | restaura exacto (`restauro: true`) |

### ✅ El O(n²) no volvió

Filtrar sobre 1351 grupos / 4122 filas **no produce ni una long task > 50 ms**. El problema
histórico de varios segundos sigue resuelto.

### Observación

4122 filas en el DOM sin virtualización es el coste estructural de la vista. Hoy no se traduce
en bloqueo medible, pero es el factor que más pesa en los ~5,5 s de carga inicial.

### ⚠️ Equivalencia con Ajustes > Duplicados — NO verificada

Requiere sesión admin. Pendiente.

## Bloqueado por sesión

Tras la auditoría de autorización la sesión quedó anónima. Quedan sin verificar:

| Ítem | Fase |
|---|---|
| Repro en navegador de COB-2 (`EDITAR DATOS`) | 9 |
| Equivalencia Duplicados ↔ Ajustes > Duplicados | 11 |
| Export XLSX desde la UI | 9 |

Para cerrarlos hace falta iniciar sesión en `http://localhost:3200/login`.

---

# CHECKPOINT 7 — Admin bloqueados + perfilado

**Writes reales: 0.** Sesión admin iniciada manualmente por el responsable.

## A. Los tres ítems admin — CERRADOS

### A.1 COB-2 — **REPRODUCIDO EN NAVEGADOR**

`/reportes/cobranzas` → `EDITAR DATOS` → fila *refin / Mayo* (`2.020.000,00` · `933,619` · `46.22`).

| Valor escrito en `recupero` | Cumplimiento resultante |
|---|---|
| `933,619` (original, sin tocar) | **46.22** |
| `933,619` reescrito idéntico | 46.22 — React deduplica el `onChange`, el handler no corre |
| `933,620` (mismo formato, 1 dígito distinto) | **0,0** ← se corrompe |
| `933620` (sin separador, inequívoco) | **46,2** ← correcto |
| vuelta a `933,619` | **0,0** ← queda corrupto |

Lo más revelador: **el 46.22 almacenado es inalcanzable desde la UI.** Cualquier edición de esa
fila lo destruye, y escribir el importe sin separador lo recupera — lo que prueba que la
ambigüedad del separador es la causa exacta.

`WRITES_TOTALES: []`. Se canceló; la fila volvió a `933,619 | 46.22` en la base.

**Clasificación: DECISIÓN DE MODELO DE DATOS / MIGRACIÓN.** No se parcheó `parseNumberRobust`:
el parser acierta en 6 de 7 formatos y el caso que falla es genuinamente ambiguo. El problema es
persistir importes como texto dependiente de locale.

### A.2 Equivalencia Duplicados — **OK**

| Vista | Grupos | Fuente | Orden |
|---|---|---|---|
| `/duplicados` | **1351** | `useRegistros()` → RegistrosProvider | `fecha.desc, id.asc` |
| `Ajustes > Datos masivos > Duplicados` | **1351** | fetch propio con `fetchAllRows` | `created_at.desc, id.asc` |

Coinciden exactamente, incluido el primer grupo (`27167873249`, 14 registros). **Ambas consultas
llevan desempate por `id`** — se verificó leyendo el bloque completo de `ajustes/page.tsx:402-410`,
no sólo la línea del `order`. `RegistrosProvider`: **7013 ROWS / 7013 UNIQUE / 0 duplicados**.

### A.3 Export XLSX — **OK**

| Comprobación | Resultado |
|---|---|
| Botón visible (admin) | ✅ |
| Modal abre | ✅ con el set completo de filtros |
| Requests al abrir | **0** → on-demand ✅ |
| Vista previa | **1 sola** `POST /api/admin/export-xlsx` |
| HTTP | 200 |
| Count | **"Vista previa — 7013 registros"**, tabla de 7014 filas (7013 + cabecera) |
| Coincide con registros actuales | ✅ 7013 = 7013 (`RegistrosProvider`) |
| Descargas realizadas | **0** (no necesarias: preview + endpoint certifican el flujo) |

## B. Performance `/registros` — **CORRECCIÓN DE UN HALLAZGO PROPIO**

### Coste de cálculo puro, medido sobre los 7013 registros reales

| Operación | ms |
|---|---|
| Construir índice de búsqueda (7013) | **14,3** |
| Filtrar con índice | **2,8** |
| Filtrar sin índice, normalizando cada vez | **17,3** |
| `sort` completo (7013) | **6,3** |

Todo el pipeline junto ≈ **38 ms en el peor caso**. El cálculo **no** es el cuello de botella.

### Interacción real

| Escenario | Long tasks > 50 ms |
|---|---|
| 6 interacciones sobre página asentada (2 búsquedas, 2 limpiezas, score on/off) | **0** |
| Filtrado inmediatamente tras recarga, durante la ventana de carga | **0** |
| Una corrida aislada anterior | 1 × 77 ms |

### ❌ Los 385–531 ms de la Fase 6 NO son reproducibles

No se reprodujeron **en ninguna condición**: ni en estado estable, ni en carga fresca, ni
filtrando mientras llegaban páginas. Aquellas mediciones se tomaron en la primera carga en frío,
con gráficos y providers montando y con el propio arnés envolviendo `window.fetch`.

**Conclusión honesta: no hay problema de performance demostrable en el filtrado de `/registros`.**
No hay nada que optimizar aquí. El hallazgo de Fase 6 queda retirado.

## C. Impacto real del loading parcial

| Medición | Resultado |
|---|---|
| Contador al primer render (esta corrida) | **7013** — la ventana no se manifestó |
| Búsqueda `Gimenez` durante la carga | **62** |
| Misma búsqueda tras completar la carga | **62** |
| ¿Cambió el resultado? | **NO** |

La ventana sigue existiendo **estructuralmente** (`RegistrosProvider:103` libera `loading` tras
la primera página, por decisión documentada), y se observó una pantalla con "1000 registros"
durante la auditoría. Pero **no se logró provocar un resultado divergente**: la carga completa
es lo bastante rápida en este entorno.

**No se abre BUG.** Queda como riesgo estructural documentado, sin impacto medido.

## D. Carga de `/duplicados` — desglose

| Componente | Medición |
|---|---|
| **Red (wall clock hasta la última respuesta)** | **4598 ms** |
| Suma de duraciones de requests (en paralelo) | 25.072 ms en 21 requests |
| `domContentLoaded` / `load` | 204 ms / 474 ms |
| **Long tasks > 50 ms** | **0** |
| Bloqueo total de JS | **0 ms** |
| Nodos DOM | **64.299** (4122 filas) |
| Grupos | 1351 |

Las 21 requests incluyen **8 páginas de `registros`** (terminan entre 3086 y 4598 ms) más
`gestion_diaria`, `recordatorios` ×4, `objetivos`, `historico_ventas`, `analistas`,
`permisos_roles`, `alertas_config`, `dias_habiles_config` y `configuracion`.

### Conclusión — contradice la hipótesis de partida

Se esperaba que el principal candidato fuera DOM/render. **Los datos dicen que no:** el coste es
**de red (~4,6 s)**, con **cero bloqueo de JS**. Ni el agrupamiento de duplicados ni la creación
de 64.299 nodos producen una sola long task.

**Virtualizar no reduciría el tiempo de carga**, porque el tiempo no se va en renderizar. El
beneficio potencial de la virtualización sería de memoria y de fluidez al hacer scroll, no de
carga inicial. **Beneficio cuantificado: bajo.** No se implementa.

## E. UseEffects — auditoría dirigida

84 `useEffect` en el proyecto. Revisión acotada a las categorías con riesgo real:

| Categoría | Resultado |
|---|---|
| Subscriptions realtime | **4 de 4 con cleanup** (`ajustes/page`, `registros/page`, `BitacoraModal`, `GestionDiariaProvider`) |
| `setInterval` | **5 de 5 con `clearInterval`** |
| Effects con fetch | usan guard de cancelación (`isCancelled` / `cancelado` / `active`) |
| `setState` síncrono en effect | 13 avisos de lint, **preexistentes**, ya contabilizados en el baseline |
| Dependencias faltantes | **9 avisos**: 8 en `useMemo`, 1 en `useEffect` (`:305`, falta `extraIndices`) |

**Sin anomalías demostrables.** Los 9 avisos de dependencias son riesgo latente de memo obsoleto,
no fallos reproducidos. No se corrigió ninguno.

## Correcciones a hallazgos propios en este checkpoint

1. **`ajustes/page.tsx:407` sí tiene desempate por `id`.** Un grep recortado había mostrado sólo
   la línea del `created_at`; el bloque completo incluye `.order('id', { ascending: true })`.
2. **Los long tasks de 385–531 ms en `/registros` no son reproducibles.** Hallazgo retirado.
3. **Dos "timeouts" de scripts atribuidos a lentitud eran condiciones de polling propias**
   (esperar `innerText.length > 800` en una página de 437 caracteres; esperar `tbody tr` en una
   vista que renderiza tarjetas). Ninguna lentitud de la aplicación.

---

# CIERRE — Auditoría funcional completa

**Writes reales a producción en toda la auditoría: 0.**

## A. Funciones probadas — matriz

| Área | Resultado |
|---|---|
| `/registros` — búsqueda (nombre, CUIL con y sin guiones, sin resultados, limpiar) | **PASS** |
| `/registros` — filtros (analista, estado, fechas, score) | **PASS** |
| `/registros` — combinaciones + limpieza en orden inverso | **PASS** |
| `/registros` — paginación (Anterior/Siguiente, reajuste al filtrar desde pág. >1) | **PASS** |
| `/registros` — tabs (guard de Fijados vacío) | **PASS** |
| `/registros` — alta de registros | **PASS** (regresión corregida) |
| `/registros` — selector de filas por página | **PASS** (regresión corregida) |
| Modales: Editar, Teléfono, Comentarios, Bitácora, Eliminar | **PASS** |
| `/gestion-diaria` — alta, comentarios | **PASS** |
| `/ajustes` — Alertas, Días Hábiles, Roles y Permisos, Analistas | **PASS** |
| `/reportes` — navegación | **PASS** |
| `/reportes/cobranzas` — tablas, gráficos, edición | **FAIL** (COB-2) |
| `/analistas` — KPIs contra datos crudos | **PASS** salvo KPI-1 |
| `/duplicados` — carga, agrupación, filtros, equivalencia con Ajustes | **PASS** |
| Export XLSX | **PASS** |
| Responsive 390px (7 rutas) | **PASS** |
| Escrituras reales | **BLOQUEADAS por diseño de la auditoría** |

## B. Bugs corregidos — 6

| # | Ubicación | Causa | Validación |
|---|---|---|---|
| **BUG-01** | `GestionDiariaClient:491` | `return` mudo en `guardar()`: único return del archivo sin `setActionError` | mensaje visible, 0 requests, `tsc` 0 |
| **BUG-02** | `registros/page.tsx:1049` | `if (!name) return;` mudo al agregar localidad | 5 escenarios de `disabled`, 0 requests |
| **BUG-03** | `ComentariosModal` | `saving` nunca volvía a `false`: efecto con dep `[registro]` que no se re-disparaba | PATCH interceptado → botón rehabilitado, reintento OK |
| **BUG-04** | `ajustes/page.tsx:204` | `savingPermiso` como `string` único: una 2ª petición pisaba la clave de la 1ª | test de 7 pasos con latencias escalonadas |
| **BUG-05** | `DiasHabilesTab:142,575` + `SettingsProvider:244` | `supabase-js` no lanza ante error PostgREST; 3 sitios no desestructuraban `error` → éxito falso | 3 upserts en 500 → "Error al replicar", aborta en el 1º |
| **BUG-06** | `registros/page.tsx:1645` | 5 defectos: cerraba antes del write, ignoraba error, auditaba un borrado inexistente, emitía broadcast DELETE y mostraba éxito | sin auditoría falsa, modal abierto, reintento OK |

Además: `saveAlertas` reescrito (DELETE-all de 7 operaciones → **1 upsert atómico**, con
hidratación explícita vía `settingsLoaded`), y 2 sitios de `recordatorios` con `error` ignorado.

## C. Bugs abiertos

### Requieren decisión funcional

**KPI-1 — "Ticket promedio" designa dos métricas distintas.**
`ComparativaAnalistasTab:150` usa `capital / operaciones`; `ResumenMensualTab:633` y
`analistas/page:403` usan `capital / días transcurridos`. En `analistas/page` la evidencia es
literal: la línea 403 (`ticket`) y la 406 (`ventaPorDia`) son **la misma expresión**.
No se corrige hasta definir qué significa el término.

### Requieren decisión de modelo de datos

**COB-2 — importes de cobranzas persistidos como texto con locales ambiguos.**
`933,619` puede ser 933619 o 933.619. La aplicación interpreta la segunda al editar.
Reproducido en navegador: el valor almacenado (46,22 %) es **inalcanzable desde la UI** —
cualquier edición de esa fila lo lleva a 0,0 %, y escribirlo sin separador lo recupera.
`parseNumberRobust` acierta en 6 de 7 formatos reales; no se parchea porque el caso que falla
es genuinamente ambiguo. **No hay arreglo seguro sin definir la convención de datos.**

### Técnicos

Ninguno pendiente. Los dos restantes son de las familias explícitamente diferidas
(autorización, y la duplicación de KPIs).

## D. Código muerto eliminado

Barrido con `scripts/code-audit.mjs` + verificación manual incluyendo tests, scripts y
`dynamic()`. **0 ciclos de imports.** De 33 exports señalados:

| Símbolo | Clasificación | Acción |
|---|---|---|
| `isAdmin` (`lib/auth`) | **A — muerto** (los 75 "usos" eran la variable homónima de `AuthContext`) | **eliminado** |
| `ESTADOS_MAP` (`types/index`) | **A — muerto** | **eliminado** |
| `CARGA_FIELD_LABELS` (`lib/carga-rapida-utils`) | **A — muerto** | **eliminado** |
| `calcularComisiones`, `calcularDiasHabilesAutomaticos` (`lib/utils`) | **A — muerto**, pero son reglas de negocio y la única implementación existente | **conservados** y reportados |
| `esJornadaCerrada` (`lib/dias-habiles`) | **B — API local de un módulo cohesivo** cuyos hermanos sí se usan | conservado |
| `SUPABASE_PAGE_SIZE` | **D — falso positivo**: lo consume `supabase-paginate.test.ts` | conservado |
| 20 tipos/interfaces exportados | **B — legítimos** | conservados |

`tsc` exit 0 tras las eliminaciones; sin imports huérfanos.
No se persiguió el cero artificialmente.

## E. Duplicación — cuantificada, NO extraída

31 nombres definidos en más de un archivo. Los relevantes: `baseChartOpts` (4×),
`getGradient` (4×), `sectionHeader` (4×), `tendBadge` (3×), `classify` (3×), `cumplColor` (3×).

**No se extrae en este cierre**, por decisión explícita: los contextos difieren y **KPI-1 ya
demostró que la duplicación divergió en la semántica**, no sólo en el código. Unificar sin
definir antes la métrica consolidaría una ambigüedad.

Clasificación: **DEUDA TÉCNICA / REQUIERE DEFINICIÓN DE NEGOCIO.**

## F. Performance — sólo lo reproducible

| Hallazgo | Estado |
|---|---|
| `/registros` filtrado: 385–531 ms | **RETIRADO** — no reproducible en ninguna condición |
| `/registros` cálculo puro (7013 filas) | índice 14,3 ms · filtrar 2,8 ms · sort 6,3 ms → **≈38 ms peor caso** |
| `/registros` long tasks en 6 interacciones | **0** |
| `/duplicados` carga ~5,5 s | **dominada por red: 4598 ms**, 21 requests |
| `/duplicados` long tasks | **0** · bloqueo de JS: **0 ms** |
| `/duplicados` nodos DOM | 64.299 |

**Virtualizar no reduciría la carga de `/duplicados`**: el tiempo no se va en renderizar.
Beneficio potencial cuantificado: bajo. No se implementó.

## G. Network / Data correctness

| Verificación | Resultado |
|---|---|
| Truncamiento a 1000 | **no reapareció** — 8 páginas, COUNT = ROWS = UNIQUE = UI = 7011/7013 |
| Orden determinista | `fecha.desc,id.asc` (RegistrosProvider) · `created_at.desc,id.asc` (Ajustes) |
| IDs duplicados | **0** |
| Refetch al filtrar localmente | **0** en búsqueda, filtros, combinaciones, paginación, tabs y page size |
| Export al montar | **no** — on-demand, 1 sola POST |
| Loops / requests duplicadas obvias | ninguna |
| Equivalencia `/duplicados` ↔ Ajustes | **1351 = 1351** |
| Export XLSX vs registros actuales | **7013 = 7013** |

## H. Responsive — 390 × 844, pestaña limpia

| Ruta | Overflow | Botones inalcanzables |
|---|---|---|
| `/registros` | no | **0** (los fuera de viewport tienen ancestro con scroll) |
| `/gestion-diaria` | no | 0 |
| `/ajustes` | no | 0 |
| `/analistas` | no | 0 |
| `/duplicados` | no | 0 |
| `/reportes/cobranzas` | no | 0 |

`Nuevo registro`, selector de page size, búsqueda, filtros, paginación, modales, tablas,
gráficos y AccountActions: todos accesibles. **Sin bugs de responsive.**

## I. Console

**Errores reales = 0.**

28 mensajes en pestaña limpia recorriendo las 7 rutas: `[HMR] connected`, `[Fast Refresh]`,
el aviso de React DevTools y un warn de preload de CSS de Next. Todo ruido de framework.

Los errores vistos durante la auditoría (`webpack-hmr` WebSocket, realtime WS,
`ERR_NETWORK_IO_SUSPENDED`, un `ReferenceError` de chunk intermedio) quedaron confirmados como
**buffer contaminado por HMR y reinicios del servidor**, no como errores de aplicación.

## J. Métricas

| | Inicio | Final |
|---|---|---|
| `tsc --noEmit` | exit 0 | **exit 0** |
| Tests | 25 | **25 pass / 0 fail** |
| `npm run build` | — | **exit 0**, 18/18 páginas |
| Lint global | 278 | **278** (232 `no-explicit-any`, 28 `set-state-in-effect`, 9 `exhaustive-deps`, 9 varios) |
| Ciclos de imports | — | **0** |
| `git diff --check` | — | **limpio** |
| Bugs corregidos | 0 | **6** + `saveAlertas` + recordatorios |
| Regresiones recuperadas | 0 | **2** |
| Exports muertos eliminados | 0 | **3** |

El lint se mantiene en 278 a propósito: no se introdujo ninguna violación nueva (se detectó y
corrigió un `exhaustive-deps` propio durante el trabajo) y no se corrigieron las preexistentes,
que son deuda de estilo/tipos sin bug asociado.

## K. Git

```
106 entradas:  51 M  ·  48 ??  ·  7 D
```

(103 al inicio; +3 por `AUDITORIA-FUNCIONAL.md` y archivos nuevos del trabajo.)
**No se ejecutó** `reset`, `restore`, `checkout`, `clean`, `stash`, `commit` ni `push`.
Nada quedó en *staging* por la auditoría.

## L. Veredicto

| Severidad | Hallazgo | Evidencia |
|---|---|---|
| **P0** | Ninguno dentro del alcance funcional | — |
| **P1** | **COB-2** — corrupción silenciosa de cumplimiento al editar cobranzas | reproducido en navegador: 46,22 % → 0,0 % |
| **P1** | *(familia diferida)* control de acceso basado en cliente | 13/13 tablas legibles por `anon`; `export-xlsx` autoriza con un header del cliente |
| **P2** | **KPI-1** — "Ticket promedio" con dos definiciones | `ticket` y `ventaPorDia` son la misma expresión |
| **P2** | Duplicación de helpers de gráficos (31 nombres) | deuda técnica |
| **P2** | `calcularComisiones` / `calcularDiasHabilesAutomaticos` sin consumidor | reglas de negocio desconectadas |

### Estado

**AUDITORÍA FUNCIONAL TERMINADA.**

Las fases 17–20 no descubrieron ningún bug nuevo: 0 ciclos de imports, 0 errores de consola,
0 problemas de responsive, build y tests en verde. Los dos hallazgos abiertos (COB-2 y KPI-1)
**no son defectos de implementación**: ambos requieren una definición previa —de convención de
datos uno, de significado de negocio el otro— y corregirlos sin esa definición consolidaría la
ambigüedad en lugar de resolverla.

No se abren más refactors por tamaño.

---

# ADENDA — Regresiones de migración detectadas por diff contra el último push

Motivo: la auditoría comparó **comportamiento contra el código actual**, nunca **la UI actual
contra la del último push**. Eso dejó pasar pérdidas de columnas y controles. Este barrido
corrige ese punto ciego.

## BUG-07 (CORREGIDO) — columna `Calif.` perdida en `/registros`

| | Columnas |
|---|---|
| Push `19f881e` | `Cliente \| CUIL · Gestión · Fecha · Score · Monto · **Calif.** · **Tipo / Acuerdo** · Acciones` (8) |
| Antes del fix | `Cliente \| CUIL · Gestión · Fecha · Score · Monto · Estado / Tipo · Acciones` (7) |

La migración colapsó dos campos independientes en una celda:

```js
const estado = reg.tipo_cliente || (reg.estado ? capitalizado : '—');
```

Con `||`, el **estado desaparece** cuando hay `tipo_cliente`.

**Impacto medido: 6096 de 7013 registros (86,9 %)** tienen ambos campos → en todos ellos el
estado era invisible. La cabecera decía "Estado / Tipo" mostrando sólo el Tipo.

### Corrección

Se restauraron las dos columnas del push, reutilizando el idioma CSS actual
(`.status-badge`, ya usado por Ajustes y Duplicados) en lugar de recrear estilos legacy.
Se mantuvo el rótulo `Calif.` tal como estaba — restaurar, no redefinir producto.

| Verificación | Resultado |
|---|---|
| Columnas | **8** |
| Alineación header/body | **8 = 8** |
| Fila ejemplo | Calif. `Derivado / Aprobado Cc` · Tipo/Acuerdo `Apertura` + `RIESGO MEDIO` |
| Los 3 valores simultáneos | ✅ |
| Desktop | ✅ |
| 390 px | ✅ Calif. visible, Acciones accesible, scroll horizontal OK, sin overflow de página |
| `tsc` / lint / `diff --check` | 0 · 8 (baseline) · limpio |
| Writes | **0** |

Commit: `9a65a2f` — `fix(registros): restaurar columna Calif y Tipo/Acuerdo`

## Inventario del barrido

### A. Regresiones reales

| Ruta | Elemento perdido | Antes (`19f881e`) | Ahora | Impacto |
|---|---|---|---|---|
| `/registros` | columna `Calif.` | estado en columna propia | fusionado con `\|\|` | 86,9 % de registros sin estado visible — **CORREGIDO** |
| `/ajustes` → Datos masivos | **5 controles de edición masiva** | 11 `fieldSection`: acuerdo_precios, analista, **comentarios**, cuotas, empleador, **es_re**, estado, **localidad**, **rango_etario**, **sexo**, tipo_cliente | sólo 6 controles | **ABIERTO** |

**Detalle de la segunda.** El camino de escritura está **intacto** —`updates.*` sigue aplicando
los 11 campos— pero sólo 6 tienen control de UI (`setCampos` cayó de 25 a 14 llamadas, todas
entre las líneas 3397-3446). Sin control: `comentarios`, `es_re`, `localidad`, `rango_etario`,
`sexo`. Es el mismo patrón que el alta de registros y el selector de page size: **la capacidad
existe y es inalcanzable**.

El caso de `comentarios` es el más visible: el viejo tenía
`fieldSection('Comentarios (agregar al final)', <textarea placeholder="Texto a agregar..."/>)`,
que permitía **anexar texto a los comentarios de un lote**. Hoy no hay forma de usarlo.

### B. Falsos positivos — sólo diferencia visual o de nombre

| Cadena | Veredicto |
|---|---|
| `RIESGO BAJO` / `RIESGO MEDIO` en mayúsculas | el valor se renderiza crudo y el `text-transform` lo hace en CSS |
| `Ej: 3434538564 (10 dígitos)` | placeholder acortado a `Ej: 3434538564` |
| `Recordatorio & Seguimiento` | renombrado a `RECORDATORIOS Y SEGUIMIENTOS` |
| `Outfitpretación del Período` | **el nuevo lo arregla**: dice `Interpretación del Período`. La cadena vieja estaba corrompida por un find/replace del nombre de fuente (`Inter` → `Outfit`). Mejora, no regresión |

### C. Features movidas

| Elemento | Antes | Ahora |
|---|---|---|
| Campo de **hora** del recordatorio (`type="time"`) | `registros/page.tsx:1726` | `BitacoraModal.tsx:447` ✅ |
| `Nota`, `Restablecer a 100%`, `Recordatorio creado` | `registros/page.tsx` | `BitacoraModal.tsx` ✅ |
| `Agregar otro...` | `registros/page.tsx` | `PremiumSelect.tsx` ✅ |
| `Final mes (K/Q)` | `analistas/page.tsx` | `ProyeccionCard.tsx` ✅ |
| `Acuerdo de Precios`, `Resumen Ejecutivo` | `BulkModifyTab` | `ExportXlsxModal.tsx`, `ComparativaAnalistasTab` ✅ |

### D. Verificados como presentes

Zoom del modal de edición (`crm_modal_edit_zoom_level_v1`), modal de teléfono
(`phoneOverlay` + validación "El teléfono es obligatorio"), cabeceras de Analistas, Duplicados,
Cobranzas y el shell (RecordsSidebar / AccountActions): **sin pérdidas**.

### E. Requieren decisión

Ninguna más allá de si se restauran los 5 controles de edición masiva.

**No se corrigió nada fuera de la columna `Calif.`**, conforme a la autorización.

## BUG-08 (CORREGIDO) — 5 controles de edición masiva perdidos

`src/app/ajustes/BulkModifyTab.tsx` · Ajustes → Reportes → **Calif. x SCORE** → *Otras
Modificaciones Masivas (Avanzado)*

### Controles restaurados

| Campo | Antes | Después | Semántica (idéntica a `19f881e`) |
|---|---|---|---|
| `rango_etario` | sin control | `<select>` | `''` = no modificar · `SIN_ESPECIFICAR` = borrar · 6 rangos |
| `sexo` | sin control | `<select>` | ídem · 3 opciones |
| `localidad` | sin control | `<select>` | ídem · localidades únicas de `registros` |
| `es_re` | sin control | `<select>` «Resumen Ejecutivo» | `''` = no modificar · `'si'` → `true` · `'no'` → `false` |
| `comentarios` | sin control | `<textarea rows=2>` | `''` = no modificar |

Se usó el idioma visual actual (`styles.label`, `form-select`/`form-input`,
`uBackgroundSurface-sunken`), **no** el JSX legacy. No se tocó la lógica de escritura.

`localidadesDisponibles` se calcula con `Set` en lugar del `arr.indexOf()` dentro de un `filter`
del original — **misma lista** (únicas, ordenadas) sin el O(n²) sobre 7013 registros, siguiendo
el patrón que el archivo ya usa para `allAnalistas` y `allEmpleadoresList`.

### Paridad writer ↔ UI

| | Antes | Después |
|---|---|---|
| `updates.*` (campos aplicables) | 11 | 11 |
| `setCampos` (capacidades accesibles) | **6** | **11** |

### Certificación del payload — write interceptado, 0 escrituras reales

Seleccionando **sólo** los 5 restaurados + una calificación (el guard preexistente obliga):

```json
{
  "acuerdo_precios": "Premium",
  "comentarios": "nota de auditoria",
  "es_re": true,
  "localidad": "Aldea Brasilera",
  "rango_etario": "46-55",
  "sexo": "Femenino"
}
```

- Los 5 campos llegan con su valor ✅
- `es_re: 'si'` → boolean `true` ✅ (la conversión del writer se conserva)
- Los 5 **no** seleccionados (`estado`, `analista`, `tipo_cliente`, `cuotas`, `empleador`)
  están **ausentes** del payload → no sobrescriben ✅
- 3 `PATCH registros` bloqueados, **ninguno alcanzó Supabase**

### Dos discrepancias preexistentes detectadas, NO corregidas

Ambas existen **igual** en `19f881e`, por lo que no son regresiones de la migración y
corregirlas sería redefinir comportamiento:

1. **La etiqueta «Comentarios (agregar al final)» no describe lo que hace.** El writer es
   `updates.comentarios = campos.comentarios` — un **reemplazo**, no un anexado. La línea es
   byte a byte idéntica a la del último push (`:2683`). No se inventó un append.
2. **El guard del botón Aplicar sólo contempla 6 campos:**
   ```js
   disabled={… || (!campos.acuerdo_precios && !campos.estado && !campos.analista &&
                   !campos.tipo_cliente && !campos.cuotas && !campos.empleador)}
   ```
   Seleccionar únicamente alguno de los 5 restaurados deja el botón deshabilitado. La condición
   es idéntica en `19f881e`. → **corregido como BUG-09**, abajo.

### Validación

`tsc --noEmit` **exit 0** · lint del archivo **sin problemas** · `git diff --check` limpio ·
Desktop ✅ · **390 px**: los 5 controles presentes, **0 fuera del viewport**, sin overflow ·
**writes reales: 0**

Commit: `12cc338` — `fix(ajustes): restaurar controles de edición masiva`

## BUG-09 (CORREGIDO) — el guard de `Aplicar` sólo contemplaba 6 de 11 campos

`src/app/ajustes/BulkModifyTab.tsx` · continuación directa de BUG-08.

Restaurar los 5 controles no alcanzó: el botón **Aplicar** seguía evaluando únicamente los 6
campos antiguos, así que seleccionar sólo `comentarios`, `es_re`, `localidad`, `rango_etario` o
`sexo` lo dejaba **deshabilitado**. La restauración funcional estaba incompleta.

### Causa raíz

La condición de 6 campos estaba **duplicada 5 veces** en el mismo elemento — una en `disabled` y
cuatro dentro del `style` inline (`background`, `color`, `cursor`, `boxShadow`). Esa duplicación
es *por qué* se desincronizó: al agregarse campos al writer, nadie actualizó las 5 copias.

### Fix

Una sola derivación, tomada de `EMPTY_CAMPOS` para que agregar un campo editable no pueda volver
a desincronizar el guard:

```ts
const hayCamposAModificar = (Object.keys(EMPTY_CAMPOS) as (keyof CamposAModificar)[])
  .some((k) => !!campos[k]);
const aplicarDisabled = updating || previewCount === 0 || !hayCamposAModificar;
```

Los 5 usos pasan a referenciar `aplicarDisabled`. **9 inserciones, 2 borrados**; no se tocó la
lógica de escritura.

### Semántica — idéntica a la del writer, no `Boolean()` ingenuo

Los 11 campos de `CamposAModificar` son **`string`**, incluido `es_re` (`'' | 'si' | 'no'`). Por
eso la verdad del string refleja exactamente lo que hace `handleUpdate`:

| Valor UI | Writer | Guard |
|---|---|---|
| `''` | no modifica | no cuenta |
| `SIN_ESPECIFICAR` | `null` (borrado explícito) | **cuenta** |
| `es_re: 'no'` | `es_re = false` | **cuenta** |
| `'   '` (sólo espacios) | aplica (truthy) | **cuenta** |

No se usó `.trim()` justamente para no divergir del writer, que evalúa truthiness cruda.

### Tests individuales en navegador — payload interceptado

| Caso | Aplicar habilita | Vuelve a deshabilitar al limpiar | Payload | |
|---|---|---|---|---|
| sólo `comentarios` | ✅ | ✅ | `{"comentarios":"nota de auditoria"}` | **PASS** |
| sólo `es_re` = Sí | ✅ | ✅ | `{"es_re":true}` | **PASS** |
| sólo `es_re` = No | ✅ | ✅ | `{"es_re":false}` | **PASS** |
| sólo `localidad` | ✅ | ✅ | `{"localidad":"Aldea Brasilera"}` | **PASS** |
| sólo `rango_etario` | ✅ | ✅ | `{"rango_etario":"46-55"}` | **PASS** |
| sólo `sexo` | ✅ | ✅ | `{"sexo":"Femenino"}` | **PASS** |

Cada payload contiene **exactamente el campo elegido y ningún otro**. `es_re = No` produciendo
`{"es_re":false}` es el caso crítico: un `false` explícito cuenta como modificación válida.

Sin regresión en los 6 originales (`estado`, `analista`, `tipo_cliente`, `cuotas`, `empleador`,
`acuerdo_precios`) ni en `SIN_ESPECIFICAR`. Guard base con los 11 campos vacíos: **deshabilitado**.

### Writes reales: 0 — en qué se apoya la afirmación

6 `PATCH /rest/v1/registros` interceptados (+1 probe), **0 salieron del navegador**. El
interceptor devuelve una `Response` sintética **antes** de llamar a `origFetch`, así que la
petición nunca se construye ni se despacha; el toast de éxito de la app proviene de ese 200
sintético.

Que el interceptor esté **en el mismo camino de código que usa supabase-js** se verificó
empíricamente: el `GET /rest/v1/registros` de la propia búsqueda quedó registrado por el wrapper.
Además el set de preview se redujo de 3840 a **5 registros** antes de cualquier clic en Aplicar,
para minimizar el radio de impacto.

**Limitación declarada:** no se obtuvo una relectura independiente contra la DB. El flujo no
expone en su UI ningún filtro por `comentarios` ni por `localidad`, y el array de `registros` no
resultó alcanzable por fiber en `/registros`. La afirmación de 0 writes se apoya en la
construcción del interceptor más la prueba de camino, no en un `SELECT` de verificación.

### BULK-COMENTARIOS — discrepancia funcional preexistente, requiere decisión

**ABIERTA.** La UI dice «Comentarios (agregar al final)» pero el writer **reemplaza**
(`updates.comentarios = campos.comentarios`). Idéntico en `19f881e`. No se decidió entre
(A) cambiar la etiqueta a «Reemplazar comentarios» o (B) cambiar el writer para anexar —
es una definición de producto, no un bug de migración.

### Cambios paralelos ajenos — fuera de este commit

El árbol de trabajo contiene trabajo de terceros en curso (menú de acciones: `MoreHorizontal`,
estado `actionMenu`, posicionamiento, manejo de Escape y su CSS) en `src/app/registros/page.tsx`,
`src/app/gestion-diaria/GestionDiariaClient.tsx` y `src/app/globals.css`. **No fueron tocados,
ni stageados, ni reformateados, ni incluidos en ningún commit.** Se verificó que no afectan la
columna `Calif.` ni `.records-calif-badge`.

### Validación

`tsc --noEmit` **exit 0** · lint del archivo **sin problemas** · diff confinado a
`BulkModifyTab.tsx` · navegador: 6/6 casos PASS · **writes reales: 0**


## G. Network

_Pendiente — Fase 13._

## H. Performance

_Pendiente — Fases 11 y 16._

## I. Data correctness

_Pendiente — Fase 14._

## J. Código muerto

_Pendiente — Fase 17._

## K. Arquitectura

_Pendiente — Fase 18._

## L. Responsive

_Pendiente — Fase 19._

## M. Métricas

_Pendiente._

## N. Pendientes

_Pendiente._
