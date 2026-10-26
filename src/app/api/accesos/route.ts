import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * Registro de inicios de sesión.
 *
 * POST lo llama la pantalla de login apenas la sesión queda abierta. El usuario
 * NO viaja en el cuerpo: se resuelve de la sesión, así nadie puede anotar un
 * ingreso a nombre de otro. No se guarda contraseña ni token.
 *
 * GET devuelve los últimos ingresos para la pantalla de auditoría.
 */

export async function POST(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    const ins = await ctx.supabase.from("accesos_usuarios").insert({
      empresa_id: ctx.auth.empresa_id,
      usuario_id: ctx.auth.usuarioCatalogId ?? null,
      usuario_nombre: ctx.auth.nombre ?? null,
      email: ctx.auth.user?.email ?? null,
      user_agent: (request.headers.get("user-agent") ?? "").slice(0, 300) || null,
    });
    // Que no se registre el ingreso nunca debe impedir entrar al sistema.
    if (ins.error) {
      console.error("[/api/accesos POST]", ins.error.message);
      return NextResponse.json(successResponse({ registrado: false }));
    }
    return NextResponse.json(successResponse({ registrado: true }));
  } catch (err) {
    console.error("[/api/accesos POST]", err instanceof Error ? err.message : err);
    return NextResponse.json(successResponse({ registrado: false }));
  }
}

export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });

    const q = await ctx.supabase
      .from("accesos_usuarios")
      .select("id, usuario_nombre, email, fecha, user_agent")
      .eq("empresa_id", ctx.auth.empresa_id)
      .order("fecha", { ascending: false })
      .limit(300);
    if (q.error) throw new Error(q.error.message);

    return NextResponse.json(successResponse({ accesos: q.data ?? [] }));
  } catch (err) {
    console.error("[/api/accesos GET]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudieron cargar los ingresos."), { status: 500 });
  }
}
