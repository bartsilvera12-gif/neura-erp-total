-- =============================================================================
-- total — conectar al ERP dos usuarios ya creados en Supabase Auth
--
-- Crear la cuenta en Supabase Auth alcanza para iniciar sesión, pero no para
-- usar el sistema: el ERP necesita además la fila en `total.usuarios`, que es
-- donde vive a qué empresa pertenece, su nombre y su rol. Sin ella la persona
-- entra y no ve nada.
--
-- ANTES DE CORRER: crear en Supabase Auth los dos usuarios con estos correos
-- (Authentication → Users → Add user, con "Auto Confirm User" activado):
--     marta@total.com
--     celeste@total.com
-- La contraseña la elegís ahí. Este script no la toca ni la lee.
--
-- Rol `administrador`: ve las mismas pantallas que el admin. Los
-- administradores NO llevan filas en `usuario_modulos` —el sistema les da todo
-- lo que tenga habilitado la empresa—, por eso acá no se asigna ninguno.
--
-- `es_vendedor = true` las hace aparecer en el selector de Vendedor de la
-- venta, que es lo que acredita la comisión en el reporte mensual.
--
-- Idempotente: si la fila ya existe, la actualiza en vez de duplicarla.
-- =============================================================================

WITH datos(email, nombre) AS (
  VALUES
    ('marta@total.com',   'Marta'),
    ('celeste@total.com', 'Celeste')
),
emp AS (SELECT id FROM total.empresas ORDER BY created_at LIMIT 1)
INSERT INTO total.usuarios (empresa_id, email, nombre, rol, auth_user_id, estado, activo, es_vendedor)
SELECT emp.id, d.email, d.nombre, 'administrador', au.id, 'activo', true, true
  FROM datos d
  CROSS JOIN emp
  JOIN auth.users au ON lower(au.email) = d.email
 WHERE NOT EXISTS (
   SELECT 1 FROM total.usuarios u WHERE lower(u.email) = d.email
 );

-- Si la fila ya existía (de un intento anterior), se completa lo que falte.
UPDATE total.usuarios u
   SET auth_user_id = COALESCE(u.auth_user_id, au.id),
       nombre       = COALESCE(NULLIF(btrim(u.nombre), ''), d.nombre),
       rol          = 'administrador',
       estado       = 'activo',
       activo       = true,
       es_vendedor  = true,
       empresa_id   = COALESCE(u.empresa_id, (SELECT id FROM total.empresas ORDER BY created_at LIMIT 1))
  FROM (VALUES
          ('marta@total.com',   'Marta'),
          ('celeste@total.com', 'Celeste')
       ) AS d(email, nombre)
  LEFT JOIN auth.users au ON lower(au.email) = d.email
 WHERE lower(u.email) = d.email;

-- Los administradores no llevan filas en `usuario_modulos`: si quedaron de
-- antes, limitarían lo que ven en vez de ampliarlo.
DELETE FROM total.usuario_modulos
 WHERE usuario_id IN (
   SELECT id FROM total.usuarios WHERE lower(email) IN ('marta@total.com','celeste@total.com')
 );

-- Control: tienen que salir las dos, con auth_user_id cargado.
SELECT nombre, email, rol, (auth_user_id IS NOT NULL) AS vinculado_a_auth, es_vendedor
  FROM total.usuarios
 WHERE lower(email) IN ('marta@total.com','celeste@total.com')
 ORDER BY nombre;
