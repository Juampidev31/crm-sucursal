# Auditoría integral del repositorio

Fecha: 2026-09-24
Base: `master` (`19f881edcacef2ab1931d1681aac74596b092820`)

## Alcance revisado

Se recorrieron las rutas App Router, handlers API, componentes, contextos,
providers, hooks, utilidades, scripts operativos, SQL, estilos globales,
configuración de Next/TypeScript/ESLint, dependencias y documentación. Para
detectar código muerto se construyó el grafo de imports estáticos y dinámicos y
se contrastó con convenciones de rutas, búsquedas globales e historial Git.

Las dependencias de datos comprobadas son:

- Supabase para registros, configuración, auditoría, recordatorios, objetivos,
  históricos y snapshots mensuales.
- CSV publicados desde Google Sheets para PDV, analistas, históricos y cobranzas.
- `csv-parse` para el script operativo de migración.
- `exceljs` para exportación XLSX del servidor.
- `xlsx` para una exportación XLSX puntual desde `BulkModifyTab`.

No se encontró una dependencia directa instalada sin uso confirmado.

## Hallazgos priorizados

### Críticos — requieren decisión y trabajo específico

1. **La autorización administrativa no tiene una sesión verificable por el
   servidor.** `src/lib/auth.ts` guarda el rol en `localStorage` y
   `src/app/api/admin/export-xlsx/route.ts` confía en un JSON enviado por el
   cliente mediante `x-session`. Un cliente puede construir ambos valores. La
   solución correcta requiere cookie de sesión firmada/HTTP-only o Supabase Auth
   y verificación del usuario en cada operación privilegiada. No se modificó el
   contrato dentro de esta limpieza.

2. **El esquema versionado no habilita RLS.** En `supabase-schema.sql` las líneas
   de RLS están comentadas, mientras que la aplicación ejecuta escrituras
   directas con la clave `anon`. Debe verificarse el esquema realmente aplicado,
   definir políticas por tabla y mover operaciones privilegiadas al servidor o a
   RPCs. No es posible inferir políticas de negocio seguras sólo desde el código.

3. **`POST /api/cobranzas` no verifica identidad o rol.** Puede intentar un
   `upsert` con la clave pública. Bloquearlo correctamente depende de resolver la
   sesión de servidor y RLS de los puntos anteriores.

### Altos

1. **Riesgo de XSS almacenado en el resumen público.** La ruta
   `src/app/publico/resumen-mensual/page.tsx` inserta HTML almacenado en Supabase
   con `dangerouslySetInnerHTML`. Sanitizarlo puede cambiar snapshots existentes;
   requiere definir qué etiquetas/atributos son válidos y migrar el contenido.

2. **Datos operativos y una clave pública estaban versionados.** Se retiraron los
   CSV, logs y la credencial incrustada del árbol actual. Git conserva versiones
   históricas: corresponde rotar la clave y evaluar una reescritura de historial
   coordinada si el repositorio fue o será público. No se reescribió historial.

3. **`xlsx@0.18.5` conserva avisos de prototype pollution/ReDoS sin versión
   corregida en npm.** Su uso real está limitado a generar un libro desde datos
   ya cargados; no se eliminó ni reemplazó porque hacerlo cambiaría la exportación
   XLSX. Requiere elegir entre la distribución soportada de SheetJS, ExcelJS en
   cliente o una exportación del servidor.

### Medios

1. **Deuda de lint y tipos.** Con el tooling reparado quedan 373 advertencias:
   principalmente 251 usos de `any`, 60 símbolos sin uso, 40 efectos que disparan
   estado, y 29 dependencias de hooks. Se conservaron como advertencias visibles
   para no introducir un refactor masivo de comportamiento en esta rama.

2. **Componentes monolíticos.** `BulkModifyTab.tsx` supera 5.000 líneas;
   `registros/page.tsx`, `analistas/page.tsx`, `ResumenMensualTab.tsx` y
   `ajustes/page.tsx` también concentran UI, consultas y reglas. Separarlos por
   capacidad reduciría renders y riesgo, pero requiere pruebas de flujo antes de
   una extracción segura.

3. **Carga global amplia.** `AppShell` monta todos los providers para casi todas
   las rutas. Esto inicia lecturas, realtime y polling aun donde no siempre se
   necesitan. Conviene perfilar por ruta y acercar providers a sus consumidores.

4. **Gráficos repetidos.** Varios módulos registran Chart.js y construyen opciones
   similares dentro de grandes componentes cliente. La consolidación puede bajar
   bundle y renders, pero debe medirse para no alterar tooltips ni apariencia.

5. **Exportación de hasta 100.000 filas en memoria.** El handler XLSX pagina la
   consulta pero acumula todas las filas y el libro completo antes de responder.
   Para volúmenes mayores conviene streaming o jobs asíncronos.

6. **Headers de conexión globales.** `next.config.ts` agrega `Connection` y
   `Keep-Alive` a todas las respuestas. Son headers hop-by-hop y su manejo depende
   del proxy/plataforma. Se conservaron por su comentario de workaround, pero
   deberían validarse en infraestructura y retirarse si no son necesarios.

### Bajos / mantenibilidad

- Los scripts `watchdog.js` y SQL no están conectados a `package.json`, pero son
  herramientas operativas explícitas; se conservaron como «requiere revisión».
- La accesibilidad básica se beneficia de las reglas de Next/JSX, pero persisten
  controles icon-only y modales con implementación manual que deberían probarse
  con teclado, foco y lector de pantalla.
- No había infraestructura de pruebas automatizadas.

## Cambios aplicados

- Alineación puntual de Next.js y `eslint-config-next` en 16.3.3; se corrigió la
  incompatibilidad que impedía iniciar ESLint y la versión vulnerable de Next.
- Actualización de `csv-parse` a 7.0.2 y correcciones transitivas no disruptivas de
  `ws`, `brace-expansion`, `js-yaml` y `humanfs`.
- Override verificado de `uuid@11.1.1` para ExcelJS; la API usada (`v4`) sigue
  disponible en CommonJS.
- Separación de clientes Supabase de servidor/navegador e inicialización perezosa
  del cliente web. El build ya no ejecuta `createClient` durante imports.
- Cliente CSV de servidor compartido con control de estado HTTP y validación
  numérica de `gid`.
- Validación real de fechas calendario usadas por los flujos de importación.
- Pruebas unitarias para CSV, números, fechas y matching no duplicado.
- README de instalación, variables, rutas, scripts y advertencias operativas.
- Eliminación de código y artefactos sin consumidores confirmados.

## Eliminaciones confirmadas

- `src/app/publico/resumen-mensual/ResumenHTML.tsx`: cero imports; la ruta usa
  `ResumenMensualInteractivo` y una especificación previa ya lo marcaba muerto.
- `src/lib/audit-import-utils.ts`: cero imports; su único consumidor histórico
  (`ImportAuditTab`) ya no existe.
- `fix.js`, `replaceTooltips.js`, `build_output.log`, `output.txt` y
  `deploy-trigger.txt`: artefactos temporales sin scripts ni referencias.
- Cinco SVG de plantilla de Create Next App sin referencias.
- Dos CSV de trabajo sin referencias, con datos operativos que no deben vivir en
  el repositorio.

## Verificación

### Antes

- `npm run lint`: fallaba antes de analizar archivos por incompatibilidad entre
  Next 16.2.1 y `eslint-config-next` 15.1.7.
- `npx tsc --noEmit`: correcto.
- `npm run build`: compilaba TypeScript y fallaba al recolectar páginas porque
  Supabase se inicializaba durante el import sin variables de entorno.
- `npm audit`: 13 vulnerabilidades (1 crítica, 7 altas, 5 moderadas).

### Después

- `npm run lint`: correcto, con 373 advertencias de deuda existente visibles.
- `npm run typecheck`: correcto.
- `npm test`: 13 pruebas correctas.
- `npm run build`: correcto sin variables ni conexiones externas durante el
  prerender.
- `npm audit`: queda 1 vulnerabilidad alta correspondiente a `xlsx`, sin fix
  disponible en npm.
- `git diff --check`: debe permanecer correcto antes de merge.

## Riesgos pendientes y siguiente paso recomendado

Crear una tarea de seguridad separada para implementar sesión de servidor, RLS y
autorización de endpoints; después cubrir los flujos privilegiados con pruebas de
integración contra un Supabase de desarrollo. No debe desplegarse el modelo de
permisos actual como frontera de seguridad hasta verificar esos puntos.
