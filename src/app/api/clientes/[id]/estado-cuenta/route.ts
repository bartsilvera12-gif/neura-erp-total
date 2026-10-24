import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";

/**
 * GET /api/clientes/[id]/estado-cuenta — resumen + cuentas por cobrar + cobros del cliente.
 * Solo lectura. No toca ventas/stock.
 */
export async function GET(request: NextRequest, ctxParams: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctxParams.params;
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const empresaId = ctx.auth.empresa_id;
    const hoy = new Date().toISOString().slice(0, 10);

    const cq = await ctx.supabase
      .from("clientes")
      .select("id, empresa, nombre_contacto, nombre, ruc, documento, telefono, direccion")
      .eq("empresa_id", empresaId)
      .eq("id", id)
      .maybeSingle();
    if (cq.error) throw new Error(cq.error.message);
    if (!cq.data) return NextResponse.json(errorResponse(API_ERRORS.NOT_FOUND), { status: 404 });
    const c = cq.data as Record<string, unknown>;
    const s = (v: unknown) => (typeof v === "string" ? v.trim() : "");
    const cliente = {
      id: String(c.id),
      nombre: s(c.empresa) || s(c.nombre_contacto) || s(c.nombre) || "Cliente",
      ruc: s(c.ruc) || s(c.documento) || null,
      telefono: s(c.telefono) || null,
      direccion: s(c.direccion) || null,
    };

    // Ventas del cliente → total vendido (excluye anuladas).
    const vq = await ctx.supabase
      .from("ventas")
      .select("total")
      .eq("empresa_id", empresaId)
      .eq("cliente_id", id)
      .neq("estado", "anulada");
    if (vq.error) throw new Error(vq.error.message);
    const totalVendido = ((vq.data ?? []) as Record<string, unknown>[]).reduce((acc, r) => acc + (Number(r.total) || 0), 0);

    // Cobros del cliente. Se traen antes que las cuentas porque lo cobrado de
    // cada una se calcula sumando SUS cobros, no restando el saldo: al anular
    // una cuenta el saldo se pone en cero, y "total − saldo" mostraba la deuda
    // entera como si el cliente la hubiera pagado.
    const cobQ = await ctx.supabase
      .from("cobros_clientes")
      .select("id, cuenta_por_cobrar_id, venta_id, fecha_pago, monto, metodo_pago, referencia")
      .eq("empresa_id", empresaId)
      .eq("cliente_id", id)
      .order("fecha_pago", { ascending: false })
      .limit(500);
    if (cobQ.error) throw new Error(cobQ.error.message);
    const cobros = (cobQ.data ?? []) as Record<string, unknown>[];
    const cobradoPorCuenta = new Map<string, number>();
    for (const c of cobros) {
      const k = String(c.cuenta_por_cobrar_id ?? "");
      if (!k) continue;
      cobradoPorCuenta.set(k, (cobradoPorCuenta.get(k) ?? 0) + (Number(c.monto) || 0));
    }

    // Cuentas por cobrar (movimientos de crédito).
    const cxcQ = await ctx.supabase
      .from("cuentas_por_cobrar")
      .select("id, venta_id, numero_venta, fecha_emision, fecha_vencimiento, moneda, total, saldo, estado")
      .eq("empresa_id", empresaId)
      .eq("cliente_id", id)
      .order("fecha_emision", { ascending: false });
    if (cxcQ.error) throw new Error(cxcQ.error.message);
    let saldoPendiente = 0;
    let vencido = 0;
    const movimientos = ((cxcQ.data ?? []) as Record<string, unknown>[]).map((r) => {
      const total = Number(r.total) || 0;
      const saldo = Number(r.saldo) || 0;
      const venc = r.fecha_vencimiento ? String(r.fecha_vencimiento).slice(0, 10) : null;
      const vigentePendiente = r.estado === "pendiente" || r.estado === "parcial";
      if (r.estado !== "anulado") saldoPendiente += saldo;
      const vencida = vigentePendiente && venc != null && venc < hoy;
      if (vencida) vencido += saldo;
      return {
        id: String(r.id),
        venta_id: r.venta_id ? String(r.venta_id) : null,
        numero_venta: r.numero_venta ?? null,
        fecha_emision: r.fecha_emision ?? null,
        fecha_vencimiento: venc,
        total,
        cobrado: Math.round((cobradoPorCuenta.get(String(r.id)) ?? 0) * 100) / 100,
        saldo,
        estado: r.estado,
        vencida,
      };
    });

    // Cuotas de esas cuentas: cuántas lleva pagadas, cuántas le faltan y cuál
    // es la próxima. Lo que el mostrador pregunta primero cuando llama el cliente.
    const cxcIds = movimientos.map((m) => m.id);
    const cuotasPorCuenta = new Map<string, {
      numero_cuota: number;
      fecha_vencimiento: string;
      monto: number;
      saldo: number;
      estado: string;
      vencida: boolean;
    }[]>();
    if (cxcIds.length > 0) {
      const cuoQ = await ctx.supabase
        .from("venta_cuotas")
        .select("id, cuenta_por_cobrar_id, numero_cuota, fecha_vencimiento, monto, saldo, estado")
        .eq("empresa_id", empresaId)
        .in("cuenta_por_cobrar_id", cxcIds)
        .neq("estado", "anulada")
        .order("numero_cuota", { ascending: true });
      // Sin la tabla todavía (migración sin correr) el estado de cuenta sigue
      // mostrándose como antes, solo que sin el detalle por cuota.
      if (!cuoQ.error) {
        for (const r of (cuoQ.data ?? []) as Record<string, unknown>[]) {
          const cxcId = String(r.cuenta_por_cobrar_id);
          const venc = String(r.fecha_vencimiento ?? "").slice(0, 10);
          const saldo = Number(r.saldo) || 0;
          const lista = cuotasPorCuenta.get(cxcId) ?? [];
          lista.push({
            numero_cuota: Number(r.numero_cuota) || 0,
            fecha_vencimiento: venc,
            monto: Number(r.monto) || 0,
            saldo,
            estado: String(r.estado ?? "pendiente"),
            vencida: saldo > 0.009 && !!venc && venc < hoy,
          });
          cuotasPorCuenta.set(cxcId, lista);
        }
      }
    }

    // Se adjunta a cada movimiento el resumen de su plan, para no obligar a la
    // pantalla a recorrer las cuotas de nuevo.
    const movimientosConCuotas = movimientos.map((m) => {
      const cuotas = cuotasPorCuenta.get(m.id) ?? [];
      if (cuotas.length === 0) return { ...m, cuotas: [], plan: null };
      const pagadas = cuotas.filter((q) => q.saldo <= 0.009).length;
      const proxima = cuotas.find((q) => q.saldo > 0.009) ?? null;
      return {
        ...m,
        cuotas,
        plan: {
          total_cuotas: cuotas.length,
          cuotas_pagadas: pagadas,
          cuotas_pendientes: cuotas.length - pagadas,
          cuotas_vencidas: cuotas.filter((q) => q.vencida).length,
          proxima_numero: proxima?.numero_cuota ?? null,
          proxima_vencimiento: proxima?.fecha_vencimiento ?? null,
          proxima_saldo: proxima ? Math.round(proxima.saldo) : null,
        },
      };
    });

    const resumen = {
      total_vendido: Math.round(totalVendido),
      saldo_pendiente: Math.round(saldoPendiente),
      total_cobrado: Math.round(totalVendido - saldoPendiente),
      vencido: Math.round(vencido),
    };

    return NextResponse.json(successResponse({ cliente, resumen, movimientos: movimientosConCuotas, cobros }));
  } catch (err) {
    console.error("[/api/clientes/[id]/estado-cuenta GET]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudo cargar el estado de cuenta."), { status: 500 });
  }
}
