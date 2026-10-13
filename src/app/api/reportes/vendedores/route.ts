import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { fetchDataSchemaForEmpresaId } from "@/lib/supabase/empresa-data-schema";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";
import { getChatPostgresPool, quoteSchemaTable } from "@/lib/supabase/chat-pg-pool";
import { assertAllowedChatDataSchema } from "@/lib/supabase/chat-data-schema";

/**
 * Ventas por vendedor.
 *
 * La tarjeta del panel de Reportes apuntaba a /comisiones, que se dio de baja
 * junto con el módulo de Comisiones (el cliente no lo pidió), así que daba 404.
 * Esto la reemplaza con lo que sí sirve acá: cuánto vendió cada asesor.
 *
 * No calcula comisiones: eso vive en el módulo que no se porta.
 */

export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    const p = getChatPostgresPool();
    if (!p) throw new Error("Pool no disponible.");

    const schema = assertAllowedChatDataSchema(
      await fetchDataSchemaForEmpresaId(ctx.auth.empresa_id)
    );
    const tV = quoteSchemaTable(schema, "ventas");

    const { searchParams } = new URL(request.url);
    const hoy = new Date();
    const desde =
      searchParams.get("desde") ||
      `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;
    const hasta = searchParams.get("hasta") || hoy.toISOString().slice(0, 10);

    const { rows } = await p.query(
      `SELECT COALESCE(NULLIF(TRIM(v.vendedor_nombre), ''), 'Sin vendedor') AS vendedor,
              count(*)::int                        AS ventas,
              COALESCE(SUM(v.total), 0)::float8    AS total,
              COALESCE(AVG(v.total), 0)::float8    AS ticket_promedio,
              MAX(v.fecha)                         AS ultima_venta
         FROM ${tV} v
        WHERE v.empresa_id = $1::uuid
          AND COALESCE(v.estado, '') NOT IN ('anulada', 'devuelta_total')
          AND v.fecha >= $2::date
          AND v.fecha < ($3::date + interval '1 day')
        GROUP BY 1
        ORDER BY total DESC`,
      [ctx.auth.empresa_id, desde, hasta]
    );

    const vendedores = rows.map((r: Record<string, unknown>) => ({
      vendedor: String(r.vendedor),
      ventas: Number(r.ventas) || 0,
      total: Number(r.total) || 0,
      ticket_promedio: Number(r.ticket_promedio) || 0,
      ultima_venta: r.ultima_venta ? String(r.ultima_venta) : null,
    }));

    const total = vendedores.reduce((a, v) => a + v.total, 0);

    return NextResponse.json(successResponse({ desde, hasta, total, vendedores }));
  } catch (err) {
    console.error("[api/reportes/vendedores]", err instanceof Error ? err.message : err);
    return NextResponse.json(
      errorResponse(err instanceof Error ? err.message : "No se pudo armar el reporte."),
      { status: 500 }
    );
  }
}
