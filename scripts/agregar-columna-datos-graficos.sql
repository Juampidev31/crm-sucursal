-- ============================================
-- AGREGAR columna datos_graficos a resumen_mensual
-- Ejecutar en Supabase SQL Editor
-- ============================================

ALTER TABLE resumen_mensual 
ADD COLUMN IF NOT EXISTS datos_graficos JSONB DEFAULT '{}'::jsonb;