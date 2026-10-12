import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * Pedidos de la tienda web.
 *
 * Portado del ERP de Marilia Magazine. Los datos salen de `v_web_pedidos`, que
 * aplana los pedidos que crea la tienda (ver 07_pedidos_web_en_el_erp.sql en el
 * repo de la web).
 *
 * Si la vista todavía no existe —porque el SQL no se corrió— se devuelve una
 * lista vacía con `sin_tienda: true` en vez de un error, para que el módulo
 * muestre un cartel claro y no una pantalla rota.
 */

/**
 * Distingue "todavía no está la vista" de "algo se rompió".
 *
 * Solo 42P01 (la relación no existe) y PGRST205 (PostgREST no la encuentra en
 * su caché) significan que falta la tienda. Cualquier otro fallo —permisos,
 * conexión, RLS— es un problema que hay que mostrar, no esconder detrás de un
 * cartel de "no configurado".
 */
function esSinTienda(err: { code?: string; message?: string }): boolean {
  const codigo = String(err?.code ?? "").toUpperCase();
  if (codigo === "42P01" || codigo === "PGRST205") return true;

  const m = String(err?.message ?? "").toLowerCase();
  return m.includes("does not exist") || m.includes("could not find the table");
}

/** Los mismos valores que admite el CHECK de `total.web_pedido.estado`. */
const ESTADOS = new Set([
  "recibido",
  "pago-pendiente",
  "pagado",
  "preparando",
  "listo",
  "entregado",
  "cancelado",
]);

/**
 * GET /api/pedidos-web
 *
 * Query:
 *   estado        filtra por estado del pedido
 *   solo_pagados  "1" para ver solo los que ya se cobraron
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) {
      return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    }
    const { supabase } = ctx;

    const { searchParams } = new URL(request.url);
    const estado = searchParams.get("estado");
    const soloPagados = searchParams.get("solo_pagados") === "1";

    let query = supabase
      .from("v_web_pedidos")
      .select("*")
      .order("fecha_pedido", { ascending: false })
      .limit(300);

    // A diferencia de Marilia, acá NO se filtra por pagado por defecto:
    // PagoPar todavía está simulado, así que todos los pedidos entran como
    // pendientes y filtrarlos dejaría el tablero vacío.
    if (soloPagados) query = query.eq("estado_pago", "aprobado");
    if (estado && ESTADOS.has(estado)) query = query.eq("estado_envio", estado);

    const { data, error } = await query;

    if (error) {
      if (esSinTienda(error)) {
        return NextResponse.json(successResponse({ pedidos: [], sin_tienda: true }));
      }
      // El error se devuelve tal cual: esconderlo detrás de un cartel genérico
      // hace imposible saber si falta un permiso, una vista o la conexión.
      console.error(
        "[api/pedidos-web] GET:",
        error.code,
        error.message,
        error.details,
        error.hint
      );
      const detalle = [error.message, error.hint].filter(Boolean).join(" — ");
      return NextResponse.json(errorResponse(detalle || "Error al consultar."), { status: 400 });
    }

    return NextResponse.json(successResponse({ pedidos: data ?? [], sin_tienda: false }));
  } catch (err) {
    console.error("[api/pedidos-web] GET:", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudieron traer los pedidos."), { status: 500 });
  }
}

/**
 * PATCH /api/pedidos-web — cambia el estado del pedido.
 * Body: { id, estado, nota? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) {
      return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    }
    const { supabase } = ctx;

    const body = await request.json().catch(() => ({}));
    const id = typeof body?.id === "string" ? body.id.trim() : "";
    const estado = typeof body?.estado === "string" ? body.estado.trim() : "";
    const nota = typeof body?.nota === "string" ? body.nota.trim() : null;

    if (!id) {
      return NextResponse.json(errorResponse("Falta el pedido."), { status: 400 });
    }
    if (!ESTADOS.has(estado)) {
      return NextResponse.json(errorResponse(`Estado no válido: ${estado}`), { status: 400 });
    }

    // La función guarda además la hora del cambio, para poder reconstruir
    // después cuánto tardó cada pedido.
    const { data, error } = await supabase.rpc("web_marcar_envio", {
      p_pedido: id,
      p_estado: estado,
      p_nota: nota,
    });

    if (error) {
      console.error("[api/pedidos-web] PATCH:", error.message);
      return NextResponse.json(errorResponse(error.message), { status: 400 });
    }

    const r = data as { ok?: boolean; error?: string } | null;
    if (r && r.ok === false) {
      return NextResponse.json(errorResponse(r.error ?? "No se pudo actualizar."), { status: 400 });
    }

    return NextResponse.json(successResponse({ id, estado }));
  } catch (err) {
    console.error("[api/pedidos-web] PATCH:", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudo actualizar el pedido."), { status: 500 });
  }
}
