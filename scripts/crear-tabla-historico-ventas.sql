-- ============================================
-- CREAR tabla historico_ventas + RLS
-- Ejecutar en Supabase SQL Editor
-- ============================================

-- 1. Tabla
CREATE TABLE IF NOT EXISTS historico_ventas (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  analista TEXT NOT NULL,
  anio INTEGER NOT NULL,
  mes INTEGER NOT NULL CHECK (mes >= 0 AND mes <= 11), -- 0-11 estilo JS
  capital_real NUMERIC(14,2) NOT NULL DEFAULT 0,
  ops_real INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (analista, anio, mes)
);

-- 2. Índice de lookup por período
CREATE INDEX IF NOT EXISTS historico_ventas_periodo_idx
  ON historico_ventas (anio, mes);

-- 3. RLS
ALTER TABLE historico_ventas ENABLE ROW LEVEL SECURITY;

-- 4. Lectura: anon + authenticated
CREATE POLICY "Permitir lectura de historico_ventas"
  ON historico_ventas
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- 5. Escritura: solo authenticated
CREATE POLICY "Permitir escritura en historico_ventas"
  ON historico_ventas
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- 6. Trigger updated_at
CREATE OR REPLACE FUNCTION set_historico_ventas_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_historico_ventas_updated_at ON historico_ventas;
CREATE TRIGGER trg_historico_ventas_updated_at
  BEFORE UPDATE ON historico_ventas
  FOR EACH ROW
  EXECUTE FUNCTION set_historico_ventas_updated_at();

-- 7. Reload schema cache (evita PGRST205 inmediato)
NOTIFY pgrst, 'reload schema';
