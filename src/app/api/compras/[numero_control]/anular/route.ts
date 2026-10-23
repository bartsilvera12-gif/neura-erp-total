import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { fetchDataSchemaForEmpresaId } from "@/lib/supabase/empresa-data-schema";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";
import { getChatPostgresPool, quoteSchemaTable } from "@/lib/supabase/chat-pg-pool";
import { assertAllowedChatDataSchema } from "@/lib/supabase/chat-data-schema";

function pool() {
  const p = getChatPostgresPool();
  if (!p) throw new Error("Pool no disponible.");
  return p;
}

/**
 * POST /api/compras/[numero_control]/anular
 *
 * Anula una compra individual (identificada por numero_control). Revierte
 * el stock ingresado, marca la(s) fila(s) de compras.anulada_at y crea un
 * contra-movimiento SALIDA visible en Inventario > Movimientos.
 * NO toca la orden de compra padre.
 *
 * Body: { motivo?: string }
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ numero_control: string }> }
) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    const { numero_control } = await params;
    const numeroControl = decodeURIComponent(numero_control);
    const schemaRaw = await fetchDataSchemaForEmpresaId(ctx.auth.empresa_id);
    const schema = assertAllowedChatDataSchema(schemaRaw);
    const empresaId = ctx.auth.empresa_id;
    const usuarioId = ctx.auth.usuarioCatalogId ?? null;

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const motivo = body.motivo != null
      ? String(body.motivo).trim().slice(0, 500) || null
      : null;

    const tC = quoteSchemaTable(schema, "compras");
    const tP = quoteSchemaTable(schema, "productos");
    const tM = quoteSchemaTable(schema, "movimientos_inventario");
    const tCm = quoteSchemaTable(schema, "caja_movimientos");
    const tCxp = quoteSchemaTable(schema, "cuentas_por_pagar");
    const tCuo = quoteSchemaTable(schema, "compra_cuotas");
    const tPagProv = quoteSchemaTable(schema, "pagos_proveedores");

    const client = await pool().connect();
    try {
      await client.query("BEGIN");

      const { rows: compras } = await client.query<{
        id: string;
        producto_id: string;
        producto_nombre: string;
        cantidad: string;
        costo_unitario: string;
      }>(
        `SELECT id, producto_id, producto_nombre, cantidad::text, costo_unitario::text
           FROM ${tC}
          WHERE empresa_id = $1::uuid
            AND numero_control = $2
            AND anulada_at IS NULL`,
        [empresaId, numeroControl]
      );

      if (compras.length === 0) {
        await client.query("ROLLBACK");
        return NextResponse.json(
          errorResponse("Compra no encontrada o ya anulada."),
          { status: 404 }
        );
      }

      let unidadesDevueltas = 0;
      for (const c of compras) {
        const cantidad = Number(c.cantidad);
        if (!Number.isFinite(cantidad) || cantidad <= 0) continue;

        await client.query(
          `UPDATE ${tP}
              SET stock_actual = GREATEST(0, stock_actual - $1::numeric),
                  updated_at = now()
            WHERE id = $2::uuid AND empresa_id = $3::uuid`,
          [cantidad, c.producto_id, empresaId]
        );

        await client.query(
          `UPDATE ${tC}
              SET anulada_at = now(),
                  anulada_por = $1,
                  anulada_motivo = $2
            WHERE id = $3::uuid AND empresa_id = $4::uuid`,
          [usuarioId, motivo, c.id, empresaId]
        );

        // Marcar mov ENTRADA original (best-effort)
        try {
          await client.query(
            `UPDATE ${tM}
                SET anulado_at = now(),
                    anulado_por = $1
              WHERE empresa_id = $2::uuid
                AND referencia = $3
                AND producto_id = $4::uuid
                AND tipo = 'ENTRADA'
                AND anulado_at IS NULL`,
            [usuarioId, empresaId, numeroControl, c.producto_id]
          );
        } catch {
          /* columna puede no existir; el contra-mov queda igual */
        }

        // Contra-movimiento SALIDA
        await client.query(
          `INSERT INTO ${tM} (
             empresa_id, producto_id, producto_nombre, producto_sku,
             tipo, cantidad, costo_unitario, origen, referencia, fecha,
             created_by, usuario_nombre
           )
           SELECT $1::uuid, $2::uuid, $3, COALESCE(p.sku, ''),
                  'SALIDA', $4::numeric, $5::numeric, 'ajuste_manual', $6, now(),
                  $7::uuid, NULL
           FROM ${tP} p WHERE p.id = $2::uuid`,
          [
            empresaId,
            c.producto_id,
            c.producto_nombre,
            cantidad,
            Number(c.costo_unitario) || 0,
            `ANUL-${numeroControl}`,
            usuarioId,
          ]
        );

        unidadesDevueltas += cantidad;
      }

      /**
       * Caja: si la compra se pagó en efectivo desde la caja, ese egreso deja
       * de valer. Antes quedaba vivo y el arqueo seguía descontando plata de
       * una compra que ya no existe.
       *
       * El movimiento no guarda el número de compra en una columna propia: se
       * lo reconoce por el concepto que escribe la propia alta, "Compra
       * <numero>: <proveedor>".
       */
      const egresos = await client.query(
        `UPDATE ${tCm}
            SET anulado_at = now(), anulado_por = $1::uuid,
                anulado_motivo = $2
          WHERE empresa_id = $3::uuid
            AND tipo = 'egreso'
            AND anulado_at IS NULL
            AND concepto LIKE $4`,
        [usuarioId, `Compra ${numeroControl} anulada`, empresaId, `Compra ${numeroControl}:%`]
      );

      /**
       * Cuenta por pagar: una compra anulada no se debe. Se anula la cuenta y
       * sus cuotas. Si ya tenía pagos registrados NO se toca y se avisa: esa
       * plata salió de verdad y hay que resolverla a mano (nota de crédito del
       * proveedor o devolución).
       */
      const { rows: cxpRows } = await client.query<{ id: string; saldo: string }>(
        `SELECT id, saldo::text FROM ${tCxp}
          WHERE empresa_id = $1::uuid AND compra_numero_control = $2`,
        [empresaId, numeroControl]
      );
      let cuentasAnuladas = 0;
      let avisoPagos: string | null = null;
      for (const c of cxpRows) {
        const { rows: pg } = await client.query<{ n: number }>(
          `SELECT count(*)::int AS n FROM ${tPagProv} WHERE cuenta_por_pagar_id = $1::uuid`,
          [c.id]
        );
        if ((pg[0]?.n ?? 0) > 0) {
          avisoPagos = `La cuenta por pagar de ${numeroControl} tiene pagos registrados: se dejó como estaba. Revisala en Finanzas → Pagos.`;
          continue;
        }
        await client.query(
          `UPDATE ${tCuo} SET estado = 'anulada', saldo = 0 WHERE cuenta_por_pagar_id = $1::uuid`,
          [c.id]
        );
        await client.query(
          // En cuentas_por_pagar el CHECK admite 'anulado'; en compra_cuotas, 'anulada'.
          `UPDATE ${tCxp} SET estado = 'anulado', saldo = 0 WHERE id = $1::uuid`,
          [c.id]
        );
        cuentasAnuladas += 1;
      }

      await client.query("COMMIT");
      return NextResponse.json(
        successResponse({
          ok: true,
          numero_control: numeroControl,
          filas_anuladas: compras.length,
          unidades_devueltas: unidadesDevueltas,
          egresos_de_caja_anulados: egresos.rowCount ?? 0,
          cuentas_por_pagar_anuladas: cuentasAnuladas,
          aviso: avisoPagos,
        })
      );
    } catch (err) {
      await client.query("ROLLBACK").catch(() => null);
      throw err;
    } finally {
      client.release();
    }
  } catch (err) {
    console.error(
      "[/api/compras/[numero_control]/anular]",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json(
      errorResponse("No se pudo anular la compra."),
      { status: 500 }
    );
  }
}
