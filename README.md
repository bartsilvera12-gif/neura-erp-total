# Neura ERP — Total Electrodomésticos

ERP de Total Electrodomésticos. **Etapa 2 del proyecto: todavía no arrancó.**

La web vive en [`total-electrodomesticos-web`](https://github.com/bartsilvera12-gif/total-electrodomesticos-web)
y está diseñada desacoplada, con datos mock, esperando esta integración.

## Estado

Repo vacío a propósito. El paso siguiente es partir de un ERP hermano de la familia
(`neura-erp-esqueleto` o el que mejor se parezca a este caso) y ajustar schema y módulos.

## Decisiones pendientes

- **Schema.** Lo fija `APP_DB_SCHEMA`. Hay que elegir el nombre y revisar que matchee los
  patrones de tenant del código, porque varios clientes mordieron ahí.
- **Instancia.** ¿Supabase compartida (`api.neura.com.py`) o instancia dedicada?
- **ERP base.** De qué ERP hermano se clona.

## Módulos contemplados

Clientes · Cobranzas · Compras · Dashboard · Gastos · Gerencia · Inventario · Movimientos ·
Notas de crédito · Pagos · Reportes · Tableros · Ventas · Productos · Stock · Precios ·
Pedidos provenientes de la web · Facturación · Caja · Proveedores · Cuentas por cobrar ·
Cuentas por pagar · Usuarios y permisos

## Integración con la web

Cuando se conecte, el ERP define la fuente de verdad de: producto, precio, stock, cliente,
pedido, venta y factura. La web no debe construir una segunda lógica que entre en conflicto.

El panel web se queda solo con lo editorial: imágenes, descripciones comerciales, banners,
orden de categorías, destacados, home, SEO.

### Catálogo

~3.400 artículos, con campos `IDART`, `NOMBRE`, `CODBARRA`, `PRECIO_1`, `COSTO`, `ESTADO`.

**`COSTO` es información interna y nunca sale en la web pública.** El archivo del catálogo
no se versiona en ningún repo del proyecto.

---

Desarrollado por [Neura](https://neura.com.py)
