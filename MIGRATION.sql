-- ============================================================
-- SLOTIFY — Migración Multi-tenant + Supabase Auth
-- ============================================================
-- Ejecutar en Supabase → SQL Editor → New Query → Pegar → Run
-- ============================================================

-- ─── PASO 1: Añadir columna auth_user_id a empresas ───
ALTER TABLE empresas 
ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id);

-- ─── PASO 2: Activar RLS en todas las tablas ───
ALTER TABLE empresas ENABLE ROW LEVEL SECURITY;
ALTER TABLE profesionales ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE citas ENABLE ROW LEVEL SECURITY;
ALTER TABLE notificaciones ENABLE ROW LEVEL SECURITY;

-- ─── PASO 3: Políticas para EMPRESAS ───
-- El usuario solo ve SU empresa
CREATE POLICY "empresas_select" ON empresas FOR SELECT 
  USING (auth_user_id = auth.uid());

CREATE POLICY "empresas_insert" ON empresas FOR INSERT 
  WITH CHECK (auth_user_id = auth.uid());

CREATE POLICY "empresas_update" ON empresas FOR UPDATE 
  USING (auth_user_id = auth.uid());

-- ─── PASO 4: Función helper para obtener empresa_id del usuario ───
CREATE OR REPLACE FUNCTION get_my_empresa_id()
RETURNS UUID
LANGUAGE SQL
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM empresas WHERE auth_user_id = auth.uid() LIMIT 1;
$$;

-- ─── PASO 5: Políticas para PROFESIONALES ───
CREATE POLICY "profesionales_select" ON profesionales FOR SELECT 
  USING (empresa_id = get_my_empresa_id());

CREATE POLICY "profesionales_insert" ON profesionales FOR INSERT 
  WITH CHECK (empresa_id = get_my_empresa_id());

CREATE POLICY "profesionales_update" ON profesionales FOR UPDATE 
  USING (empresa_id = get_my_empresa_id());

CREATE POLICY "profesionales_delete" ON profesionales FOR DELETE 
  USING (empresa_id = get_my_empresa_id());

-- ─── PASO 6: Políticas para CLIENTES ───
CREATE POLICY "clientes_select" ON clientes FOR SELECT 
  USING (empresa_id = get_my_empresa_id());

CREATE POLICY "clientes_insert" ON clientes FOR INSERT 
  WITH CHECK (empresa_id = get_my_empresa_id());

CREATE POLICY "clientes_update" ON clientes FOR UPDATE 
  USING (empresa_id = get_my_empresa_id());

CREATE POLICY "clientes_delete" ON clientes FOR DELETE 
  USING (empresa_id = get_my_empresa_id());

-- ─── PASO 7: Políticas para SERVICIOS ───
CREATE POLICY "servicios_select" ON servicios FOR SELECT 
  USING (empresa_id = get_my_empresa_id());

CREATE POLICY "servicios_insert" ON servicios FOR INSERT 
  WITH CHECK (empresa_id = get_my_empresa_id());

CREATE POLICY "servicios_update" ON servicios FOR UPDATE 
  USING (empresa_id = get_my_empresa_id());

CREATE POLICY "servicios_delete" ON servicios FOR DELETE 
  USING (empresa_id = get_my_empresa_id());

-- ─── PASO 8: Políticas para CITAS ───
CREATE POLICY "citas_select" ON citas FOR SELECT 
  USING (empresa_id = get_my_empresa_id());

CREATE POLICY "citas_insert" ON citas FOR INSERT 
  WITH CHECK (empresa_id = get_my_empresa_id());

CREATE POLICY "citas_update" ON citas FOR UPDATE 
  USING (empresa_id = get_my_empresa_id());

CREATE POLICY "citas_delete" ON citas FOR DELETE 
  USING (empresa_id = get_my_empresa_id());

-- ─── PASO 9: Políticas para NOTIFICACIONES ───
CREATE POLICY "notificaciones_select" ON notificaciones FOR SELECT 
  USING (empresa_id = get_my_empresa_id());

CREATE POLICY "notificaciones_insert" ON notificaciones FOR INSERT 
  WITH CHECK (empresa_id = get_my_empresa_id());

CREATE POLICY "notificaciones_update" ON notificaciones FOR UPDATE 
  USING (empresa_id = get_my_empresa_id());

-- ─── PASO 10: Política especial para REGISTRO ───
-- Cuando un usuario se registra, aún no tiene empresa.
-- Necesita poder insertar en empresas con su propio auth_user_id.
-- La política empresas_insert ya lo permite (WITH CHECK auth_user_id = auth.uid()).

-- Para que el registro funcione, profesionales también necesita permitir
-- insert cuando la empresa_id coincide con la que acaba de crear el usuario.
-- La política profesionales_insert ya lo hace via get_my_empresa_id().

-- ============================================================
-- ¡HECHO! Ahora cada usuario solo ve los datos de su negocio.
-- ============================================================
