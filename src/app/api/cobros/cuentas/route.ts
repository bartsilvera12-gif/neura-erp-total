import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

const CXC_COLS =
  "id, cliente_id, venta_id, numero_venta, fecha_emision, fecha_vencimiento, moneda, total, saldo, estado, created_at";

/**
 * GET /api/cobros/cuentas — cuentas por cobrar + resumen.
 * Filtros: ?cliente_id= &estado=pendiente|parcial|pagado|anulado &filtro=vencidas|por_vencer
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const empresaId = ctx.auth.empresa_id;
    const sp = new URL(request.url).searchParams;
    const clienteId = sp.get("cliente_id");
    const estado = sp.get("estado");
    const filtro = sp.get("filtro"); // vencidas | por_vencer
    const hoy = new Date().toISOString().slice(0, 10);

    let q = ctx.supabase
      .from("cuentas_por_cobrar")
      .select(CXC_COLS)
      .eq("empresa_id", empresaId)
      .order("fecha_vencimiento", { ascending: true, nullsFirst: false })
      .limit(1000);
    if (clienteId) q = q.eq("cliente_id", clienteId);
    if (estado) q = q.eq("estado", estado);
    if (filtro === "vencidas") q = q.in("estado", ["pendiente", "parcial"]).lt("fecha_vencimiento", hoy);
    if (filtro === "por_vencer") q = q.in("estado", ["pendiente", "parcial"]).gte("fecha_vencimiento", hoy);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Record<string, unknown>[];

    // Nombres de clientes.
    const clienteIds = [...new Set(rows.map((r) => String(r.cliente_id)).filter(Boolean))];
    const nombreById = new Map<string, string>();
    if (clienteIds.length) {
      const cq = await ctx.supabase
        .from("clientes")
        .select("id, empresa, nombre_contacto, nombre")
        .eq("empresa_id", empresaId)
        .in("id", clienteIds);
      for (const c of (cq.data ?? []) as Record<string, unknown>[]) {
        const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
        nombreById.set(String(c.id), s(c.empresa) || s(c.nombre_contacto) || s(c.nombre) || "Cliente");
      }
    }

    // Plan de cuotas de cada cuenta: cuál es la próxima a cobrar y cuánto.
    // Sin esto, Cobranzas solo conocía el saldo total y el cajero tenía que
    // acordarse de memoria de cuánto era la cuota del mes.
    const cxcIds = rows.map((r) => String(r.id));
    const planPorCuenta = new Map<string, {
      total_cuotas: number;
      cuotas_pagadas: number;
      proxima_numero: number | null;
      proxima_saldo: number | null;
      proxima_vencimiento: string | null;
    }>();
    if (cxcIds.length > 0) {
      const cuoQ = await ctx.supabase
        .from("venta_cuotas")
        .select("cuenta_por_cobrar_id, numero_cuota, monto, saldo, fecha_vencimiento")
        .eq("empresa_id", empresaId)
        .in("cuenta_por_cobrar_id", cxcIds)
        .neq("estado", "anulada")
        .order("numero_cuota", { ascending: true });
      // Sin la tabla todavía, Cobranzas sigue funcionando contra el saldo total.
      if (!cuoQ.error) {
        const porCuenta = new Map<string, Record<string, unknown>[]>();
        for (const c of (cuoQ.data ?? []) as Record<string, unknown>[]) {
          const k = String(c.cuenta_por_cobrar_id);
          porCuenta.set(k, [...(porCuenta.get(k) ?? []), c]);
        }
        for (const [k, lista] of porCuenta) {
          const pagadas = lista.filter((c) => (Number(c.saldo) || 0) <= 0.009).length;
          const prox = lista.find((c) => (Number(c.saldo) || 0) > 0.009) ?? null;
          planPorCuenta.set(k, {
            total_cuotas: lista.length,
            cuotas_pagadas: pagadas,
            proxima_numero: prox ? Number(prox.numero_cuota) : null,
            proxima_saldo: prox ? Math.round(Number(prox.saldo) || 0) : null,
            proxima_vencimiento: prox ? String(prox.fecha_vencimiento ?? "").slice(0, 10) : null,
          });
        }
      }
    }

    const cuentas = rows.map((r) => {
      const venc = r.fecha_vencimiento ? String(r.fecha_vencimiento).slice(0, 10) : null;
      const vencida = (r.estado === "pendiente" || r.estado === "parcial") && venc != null && venc < hoy;
      return {
        ...r,
        total: Number(r.total) || 0,
        saldo: Number(r.saldo) || 0,
        cliente_nombre: nombreById.get(String(r.cliente_id)) ?? "Cliente",
        vencida,
        plan: planPorCuenta.get(String(r.id)) ?? null,
      };
    });

    // Resumen general (sobre todas las CxC de la empresa, no solo filtradas).
    const allQ = await ctx.supabase
      .from("cuentas_por_cobrar")
      .select("saldo, estado, fecha_vencimiento")
      .eq("empresa_id", empresaId);
    let totalPendiente = 0;
    let totalVencido = 0;
    for (const r of (allQ.data ?? []) as Record<string, unknown>[]) {
      const saldo = Number(r.saldo) || 0;
      if (r.estado === "pendiente" || r.estado === "parcial") {
        totalPendiente += saldo;
        const venc = r.fecha_vencimiento ? String(r.fecha_vencimiento).slice(0, 10) : null;
        if (venc != null && venc < hoy) totalVencido += saldo;
      }
    }

    // Cobrado del mes en curso.
    const inicioMes = `${hoy.slice(0, 7)}-01`;
    const cobMesQ = await ctx.supabase
      .from("cobros_clientes")
      .select("monto, fecha_pago")
      .eq("empresa_id", empresaId)
      .gte("fecha_pago", inicioMes);
    let cobradoMes = 0;
    for (const r of (cobMesQ.data ?? []) as Record<string, unknown>[]) cobradoMes += Number(r.monto) || 0;

    // Cuentas parciales (cantidad) para el resumen.
    let parciales = 0;
    for (const r of (allQ.data ?? []) as Record<string, unknown>[]) if (r.estado === "parcial") parciales += 1;

    // Historial de cobros recientes (para la pestaña de cobros registrados).
    const histQ = await ctx.supabase
      .from("cobros_clientes")
      .select("id, cliente_id, venta_id, cuenta_por_cobrar_id, fecha_pago, monto, metodo_pago, referencia, usuario_nombre")
      .eq("empresa_id", empresaId)
      .order("fecha_pago", { ascending: false })
      .limit(500);
    const histRows = (histQ.data ?? []) as Record<string, unknown>[];
    // Nombres de clientes que aún no estén en el mapa.
    const faltanIds = [...new Set(histRows.map((r) => String(r.cliente_id)).filter((idc) => idc && !nombreById.has(idc)))];
    if (faltanIds.length) {
      const cq2 = await ctx.supabase
        .from("clientes")
        .select("id, empresa, nombre_contacto, nombre")
        .eq("empresa_id", empresaId)
        .in("id", faltanIds);
      for (const c of (cq2.data ?? []) as Record<string, unknown>[]) {
        const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
        nombreById.set(String(c.id), s(c.empresa) || s(c.nombre_contacto) || s(c.nombre) || "Cliente");
      }
    }
    // numero_venta por cuenta_por_cobrar_id (de las cuentas ya cargadas).
    const ventaByCuenta = new Map<string, string>();
    for (const r of rows) ventaByCuenta.set(String(r.id), String(r.numero_venta ?? ""));
    const cobros = histRows.map((r) => ({
      id: String(r.id),
      cliente_id: r.cliente_id ? String(r.cliente_id) : null,
      cliente_nombre: nombreById.get(String(r.cliente_id)) ?? "Cliente",
      numero_venta: ventaByCuenta.get(String(r.cuenta_por_cobrar_id)) || null,
      fecha_pago: r.fecha_pago ?? null,
      monto: Number(r.monto) || 0,
      metodo_pago: r.metodo_pago ?? "efectivo",
      referencia: r.referencia ?? null,
      usuario_nombre: r.usuario_nombre ?? null,
    }));

    return NextResponse.json(
      successResponse({
        cuentas,
        cobros,
        resumen: {
          total_pendiente: Math.round(totalPendiente),
          total_vencido: Math.round(totalVencido),
          cobrado_mes: Math.round(cobradoMes),
          parciales,
        },
      })
    );
  } catch (err) {
    console.error("[/api/cobros/cuentas GET]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudieron cargar las cuentas por cobrar."), { status: 500 });
  }
}
