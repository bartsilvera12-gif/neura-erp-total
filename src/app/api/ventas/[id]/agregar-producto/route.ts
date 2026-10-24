/**
 * POST /api/ventas/[id]/agregar-producto
 * Body: { producto_id, cantidad, precio_venta, tipo_iva, permitir_sin_stock? }
 *
 * Agrega una línea a una venta por ticket ya registrada, ajustando stock, IVA,
 * total y el arqueo del día. Solo ventas sin factura: los guardrails viven en
 * agregarProductoVenta.
 */
import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { fetchDataSchemaForEmpresaId } from "@/lib/supabase/empresa-data-schema";
import { agregarProductoVenta, AgregarProductoError } from "@/lib/ventas/server/agregar-producto-pg";

export async function POST(request: NextRequest, ctxParams: { params: Promise<{ id: string }> }) {
  try {
    const { id: ventaId } = await ctxParams.params;
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
    const empresaId = ctx.auth.empresa_id;

    const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const productoId = String(b.producto_id ?? "");
    const cantidad = Number(b.cantidad);
    const precio = Number(b.precio_venta);
    const tipoIvaRaw = String(b.tipo_iva ?? "10%");
    const tipoIva = (tipoIvaRaw === "EXENTA" || tipoIvaRaw === "5%" || tipoIvaRaw === "10%") ? tipoIvaRaw : "10%";
    if (!productoId) return NextResponse.json({ success: false, error: "Falta el producto." }, { status: 400 });
    if (!Number.isFinite(cantidad) || cantidad <= 0) return NextResponse.json({ success: false, error: "Cantidad inválida." }, { status: 400 });
    if (!Number.isFinite(precio) || precio < 0) return NextResponse.json({ success: false, error: "Precio inválido." }, { status: 400 });

    const schema = await fetchDataSchemaForEmpresaId(empresaId);
    try {
      const r = await agregarProductoVenta(schema, empresaId, ventaId, {
        productoId,
        cantidad,
        precioVenta: precio,
        tipoIva,
        permitirSinStock: b.permitir_sin_stock === true,
        createdBy: ctx.auth.usuarioCatalogId ?? null,
        usuarioNombre: ctx.auth.nombre ?? ctx.auth.user?.email ?? null,
      });
      return NextResponse.json({ success: true, ...r }, { headers: { "Cache-Control": "no-store" } });
    } catch (e) {
      if (e instanceof AgregarProductoError) {
        return NextResponse.json({ success: false, error: e.message }, { status: 409 });
      }
      throw e;
    }
  } catch (e) {
    console.error("[ventas/agregar-producto]", e instanceof Error ? e.message : e);
    return NextResponse.json({ success: false, error: "No se pudo agregar el producto." }, { status: 500 });
  }
}
