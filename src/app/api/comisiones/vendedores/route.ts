/**
 * Vendedores de la empresa (usuarios con `es_vendedor = true`).
 *
 * GET → { vendedores: [{ id, nombre, email }] }
 *
 * Lo usa el selector de vendedor en Caja (/ventas y /ventas/nueva) para
 * atribuir la venta a un asesor. Accesible a cualquier usuario autenticado
 * de la empresa, porque el cajero lo necesita.
 *
 * El modulo de Comisiones no se porto a Total, asi que esta ruta ya no
 * expone `porcentaje_comision` ni el PATCH que lo editaba.
 */
import { NextResponse } from "next/server";
import { errorResponse, successResponse } from "@/lib/api/response";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";

export async function GET(request: Request) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse("No autenticado"), { status: 401 });

    const { data, error } = await ctx.supabase
      .from("usuarios")
      .select("id, nombre, email")
      .eq("empresa_id", ctx.auth.empresa_id)
      .eq("es_vendedor", true)
      .order("nombre", { ascending: true });
    if (error) throw new Error(error.message);

    const vendedores = (data ?? []).map((u) => {
      const row = u as { id: string; nombre?: string | null; email?: string | null };
      return {
        id: String(row.id),
        nombre: (row.nombre ?? "").trim() || (row.email ?? "").trim(),
        email: (row.email ?? "").trim(),
      };
    });

    return NextResponse.json(successResponse({ vendedores }));
  } catch (err) {
    console.error("[/api/comisiones/vendedores]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("Error al listar vendedores"), { status: 500 });
  }
}
