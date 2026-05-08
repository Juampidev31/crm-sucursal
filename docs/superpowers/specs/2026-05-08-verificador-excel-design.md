# Verificador Excel — Design Spec
Date: 2026-05-08

## Overview

Tab "Verificador" en el módulo Ajustes (solo admins) que permite pegar datos copiados de Excel y cruzarlos contra los registros ya cargados en la base de datos. No crea ni modifica datos — es solo lectura.

## Architecture

- **Ubicación**: `src/app/ajustes/VerificadorTab.tsx` + registrado en `src/app/ajustes/page.tsx`
- **Acceso**: solo admins (mismo patrón que otras tabs restringidas en Ajustes)
- **Datos**: consume `useRegistros()` — sin nueva query a Supabase, usa lo que ya está en memoria
- **Dependencias nuevas**: ninguna

## User Flow

1. Usuario pega texto copiado desde Excel en un textarea
2. El sistema parsea al instante y muestra una tabla preview con las columnas detectadas
3. El usuario asigna cada columna mediante dropdowns: CUIL / Nombre / Mes / Importe / (Ignorar)
4. El usuario presiona "Verificar"
5. Se muestra la misma tabla con una columna extra de estado por fila

## Parsing

- Separador de filas: `\n`
- Separador de columnas: `\t` (formato nativo de Excel al copiar)
- Límite: 500 filas
- CUIL normalizado: se eliminan guiones y espacios antes de comparar
- Campo Mes acepta: `01/2025`, `enero 2025`, fecha completa `15/01/2025` (se extrae mes+año)
- Importe: tolerancia ±$1 para diferencias de redondeo

## Matching Logic

Por cada fila pegada:
1. Buscar registros con el mismo CUIL normalizado
2. Si se mapeó columna Mes: filtrar por mes+año coincidente
3. Si no se mapeó Mes: usar cualquier registro del CUIL

## Result States

| Estado | Condición | Visual |
|--------|-----------|--------|
| ✅ Encontrado | CUIL + mes coinciden + importe igual (±$1) | Verde |
| ⚠️ Importe diferente | CUIL + mes coinciden, importe difiere | Amarillo — muestra importe Excel vs DB |
| ❌ No encontrado | No hay registro con ese CUIL en ese mes | Rojo |

Columnas mostradas en resultados: todas las del Excel pegado + columna Estado + (si encontrado) Importe DB, Fecha DB, Estado DB.

## Admin Guard

Mismo patrón que el resto de Ajustes: si `!isAdmin` no renderiza el tab ni su contenido.

## Out of Scope

- No importa ni crea registros
- No exporta resultados
- No guarda historial de verificaciones
