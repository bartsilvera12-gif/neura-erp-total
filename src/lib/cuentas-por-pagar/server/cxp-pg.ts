/**
 * Cuentas por pagar a proveedores (PG directo, schema del tenant).
 *
 * Modelo:
 *  - Una compra a crédito genera 1 `cuentas_por_pagar` + N `compra_cuotas`.
 *  - Cuotas automáticas: fecha_vencimiento = fecha_factura + dias_gracia + plazo_i.
 *    Monto por cuota = total / N (la última absorbe el redondeo).
 *  - Pagos parciales: `pagos_proveedores` descuenta saldo de la cuota y de la cuenta.
 *  - 'vencida' se DERIVA en las lecturas (saldo>0 AND fecha_venc < hoy), no se persiste.
 */
import { getChatPostgresPool, quoteSchemaTable } from "@/lib/supabase/chat-pg-pool";
import { assertAllowedChatDataSchema } from "@/lib/supabase/chat-data-schema";

function pool() {
  const p = getChatPostgresPool();
  if (!p) throw new Error("Pool no disponible.");
  return p;
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

/** Suma `days` a una fecha YYYY-MM-DD y devuelve YYYY-MM-DD (UTC, sin desfase de TZ). */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map((x) => parseInt(x, 10));
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export interface CuotaCalculada {
  numero_cuota: number;
  dias_plazo: number;
  fecha_vencimiento: string;
  monto: number;
}

/**
 * Calcula las cuotas: base = fechaEmision + diasGracia; cada plazo cuenta DESDE
 * el fin de la gracia. Reparte `total` en partes iguales (última absorbe resto).
 */
export function calcularCuotas(
  total: number,
  fechaEmisionYmd: string,
  diasGracia: number,
  plazos: number[]
): CuotaCalculada[] {
  const limpios = (plazos ?? []).filter((n) => Number.isFinite(n) && n > 0).sort((a, b) => a - b);
  if (limpios.length === 0) return [];
  const n = limpios.length;
  const base = round2(total);
  const cuotaBase = round2(base / n);
  const cuotas: CuotaCalculada[] = [];
  let acumulado = 0;
  for (let i = 0; i < n; i++) {
    const esUltima = i === n - 1;
    const monto = esUltima ? round2(base - acumulado) : cuotaBase;
    acumulado = round2(acumulado + monto);
    cuotas.push({
      numero_cuota: i + 1,
      dias_plazo: limpios[i],
      fecha_vencimiento: addDaysYmd(fechaEmisionYmd, diasGracia + limpios[i]),
      monto,
    });
  }
  return cuotas;
}

export interface CuentaPorPagarResumen {
  id: string;
  compra_numero_control: string | null;
  total: number;
  saldo: number;
  estado: string;
  cuotas: number;
}

export interface CuotaRow {
  id: string;
  cuenta_por_pagar_id: string;
  numero_cuota: number;
  fecha_vencimiento: string;
  monto: number;
  saldo: number;
  estado: string;
  proveedor_nombre: string | null;
  compra_numero_control: string | null;
  moneda: string;
}

/** Lista todas las cuotas con datos del proveedor/cuenta, para el panel de pagos. */
export async function listCuotas(schemaRaw: string, empresaId: string): Promise<CuotaRow[]> {
  const schema = assertAllowedChatDataSchema(schemaRaw);
  const tCuo = quoteSchemaTable(schema, "compra_cuotas");
  const tCxp = quoteSchemaTable(schema, "cuentas_por_pagar");
  const { rows } = await pool().query<CuotaRow>(
    `SELECT c.id, c.cuenta_por_pagar_id, c.numero_cuota,
            to_char(c.fecha_vencimiento, 'YYYY-MM-DD') AS fecha_vencimiento,
            c.monto, c.saldo, c.estado,
            cx.proveedor_nombre, cx.compra_numero_control, cx.moneda
       FROM ${tCuo} c
       JOIN ${tCxp} cx ON cx.id = c.cuenta_por_pagar_id
      WHERE c.empresa_id = $1::uuid AND c.estado <> 'anulada'
      ORDER BY c.fecha_vencimiento ASC`,
    [empresaId]
  );
  return rows.map((r) => ({
    ...r,
    monto: Number(r.monto) || 0,
    saldo: Number(r.saldo) || 0,
  }));
}

export interface RegistrarPagoInput {
  cuotaId: string;
  monto: number;
  fechaPago?: string | null;
  metodoPago?: string | null;
  referencia?: string | null;
  observaciones?: string | null;
  usuarioId?: string | null;
  usuarioNombre?: string | null;
}

/**
 * Registra un pago (parcial o total) de una cuota: inserta en pagos_proveedores,
 * baja el saldo de la cuota y recalcula el saldo/estado de la cuenta. Transaccional.
 *
 * El pago EN EFECTIVO además sale de la caja abierta. Es el mismo problema que
 * tenían los cobros, del otro lado del mostrador: la compra a crédito no mueve
 * caja al comprarse, y después se pagaba una cuota con plata del cajón sin que
 * el arqueo la descontara. Si no hay caja abierta, el pago igual se registra y
 * se devuelve un aviso.
 */
export async function registrarPagoProveedor(
  schemaRaw: string,
  empresaId: string,
  input: RegistrarPagoInput
): Promise<{ ok: true; caja_warning: string | null }> {
  const schema = assertAllowedChatDataSchema(schemaRaw);
  const tCuo = quoteSchemaTable(schema, "compra_cuotas");
  const tCxp = quoteSchemaTable(schema, "cuentas_por_pagar");
  const tPag = quoteSchemaTable(schema, "pagos_proveedores");
  const tCajas = quoteSchemaTable(schema, "cajas");
  const tCm = quoteSchemaTable(schema, "caja_movimientos");

  const monto = round2(Number(input.monto) || 0);
  if (monto <= 0) throw new Error("El monto del pago debe ser mayor a 0.");

  const client = await pool().connect();
  try {
    await client.query("BEGIN");

    const { rows: cuotaRows } = await client.query<{
      id: string;
      cuenta_por_pagar_id: string;
      saldo: string | number;
      proveedor_id: string | null;
      compra_numero_control: string | null;
      proveedor_nombre: string | null;
    }>(
      `SELECT c.id, c.cuenta_por_pagar_id, c.saldo, cx.proveedor_id,
              cx.compra_numero_control, cx.proveedor_nombre
         FROM ${tCuo} c JOIN ${tCxp} cx ON cx.id = c.cuenta_por_pagar_id
        WHERE c.id = $1::uuid AND c.empresa_id = $2::uuid
        FOR UPDATE`,
      [input.cuotaId, empresaId]
    );
    if (cuotaRows.length === 0) throw new Error("Cuota no encontrada.");
    const cuota = cuotaRows[0];
    const saldoCuota = round2(Number(cuota.saldo) || 0);
    if (monto > saldoCuota + 0.01) {
      throw new Error(`El pago (${monto}) supera el saldo de la cuota (${saldoCuota}).`);
    }

    await client.query(
      `INSERT INTO ${tPag} (
         empresa_id, proveedor_id, cuenta_por_pagar_id, cuota_id,
         fecha_pago, monto, metodo_pago, referencia, observaciones
       ) VALUES ($1::uuid, $2::uuid, $3::uuid, $4::uuid, COALESCE($5::date, current_date), $6::numeric, $7, $8, $9)`,
      [empresaId, cuota.proveedor_id, cuota.cuenta_por_pagar_id, cuota.id,
       input.fechaPago || null, monto, input.metodoPago || null, input.referencia || null, input.observaciones || null]
    );

    const nuevoSaldoCuota = round2(saldoCuota - monto);
    const estadoCuota = nuevoSaldoCuota <= 0.01 ? "pagada" : "parcial";
    await client.query(
      `UPDATE ${tCuo} SET saldo = $1::numeric, estado = $2, updated_at = now() WHERE id = $3::uuid`,
      [Math.max(0, nuevoSaldoCuota), estadoCuota, cuota.id]
    );

    // Recalcular la cuenta desde las cuotas.
    const { rows: agg } = await client.query<{ total: string; saldo: string; pend: string }>(
      `SELECT COALESCE(SUM(monto),0) AS total, COALESCE(SUM(saldo),0) AS saldo,
              COUNT(*) FILTER (WHERE saldo > 0.01 AND estado <> 'anulada') AS pend
         FROM ${tCuo} WHERE cuenta_por_pagar_id = $1::uuid AND estado <> 'anulada'`,
      [cuota.cuenta_por_pagar_id]
    );
    const saldoCuenta = round2(Number(agg[0]?.saldo) || 0);
    const pend = Number(agg[0]?.pend) || 0;
    const estadoCuenta = saldoCuenta <= 0.01 ? "pagado" : pend > 0 && saldoCuenta < round2(Number(agg[0]?.total) || 0) ? "parcial" : "pendiente";
    await client.query(
      `UPDATE ${tCxp} SET saldo = $1::numeric, estado = $2, updated_at = now() WHERE id = $3::uuid`,
      [Math.max(0, saldoCuenta), estadoCuenta, cuota.cuenta_por_pagar_id]
    );

    // Egreso de caja, solo si se pagó en efectivo. Dentro de la transacción: si
    // falla, no queda un pago registrado con la caja descuadrada.
    let cajaWarning: string | null = null;
    if ((input.metodoPago ?? "efectivo") === "efectivo") {
      const cajaR = await client.query<{ id: string }>(
        `SELECT id FROM ${tCajas}
          WHERE empresa_id = $1::uuid AND estado = 'abierta'
          ORDER BY fecha_apertura DESC LIMIT 1`,
        [empresaId]
      );
      if (cajaR.rowCount === 0) {
        cajaWarning =
          "El pago quedó registrado, pero no salió de ninguna caja porque no hay una abierta. Abrí la caja y cargá el egreso a mano.";
      } else {
        const detalle = [cuota.compra_numero_control, cuota.proveedor_nombre].filter(Boolean).join(" · ");
        const concepto = `Pago a proveedor${detalle ? ` ${detalle}` : ""}`.slice(0, 200);
        await client.query(
          `INSERT INTO ${tCm} (empresa_id, caja_id, tipo, concepto, monto, medio_pago, usuario_id, usuario_email)
           VALUES ($1::uuid, $2::uuid, 'egreso', $3, $4::numeric, 'efectivo', $5::uuid, $6)`,
          [empresaId, cajaR.rows[0].id, concepto, monto, input.usuarioId || null, input.usuarioNombre || null]
        );
      }
    }

    await client.query("COMMIT");
    return { ok: true, caja_warning: cajaWarning };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => null);
    throw err;
  } finally {
    client.release();
  }
}

// ── Provisorias (para la UI de compras) ─────────────────────────────────────
