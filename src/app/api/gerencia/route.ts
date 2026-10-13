import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { fetchDataSchemaForEmpresaId } from "@/lib/supabase/empresa-data-schema";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";
import { getGerenciaReporte } from "@/lib/gerencia/comercial-pg";

/**
 * GET /api/gerencia?periodo=YYYY-MM
 *
 * Solo lectura. Sin `periodo`, el mes actual.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    const schema = await fetchDataSchemaForEmpresaId(ctx.auth.empresa_id);
    const periodo = new URL(request.url).searchParams.get("periodo") ?? undefined;

    const data = await getGerenciaReporte(schema, ctx.auth.empresa_id, periodo);
    return NextResponse.json(successResponse(data));
  } catch (err) {
    console.error("[api/gerencia]", err instanceof Error ? err.message : err);
    const msg = err instanceof Error ? err.message : "No se pudo armar el reporte.";
    return NextResponse.json(errorResponse(msg), { status: 500 });
  }
}
