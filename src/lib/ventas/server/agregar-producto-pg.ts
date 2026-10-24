/**
 * Agregar un producto a una venta ya registrada, ajustando stock, IVA, total y
 * la caja del día — manteniendo el MISMO número de venta.
 *
 * Para cuando el cajero cerró la venta y el cliente se acordó de algo, o se le
 * pasó cargar un ítem. Hasta ahora la única salida era anular y rehacer todo.
 *
 * SOLO VENTAS POR TICKET. Si la venta ya emitió factura, el documento declarado
 * ante la SET (o el talonario preimpreso) dejaría de coincidir con lo vendido:
 * eso se corrige cancelando el DE o con una nota de crédito, no agregando
 * líneas por atrás.
 *
 * Caja: una venta al contado no genera fila en `caja_movimientos`; el efectivo
 * esperado del turno se DERIVA de `ventas.total`, así que al recalcular el total
 * el arqueo se ajusta solo. En pago MIXTO el efectivo sale del desglose de
 * `ventas_pagos_detalle`, y ahí la diferencia se carga sobre la línea de
 * efectivo, que es la plata que el cajero cobra en el mostrador.
 *
 * Guardrails: venta ACTIVA al CONTADO, sin factura, caja ABIERTA cuando hay
 * efectivo, y producto sin receta ni series. Corre en UNA transacción.
 */
import { getChatPostgresPool, quoteSchemaTable } from "@/lib/supabase/chat-pg-pool";
import { assertAllowedChatDataSchema } from "@/lib/supabase/chat-data-schema";

export interface AgregarProductoParams {
  productoId: string;
  cantidad: number;
  precioVenta: number;
  tipoIva: "EXENTA" | "5%" | "10%";
  /** Si true, deja vender aunque el stock no alcance (queda en negativo). */
  permitirSinStock?: boolean;
  createdBy?: string | null;
  usuarioNombre?: string | null;
}

export interface AgregarProductoResultado {
  numero_control: string;
  total_anterior: number;
  total_nuevo: number;
  /** Lo que hay que cobrarle al cliente por lo agregado. */
  diferencia: number;
  producto_nombre: string;
}

export class AgregarProductoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AgregarProductoError";
  }
}

function num(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"));
  return Number.isFinite(n) ? n : 0;
}

/** IVA incluido en el precio (Paraguay): se extrae desde adentro del total. */
function calcIva(tipoIva: string, totalLinea: number): number {
  if (tipoIva === "10%") return Math.round(totalLinea - totalLinea / 1.1);
  if (tipoIva === "5%") return Math.round(totalLinea - totalLinea / 1.05);
  return 0; // EXENTA
}

export async function agregarProductoVenta(
  schemaRaw: string,
  empresaId: string,
  ventaId: string,
  p: AgregarProductoParams
): Promise<AgregarProductoResultado> {
  const pool = getChatPostgresPool();
  if (!pool) throw new AgregarProductoError("Pool no disponible.");
  const schema = assertAllowedChatDataSchema(schemaRaw);
  const tVentas = quoteSchemaTable(schema, "ventas");
  const tItems = quoteSchemaTable(schema, "ventas_items");
  const tProd = quoteSchemaTable(schema, "productos");
  const tMov = quoteSchemaTable(schema, "movimientos_inventario");
  const tCajas = quoteSchemaTable(schema, "cajas");
  const tPagos = quoteSchemaTable(schema, "ventas_pagos_detalle");
  const tFa = quoteSchemaTable(schema, "factura_autoimpresor");
  const tRecetas = quoteSchemaTable(schema, "recetas");

  if (!(p.cantidad > 0)) throw new AgregarProductoError("La cantidad debe ser mayor a cero.");
  if (!(p.precioVenta >= 0)) throw new AgregarProductoError("El precio no puede ser negativo.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1) Venta con lock + guardrails.
    const vQ = await client.query(
      `SELECT id, numero_control, estado, tipo_venta, metodo_pago, caja_id, factura_id,
              COALESCE(retencion_iva_monto,0) AS ret, total
         FROM ${tVentas} WHERE id=$1::uuid AND empresa_id=$2::uuid FOR UPDATE`,
      [ventaId, empresaId]
    );
    const v = vQ.rows[0] as Record<string, unknown> | undefined;
    if (!v) throw new AgregarProductoError("Venta no encontrada.");
    if (String(v.estado) !== "completada") {
      throw new AgregarProductoError("Solo se pueden agregar productos a ventas activas (no anuladas ni devueltas).");
    }
    if (v.factura_id) {
      throw new AgregarProductoError(
        "Esta venta ya emitió factura. Agregar productos cambiaría un documento declarado: cancelá la factura y rehacé la venta, o emitile una nota de crédito."
      );
    }
    if (String(v.tipo_venta).toUpperCase() === "CREDITO") {
      throw new AgregarProductoError("Por ahora solo ventas al contado: en crédito habría que rearmar las cuotas.");
    }

    // La preimpresa también es un documento con número de talonario.
    const faQ = await client.query(
      `SELECT numero_factura FROM ${tFa} WHERE venta_id=$1::uuid AND empresa_id=$2::uuid LIMIT 1`,
      [ventaId, empresaId]
    );
    const faNumero = faQ.rows[0] ? String((faQ.rows[0] as Record<string, unknown>).numero_factura ?? "").trim() : "";
    if (faNumero) {
      throw new AgregarProductoError(
        `Esta venta ya tiene el número de factura ${faNumero} del talonario. No se le pueden agregar productos.`
      );
    }

    // 2) Caja: solo el efectivo afecta el arqueo, y tiene que caer en el turno
    //    correcto. En mixto, el efectivo es solo su línea del desglose.
    const esMixto = String(v.metodo_pago) === "mixto";
    const lineaEfectivoQ = esMixto
      ? await client.query(
          `SELECT id, monto FROM ${tPagos}
            WHERE venta_id=$1::uuid AND empresa_id=$2::uuid AND metodo_pago='efectivo'
            ORDER BY created_at LIMIT 1 FOR UPDATE`,
          [ventaId, empresaId]
        )
      : null;
    const lineaEfectivo = lineaEfectivoQ?.rows[0] as Record<string, unknown> | undefined;

    if (String(v.metodo_pago) === "efectivo" || lineaEfectivo) {
      if (!v.caja_id) throw new AgregarProductoError("La venta en efectivo no tiene caja asociada; no se puede ajustar.");
      const cQ = await client.query(`SELECT estado FROM ${tCajas} WHERE id=$1::uuid AND empresa_id=$2::uuid`, [v.caja_id, empresaId]);
      if (!cQ.rows[0] || String((cQ.rows[0] as Record<string, unknown>).estado) !== "abierta") {
        throw new AgregarProductoError(
          "Esta venta cobró efectivo y su caja ya cerró. Solo se pueden agregar productos mientras la caja del día siga abierta (para no alterar un arqueo cerrado)."
        );
      }
    }

    // 3) Producto a agregar.
    const prodQ = await client.query(
      `SELECT nombre, sku, controla_stock, costo_promedio, stock_actual, maneja_series
         FROM ${tProd} WHERE id=$1::uuid AND empresa_id=$2::uuid FOR UPDATE`,
      [p.productoId, empresaId]
    );
    const prod = prodQ.rows[0] as Record<string, unknown> | undefined;
    if (!prod) throw new AgregarProductoError("El producto no existe.");
    if (prod.maneja_series === true) throw new AgregarProductoError("El producto maneja series; no se puede agregar por acá todavía.");

    // Receta = fila activa en `recetas`, igual que al vender (no `modo_receta`,
    // que es solo CUÁNDO se consume y viene con un default que marcaría a todos).
    const recetaQ = await client.query(
      `SELECT producto_id FROM ${tRecetas} WHERE empresa_id=$1::uuid AND activa = true AND producto_id=$2::uuid`,
      [empresaId, p.productoId]
    );
    if (recetaQ.rowCount && recetaQ.rowCount > 0) {
      throw new AgregarProductoError("El producto usa receta; no se puede agregar por acá todavía.");
    }

    const controlaStock = prod.controla_stock !== false;
    const stockActual = num(prod.stock_actual);
    if (controlaStock && !p.permitirSinStock && stockActual < p.cantidad) {
      throw new AgregarProductoError(
        `No hay stock suficiente de ${String(prod.nombre ?? "")}: quedan ${stockActual} y se piden ${p.cantidad}.`
      );
    }

    const numeroControl = String(v.numero_control);
    const obs = `Producto agregado a ${numeroControl}`;

    // 4) Línea nueva.
    const totalLinea = Math.round(p.cantidad * p.precioVenta);
    const montoIva = calcIva(p.tipoIva, totalLinea);
    const subtotalLinea = totalLinea - montoIva;
    await client.query(
      `INSERT INTO ${tItems}
         (empresa_id, venta_id, producto_id, producto_nombre, sku, cantidad, precio_venta,
          precio_venta_original, tipo_iva, tipo_precio, subtotal, monto_iva, total_linea,
          cantidad_total_base, costo_unitario)
       VALUES ($1::uuid,$2::uuid,$3::uuid,$4,$5,$6::numeric,$7::numeric,$7::numeric,$8,'minorista',
               $9::numeric,$10::numeric,$11::numeric,$6::numeric,$12::numeric)`,
      [empresaId, ventaId, p.productoId, String(prod.nombre ?? ""), String(prod.sku ?? ""),
       p.cantidad, p.precioVenta, p.tipoIva, subtotalLinea, montoIva, totalLinea, num(prod.costo_promedio)]
    );

    // 5) Stock: sale igual que en una venta normal, con origen 'venta', para que
    //    anular la venta lo devuelva como a cualquier otra línea.
    if (controlaStock && p.cantidad > 0) {
      await client.query(
        `UPDATE ${tProd} SET stock_actual = stock_actual - $2::numeric, updated_at=now() WHERE id=$1::uuid`,
        [p.productoId, p.cantidad]
      );
      await client.query(
        `INSERT INTO ${tMov} (empresa_id, producto_id, producto_nombre, producto_sku, tipo, cantidad, costo_unitario, origen, referencia, fecha, venta_id, created_by, usuario_nombre, observaciones)
         VALUES ($1::uuid,$2::uuid,$3,$4,'SALIDA',$5::numeric,$6::numeric,'venta',$7,now(),$8::uuid,$9,$10,$11)`,
        [empresaId, p.productoId, String(prod.nombre ?? ""), String(prod.sku ?? ""), p.cantidad,
         num(prod.costo_promedio), numeroControl, ventaId, p.createdBy ?? null, p.usuarioNombre ?? null, obs]
      );
    }

    // 6) Totales de la venta (suma de líneas) menos la retención.
    const sumQ = await client.query(
      `SELECT COALESCE(SUM(subtotal),0) sub, COALESCE(SUM(monto_iva),0) iva, COALESCE(SUM(total_linea),0) tot
         FROM ${tItems} WHERE venta_id=$1::uuid AND empresa_id=$2::uuid`,
      [ventaId, empresaId]
    );
    const sums = sumQ.rows[0] as Record<string, unknown>;
    const totalAnterior = num(v.total);
    const totalNuevo = Math.round(num(sums.tot)) - num(v.ret);
    await client.query(
      `UPDATE ${tVentas} SET subtotal=$2::numeric, monto_iva=$3::numeric, total=$4::numeric, updated_at=now() WHERE id=$1::uuid`,
      [ventaId, Math.round(num(sums.sub)), Math.round(num(sums.iva)), totalNuevo]
    );

    // 7) Detalle de pago: el cliente paga la diferencia en el mostrador.
    if (!esMixto) {
      await client.query(
        `UPDATE ${tPagos} SET monto=$2::numeric, updated_at=now() WHERE venta_id=$1::uuid AND empresa_id=$3::uuid`,
        [ventaId, totalNuevo, empresaId]
      );
    } else {
      const dif = totalNuevo - totalAnterior;
      if (dif !== 0) {
        if (!lineaEfectivo) {
          await client.query(
            `INSERT INTO ${tPagos} (empresa_id, venta_id, metodo_pago, monto, fecha_pago, observacion)
             VALUES ($1::uuid,$2::uuid,'efectivo',$3::numeric, now(), $4)`,
            [empresaId, ventaId, dif, obs]
          );
        } else {
          await client.query(
            `UPDATE ${tPagos} SET monto=$2::numeric, updated_at=now() WHERE id=$1::uuid`,
            [String(lineaEfectivo.id), num(lineaEfectivo.monto) + dif]
          );
        }
      }
    }

    await client.query("COMMIT");
    return {
      numero_control: numeroControl,
      total_anterior: totalAnterior,
      total_nuevo: totalNuevo,
      diferencia: totalNuevo - totalAnterior,
      producto_nombre: String(prod.nombre ?? ""),
    };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
