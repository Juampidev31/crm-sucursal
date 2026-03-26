-- ============================================
-- SCHEMA: Sistema de Proyección de Ventas
-- Para ejecutar en Supabase SQL Editor
-- ============================================

-- 1. REGISTROS (tabla principal)
CREATE TABLE IF NOT EXISTS registros (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cuil TEXT NOT NULL DEFAULT '',
  nombre TEXT NOT NULL DEFAULT '',
  puntaje INTEGER DEFAULT 0,
  es_re BOOLEAN DEFAULT false,
  analista TEXT DEFAULT '',
  fecha DATE,
  fecha_score DATE,
  monto NUMERIC(15,2) DEFAULT 0,
  estado TEXT DEFAULT 'proyeccion',
  comentarios TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para búsquedas frecuentes
CREATE INDEX IF NOT EXISTS idx_registros_analista ON registros (analista);
CREATE INDEX IF NOT EXISTS idx_registros_estado ON registros (estado);
CREATE INDEX IF NOT EXISTS idx_registros_fecha ON registros (fecha DESC);
CREATE INDEX IF NOT EXISTS idx_registros_cuil ON registros (cuil);

-- 2. AUDITORÍA
CREATE TABLE IF NOT EXISTS auditoria (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  id_registro TEXT DEFAULT '',
  fecha_hora TIMESTAMPTZ DEFAULT now(),
  analista TEXT DEFAULT '',
  accion TEXT DEFAULT '',
  campo_modificado TEXT DEFAULT '',
  valor_anterior TEXT DEFAULT '',
  valor_nuevo TEXT DEFAULT '',
  id_analista TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_auditoria_fecha ON auditoria (fecha_hora DESC);

-- 3. OBJETIVOS por analista y mes
CREATE TABLE IF NOT EXISTS objetivos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  analista TEXT NOT NULL,
  mes INTEGER NOT NULL CHECK (mes >= 0 AND mes <= 11),
  anio INTEGER NOT NULL,
  meta_ventas NUMERIC(15,2) DEFAULT 0,
  meta_operaciones INTEGER DEFAULT 0,
  UNIQUE(analista, mes, anio)
);

CREATE INDEX IF NOT EXISTS idx_objetivos_analista ON objetivos (analista, anio, mes);

-- 4. CONFIGURACIÓN DE ALERTAS
CREATE TABLE IF NOT EXISTS alertas_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  nombre TEXT NOT NULL,
  estado TEXT NOT NULL,
  dias INTEGER NOT NULL DEFAULT 7,
  mensaje TEXT DEFAULT '',
  color TEXT DEFAULT '#888'
);

-- 5. RECORDATORIOS
CREATE TABLE IF NOT EXISTS recordatorios (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  registro_id UUID REFERENCES registros(id) ON DELETE SET NULL,
  nombre TEXT DEFAULT '',
  cuil TEXT DEFAULT '',
  analista TEXT DEFAULT '',
  estado TEXT DEFAULT '',
  nota TEXT DEFAULT '',
  fecha_hora TIMESTAMPTZ,
  creado_por TEXT DEFAULT '',
  creado_en TIMESTAMPTZ DEFAULT now(),
  mostrado BOOLEAN DEFAULT false,
  comentario_registro TEXT DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_recordatorios_cuil ON recordatorios (cuil);
CREATE INDEX IF NOT EXISTS idx_recordatorios_mostrado ON recordatorios (mostrado);

-- 6. CONFIGURACIÓN DE DÍAS HÁBILES
CREATE TABLE IF NOT EXISTS dias_habiles_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  analista TEXT NOT NULL UNIQUE,
  dias_habiles NUMERIC(4,1) DEFAULT 0,
  dias_transcurridos NUMERIC(4,1) DEFAULT 0,
  manual BOOLEAN DEFAULT false
);

-- 7. CONFIGURACIÓN GENERAL (key-value)
CREATE TABLE IF NOT EXISTS configuracion (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  clave TEXT NOT NULL UNIQUE,
  valor_json JSONB DEFAULT '{}'::jsonb
);

-- ============================================
-- TRIGGERS: auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_registros_updated_at
  BEFORE UPDATE ON registros
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (opcional, habilitar si necesario)
-- ============================================
-- ALTER TABLE registros ENABLE ROW LEVEL SECURITY;
-- CREATE POLICY "Allow all for authenticated" ON registros FOR ALL USING (true);

-- ============================================
-- SEED: Alertas por defecto
-- ============================================
INSERT INTO alertas_config (nombre, estado, dias, mensaje, color) VALUES
  ('Proyecciones', 'proyeccion', 10, 'Tiene proyecciones con más de {dias} días sin actualización.', '#17a2b8'),
  ('En seguimiento', 'en seguimiento', 3, 'Tiene registros en seguimiento con más de {dias} días sin contacto.', '#ffc107'),
  ('Score bajo', 'score bajo', 30, 'Tiene clientes con score bajo que no reciben seguimiento desde hace {dias} días.', '#dc3545'),
  ('Afectaciones', 'afectaciones', 5, 'Tiene afectaciones con más de {dias} días sin resolver.', '#9c27b0'),
  ('Derivado Aprobado CC', 'derivado / aprobado cc', 7, 'Tiene derivaciones aprobadas por CC sin resolver en {dias} días.', '#9B59B6'),
  ('Derivado Rechazado CC', 'derivado / rechazado cc', 7, 'Tiene derivaciones rechazadas por CC sin seguimiento en {dias} días.', '#E67E22')
ON CONFLICT DO NOTHING;

-- ============================================
-- SEED: Objetivos por defecto (Marzo 2026)
-- ============================================
INSERT INTO objetivos (analista, mes, anio, meta_ventas, meta_operaciones) VALUES
  ('Luciana', 2, 2026, 23500000, 33),
  ('Victoria', 2, 2026, 23500000, 33)
ON CONFLICT DO NOTHING;

-- ============================================
-- SEED: Credenciales de acceso (admin_credentials)
-- Usuarios por defecto:
--   admin   / admin123  → rol admin (acceso completo)
--   viewer  / viewer123 → rol viewer (solo lectura)
-- ⚠ Cambiá las contraseñas desde Ajustes o directo en Supabase
-- ============================================
INSERT INTO configuracion (clave, valor_json) VALUES (
  'admin_credentials',
  '{
    "users": [
      {"username": "admin",  "password": "admin123",  "rol": "admin"},
      {"username": "viewer", "password": "viewer123", "rol": "viewer"}
    ]
  }'::jsonb
) ON CONFLICT (clave) DO NOTHING;
