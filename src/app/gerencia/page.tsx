"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Wallet,
  AlertTriangle,
  Users,
  Percent,
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import type { GerenciaReporte } from "@/lib/gerencia/comercial-pg";

/**
 * Gerencia.
 *
 * Portado de neura-erp-sistemas-propio, que mide un negocio de suscripciones
 * (MRR, clientes recurrentes, facturación por categoría de plan). Acá eso no
 * aplica, así que queda la parte que sí: cuánto se vendió, cuánto se cobró,
 * cuánto falta cobrar y de quién.
 *
 * La comparación importante es contra el MISMO DÍA del mes anterior: el 10 no
 * se compara contra un mes cerrado.
 */

const gs = (n: number | null | undefined) =>
  "Gs. " + Math.round(Number(n ?? 0)).toLocaleString("es-PY").replace(/,/g, ".");

const pct = (n: number | null | undefined) =>
  n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;

function mesLargo(periodo: string) {
  const [a, m] = periodo.split("-").map(Number);
  if (!a || !m) return periodo;
  return new Date(a, m - 1, 1).toLocaleDateString("es-PY", { month: "long", year: "numeric" });
}

export default function GerenciaPage() {
  const [datos, setDatos] = useState<GerenciaReporte | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const traer = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await fetch("/api/gerencia", { credentials: "include", cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.success) {
        setError(j?.error ?? "No se pudo armar el reporte.");
        return;
      }
      setDatos(j.data as GerenciaReporte);
    } catch {
      setError("No se pudo conectar.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void traer();
  }, [traer]);

  if (cargando && !datos) {
    return (
      <div className="py-24 text-center text-slate-400">
        <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
        Armando el reporte…
      </div>
    );
  }

  const k = datos?.kpis;
  const d = datos?.igual_dia;
  const vaMejor = (d?.diff ?? 0) >= 0;

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#4FAEB2] shadow-[0_0_0_3px_rgba(79,174,178,0.18)]" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#4FAEB2]">
              Dirección · Gerencia
            </p>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Gerencia</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Cómo viene {datos ? mesLargo(datos.periodo) : "el mes"} contra el mes pasado, y qué
            falta cobrar.
          </p>
        </div>
        <button
          onClick={() => void traer()}
          disabled={cargando}
          className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {datos && (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard
              accent
              label="Vendido del mes"
              value={gs(k?.facturado_mes)}
              icon={<TrendingUp className="h-4 w-4" />}
              hint={`${k?.ventas_mes ?? 0} venta${k?.ventas_mes === 1 ? "" : "s"}`}
            />
            <StatCard
              label="Cobrado del mes"
              value={gs(k?.cobrado_mes)}
              icon={<Wallet className="h-4 w-4" />}
              hint="pagos recibidos"
            />
            <StatCard
              label="Falta cobrar"
              value={gs(k?.pendiente_cobro)}
              icon={<AlertTriangle className="h-4 w-4" />}
              hint={
                (k?.vencido ?? 0) > 0
                  ? `${gs(k?.vencido)} ya vencido`
                  : "nada vencido"
              }
            />
            <StatCard
              label="Margen del mes"
              value={gs(k?.margen_mes)}
              icon={<Percent className="h-4 w-4" />}
              hint={k?.margen_pct == null ? "sin ventas" : `${k.margen_pct.toFixed(1)}% sobre el neto`}
            />
          </div>

          {/* La comparación que de verdad dice si vamos bien. */}
          <div className="rounded-2xl border border-[#4FAEB2]/30 bg-white p-6 shadow-sm ring-1 ring-[#4FAEB2]/10">
            <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
              <span className="inline-block h-3.5 w-1 rounded-full bg-[#4FAEB2]" />
              Ritmo contra el mes pasado
            </h2>
            <div className="flex flex-wrap items-end gap-8">
              <div>
                <p className="text-xs text-slate-500">Hasta el día {d?.dia} de este mes</p>
                <p className="mt-1 text-2xl font-semibold text-slate-900">
                  {gs(d?.facturado_actual)}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">A esta altura del mes pasado</p>
                <p className="mt-1 text-2xl font-semibold text-slate-400">
                  {gs(d?.facturado_anterior)}
                </p>
              </div>
              <div
                className={`flex items-center gap-2 rounded-xl px-4 py-2.5 ${
                  vaMejor
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-rose-50 text-rose-700"
                }`}
              >
                {vaMejor ? (
                  <TrendingUp className="h-5 w-5" />
                ) : (
                  <TrendingDown className="h-5 w-5" />
                )}
                <div>
                  <p className="text-sm font-semibold">
                    {vaMejor ? "+" : ""}
                    {gs(d?.diff).replace("Gs. -", "Gs. ")}
                  </p>
                  <p className="text-[11px] opacity-80">{pct(d?.diff_pct)}</p>
                </div>
              </div>
            </div>

            {/* Serie de los últimos 6 meses, en barras simples. */}
            <div className="mt-6 grid grid-cols-6 items-end gap-2">
              {datos.serie_mensual.map((m) => {
                const max = Math.max(...datos.serie_mensual.map((x) => x.facturado), 1);
                const alto = Math.max(4, Math.round((m.facturado / max) * 90));
                const esUltimo = m.mes === datos.periodo;
                return (
                  <div key={m.mes} className="flex flex-col items-center gap-1.5">
                    <span className="text-[10px] tabular-nums text-slate-400">
                      {/* Menos de un millón redondeaba a "0M". */}
                      {m.facturado >= 1_000_000
                        ? Math.round(m.facturado / 1_000_000) + "M"
                        : m.facturado > 0
                        ? Math.round(m.facturado / 1_000) + "k"
                        : ""}
                    </span>
                    <div
                      style={{ height: `${alto}px` }}
                      className={`w-full rounded-t ${esUltimo ? "bg-[#4FAEB2]" : "bg-slate-200"}`}
                      title={`${m.mes}: ${gs(m.facturado)}`}
                    />
                    <span className="text-[10px] text-slate-500">{m.mes.slice(5)}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Concentración: de quién depende el mes. */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                <Users className="h-4 w-4 text-slate-400" />
                Clientes del mes
              </h2>
              <p className="mb-4 text-xs text-slate-500">
                {datos.concentracion_top5_pct == null
                  ? "Todavía no hay ventas este mes."
                  : `Los 5 más grandes son el ${datos.concentracion_top5_pct.toFixed(0)}% del mes.`}
              </p>
              {datos.top_clientes.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">Sin ventas en el mes.</p>
              ) : (
                <ul className="m-0 list-none space-y-2 p-0">
                  {datos.top_clientes.map((c) => (
                    <li key={c.cliente} className="flex items-center justify-between gap-3 text-sm">
                      <span className="min-w-0 truncate text-slate-700">{c.cliente}</span>
                      <span className="shrink-0 tabular-nums font-medium text-slate-900">
                        {gs(c.facturado)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Lo que hay que salir a cobrar, lo más atrasado primero. */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-1 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
                <AlertTriangle className="h-4 w-4 text-slate-400" />
                Para salir a cobrar
              </h2>
              <p className="mb-4 text-xs text-slate-500">Lo más atrasado primero.</p>
              {datos.pendientes_cobro.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-400">
                  No hay nada pendiente de cobro.
                </p>
              ) : (
                <ul className="m-0 list-none space-y-2 p-0">
                  {datos.pendientes_cobro.slice(0, 10).map((c, i) => (
                    <li
                      key={`${c.numero ?? "s"}-${i}`}
                      className="flex items-center justify-between gap-3 text-sm"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-slate-700">{c.cliente}</span>
                        <span className="block text-[11px] text-slate-400">
                          {c.numero ?? "sin número"}
                          {c.dias_atraso != null && (
                            <span className="ml-1.5 font-semibold text-rose-600">
                              {c.dias_atraso} días de atraso
                            </span>
                          )}
                        </span>
                      </span>
                      <span className="shrink-0 tabular-nums font-medium text-slate-900">
                        {gs(c.saldo)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
