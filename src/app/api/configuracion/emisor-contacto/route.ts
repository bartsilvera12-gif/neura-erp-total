import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { fetchDataSchemaForEmpresaId } from "@/lib/supabase/empresa-data-schema";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";
import { getChatPostgresPool, quoteSchemaTable } from "@/lib/supabase/chat-pg-pool";
import { assertAllowedChatDataSchema } from "@/lib/supabase/chat-data-schema";

/**
 * Teléfono y correo del EMISOR (los de la empresa, en `empresas`).
 *
 * SIFEN los exige en el XML: `gEmis.dTelEmi` pide entre 8 y 15 dígitos y
 * `dEmailE` un correo. Vivían solo en la tabla, sin ninguna pantalla que los
 * cargara, así que quedaban vacíos y la factura electrónica fallaba con
 * "emisorTelefono debe tener entre 8 y 15 dígitos" sin decir dónde cargarlo.
 *
 * Se guardan en `empresas` porque de ahí los lee `getEmisorDatos`, que es la
 * fuente única para los documentos impresos y para el XML.
 */

/** Dígitos del teléfono, que es lo que termina en el XML. */
function soloDigitos(v: unknown): string {
  return String(v ?? "").replace(/\D/g, "");
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    const pool = getChatPostgresPool();
    if (!pool) throw new Error("Pool no disponible.");
    const schema = assertAllowedChatDataSchema(await fetchDataSchemaForEmpresaId(ctx.auth.empresa_id));
    const t = quoteSchemaTable(schema, "empresas");

    const { rows } = await pool.query<{ telefono: string | null; email: string | null }>(
      `SELECT telefono, email FROM ${t} WHERE id = $1::uuid LIMIT 1`,
      [ctx.auth.empresa_id]
    );
    return NextResponse.json(
      successResponse({
        telefono: (rows[0]?.telefono ?? "").trim(),
        email: (rows[0]?.email ?? "").trim(),
      })
    );
  } catch (err) {
    console.error("[/api/configuracion/emisor-contacto GET]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudieron cargar los datos de contacto."), { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const telefono = soloDigitos(body.telefono);
    const email = String(body.email ?? "").trim();

    // Las mismas reglas que valida el XML, pero acá se avisa a tiempo y en la
    // pantalla donde se cargan, no al emitir la factura.
    if (telefono && (telefono.length < 8 || telefono.length > 15)) {
      return NextResponse.json(
        errorResponse("El teléfono debe tener entre 8 y 15 dígitos (ej. 0981123456)."),
        { status: 400 }
      );
    }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) {
      return NextResponse.json(errorResponse("El correo no tiene un formato válido."), { status: 400 });
    }

    const pool = getChatPostgresPool();
    if (!pool) throw new Error("Pool no disponible.");
    const schema = assertAllowedChatDataSchema(await fetchDataSchemaForEmpresaId(ctx.auth.empresa_id));
    const t = quoteSchemaTable(schema, "empresas");

    const { rows } = await pool.query<{ telefono: string | null; email: string | null }>(
      `UPDATE ${t}
          SET telefono = $2, email = $3
        WHERE id = $1::uuid
        RETURNING telefono, email`,
      [ctx.auth.empresa_id, telefono || null, email || null]
    );
    if (rows.length === 0) {
      return NextResponse.json(errorResponse("No se encontró la empresa."), { status: 404 });
    }

    return NextResponse.json(
      successResponse({
        telefono: (rows[0].telefono ?? "").trim(),
        email: (rows[0].email ?? "").trim(),
      })
    );
  } catch (err) {
    console.error("[/api/configuracion/emisor-contacto PATCH]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudieron guardar los datos de contacto."), { status: 500 });
  }
}
