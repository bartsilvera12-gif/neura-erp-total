-- =============================================================================
-- TOTAL ELECTRODOMÉSTICOS — Empresa, usuario admin y módulos
-- Destino: Supabase self-hosted → SQL Editor (ejecutar como `postgres`)
--
-- Corre DESPUÉS de 00_setup_schema_total.sql.
--
-- ANTES de correr esto, creá el usuario de login a mano:
--   Supabase → Authentication → Users → Add user
--     email:    admin@total.com
--     password: la que elijas
--     "Auto Confirm User": sí
--
-- Se hace desde el panel y no por SQL a propósito: `auth.users` es de Supabase
-- y no queremos escribir en un schema ajeno. Este script solo LEE de `auth`
-- para encontrar el id del usuario por su email.
--
-- Qué hace:
--   1. Crea la empresa TOTAL ELECTRODOMÉSTICOS con su propio id
--   2. Copia los catálogos globales de `asunhome` (modulos, dashboard_views)
--   3. Vincula admin@total.com a la empresa como rol admin
--   4. Activa SOLO los módulos pedidos
--
-- Idempotente: se puede re-ejecutar.
-- =============================================================================

DO $seed$
DECLARE
  -- Id propio de Total. No se comparte con ninguna otra instancia.
  v_empresa  uuid := '8a8413c6-51bf-424b-a479-c442a2dc17a7';
  v_email    text := 'admin@total.com';
  v_auth     uuid;
  v_tabla    text;
  v_mod      uuid;
  v_cols     text;
  v_n        bigint;

  -- Módulos pedidos para Total.
  -- 'inventario' incluye Movimientos (es /inventario/movimientos, no un módulo aparte).
  -- 'configuracion' y 'usuarios' van porque el admin los necesita para operar.
  -- Gerencia y Tableros NO están: no existen como módulo en el catálogo heredado.
  v_modulos  text[] := ARRAY[
    'dashboard', 'ventas', 'inventario', 'clientes', 'cobros', 'compras',
    'pagos', 'gastos', 'reportes', 'notas_credito',
    'configuracion', 'usuarios'
  ];
BEGIN
  -- ── 1) La empresa ──────────────────────────────────────────────────────────
  INSERT INTO total.empresas (id, nombre_empresa, pais, estado, data_schema)
  VALUES (v_empresa, 'TOTAL ELECTRODOMÉSTICOS', 'PARAGUAY', 'ACTIVA', 'total')
  ON CONFLICT (id) DO UPDATE
    SET nombre_empresa = EXCLUDED.nombre_empresa,
        data_schema    = EXCLUDED.data_schema;
  RAISE NOTICE 'empresa: %', v_empresa;

  -- ── 2) Catálogos globales desde asunhome ───────────────────────────────────
  -- El clon estructural dejó estas tablas vacías. Sin ellas el sidebar y el
  -- dashboard quedan sin nada que mostrar.
  FOREACH v_tabla IN ARRAY ARRAY['modulos', 'dashboard_views']
  LOOP
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'total' AND c.relname = v_tabla AND c.relkind = 'r');

    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
    INTO v_cols
    FROM information_schema.columns
    WHERE table_schema = 'total' AND table_name = v_tabla
      AND column_name IN (SELECT column_name FROM information_schema.columns
                          WHERE table_schema = 'asunhome' AND table_name = v_tabla);

    EXECUTE format('INSERT INTO total.%I (%s) SELECT %s FROM asunhome.%I ON CONFLICT DO NOTHING',
                   v_tabla, v_cols, v_cols, v_tabla);
    GET DIAGNOSTICS v_n = ROW_COUNT;
    RAISE NOTICE 'catalogo %: % filas', v_tabla, v_n;
  END LOOP;

  -- ── 3) El usuario admin ────────────────────────────────────────────────────
  SELECT id INTO v_auth FROM auth.users WHERE lower(email) = lower(v_email) LIMIT 1;

  IF v_auth IS NULL THEN
    RAISE EXCEPTION
      'No existe % en auth.users. Creálo primero en Authentication → Users → Add user (con Auto Confirm).',
      v_email;
  END IF;

  INSERT INTO total.usuarios (
    id, email, nombre, rol, empresa_id, auth_user_id,
    activo, estado, es_vendedor, ips
  )
  VALUES (
    v_auth, v_email, 'Administrador', 'admin', v_empresa, v_auth,
    true, 'activo', true, false
  )
  ON CONFLICT (email) DO UPDATE
    SET rol          = 'admin',
        empresa_id   = EXCLUDED.empresa_id,
        auth_user_id = EXCLUDED.auth_user_id,
        activo       = true,
        estado       = 'activo';
  RAISE NOTICE 'usuario admin: % (auth %)', v_email, v_auth;

  -- ── 4) Solo los módulos pedidos ────────────────────────────────────────────
  -- Primero se desactiva todo, después se activa la lista. Así el menú queda
  -- exactamente con lo pedido aunque el catálogo traiga módulos de más.
  UPDATE total.empresa_modulos SET activo = false WHERE empresa_id = v_empresa;

  FOR v_mod IN SELECT id FROM total.modulos WHERE slug = ANY(v_modulos)
  LOOP
    IF EXISTS (SELECT 1 FROM total.empresa_modulos
               WHERE empresa_id = v_empresa AND modulo_id = v_mod) THEN
      UPDATE total.empresa_modulos SET activo = true
      WHERE empresa_id = v_empresa AND modulo_id = v_mod;
    ELSE
      INSERT INTO total.empresa_modulos (empresa_id, modulo_id, activo)
      VALUES (v_empresa, v_mod, true);
    END IF;
  END LOOP;

  -- ── 5) Vistas del dashboard ────────────────────────────────────────────────
  INSERT INTO total.empresa_dashboard_views (empresa_id, dashboard_view_id, activo)
  SELECT v_empresa, edv.dashboard_view_id, edv.activo
  FROM asunhome.empresa_dashboard_views edv
  ON CONFLICT DO NOTHING;
END $seed$;


-- =============================================================================
-- VERIFICACIÓN
-- =============================================================================

-- Módulos activos: deben ser exactamente los pedidos
SELECT m.slug, m.nombre, em.activo
FROM total.empresa_modulos em
JOIN total.modulos m ON m.id = em.modulo_id
WHERE em.activo = true
ORDER BY m.slug;

-- El admin
SELECT u.email, u.rol, u.activo, e.nombre_empresa, e.data_schema
FROM total.usuarios u
JOIN total.empresas e ON e.id = u.empresa_id;
