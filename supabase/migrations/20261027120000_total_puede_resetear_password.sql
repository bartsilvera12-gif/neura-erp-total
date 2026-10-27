-- =============================================================================
-- total — quién puede restablecer contraseñas de otros
--
-- Hasta ahora podía cualquiera con rol admin/administrador, y eso incluye a las
-- vendedoras: podían cambiarle la clave al administrador y dejarlo afuera.
--
-- Se podría haber separado por el rol ('admin' vs 'administrador'), porque hoy
-- el administrador tiene uno y ellas el otro. Pero en TODO el resto del ERP esos
-- dos nombres son sinónimos (`nivelFromRolDb` los mapea al mismo nivel), así que
-- colgar un permiso de esa diferencia es una trampa: el día que alguien cree un
-- usuario con rol 'admin' se lleva la facultad sin que nadie lo decida.
--
-- Por eso va una marca explícita. Para dársela a otra persona:
--   UPDATE total.usuarios SET puede_resetear_password = true WHERE email = '...';
--
-- ALCANCE: SOLO el schema `total`. Idempotente.
-- =============================================================================

ALTER TABLE total.usuarios
  ADD COLUMN IF NOT EXISTS puede_resetear_password boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN total.usuarios.puede_resetear_password IS
  'Permite restablecer la contraseña de OTROS usuarios. No se hereda del rol.';

-- El administrador original conserva la facultad; nadie más la recibe.
UPDATE total.usuarios
   SET puede_resetear_password = true
 WHERE lower(email) = 'admin@total.com';

NOTIFY pgrst, 'reload schema';
