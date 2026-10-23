import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { fetchDataSchemaForEmpresaId } from "@/lib/supabase/empresa-data-schema";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";
import { listCuotas, registrarPagoProveedor } from "@/lib/cuentas-por-pagar/server/cxp-pg";

/**
 * Cuentas por pagar: las cuotas de las compras a proveedores.
 *
 * El motor (listCuotas / registrarPagoProveedor) ya existía y es transaccional,
 * pero no estaba expuesto: sin API ni pantalla, el módulo "Pagos" del menú
 * terminaba mostrando Cobranzas.
 */

export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    const schema = await fetchDataSchemaForEmpresaId(ctx.auth.empresa_id);
    const cuotas = await listCuotas(schema, ctx.auth.empresa_id);
    return NextResponse.json(successResponse({ cuotas }));
  } catch (err) {
    console.error("[api/cuentas-por-pagar] GET:", err instanceof Error ? err.message : err);
    return NextResponse.json(
      errorResponse(err instanceof Error ? err.message : "No se pudieron traer las cuotas."),
      { status: 500 }
    );
  }
}

/** POST — registra un pago (parcial o total) de una cuota. */
export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    const body = await request.json().catch(() => ({}));
    const cuotaId = typeof body?.cuota_id === "string" ? body.cuota_id.trim() : "";
    const monto = Number(body?.monto);

    if (!cuotaId) return NextResponse.json(errorResponse("Falta la cuota."), { status: 400 });
    if (!Number.isFinite(monto) || monto <= 0) {
      return NextResponse.json(errorResponse("El monto debe ser mayor a 0."), { status: 400 });
    }

    const schema = await fetchDataSchemaForEmpresaId(ctx.auth.empresa_id);
    const res = await registrarPagoProveedor(schema, ctx.auth.empresa_id, {
      cuotaId,
      monto,
      fechaPago: typeof body?.fecha_pago === "string" ? body.fecha_pago : null,
      metodoPago: typeof body?.metodo_pago === "string" ? body.metodo_pago : null,
      referencia: typeof body?.referencia === "string" ? body.referencia : null,
      observaciones: typeof body?.observaciones === "string" ? body.observaciones : null,
      usuarioId: ctx.auth.user?.id ?? null,
      usuarioNombre: ctx.auth.nombre ?? ctx.auth.user?.email ?? null,
    });

    return NextResponse.json(successResponse({ ok: true, caja_warning: res.caja_warning }));
  } catch (err) {
    console.error("[api/cuentas-por-pagar] POST:", err instanceof Error ? err.message : err);
    // El motor valida que el pago no supere el saldo: ese mensaje le sirve al
    // cajero, así que se devuelve tal cual.
    return NextResponse.json(
      errorResponse(err instanceof Error ? err.message : "No se pudo registrar el pago."),
      { status: 400 }
    );
  }
}
