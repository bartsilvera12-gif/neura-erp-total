-- =============================================================================
-- total — registro de inicios de sesión
--
-- No había forma de saber quién entró al sistema ni cuándo. Con un solo usuario
-- daba igual; con Marta y Celeste operando, es lo que permite atar una venta o
-- una anulación a una persona y a un turno.
--
-- Solo se guarda el ingreso: usuario, correo, momento, y el navegador/dispositivo
-- desde el que entró. Nada de contraseñas ni de tokens.
--
-- ALCANCE: SOLO el schema `total`. Idempotente.
-- =============================================================================

CREATE TABLE IF NOT EXISTS total.accesos_usuarios (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id   uuid NOT NULL,
  usuario_id   uuid,
  usuario_nombre text,
  email        text,
  fecha        timestamptz NOT NULL DEFAULT now(),
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS accesos_usuarios_empresa_fecha_idx
  ON total.accesos_usuarios (empresa_id, fecha DESC);
CREATE INDEX IF NOT EXISTS accesos_usuarios_usuario_idx
  ON total.accesos_usuarios (usuario_id, fecha DESC);

COMMENT ON TABLE total.accesos_usuarios IS
  'Un registro por inicio de sesión. Sin contraseñas ni tokens.';

GRANT SELECT, INSERT ON total.accesos_usuarios TO anon, authenticated, service_role;

ALTER TABLE total.accesos_usuarios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS accesos_usuarios_rls ON total.accesos_usuarios;
CREATE POLICY accesos_usuarios_rls ON total.accesos_usuarios
  FOR ALL TO authenticated
  USING (total.puede_acceder_empresa(empresa_id))
  WITH CHECK (total.puede_acceder_empresa(empresa_id));

-- PostgREST sirve su caché de esquema hasta que se la recarga.
NOTIFY pgrst, 'reload schema';
