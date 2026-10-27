import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { getAuthWithRol, isAdmin } from "@/lib/middleware/auth";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";
import { applyTokenSearch } from "@/lib/productos/token-search";

/**
 * POST /api/productos/tienda-masivo
 *
 * Publica o saca de la tienda online muchos productos de una. Existe porque
 * el catalogo de Total son 3.391 productos en 137 paginas: marcarlos de a uno
 * con el check de cada fila no es trabajo que se le pueda pedir a nadie.
 *
 * Se le puede pasar:
 *  - ids: [...]  -> los productos tildados en la pantalla.
 *  - filtro: {}  -> "todos los que coinciden con lo que estoy viendo". Los ids
 *                   se resuelven ACA con los mismos filtros que GET
 *                   /api/productos, asi el navegador no tiene que mandar miles
 *                   de uuid ni traerse la lista entera para poder actuar.
 *
 * Campos: `visible_web` y/o `destacado`. Las dos reglas del check de la fila
 * valen igual acá:
 *   - un insumo (es_vendible=false) no se publica,
 *   - sacar de la tienda tambien saca de destacados: no tendria donde verse.
 */

/** Tope de ids por request cuando vienen explicitos desde la pantalla. */
const MAX_IDS = 5_000;
/** Lote de UPDATE. PostgREST corta las URLs muy largas de `in.(...)`. */
const CHUNK = 300;
/** Lote de lectura: Supabase corta en 1000 filas por mas que pidamos mas. */
const CHUNK_LECTURA = 1_000;
const MAX_TOTAL = 100_000;

interface Cuerpo {
  ids?: unknown;
  filtro?: { q?: unknown; categoria?: unknown };
  visible_web?: unknown;
  destacado?: unknown;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthWithRol(request);
    if (!auth) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    // Publicar cientos de productos en el sitio publico no es lo mismo que
    // tildar uno: el check de la fila lo puede usar cualquiera, esto no.
    if (!isAdmin(auth)) {
      return NextResponse.json(
        errorResponse("Solo un administrador puede publicar productos en masa."),
        { status: 403 },
      );
    }

    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const empresaId = ctx.auth.empresa_id;

    let body: Cuerpo;
    try {
      body = (await request.json()) as Cuerpo;
    } catch {
      return NextResponse.json(errorResponse("Cuerpo inválido."), { status: 400 });
    }

    const visibleWeb = typeof body.visible_web === "boolean" ? body.visible_web : null;
    const destacado = typeof body.destacado === "boolean" ? body.destacado : null;
    if (visibleWeb === null && destacado === null) {
      return NextResponse.json(
        errorResponse("Decime qué cambiar: visible_web o destacado."),
        { status: 400 },
      );
    }

    // ── A quiénes ────────────────────────────────────────────────────────────
    let ids: string[];
    if (Array.isArray(body.ids)) {
      ids = [...new Set(body.ids.filter((x): x is string => typeof x === "string" && !!x))];
      if (ids.length === 0) {
        return NextResponse.json(errorResponse("No seleccionaste ningún producto."), { status: 400 });
      }
      if (ids.length > MAX_IDS) {
        return NextResponse.json(
          errorResponse(`Son demasiados de una (máx. ${MAX_IDS.toLocaleString("es-PY")}).`),
          { status: 400 },
        );
      }
    } else if (body.filtro) {
      const q = typeof body.filtro.q === "string" ? body.filtro.q.trim() : "";
      const categoria = typeof body.filtro.categoria === "string" ? body.filtro.categoria : "";
      // Mismos filtros que GET /api/productos, para que "todos los que
      // coinciden" sea exactamente lo que la pantalla esta mostrando.
      const buildBase = () => {
        let base = ctx.supabase
          .from("productos")
          .select("id")
          .eq("empresa_id", empresaId)
          .eq("activo", true);
        if (q) base = applyTokenSearch(base, q, ["nombre", "sku"]);
        if (categoria === "__sin__") base = base.is("categoria_principal_id", null);
        else if (categoria) base = base.eq("categoria_principal_id", categoria);
        return base.order("nombre");
      };
      const acc: string[] = [];
      for (let from = 0; from < MAX_TOTAL; from += CHUNK_LECTURA) {
        const { data, error } = await buildBase().range(from, from + CHUNK_LECTURA - 1);
        if (error) throw new Error(error.message);
        const lote = (data ?? []) as { id: string }[];
        acc.push(...lote.map((x) => x.id));
        if (lote.length < CHUNK_LECTURA) break;
      }
      ids = acc;
      if (ids.length === 0) {
        return NextResponse.json(errorResponse("Ningún producto coincide con el filtro."), { status: 400 });
      }
    } else {
      return NextResponse.json(errorResponse("Faltan los productos: mandá ids o filtro."), { status: 400 });
    }

    // ── Qué cambiar ──────────────────────────────────────────────────────────
    const cambios: Record<string, unknown> = {};
    if (visibleWeb !== null) {
      cambios.visible_web = visibleWeb;
      // Sacar de la tienda tambien saca de destacados.
      if (!visibleWeb) cambios.destacado = false;
    }
    if (destacado !== null) cambios.destacado = destacado;

    let actualizados = 0;
    for (let i = 0; i < ids.length; i += CHUNK) {
      const lote = ids.slice(i, i + CHUNK);
      let upd = ctx.supabase
        .from("productos")
        .update(cambios)
        .eq("empresa_id", empresaId)
        .in("id", lote);
      // Un insumo no se publica, igual que el check de la fila, que viene
      // deshabilitado. Al despublicar no hace falta: sacar algo que no deberia
      // estar publicado es siempre correcto.
      if (visibleWeb === true) upd = upd.eq("es_vendible", true);
      // Destacar solo tiene sentido sobre algo publicado.
      if (visibleWeb === null && destacado === true) upd = upd.eq("visible_web", true);

      const { data, error } = await upd.select("id");
      if (error) throw new Error(error.message);
      actualizados += ((data ?? []) as unknown[]).length;
    }

    return NextResponse.json(
      successResponse({
        actualizados,
        pedidos: ids.length,
        // Los que quedaron afuera por insumo o por no estar publicados.
        omitidos: ids.length - actualizados,
      }),
    );
  } catch (err) {
    console.error("[/api/productos/tienda-masivo POST]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudo actualizar la tienda."), { status: 500 });
  }
}
