-- =============================================================================
-- total — liberar el número de factura 0000005
--
-- QUÉ SE BORRA: solo FAC-000005. Nunca se firmó ni se envió a la SET (no tiene
-- documento electrónico ni CDC), no tiene pagos, y la venta de la que salió
-- (VTA-000011) está anulada. Es un documento que fiscalmente nunca existió.
--
-- QUÉ NO SE TOCA, y por qué:
--   FAC-000003 → consumió el 001-002-0000003 ante la SET (CDC ...00003...),
--   FAC-000004 → consumió el 001-002-0000004 (CDC ...00004...).
--   Los dos están CANCELADOS en SIFEN, pero cancelado no es inexistente: esos
--   números quedaron usados para siempre y el documento tiene que poder
--   mostrarse si la SET lo pide.
--   FAC-000001 y FAC-000002 tampoco se borran: están antes del 3 y del 4, así
--   que borrarlas no libera ningún número reutilizable (el contador no puede
--   volver atrás del 4 sin chocar con lo ya declarado), y FAC-000001 tiene un
--   pago registrado que quedaría colgado.
--
-- RESULTADO: el contador vuelve a 4, así que la próxima factura será
-- FAC-000005 → 001-002-0000005, que está libre en la SET.
-- =============================================================================

BEGIN;

-- Red de seguridad: si alguna de las dos declaradas se coló en el borrado,
-- la transacción se cae antes de tocar nada.
DO $$
DECLARE
  v_protegidas int;
BEGIN
  SELECT count(*) INTO v_protegidas
    FROM total.facturas f
    JOIN total.factura_electronica fe ON fe.factura_id = f.id
   WHERE f.numero_factura = 'FAC-000005';
  IF v_protegidas > 0 THEN
    RAISE EXCEPTION 'FAC-000005 tiene documento electrónico: NO se puede borrar.';
  END IF;
END $$;

DELETE FROM total.factura_items
 WHERE factura_id IN (SELECT id FROM total.facturas WHERE numero_factura = 'FAC-000005');

DELETE FROM total.facturas
 WHERE numero_factura = 'FAC-000005'
   AND NOT EXISTS (SELECT 1 FROM total.factura_electronica fe WHERE fe.factura_id = total.facturas.id)
   AND NOT EXISTS (SELECT 1 FROM total.pagos p WHERE p.factura_id = total.facturas.id);

-- El contador solo avanza: se lo deja en 4 para que la próxima sea la 5.
UPDATE total.factura_correlativos
   SET ultimo_numero = 4, updated_at = now()
 WHERE prefijo = 'FAC-' AND ultimo_numero = 5;

COMMIT;
