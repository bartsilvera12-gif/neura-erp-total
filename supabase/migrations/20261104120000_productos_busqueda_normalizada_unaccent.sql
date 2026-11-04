-- =============================================================================
-- Buscador de productos insensible a acentos y mayusculas
--
-- Problema: la busqueda por ILIKE sobre nombre/sku/codigo_barras distinguia
-- acentos ("television" no encontraba "Televisión", y viceversa) y repetia el
-- patron del usuario en 3 columnas por cada token. Ademas, con el conteo
-- estimado, la paginacion capaba resultados (buscar "Midas"/"TV LED" no
-- mostraba todos los productos).
--
-- Solucion ADITIVA sobre `productos`:
--   - Extension `unaccent` + wrapper IMMUTABLE public.f_unaccent, necesario
--     para poder usar unaccent() dentro de una columna generada / indice.
--   - Columna generada STORED `busqueda_normalizada`:
--       lower(f_unaccent(nombre || ' ' || sku || ' ' || codigo_barras))
--     Una sola columna normalizada que concentra los 3 campos buscables.
--   - Indice GIN trigram sobre esa columna para que `%token%` sea rapido.
--
-- La app normaliza la consulta de la MISMA forma (NFD + sin diacriticos +
-- minusculas) y filtra por tokens sobre esta unica columna → busqueda
-- orden-independiente, por palabra parcial, sin importar acentos ni mayusculas.
--
-- ESQUEMA: esta es una instancia dedicada monocliente. El schema de datos lo
-- define `NEURA_CLIENT_SCHEMA` (src/lib/supabase/schema.ts), que por defecto es
-- `total` (Total Electrodomesticos). La migracion aplica sobre ese schema. Si
-- se reusa el repo para otro cliente con NEURA_CLIENT_SCHEMA distinto, cambiar
-- el valor de `v_schema` abajo por el mismo nombre.
--
-- Reglas: IF NOT EXISTS en todo; no toca datos; idempotente.
-- NOTA: agregar una columna generada STORED reescribe la tabla una vez (lock
-- ACCESS EXCLUSIVE breve). Aceptable para el tamano del catalogo.
-- =============================================================================

-- Fijar search_path de la sesion para que la validacion del cuerpo de
-- f_unaccent (check_function_bodies) resuelva `unaccent` sin importar si la
-- extension quedo en `public` o en `extensions`.
SET search_path = public, extensions, pg_catalog;

-- 0) Extensiones (una sola vez)
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1) Wrapper IMMUTABLE de unaccent.
--    unaccent() por si solo es STABLE (depende del diccionario de texto), por
--    eso Postgres no lo acepta en columnas generadas ni en indices. Fijando el
--    search_path el resultado es determinista, y envolverlo marcado IMMUTABLE
--    es el patron estandar para busqueda sin acentos.
CREATE OR REPLACE FUNCTION public.f_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public, extensions, pg_catalog
AS $func$ SELECT unaccent('unaccent', $1) $func$;

-- 2) Columna generada + indice GIN trigram en el schema del cliente.
DO $do$
DECLARE
  v_schema text := 'total';  -- = NEURA_CLIENT_SCHEMA (default)
BEGIN
  IF to_regclass(format('%I.productos', v_schema)) IS NULL THEN
    RAISE EXCEPTION 'No existe %.productos — revisar el schema del cliente', v_schema;
  END IF;

  RAISE NOTICE '[productos busqueda_normalizada] schema: %', v_schema;

  -- Columna normalizada (lower + sin acentos) que concentra los 3 campos
  -- buscables. GENERATED ALWAYS => siempre consistente, no se inserta a mano.
  EXECUTE format($fmt$
    ALTER TABLE %I.productos
      ADD COLUMN IF NOT EXISTS busqueda_normalizada text
      GENERATED ALWAYS AS (
        lower(public.f_unaccent(
          coalesce(nombre, '') || ' ' ||
          coalesce(sku, '') || ' ' ||
          coalesce(codigo_barras, '')
        ))
      ) STORED
  $fmt$, v_schema);

  -- Indice trigram para busqueda rapida por palabra parcial `%token%`.
  EXECUTE format($fmt$
    CREATE INDEX IF NOT EXISTS idx_productos_busqueda_norm_trgm
      ON %I.productos USING gin (busqueda_normalizada gin_trgm_ops)
  $fmt$, v_schema);
END
$do$;

-- 3) Refrescar el cache de PostgREST para exponer la nueva columna a la API.
NOTIFY pgrst, 'reload schema';
