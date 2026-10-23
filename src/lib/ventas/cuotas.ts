/**
 * Plan de cuotas de una venta a crédito.
 *
 * Sin interés: lo que queda después de la entrega inicial se parte en cuotas
 * mensuales iguales. El redondeo NO se reparte: se absorbe entero en la última
 * cuota, para que la suma cierre exacta con lo que se debe. Si no, 100.000 en
 * 3 cuotas de 33.333 dejaba un guaraní colgado para siempre y la cuenta nunca
 * llegaba a saldo cero.
 */

export type CuotaPlan = {
  numero_cuota: number;
  fecha_vencimiento: string; // YYYY-MM-DD
  monto: number;
};

/** Cuotas permitidas en el selector. */
export const CUOTAS_OPCIONES = [1, 2, 3, 4, 5, 6, 9, 10, 12, 18, 24] as const;

/**
 * Suma `meses` a una fecha respetando el fin de mes: el 31/01 + 1 mes cae
 * el 28/02 (o 29), no el 02/03 como haría `setMonth` solo.
 */
export function sumarMeses(fechaYmd: string, meses: number): string {
  const [y, m, d] = fechaYmd.slice(0, 10).split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1 + meses, 1));
  const ultimoDia = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 0)).getUTCDate();
  base.setUTCDate(Math.min(d, ultimoDia));
  return base.toISOString().slice(0, 10);
}

function round2(n: number): number {
  return Math.round((Number(n) || 0) * 100) / 100;
}

/**
 * Arma las cuotas. `fechaBase` es la fecha de la venta (YYYY-MM-DD): la cuota 1
 * vence un mes después, la 2 a los dos meses, y así.
 *
 * Devuelve [] si no hay nada que financiar — así quien llama no tiene que
 * distinguir el caso de la venta cobrada entera con la entrega inicial.
 */
export function planCuotas(args: {
  totalFinanciado: number;
  cantidadCuotas: number;
  fechaBase: string;
}): CuotaPlan[] {
  const total = round2(args.totalFinanciado);
  const n = Math.floor(Number(args.cantidadCuotas) || 0);
  if (!(total > 0) || n < 1) return [];

  // Guaraní no tiene centavos: se parte en enteros y la última absorbe el resto.
  const base = Math.floor(total / n);
  const cuotas: CuotaPlan[] = [];
  let acumulado = 0;
  for (let i = 1; i <= n; i++) {
    const monto = i === n ? round2(total - acumulado) : base;
    acumulado = round2(acumulado + monto);
    cuotas.push({
      numero_cuota: i,
      fecha_vencimiento: sumarMeses(args.fechaBase, i),
      monto,
    });
  }
  return cuotas;
}

/**
 * Reparte un cobro sobre las cuotas pendientes, de la más vieja a la más nueva.
 * Lo que sobra después de tapar una cuota cae sobre la siguiente: el cliente que
 * paga 300 cuando la cuota era 250 se adelanta 50 del mes que viene.
 *
 * Devuelve la imputación cuota por cuota y lo que no se pudo aplicar
 * (`sobrante`), que es lo que excede la deuda entera.
 */
export function repartirCobro(
  monto: number,
  cuotas: { id: string; saldo: number }[]
): { aplicaciones: { cuota_id: string; monto: number; saldo_nuevo: number }[]; sobrante: number } {
  let restante = round2(monto);
  const aplicaciones: { cuota_id: string; monto: number; saldo_nuevo: number }[] = [];
  for (const c of cuotas) {
    if (restante <= 0.009) break;
    const saldo = round2(c.saldo);
    if (saldo <= 0.009) continue;
    const aplicado = Math.min(saldo, restante);
    restante = round2(restante - aplicado);
    aplicaciones.push({ cuota_id: c.id, monto: round2(aplicado), saldo_nuevo: round2(saldo - aplicado) });
  }
  return { aplicaciones, sobrante: round2(restante) };
}

/** Estado de una cuota a partir de su saldo. */
export function estadoCuota(monto: number, saldo: number): "pendiente" | "parcial" | "pagada" {
  if (round2(saldo) <= 0.009) return "pagada";
  return round2(saldo) < round2(monto) ? "parcial" : "pendiente";
}
