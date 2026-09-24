# CRM Sucursal

Aplicación interna de seguimiento comercial construida con Next.js 16, React 19,
TypeScript y Supabase. Incluye gestión de registros, proyecciones, objetivos,
recordatorios, auditoría, reportes y herramientas administrativas de importación,
verificación y exportación.

## Requisitos

- Node.js 20.9 o superior.
- npm (el repositorio versiona `package-lock.json`).
- Un proyecto Supabase con el esquema de `supabase-schema.sql` y las migraciones
  operativas de `scripts/` revisadas para el entorno correspondiente.

## Configuración local

1. Instalá las dependencias:

   ```bash
   npm ci
   ```

2. Copiá `.env.example` a `.env.local` y completá:

   - `NEXT_PUBLIC_SUPABASE_URL`: URL del proyecto Supabase.
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: clave pública `anon` del proyecto.
   - `ADMIN_PASSWORD`: contraseña validada por el endpoint de acceso administrativo.

   No versiones `.env.local` ni claves privadas o `service_role`.

3. Iniciá el servidor:

   ```bash
   npm run dev
   ```

La aplicación queda disponible en `http://localhost:3000`.

## Comandos

| Comando | Uso |
| --- | --- |
| `npm run dev` | Desarrollo; libera antes el puerto configurado (3000 por defecto). |
| `npm run build` | Genera el build de producción. |
| `npm start` | Sirve un build existente. |
| `npm run lint` | Ejecuta ESLint sobre el repositorio. |
| `npm run typecheck` | Comprueba TypeScript sin emitir archivos. |
| `npm test` | Ejecuta las pruebas unitarias. |
| `npm run migrate:csv -- archivo.csv` | Importa un CSV a Supabase; revisá el script antes de usar `--clean`. |

## Rutas principales

- `/registros`: gestión y seguimiento de clientes.
- `/proyeccion`: proyección comercial del mes actual.
- `/analistas`: métricas y vistas por analista.
- `/duplicados`: detección de posibles registros duplicados.
- `/ajustes`: herramientas administrativas, configuración e importaciones.
- `/reportes` y `/reportes/cobranzas`: reportes operativos.
- `/publico/resumen-mensual`: vista compartible de un resumen guardado.

Los handlers bajo `/api` integran Supabase y hojas CSV publicadas. Las fuentes
externas se cachean durante cinco minutos salvo la sección marcada como dinámica.

## Datos y seguridad

El cliente usa la clave pública de Supabase, por lo que las políticas RLS y los
permisos de base de datos deben ser la autoridad real. El archivo
`supabase-schema.sql` es una referencia histórica: verificá el esquema aplicado y
las políticas antes de usar datos reales. No ejecutes scripts SQL ni migraciones
CSV contra producción sin una copia de seguridad y una revisión explícita.

## Verificación antes de un cambio

```bash
npm run lint
npm run typecheck
npm test
npm run build
git diff --check
```
