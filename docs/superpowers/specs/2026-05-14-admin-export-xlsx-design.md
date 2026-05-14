# Admin Export XLSX — Design Spec
Date: 2026-05-14

## Overview
Admin-only feature to download a filtered XLSX of all registros. Accessible via a new button in the Sidebar, opening a modal with fecha desde/hasta and empleador filters. The file is generated server-side.

## Architecture

### API Route — `POST /api/admin/export-xlsx`
- Reads session cookie and validates `rol === 'admin'` using existing `getSession()`. Returns 403 if not admin.
- Accepts JSON body: `{ fechaDesde?: string, fechaHasta?: string, empleador?: string }`. All filters optional.
- Queries Supabase `registros` table with filters applied:
  - `fechaDesde` → `fecha >= fechaDesde`
  - `fechaHasta` → `fecha <= fechaHasta`
  - `empleador` → exact match `empleador = empleador`
- Generates XLSX using `xlsx` (SheetJS) with all Registro columns.
- Returns file as `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet` with filename `registros-YYYY-MM-DD.xlsx`.

### Columns in XLSX (in order)
nombre, cuil, analista, estado, monto, fecha, puntaje, es_re, tipo_cliente, acuerdo_precios, cuotas, rango_etario, sexo, empleador, dependencia, localidad, comentarios

### Component — `ExportXlsxModal`
- Lives in `src/components/ExportXlsxModal.tsx`
- Props: `open: boolean, onClose: () => void`
- Local state: `fechaDesde`, `fechaHasta`, `empleador` (text input), `loading`, `error`
- On submit: POST to `/api/admin/export-xlsx`, receive blob, trigger browser download
- Empleador field: free text input (no select, keeps it simple)

### Sidebar changes (`src/components/Sidebar.tsx`)
- Add new button "Exportar XLSX" visible only when `isAdmin`
- Positioned next to existing "Exportar CSV" button
- Opens `ExportXlsxModal`

## Auth
Uses existing `getSession()` from `src/lib/auth.ts` server-side. Same pattern as `/api/admin/login/route.ts`.

## Dependencies
- `xlsx` (SheetJS) — install via `npm install xlsx`

## Error handling
- 403 if not admin
- 500 with JSON error message on Supabase or generation failure
- Frontend shows error message inside modal on failure
