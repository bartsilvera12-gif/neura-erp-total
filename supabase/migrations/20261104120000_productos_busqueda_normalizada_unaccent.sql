-- =============================================================================
-- Buscador de productos insensible a acentos y mayusculas
--
-- Problema: la busqueda por ILIKE sobre nombre/sku/codigo_barras distinguia
-- acentos ("television" no encontraba "Televisión", y viceversa) y repetia el
-- patron del usuario en 3 columnas por cada token.
--
-- Solucion ADITIVA multi-schema sobre `productos`:
--   - Extension `unaccent` + wrapper IMMUTABLE public.f_unaccent, necesario
--     para poder usar unaccent() dentro de una columna generada / indice.
--   - Columna generada STORED `busqueda_normalizada`:
--       lower(f_unaccent(nombre || ' ' || sku || ' ' || codigo_barras))
--     Una sola columna normalizada que concentra los 3 campos buscables.
--   - Indice GIN trigram sobre esa columna para que `%token%` siga siendo
--     rapido (igual que los trigram existentes de nombre/sku/codigo_barras).
--
-- La app normaliza la consulta de la MISMA forma (NFD + sin diacriticos +
-- minusculas) y filtra por tokens sobre esta unica columna → busqueda
-- orden-independiente, por palabra parcial, sin importar acentos ni mayusculas.
--
-- Reglas:
--   - IF NOT EXISTS en TODAS las sentencias. NO toca datos existentes.
--   - Itera schemas donde existe `productos` (public, zentra_erp, er_<hex>, erp_%).
--   - NOTA: agregar una columna generada STORED reescribe la tabla una vez
--     (lock breve). Aceptable para el tamano de catalogo de los tenants.
-- =============================================================================

-- Fijar search_path de la sesion para que la validacion del cuerpo de
-- f_unaccent (check_function_bodies) resuelva `unaccent` sin importar si la
-- extension quedo en `public` o en `extensions`.
SET search_path = public, extensions, pg_catalog;

-- 0) Extensiones (publicas, una sola vez)
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- 1) Wrapper IMMUTABLE de unaccent.
--    unaccent() por si solo es STABLE (depende del diccionario de texto), por
--    eso Postgres no lo acepta en columnas generadas ni en indices. Fijando el
--    search_path el resultado es determinista, y envolverlo marcado IMMUTABLE
--    es el patron estandar para busqueda sin acentos. Se usa el diccionario
--    'unaccent' explicito (forma de 2 argumentos) para no depender del default.
CREATE OR REPLACE FUNCTION public.f_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
STRICT
PARALLEL SAFE
SET search_path = public, extensions, pg_catalog
AS $func$ SELECT unaccent('unaccent', $1) $func$;

-- 2) Columna generada + indice GIN trigram en cada schema con `productos`
DO $do$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT n.nspname AS sch
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname = 'productos'
      AND c.relkind = 'r'
      AND (
        n.nspname IN ('public', 'zentra_erp')
        OR n.nspname ~ '^er_[0-9a-f]{32}$'
        OR n.nspname LIKE 'erp\_%' ESCAPE '\'
      )
  LOOP
    RAISE NOTICE '[productos busqueda_normalizada] procesando schema: %', r.sch;

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
    $fmt$, r.sch);

    -- Indice trigram para busqueda rapida por palabra parcial `%token%`.
    EXECUTE format($fmt$
      CREATE INDEX IF NOT EXISTS idx_productos_busqueda_norm_trgm
        ON %I.productos USING gin (busqueda_normalizada gin_trgm_ops)
    $fmt$, r.sch);
  END LOOP;
END
$do$;

-- 3) Refrescar el cache de PostgREST para exponer la nueva columna a la API.
NOTIFY pgrst, 'reload schema';
