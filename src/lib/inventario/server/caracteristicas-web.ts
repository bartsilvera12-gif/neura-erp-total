import type { AppSupabaseClient } from "@/lib/supabase/schema";
import { fichaDeTexto, textoDeFicha } from "@/lib/inventario/caracteristicas";

/**
 * Lectura y escritura de las características en `web_producto.ficha`.
 *
 * `web_producto` es la tabla editorial de la tienda (descripción comercial,
 * galería, ficha, SEO). Un producto puede no tener fila todavía: se crea al
 * guardar la primera característica.
 */

export async function leerCaracteristicas(
  sb: AppSupabaseClient,
  empresaId: string,
  productoId: string
): Promise<string> {
  const { data, error } = await sb
    .from("web_producto")
    .select("ficha")
    .eq("empresa_id", empresaId)
    .eq("producto_id", productoId)
    .maybeSingle();
  if (error) {
    console.error("[caracteristicas-web] leer", error.message);
    return "";
  }
  return textoDeFicha((data as { ficha?: unknown } | null)?.ficha);
}

/** Devuelve un aviso para mostrar si no se pudo guardar, o null si salió bien. */
export async function guardarCaracteristicas(
  sb: AppSupabaseClient,
  empresaId: string,
  productoId: string,
  texto: string
): Promise<string | null> {
  const ficha = fichaDeTexto(texto);
  const ahora = new Date().toISOString();

  const upd = await sb
    .from("web_producto")
    .update({ ficha, updated_at: ahora })
    .eq("empresa_id", empresaId)
    .eq("producto_id", productoId)
    .select("producto_id");
  if (upd.error) {
    console.error("[caracteristicas-web] update", upd.error.message);
    return "El producto se guardó, pero no se pudieron guardar las características.";
  }
  if ((upd.data ?? []).length > 0 || ficha.length === 0) return null;

  // Sin fila todavía. `slug` quedó obsoleta en esta tabla pero sigue siendo
  // NOT NULL: se guarda el id, como hace el panel de la web.
  const ins = await sb.from("web_producto").insert({
    producto_id: productoId,
    empresa_id: empresaId,
    slug: productoId,
    ficha,
  });
  if (ins.error) {
    console.error("[caracteristicas-web] insert", ins.error.message);
    return "El producto se guardó, pero no se pudieron guardar las características.";
  }
  return null;
}
