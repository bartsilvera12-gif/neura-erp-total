-- =============================================================================
-- total — ventas a crédito en cuotas mensuales
--
-- Hasta ahora una venta a crédito generaba UNA cuenta por cobrar con un solo
-- vencimiento (`plazo_dias`). Las compras sí tenían cuotas (`compra_cuotas`);
-- las ventas no. Esto empareja los dos lados:
--
--   total.venta_cuotas            una fila por cuota de la cuenta por cobrar.
--   total.cobro_cuota_aplicacion  a qué cuota(s) se imputó cada cobro. Un cobro
--                                 puede caer sobre varias cuotas: el que paga
--                                 de más adelanta la(s) siguiente(s).
--   ventas.cuotas_cantidad        en cuántas cuotas se dividió (NULL = al contado
--                                 o crédito viejo de un solo vencimiento).
--   ventas.entrega_inicial        anticipo cobrado en el momento; NO entra en las
--                                 cuotas, que se calculan sobre el resto.
--
-- Sin interés: el monto a financiar se divide en partes iguales y el redondeo
-- se absorbe en la ÚLTIMA cuota, para que la suma cierre exacta con el total.
--
-- ALCANCE: SOLO el schema `total`. Idempotente.
-- =============================================================================

-- ── 1. Cuotas de la cuenta por cobrar ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS total.venta_cuotas (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id            uuid NOT NULL,
  cuenta_por_cobrar_id  uuid NOT NULL REFERENCES total.cuentas_por_cobrar(id) ON DELETE CASCADE,
  venta_id              uuid,
  numero_cuota          integer NOT NULL,
  fecha_vencimiento     date NOT NULL,
  monto                 numeric NOT NULL DEFAULT 0,
  saldo                 numeric NOT NULL DEFAULT 0,
  estado                text NOT NULL DEFAULT 'pendiente',
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now()
);

-- Se consulta pg_constraint en vez de atajar la excepción: un UNIQUE crea
-- además un índice, y si ese índice ya existe el error es `duplicate_table`,
-- que no entra por el WHEN duplicate_object y aborta la corrida.
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'total.venta_cuotas'::regclass AND conname = 'venta_cuotas_estado_check'
  ) THEN
    ALTER TABLE total.venta_cuotas
      ADD CONSTRAINT venta_cuotas_estado_check
      CHECK (estado IN ('pendiente', 'parcial', 'pagada', 'anulada'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'total.venta_cuotas'::regclass AND conname = 'venta_cuotas_numero_unico'
  ) THEN
    ALTER TABLE total.venta_cuotas
      ADD CONSTRAINT venta_cuotas_numero_unico UNIQUE (cuenta_por_cobrar_id, numero_cuota);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS venta_cuotas_cxc_idx
  ON total.venta_cuotas (cuenta_por_cobrar_id, numero_cuota);
CREATE INDEX IF NOT EXISTS venta_cuotas_pendientes_idx
  ON total.venta_cuotas (empresa_id, fecha_vencimiento)
  WHERE saldo > 0 AND estado <> 'anulada';

COMMENT ON TABLE total.venta_cuotas IS
  'Cuotas mensuales de una venta a crédito. El redondeo se absorbe en la última.';

-- ── 2. Imputación de cada cobro a las cuotas ─────────────────────────────────
CREATE TABLE IF NOT EXISTS total.cobro_cuota_aplicacion (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id      uuid NOT NULL,
  cobro_id        uuid NOT NULL REFERENCES total.cobros_clientes(id) ON DELETE CASCADE,
  venta_cuota_id  uuid NOT NULL REFERENCES total.venta_cuotas(id) ON DELETE CASCADE,
  monto           numeric NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cobro_cuota_aplicacion_cobro_idx
  ON total.cobro_cuota_aplicacion (cobro_id);
CREATE INDEX IF NOT EXISTS cobro_cuota_aplicacion_cuota_idx
  ON total.cobro_cuota_aplicacion (venta_cuota_id);

COMMENT ON TABLE total.cobro_cuota_aplicacion IS
  'Un cobro puede imputarse a varias cuotas: el que paga de más adelanta las siguientes.';

-- ── 3. Datos del plan en la venta ────────────────────────────────────────────
ALTER TABLE total.ventas
  ADD COLUMN IF NOT EXISTS cuotas_cantidad  integer,
  ADD COLUMN IF NOT EXISTS entrega_inicial  numeric NOT NULL DEFAULT 0;

COMMENT ON COLUMN total.ventas.cuotas_cantidad IS
  'En cuántas cuotas mensuales se dividió. NULL = contado o crédito de un solo vencimiento.';
COMMENT ON COLUMN total.ventas.entrega_inicial IS
  'Anticipo cobrado al confirmar la venta. Las cuotas se calculan sobre total - entrega_inicial.';

-- ── 4. Permisos y RLS, igual que el resto del schema ─────────────────────────
GRANT SELECT, INSERT, UPDATE, DELETE ON total.venta_cuotas            TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON total.cobro_cuota_aplicacion  TO anon, authenticated, service_role;

ALTER TABLE total.venta_cuotas           ENABLE ROW LEVEL SECURITY;
ALTER TABLE total.cobro_cuota_aplicacion ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS venta_cuotas_rls ON total.venta_cuotas;
CREATE POLICY venta_cuotas_rls ON total.venta_cuotas
  FOR ALL TO authenticated
  USING (total.puede_acceder_empresa(empresa_id))
  WITH CHECK (total.puede_acceder_empresa(empresa_id));

DROP POLICY IF EXISTS cobro_cuota_aplicacion_rls ON total.cobro_cuota_aplicacion;
CREATE POLICY cobro_cuota_aplicacion_rls ON total.cobro_cuota_aplicacion
  FOR ALL TO authenticated
  USING (total.puede_acceder_empresa(empresa_id))
  WITH CHECK (total.puede_acceder_empresa(empresa_id));

-- ── 5. PostgREST sirve su caché de esquema hasta que se la recarga ───────────
NOTIFY pgrst, 'reload schema';
