import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { fetchDataSchemaForEmpresaId } from "@/lib/supabase/empresa-data-schema";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";
import { getChatPostgresPool, quoteSchemaTable } from "@/lib/supabase/chat-pg-pool";
import { assertAllowedChatDataSchema } from "@/lib/supabase/chat-data-schema";

/**
 * IdCSC del QR: "0001" el primer CSC que entrega la DNIT, "0002" el segundo.
 *
 * Va por Postgres directo y no por PostgREST a propósito. La columna se agrega
 * con un ALTER TABLE, y PostgREST sigue sirviendo su caché de esquema hasta que
 * se la recarga: mientras tanto rechaza cualquier escritura que la mencione.
 * Como el resto de la configuración SIFEN sí pasa por PostgREST, incluir este
 * campo ahí tumbaba el guardado entero con «Could not find the 'csc_id' column
 * of 'empresa_sifen_config' in the schema cache».
 */

function normalizarIdCsc(v: unknown): string | null {
  const d = String(v ?? "").replace(/\D/g, "");
  if (!d) return null;
  return d.slice(0, 4).padStart(4, "0");
}

async function tabla(empresaId: string) {
  const pool = getChatPostgresPool();
  if (!pool) throw new Error("Pool no disponible.");
  const schema = assertAllowedChatDataSchema(await fetchDataSchemaForEmpresaId(empresaId));
  return { pool, t: quoteSchemaTable(schema, "empresa_sifen_config") };
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    const { pool, t } = await tabla(ctx.auth.empresa_id);
    const { rows } = await pool.query<{ csc_id: string | null }>(
      `SELECT csc_id FROM ${t} WHERE empresa_id = $1::uuid LIMIT 1`,
      [ctx.auth.empresa_id]
    );
    return NextResponse.json(successResponse({ csc_id: normalizarIdCsc(rows[0]?.csc_id) ?? "0001" }));
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    // Sin la columna todavía, el QR sigue usando 0001 como hasta ahora.
    if (/csc_id/i.test(m)) {
      return NextResponse.json(successResponse({ csc_id: "0001", columna_faltante: true }));
    }
    console.error("[/api/configuracion/sifen/csc-id GET]", m);
    return NextResponse.json(errorResponse("No se pudo leer el Id del CSC."), { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const id = normalizarIdCsc(body.csc_id);
    if (!id) {
      return NextResponse.json(errorResponse("Id del CSC inválido (se espera 0001 o 0002)."), { status: 400 });
    }

    const { pool, t } = await tabla(ctx.auth.empresa_id);
    const { rows } = await pool.query<{ csc_id: string | null }>(
      `UPDATE ${t} SET csc_id = $2 WHERE empresa_id = $1::uuid RETURNING csc_id`,
      [ctx.auth.empresa_id, id]
    );
    if (rows.length === 0) {
      return NextResponse.json(errorResponse("No hay configuración SIFEN para esta empresa."), { status: 404 });
    }
    return NextResponse.json(successResponse({ csc_id: rows[0].csc_id ?? id }));
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err);
    if (/csc_id/i.test(m)) {
      return NextResponse.json(
        errorResponse(
          "Falta la columna csc_id en la base: ALTER TABLE <schema>.empresa_sifen_config ADD COLUMN IF NOT EXISTS csc_id text NOT NULL DEFAULT '0001';"
        ),
        { status: 400 }
      );
    }
    console.error("[/api/configuracion/sifen/csc-id PATCH]", m);
    return NextResponse.json(errorResponse("No se pudo guardar el Id del CSC."), { status: 500 });
  }
}
