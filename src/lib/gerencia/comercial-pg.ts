import "server-only";
import { getChatPostgresPool, quoteSchemaTable } from "@/lib/supabase/chat-pg-pool";
import { assertAllowedChatDataSchema } from "@/lib/supabase/chat-data-schema";

/**
 * Reportería gerencial (solo lectura). No escribe nada.
 *
 * Portado de neura-erp-sistemas-propio (lib/gerencia/comercial-data.ts), que
 * mide un negocio de suscripciones: MRR, clientes recurrentes y facturación por
 * categoría de plan. Nada de eso aplica a una casa de electrodomésticos, así
 * que se porta la parte que sí: cuánto se vendió, cuánto se cobró, cuánto falta
 * cobrar y de quién, con la comparación contra el mes anterior.
 *
 * La pregunta que contesta esta pantalla es "¿vamos mejor o peor que el mes
 * pasado?", y para eso la comparación útil no es contra el mes anterior
 * completo sino contra el mismo día del mes anterior: el día 10 no se compara
 * con un mes cerrado.
 */

function pool() {
  const p = getChatPostgresPool();
  if (!p) throw new Error("Pool no disponible.");
  return p;
}

const num = (v: unknown): number => (v == null ? 0 : Number(v));

export type MesFila = {
  mes: string;
  facturado: number;
  cobrado: number;
  ventas: number;
};

export type GerenciaReporte = {
  periodo: string;
  generado_at: string;
  kpis: {
    facturado_mes: number;
    cobrado_mes: number;
    pendiente_cobro: number;
    vencido: number;
    ticket_promedio: number;
    ventas_mes: number;
    margen_mes: number;
    /** Margen sobre el neto (subtotal sin IVA), no sobre el total facturado. */
    margen_pct: number | null;
    variacion_facturado_pct: number | null;
  };
  /** Comparación contra el mismo día del mes anterior. */
  igual_dia: {
    dia: number;
    facturado_actual: number;
    facturado_anterior: number;
    diff: number;
    diff_pct: number | null;
  };
  serie_mensual: MesFila[];
  top_clientes: { cliente: string; facturado: number; ventas: number }[];
  /** Concentración: qué parte del mes depende de los 5 clientes más grandes. */
  concentracion_top5_pct: number | null;
  pendientes_cobro: {
    cliente: string;
    numero: string | null;
    saldo: number;
    vencimiento: string | null;
    dias_atraso: number | null;
  }[];
};

/** 'YYYY-MM' → primer día del mes. Sin período válido, el mes actual. */
function periodoADia1(periodo?: string): string {
  if (periodo && /^\d{4}-\d{2}$/.test(periodo)) return `${periodo}-01`;
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function variacion(actual: number, anterior: number): number | null {
  if (!anterior) return null;
  return ((actual - anterior) / anterior) * 100;
}

export async function getGerenciaReporte(
  schemaRaw: string,
  empresaId: string,
  periodo?: string
): Promise<GerenciaReporte> {
  const schema = assertAllowedChatDataSchema(schemaRaw);
  const tV = quoteSchemaTable(schema, "ventas");
  const tVI = quoteSchemaTable(schema, "ventas_items");
  const tCob = quoteSchemaTable(schema, "cobros_clientes");
  /** Pagos aplicados a facturas: el otro lado de la cobranza. */
  const tPagosFac = quoteSchemaTable(schema, "pagos");
  const tCxc = quoteSchemaTable(schema, "cuentas_por_cobrar");
  const tCli = quoteSchemaTable(schema, "clientes");

  const p = pool();
  const ref = periodoADia1(periodo);
  const periodoStr = ref.slice(0, 7);

  // Las anuladas y devueltas no cuentan en ningún número de esta pantalla.
  const vivas = `COALESCE(v.estado,'') NOT IN ('anulada','devuelta_total')`;

  const q = async <T>(sql: string, args: unknown[]): Promise<T[]> =>
    (await p.query(sql, args)).rows as T[];

  const [serie, igualDia, cxc, top, pend, margen] = await Promise.all([
    // Últimos 6 meses: vendido y cobrado.
    q<{ mes: string; facturado: number; cobrado: number; ventas: number }>(
      `WITH meses AS (
         SELECT generate_series(
           date_trunc('month', $2::date) - interval '5 months',
           date_trunc('month', $2::date),
           interval '1 month') AS mes
       ),
       vendido AS (
         SELECT date_trunc('month', v.fecha) AS mes,
                SUM(v.total)::float8 AS facturado,
                count(*)::int        AS ventas
           FROM ${tV} v
          WHERE v.empresa_id = $1::uuid AND ${vivas}
          GROUP BY 1
       ),
       /*
        * Lo cobrado sale de dos lados: los cobros de cuentas por cobrar
        * (ventas a crédito) y los pagos aplicados a facturas. Gerencia miraba
        * solo el primero y mostraba "cobrado del mes: 0" mientras el dashboard,
        * que mira los pagos, mostraba el importe real.
        */
       cobrado AS (
         SELECT mes, SUM(monto)::float8 AS cobrado FROM (
           SELECT date_trunc('month', c.fecha_pago) AS mes, c.monto
             FROM ${tCob} c
            WHERE c.empresa_id = $1::uuid
           UNION ALL
           SELECT date_trunc('month', pf.fecha_pago) AS mes, pf.monto
             FROM ${tPagosFac} pf
            WHERE pf.empresa_id = $1::uuid
         ) x GROUP BY 1
       )
       SELECT to_char(m.mes, 'YYYY-MM')     AS mes,
              COALESCE(ve.facturado, 0)     AS facturado,
              COALESCE(co.cobrado, 0)       AS cobrado,
              COALESCE(ve.ventas, 0)        AS ventas
         FROM meses m
         LEFT JOIN vendido ve ON ve.mes = m.mes
         LEFT JOIN cobrado co ON co.mes = m.mes
        ORDER BY m.mes`,
      [empresaId, ref]
    ),

    // Mismo día del mes anterior: el 10 no se compara con un mes cerrado.
    q<{ dia: number; actual: number; anterior: number }>(
      `WITH corte AS (
         SELECT CASE
                  WHEN date_trunc('month', $2::date) = date_trunc('month', CURRENT_DATE)
                    THEN EXTRACT(day FROM CURRENT_DATE)::int
                  ELSE EXTRACT(day FROM (date_trunc('month', $2::date) + interval '1 month - 1 day'))::int
                END AS dia
       )
       SELECT (SELECT dia FROM corte) AS dia,
              COALESCE(SUM(v.total) FILTER (
                WHERE v.fecha >= date_trunc('month', $2::date)
                  AND EXTRACT(day FROM v.fecha) <= (SELECT dia FROM corte)
                  AND v.fecha < date_trunc('month', $2::date) + interval '1 month'
              ), 0)::float8 AS actual,
              COALESCE(SUM(v.total) FILTER (
                WHERE v.fecha >= date_trunc('month', $2::date) - interval '1 month'
                  AND EXTRACT(day FROM v.fecha) <= (SELECT dia FROM corte)
                  AND v.fecha < date_trunc('month', $2::date)
              ), 0)::float8 AS anterior
         FROM ${tV} v
        WHERE v.empresa_id = $1::uuid AND ${vivas}`,
      [empresaId, ref]
    ),

    // Lo que falta cobrar, y cuánto de eso ya está vencido.
    q<{ saldo: number; vencido: number }>(
      `SELECT COALESCE(SUM(c.saldo), 0)::float8 AS saldo,
              COALESCE(SUM(CASE WHEN c.saldo > 0
                                 AND c.fecha_vencimiento IS NOT NULL
                                 AND c.fecha_vencimiento < CURRENT_DATE
                            THEN c.saldo ELSE 0 END), 0)::float8 AS vencido
         FROM ${tCxc} c
        WHERE c.empresa_id = $1::uuid`,
      [empresaId]
    ),

    // Clientes más grandes del mes.
    q<{ cliente: string; facturado: number; ventas: number }>(
      `SELECT COALESCE(NULLIF(TRIM(cl.empresa), ''), NULLIF(TRIM(cl.nombre_contacto), ''), NULLIF(TRIM(cl.nombre), ''), 'Sin cliente') AS cliente,
              SUM(v.total)::float8 AS facturado,
              count(*)::int        AS ventas
         FROM ${tV} v
         LEFT JOIN ${tCli} cl ON cl.id = v.cliente_id AND cl.empresa_id = v.empresa_id
        WHERE v.empresa_id = $1::uuid AND ${vivas}
          AND v.fecha >= date_trunc('month', $2::date)
          AND v.fecha <  date_trunc('month', $2::date) + interval '1 month'
        GROUP BY 1
        ORDER BY facturado DESC
        LIMIT 10`,
      [empresaId, ref]
    ),

    // Lo pendiente, lo más atrasado primero: es la lista para salir a cobrar.
    q<{
      cliente: string;
      numero: string | null;
      saldo: number;
      vencimiento: string | null;
      dias_atraso: number | null;
    }>(
      `SELECT COALESCE(NULLIF(TRIM(cl.empresa), ''), NULLIF(TRIM(cl.nombre_contacto), ''), NULLIF(TRIM(cl.nombre), ''), 'Sin cliente') AS cliente,
              c.numero_venta                                      AS numero,
              c.saldo::float8                                     AS saldo,
              c.fecha_vencimiento                                 AS vencimiento,
              CASE WHEN c.fecha_vencimiento IS NOT NULL AND c.fecha_vencimiento < CURRENT_DATE
                   THEN (CURRENT_DATE - c.fecha_vencimiento)::int END AS dias_atraso
         FROM ${tCxc} c
         LEFT JOIN ${tCli} cl ON cl.id = c.cliente_id AND cl.empresa_id = c.empresa_id
        WHERE c.empresa_id = $1::uuid AND c.saldo > 0
        ORDER BY dias_atraso DESC NULLS LAST, c.saldo DESC
        LIMIT 25`,
      [empresaId]
    ),

    // Margen del mes. Ingreso sin IVA contra el costo congelado en la venta.
    q<{ ingreso: number; costo: number }>(
      `SELECT COALESCE(SUM(vi.subtotal), 0)::float8                      AS ingreso,
              COALESCE(SUM(vi.costo_unitario * vi.cantidad), 0)::float8  AS costo
         FROM ${tVI} vi
         JOIN ${tV} v ON v.id = vi.venta_id
        WHERE v.empresa_id = $1::uuid AND ${vivas}
          AND v.fecha >= date_trunc('month', $2::date)
          AND v.fecha <  date_trunc('month', $2::date) + interval '1 month'`,
      [empresaId, ref]
    ),
  ]);

  const serieMensual: MesFila[] = serie.map((r) => ({
    mes: String(r.mes),
    facturado: num(r.facturado),
    cobrado: num(r.cobrado),
    ventas: num(r.ventas),
  }));

  const mesActual = serieMensual[serieMensual.length - 1];
  const mesAnterior = serieMensual[serieMensual.length - 2];

  const d = igualDia[0] ?? { dia: 0, actual: 0, anterior: 0 };
  const diaActual = num(d.actual);
  const diaAnterior = num(d.anterior);

  const ingreso = num(margen[0]?.ingreso);
  const costo = num(margen[0]?.costo);
  const margenMes = ingreso - costo;

  const facturadoMes = mesActual?.facturado ?? 0;
  const ventasMes = mesActual?.ventas ?? 0;

  const topClientes = top.map((r) => ({
    cliente: String(r.cliente),
    facturado: num(r.facturado),
    ventas: num(r.ventas),
  }));
  const top5 = topClientes.slice(0, 5).reduce((a, c) => a + c.facturado, 0);

  return {
    periodo: periodoStr,
    generado_at: new Date().toISOString(),
    kpis: {
      facturado_mes: facturadoMes,
      cobrado_mes: mesActual?.cobrado ?? 0,
      pendiente_cobro: num(cxc[0]?.saldo),
      vencido: num(cxc[0]?.vencido),
      ticket_promedio: ventasMes > 0 ? facturadoMes / ventasMes : 0,
      ventas_mes: ventasMes,
      margen_mes: margenMes,
      margen_pct: ingreso > 0 ? (margenMes / ingreso) * 100 : null,
      variacion_facturado_pct: variacion(facturadoMes, mesAnterior?.facturado ?? 0),
    },
    igual_dia: {
      dia: num(d.dia),
      facturado_actual: diaActual,
      facturado_anterior: diaAnterior,
      diff: diaActual - diaAnterior,
      diff_pct: variacion(diaActual, diaAnterior),
    },
    serie_mensual: serieMensual,
    top_clientes: topClientes,
    concentracion_top5_pct: facturadoMes > 0 ? (top5 / facturadoMes) * 100 : null,
    pendientes_cobro: pend.map((r) => ({
      cliente: String(r.cliente),
      numero: r.numero ?? null,
      saldo: num(r.saldo),
      vencimiento: r.vencimiento ? String(r.vencimiento) : null,
      dias_atraso: r.dias_atraso == null ? null : num(r.dias_atraso),
    })),
  };
}
