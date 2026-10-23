import type { AppSupabaseClient } from "@/lib/supabase/schema";
import { repartirCobro, estadoCuota } from "@/lib/ventas/cuotas";

export type MetodoPagoCobro = "efectivo" | "transferencia" | "tarjeta" | "otro";

export interface RegistrarCobroInput {
  cuenta_por_cobrar_id: string;
  monto: number;
  metodo_pago: MetodoPagoCobro;
  entidad_bancaria_id?: string | null;
  referencia?: string | null;
  titular?: string | null;
  observaciones?: string | null;
  fecha_pago?: string | null;
  usuario_id?: string | null;
  usuario_nombre?: string | null;
  entidad_nombre_snapshot?: string | null;
}

export class CobroError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "CobroError";
    this.status = status;
  }
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function metodoValido(m: unknown): MetodoPagoCobro {
  return m === "transferencia" || m === "tarjeta" || m === "otro" ? m : "efectivo";
}

/**
 * Registra un cobro contra una cuenta por cobrar: inserta en `cobros_clientes`,
 * descuenta el saldo y recalcula el estado (pendiente|parcial|pagado).
 * No permite cobrar más que el saldo. NO toca stock ni ventas.
 *
 * Si la cuenta tiene cuotas, el cobro se imputa de la más vieja a la más nueva
 * y lo que sobra de tapar una cae sobre la siguiente: el que paga 300 cuando la
 * cuota era 250 se adelanta 50 del mes que viene. Las cuentas viejas (sin
 * cuotas) siguen funcionando igual que siempre, contra el saldo total.
 */
export async function registrarCobro(
  sb: AppSupabaseClient,
  empresaId: string,
  input: RegistrarCobroInput
): Promise<{ cobro_id: string; saldo_nuevo: number; estado: string; caja_warning: string | null }> {
  const monto = round2(Number(input.monto) || 0);
  if (!(monto > 0)) throw new CobroError("El monto del cobro debe ser mayor a cero.");
  if (!input.cuenta_por_cobrar_id) throw new CobroError("Falta la cuenta por cobrar.");

  const cq = await sb
    .from("cuentas_por_cobrar")
    .select("id, cliente_id, venta_id, numero_venta, total, saldo, estado")
    .eq("empresa_id", empresaId)
    .eq("id", input.cuenta_por_cobrar_id)
    .maybeSingle();
  if (cq.error) throw new CobroError(cq.error.message, 500);
  if (!cq.data) throw new CobroError("Cuenta por cobrar no encontrada.", 404);
  const cxc = cq.data as {
    id: string;
    cliente_id: string;
    venta_id: string;
    numero_venta: string | null;
    total: number | string;
    saldo: number | string;
    estado: string;
  };

  if (cxc.estado === "anulado") throw new CobroError("La cuenta está anulada; no admite cobros.", 409);
  if (cxc.estado === "pagado") throw new CobroError("La cuenta ya está pagada.", 409);

  const saldoActual = round2(Number(cxc.saldo) || 0);
  const total = round2(Number(cxc.total) || 0);
  if (monto > saldoActual + 0.001) {
    throw new CobroError(`El monto (${monto}) supera el saldo pendiente (${saldoActual}).`);
  }

  const fechaPago =
    typeof input.fecha_pago === "string" && input.fecha_pago.trim() ? input.fecha_pago : new Date().toISOString();

  // 1) Insertar el cobro.
  const ins = await sb
    .from("cobros_clientes")
    .insert({
      empresa_id: empresaId,
      cliente_id: cxc.cliente_id,
      cuenta_por_cobrar_id: cxc.id,
      venta_id: cxc.venta_id,
      fecha_pago: fechaPago,
      monto,
      metodo_pago: metodoValido(input.metodo_pago),
      entidad_bancaria_id: input.entidad_bancaria_id || null,
      entidad_nombre_snapshot: input.entidad_nombre_snapshot?.trim() || null,
      referencia: input.referencia?.trim() || null,
      titular: input.titular?.trim() || null,
      observaciones: input.observaciones?.trim() || null,
      usuario_id: input.usuario_id || null,
      usuario_nombre: input.usuario_nombre?.trim() || null,
    })
    .select("id")
    .single();
  if (ins.error) throw new CobroError(ins.error.message, 500);
  const cobroId = String((ins.data as { id: string }).id);

  // 2) Recalcular saldo + estado.
  const saldoNuevo = round2(saldoActual - monto);
  const estadoNuevo = saldoNuevo <= 0.001 ? "pagado" : saldoNuevo < total ? "parcial" : "pendiente";
  const upd = await sb
    .from("cuentas_por_cobrar")
    .update({ saldo: saldoNuevo < 0 ? 0 : saldoNuevo, estado: estadoNuevo, updated_at: new Date().toISOString() })
    .eq("empresa_id", empresaId)
    .eq("id", cxc.id);
  if (upd.error) {
    // Rollback best-effort del cobro para no descuadrar el saldo.
    try {
      await sb.from("cobros_clientes").delete().eq("id", cobroId).eq("empresa_id", empresaId);
    } catch {}
    throw new CobroError(upd.error.message, 500);
  }

  // 3) Imputar a las cuotas, si la cuenta las tiene. Va después de actualizar la
  //    cuenta a propósito: si fallara acá, el saldo general ya quedó bien y lo
  //    único desalineado es el detalle por cuota, que se puede recomponer.
  await imputarACuotas(sb, empresaId, cxc.id, cobroId, monto);

  // 4) El efectivo entra a la caja del turno.
  let cajaWarning: string | null = null;
  if (metodoValido(input.metodo_pago) === "efectivo") {
    const cajaId = await registrarIngresoCaja(sb, empresaId, {
      monto,
      concepto: `Cobro ${cxc.numero_venta ?? ""}`.trim(),
      ventaId: cxc.venta_id ?? null,
      clienteId: cxc.cliente_id ?? null,
      usuarioId: input.usuario_id || null,
      usuarioNombre: input.usuario_nombre?.trim() || null,
    });
    if (!cajaId) {
      cajaWarning =
        "El cobro quedó registrado, pero no entró a ninguna caja porque no hay una abierta. Abrí la caja y cargá el ingreso a mano.";
    }
  }

  return {
    cobro_id: cobroId,
    saldo_nuevo: saldoNuevo < 0 ? 0 : saldoNuevo,
    estado: estadoNuevo,
    caja_warning: cajaWarning,
  };
}

/**
 * Ingreso de caja por un cobro EN EFECTIVO.
 *
 * La plata de una venta a crédito no entra a caja al vender: entra cuando el
 * cliente paga. Hasta ahora ese cobro no dejaba rastro en el arqueo, así que
 * el cajero terminaba el día con efectivo de más en el cajón y la caja no lo
 * explicaba.
 *
 * Solo efectivo: una transferencia o una tarjeta no cambian lo que hay en el
 * cajón, y el arqueo cuenta únicamente efectivo.
 *
 * El movimiento se guarda con `venta_id`, así la anulación de la venta —que ya
 * anula los movimientos por venta— lo revierte sin tener que acordarse de él.
 *
 * Devuelve `null` si no hay caja abierta: el cobro igual queda registrado y
 * quien llama avisa, porque bloquearlo dejaría al cobrador sin poder trabajar.
 */
async function registrarIngresoCaja(
  sb: AppSupabaseClient,
  empresaId: string,
  args: {
    monto: number;
    concepto: string;
    ventaId: string | null;
    clienteId: string | null;
    usuarioId: string | null;
    usuarioNombre: string | null;
  }
): Promise<string | null> {
  const cajaQ = await sb
    .from("cajas")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("estado", "abierta")
    .order("fecha_apertura", { ascending: false })
    .limit(1);
  if (cajaQ.error) return null;
  const cajaId = (cajaQ.data ?? [])[0]?.id as string | undefined;
  if (!cajaId) return null;

  const ins = await sb.from("caja_movimientos").insert({
    empresa_id: empresaId,
    caja_id: cajaId,
    tipo: "ingreso",
    concepto: args.concepto.slice(0, 200),
    monto: args.monto,
    medio_pago: "efectivo",
    venta_id: args.ventaId,
    cliente_id: args.clienteId,
    usuario_id: args.usuarioId,
    usuario_email: args.usuarioNombre,
  });
  return ins.error ? null : cajaId;
}

/**
 * Reparte un cobro ya registrado sobre las cuotas pendientes de la cuenta.
 * Silencioso si la cuenta no tiene cuotas (crédito de un solo vencimiento).
 */
async function imputarACuotas(
  sb: AppSupabaseClient,
  empresaId: string,
  cuentaPorCobrarId: string,
  cobroId: string,
  monto: number
): Promise<void> {
  const cq = await sb
    .from("venta_cuotas")
    .select("id, monto, saldo")
    .eq("empresa_id", empresaId)
    .eq("cuenta_por_cobrar_id", cuentaPorCobrarId)
    .neq("estado", "anulada")
    .gt("saldo", 0)
    .order("numero_cuota", { ascending: true });
  if (cq.error || !Array.isArray(cq.data) || cq.data.length === 0) return;

  const cuotas = (cq.data as { id: string; monto: number | string; saldo: number | string }[]).map((c) => ({
    id: String(c.id),
    monto: Number(c.monto) || 0,
    saldo: Number(c.saldo) || 0,
  }));
  const { aplicaciones } = repartirCobro(monto, cuotas);
  if (aplicaciones.length === 0) return;

  const montoPorCuota = new Map(cuotas.map((c) => [c.id, c.monto]));
  for (const ap of aplicaciones) {
    await sb
      .from("venta_cuotas")
      .update({
        saldo: ap.saldo_nuevo,
        estado: estadoCuota(montoPorCuota.get(ap.cuota_id) ?? 0, ap.saldo_nuevo),
        updated_at: new Date().toISOString(),
      })
      .eq("empresa_id", empresaId)
      .eq("id", ap.cuota_id);
  }

  await sb.from("cobro_cuota_aplicacion").insert(
    aplicaciones.map((ap) => ({
      empresa_id: empresaId,
      cobro_id: cobroId,
      venta_cuota_id: ap.cuota_id,
      monto: ap.monto,
    }))
  );
}
