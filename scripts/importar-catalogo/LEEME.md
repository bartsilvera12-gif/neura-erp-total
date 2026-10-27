# Cargar el catálogo de Total Electrodomésticos

Origen: `LISTA DE PRODUCTOS (2).XLS` (export del sistema viejo, 3.437 filas).

De esas filas entran **3.391 productos**:

| Se descartan | Cuántas | Por qué |
|---|---|---|
| `ESTADO = 0` | 34 | dados de baja en el sistema viejo |
| Conceptos contables | 12 | `DESCUENTO`, `SALDO ANTERIOR`, `REFINANCIACION`, `APOYO COMERCIAL`, `ACUERDO COMERCIAL`, `DELIVERY`, `NO DEFINIDO`, `INDEMNIZACIÓN…`, y tres números de chasis |

El `DESCUENTO` venía con precio **−619.000**: si entraba como producto, los
reportes de margen quedaban mal.

## Paso 1 — cargar los productos (7 partes)

Partido de 500 en 500 para no ahogar el SQL editor:

| Archivo | Productos | Acumulado |
|---|---|---|
| `01-productos-01-de-07.sql` | 500 | 500 |
| `01-productos-02-de-07.sql` | 500 | 1.000 |
| `01-productos-03-de-07.sql` | 500 | 1.500 |
| `01-productos-04-de-07.sql` | 500 | 2.000 |
| `01-productos-05-de-07.sql` | 500 | 2.500 |
| `01-productos-06-de-07.sql` | 500 | 3.000 |
| `01-productos-07-de-07.sql` | 391 | 3.391 |

Cada una pesa ~57 KB y al final imprime el acumulado, así que mirando ese
número sabés en qué parte vas.

No están en el repo: traen la columna COSTO y el repo es público. Quedan sólo
en la máquina, en esta carpeta.

Qué carga:

- **SKU** = el `IDART` del sistema viejo, tal cual. Buscando "3044" en el ERP
  aparece el mismo producto que en las listas impresas de antes.
- **Código de barras**: la lista lo trae vacío en las 3.437 filas, así que el
  SQL pide uno a la misma secuencia que usa el ERP
  (`total.incrementar_secuencia_producto`) y queda `INT-000001`…`INT-003391`.
  Así no choca con los que genere el sistema después.
- **Stock = 0** en todos. La lista no trae cantidades.
- **Categoría**: asignada por el nombre del producto (ver abajo).

Las partes son idempotentes y no les importa el orden: cada una crea las
categorías si faltan y saltea los SKU que ya existan. Si te perdiste y no
sabés cuál corriste, corré las 7 de nuevo — no duplica nada ni pisa un precio
editado a mano.

> También se puede cargar de una por **Inventario → Importar** con
> `01-productos.xlsx` (mismos datos, marcando "crear faltantes").

## Paso 2 — marcas y prolijidad de categorías

`02-marcas-y-categorias.sql`, **después** del paso 1. Hace tres cosas:

1. Renombra a Title Case las 5 categorías que el importador crea en MAYÚSCULA.
2. Crea 109 marcas que faltaban, reusando las que ya estaban (`Samsung` no se
   duplica como `SAMSUNG`).
3. Asigna la marca a 2.633 productos por SKU.

Es idempotente: correrlo dos veces no duplica nada.

**758 productos quedan sin marca.** Son los que no pude identificar con
certeza — preferí dejarlos vacíos antes que inventar una marca equivocada.

## Paso 3 — borrar los productos de ejemplo (opcional)

`03-limpiar-demo.sql` borra los 20 `DEMO-*`. Aborta solo si alguno aparece en
una venta.

Los 3 de prueba (`PRODUCTO PRUEBA`, `PRODUCTO PRUEBA 2`, `PRUEBA 3`) **no** se
tocan: tienen 16 renglones de venta de los videos. Para borrarlos hay que
anular esas ventas primero.

## Nombres con el encoding roto

El export del sistema viejo trae **10 nombres con el UTF-8 roto**: venían
`BALANZA DIGITAL P/ BAÃ`O`, `ASPIRADORA SPEED PORTÃ¡TIL`,
`VITROCERÃ¡MICA`, `DISEÃ±O TORTUGA`, `TENSIOMETRO DE MUÃ`ECA`.

Son bytes UTF-8 que el sistema viejo leyó como Latin-1. El SQL los carga ya
reparados (`BAÑO`, `PORTÁTIL`, `VITROCERÁMICA`, `DISEÑO`, `MUÑECA`).

En cuatro de ellos el segundo byte de la Ñ salió como un backtick ASCII, así
que el round-trip no alcanzaba y van con un reemplazo explícito.

## Reparto por categoría

| Categoría | Productos | |
|---|---|---|
| Cocina | 948 | ya existía |
| TV & Audio | 434 | ya existía |
| Dormitorio | 336 | ya existía |
| Cuidado Personal | 272 | ya existía |
| Refrigeración | 222 | ya existía |
| Deportes & Exterior | 216 | ya existía |
| Muebles & Hogar | 209 | **nueva** |
| Celulares & Tecnología | 205 | ya existía |
| Lavado | 176 | ya existía |
| Climatización | 165 | ya existía |
| Herramientas | 100 | **nueva** |
| Limpieza | 92 | **nueva** |
| Automotor | 15 | **nueva** |
| Varios | 1 | **nueva** |

Las categorías se deducen del nombre, no vienen en la lista. "AA SPLIT
CARRIER 12000BTU" → Climatización, "SOMMIER…" → Dormitorio. Un solo producto
quedó en Varios: `COMBO ELECTRODOMESTICOS` (3287), que no dice qué trae.

Los nombres con acento (`Climatización`, `Refrigeración`,
`Celulares & Tecnología`) van **escritos con acento** en el Excel a propósito:
el importador compara `nombre.toUpperCase()` sin sacar diacríticos, así que
"CLIMATIZACION" no matchea "Climatización" y trataría de crear una categoría
nueva. Eso choca contra `uq_categorias_slug_web` (mismo slug
`climatizacion`), el importador **no aborta** — lo deja como warning — y esos
165 productos entrarían sin categoría.

## Cómo se probó

Las dos corridas de SQL se probaron contra la base real dentro de
`BEGIN … ROLLBACK`, insertando antes los 3.391 productos igual que lo hace el
importador. Resultado: 0 sin categoría, 0 marcas duplicadas, 0 categorías con
slug repetido, las vistas de reporte (`v_reporte_stock`, `v_reporte_marca`,
`v_costos_precios`) siguen respondiendo, y 23 productos después del rollback.
