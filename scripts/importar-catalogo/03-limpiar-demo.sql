-- Total Electrodomesticos | opcional: borrar los productos de ejemplo
-- Los 20 DEMO-* no estan en ninguna venta, por eso se pueden borrar.
-- Los 3 REV-/PRUEBA si tienen ventas: NO se tocan aca (borralos cuando
-- termines de grabar los videos, y antes hay que anular esas ventas).
DO $$
DECLARE v_emp uuid; v_usados int;
BEGIN
  SELECT id INTO v_emp FROM total.empresas LIMIT 1;

  SELECT count(*) INTO v_usados
    FROM total.ventas_items vi
    JOIN total.productos p ON p.id = vi.producto_id
   WHERE p.empresa_id = v_emp AND p.sku LIKE 'DEMO-%';
  IF v_usados > 0 THEN
    RAISE EXCEPTION 'Hay % renglones de venta con productos DEMO. No borro nada.', v_usados;
  END IF;

  DELETE FROM total.producto_categorias
   WHERE empresa_id = v_emp
     AND producto_id IN (SELECT id FROM total.productos WHERE empresa_id=v_emp AND sku LIKE 'DEMO-%');
  DELETE FROM total.inventario_stock_ubicacion
   WHERE empresa_id = v_emp
     AND producto_id IN (SELECT id FROM total.productos WHERE empresa_id=v_emp AND sku LIKE 'DEMO-%');
  DELETE FROM total.movimientos_inventario
   WHERE empresa_id = v_emp
     AND producto_id IN (SELECT id FROM total.productos WHERE empresa_id=v_emp AND sku LIKE 'DEMO-%');
  DELETE FROM total.productos WHERE empresa_id = v_emp AND sku LIKE 'DEMO-%';

  -- La categoria "Hogar" del ejemplo queda vacia (uso "Muebles & Hogar")
  DELETE FROM total.categorias_productos
   WHERE empresa_id = v_emp AND nombre = 'Hogar'
     AND NOT EXISTS (SELECT 1 FROM total.productos WHERE categoria_principal_id = total.categorias_productos.id);

  -- Las marcas del ejemplo son marcas reales de la lista: se quedan,
  -- solo les saco el codigo "DEMO-..." para que no quede ese rastro.
  UPDATE total.marcas SET codigo = NULL, updated_at = now()
   WHERE empresa_id = v_emp AND codigo LIKE 'DEMO-%';
  UPDATE total.categorias_productos SET codigo = NULL, updated_at = now()
   WHERE empresa_id = v_emp AND codigo LIKE 'DEMO-%';
END $$;

SELECT 'productos que quedan' AS chequeo, count(*)::text AS valor FROM total.productos
UNION ALL SELECT 'productos DEMO (debe 0)', count(*)::text FROM total.productos WHERE sku LIKE 'DEMO-%';
