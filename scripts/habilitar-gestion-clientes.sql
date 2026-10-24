-- =============================================================================
-- total — habilitar el módulo "Gestión Clientes" en el menú
--
-- La pantalla ya existe y funciona escribiendo la dirección a mano, pero el
-- sidebar solo muestra los módulos ASIGNADOS a la empresa. El slug
-- `gestion-clientes` estaba en el catálogo `total.modulos` y no en
-- `total.empresa_modulos`, así que el ítem se filtraba y no había forma de
-- llegar desde el menú.
--
-- Idempotente: si ya está asignado, no hace nada.
-- =============================================================================

INSERT INTO total.empresa_modulos (empresa_id, modulo_id, activo)
SELECT e.id, m.id, true
  FROM total.empresas e
  CROSS JOIN total.modulos m
 WHERE m.slug = 'gestion-clientes'
   AND NOT EXISTS (
     SELECT 1 FROM total.empresa_modulos em
      WHERE em.empresa_id = e.id AND em.modulo_id = m.id
   );

-- Si existía desactivado, se reactiva.
UPDATE total.empresa_modulos em
   SET activo = true
  FROM total.modulos m
 WHERE m.id = em.modulo_id
   AND m.slug = 'gestion-clientes'
   AND em.activo IS DISTINCT FROM true;
