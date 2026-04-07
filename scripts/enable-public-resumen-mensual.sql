-- ============================================
-- HABILITAR ACCESO PÚBLICO A resumen_mensual
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Habilitar RLS en la tabla (si no está habilitado)
ALTER TABLE resumen_mensual ENABLE ROW LEVEL SECURITY;

-- 2. Crear política para permitir lectura pública (SELECT)
CREATE POLICY "Permitir lectura pública de resumen_mensual"
  ON resumen_mensual
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 3. Si la tabla no existe, crearla:
CREATE TABLE IF NOT EXISTS resumen_mensual (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  anio INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes >= 1 AND mes <= 12),
  logros TEXT DEFAULT '',
  desvios TEXT DEFAULT '',
  acciones_clave TEXT DEFAULT '',
  principales_logros TEXT DEFAULT '',
  principales_desvios TEXT DEFAULT '',
  acciones_clave_a_seguir TEXT DEFAULT '',
  gestiones_realizadas TEXT DEFAULT '',
  coordinacion_salidas TEXT DEFAULT '',
  empresas_estrategicas TEXT DEFAULT '',
  analisis_comercial TEXT DEFAULT '',
  dotacion TEXT DEFAULT '',
  ausentismo TEXT DEFAULT '',
  capacitacion TEXT DEFAULT '',
  evaluacion_desempeno TEXT DEFAULT '',
  operacion_procesos TEXT DEFAULT '',
  experiencia_cliente TEXT DEFAULT '',
  plan_acciones JSONB DEFAULT '[]'::jsonb,
  gestiones_por_analista JSONB DEFAULT '{}'::jsonb,
  presupuestos_por_analista JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(anio, mes)
);
