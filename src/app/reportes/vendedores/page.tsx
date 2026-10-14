"use client";

/**
 * Ventas por vendedor.
 *
 * La tarjeta de Reportes apuntaba a /comisiones, una ruta que ya no existe: el
 * módulo de Comisiones se dio de baja porque el cliente no lo pidió. Esta
 * pantalla la reemplaza con lo que sí hace falta: cuánto vendió cada asesor en
 * el período. No calcula comisiones.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Users, Loader2, RefreshCw } from "lucide-react";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import StatCard from "@/components/ui/StatCard";

type Fila = {
  vendedor: string;
  ventas: number;
  total: number;
  ticket_promedio: number;
  ultima_venta: string | null;
};

const gs = (n: number) => "Gs. " + Math.round(Number(n) || 0).toLocaleString("es-PY");

/** Un tono por puesto en el ranking; del cuarto en adelante repiten el ultimo. */
const TONOS = [
  { borde: "border-[#4FAEB2]/40 ring-1 ring-[#4FAEB2]/10", barra: "bg-[#4FAEB2]", texto: "text-[#2F7F82]", chip: "bg-[#4FAEB2] text-white" },
  { borde: "border-sky-200", barra: "bg-sky-400", texto: "text-sky-700", chip: "bg-sky-500 text-white" },
  { borde: "border-amber-200", barra: "bg-amber-400", texto: "text-amber-700", chip: "bg-amber-500 text-white" },
  { borde: "border-slate-200", barra: "bg-slate-300", texto: "text-slate-700", chip: "bg-slate-400 text-white" },
];

function primerDiaDelMes() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}
function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}
function fmtFecha(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  if (d && m && y) return `${d}/${m}/${y}`;
  // Por las dudas: si llega algo que no es YYYY-MM-DD, se muestra una fecha
  // legible igual, nunca el texto crudo del objeto Date.
  const f = new Date(iso);
  return isNaN(f.getTime()) ? "—" : f.toLocaleDateString("es-PY");
}

export default function VentasPorVendedorPage() {
  const [desde, setDesde] = useState(primerDiaDelMes());
  const [hasta, setHasta] = useState(hoyISO());
  const [filas, setFilas] = useState<Fila[]>([]);
  const [total, setTotal] = useState(0);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const traer = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await fetchWithSupabaseSession(
        `/api/reportes/vendedores?desde=${desde}&hasta=${hasta}`,
        { cache: "no-store" }
      );
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.success) {
        setError(j?.error ?? "No se pudo armar el reporte.");
        return;
      }
      setFilas((j.data?.vendedores ?? []) as Fila[]);
      setTotal(Number(j.data?.total) || 0);
    } catch {
      setError("No se pudo conectar.");
    } finally {
      setCargando(false);
    }
  }, [desde, hasta]);

  useEffect(() => { void traer(); }, [traer]);

  const campo =
    "rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/20";

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Users className="h-7 w-7 text-[#4FAEB2]" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4FAEB2]">
              Reportes · Vendedores
            </p>
            <h1 className="text-2xl font-bold text-gray-800">Ventas por vendedor</h1>
            <p className="text-sm text-gray-500">Cuánto vendió cada asesor en el período.</p>
          </div>
        </div>
        <Link href="/reportes" className="text-sm font-medium text-[#4FAEB2] hover:underline">
          ← Volver a Reportes
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">Desde</label>
          <input type="date" value={desde} onChange={(e) => setDesde(e.target.value)} className={campo} />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-slate-500">Hasta</label>
          <input type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} className={campo} />
        </div>
        <button
          onClick={() => void traer()}
          disabled={cargando}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {cargando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard accent label="Vendido en el período" value={gs(total)} />
        <StatCard label="Vendedores con ventas" value={String(filas.length)} />
        <StatCard
          label="Ventas"
          value={String(filas.reduce((a, f) => a + f.ventas, 0))}
          hint="sin anuladas"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      {cargando && filas.length === 0 ? (
        <p className="py-16 text-center text-slate-400">
          <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
          Cargando…
        </p>
      ) : filas.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center shadow-sm">
          <p className="text-sm text-slate-400">No hay ventas en el período elegido.</p>
        </div>
      ) : (
        /* Una tarjeta por asesor en vez de una tabla: lo que se mira de un
           vistazo es quien vendio mas, no cruzar columnas. El color del borde
           y de la barra rankea; el resto queda sobrio para que el numero
           grande sea lo que salta. */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filas.map((f, i) => {
            const parte = total > 0 ? (f.total / total) * 100 : 0;
            const tono = TONOS[Math.min(i, TONOS.length - 1)];
            return (
              <div
                key={f.vendedor}
                className={`rounded-2xl border bg-white p-5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${tono.borde}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">{f.vendedor}</p>
                    <p className="text-[11px] uppercase tracking-wide text-slate-400">
                      {f.ventas} venta{f.ventas === 1 ? "" : "s"}
                    </p>
                  </div>
                  {i === 0 && filas.length > 1 && (
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${tono.chip}`}>
                      1.º
                    </span>
                  )}
                </div>

                <p className={`mt-3 text-2xl font-bold tabular-nums ${tono.texto}`}>{gs(f.total)}</p>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${tono.barra}`}
                    style={{ width: `${Math.max(parte, 2)}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-slate-500">
                  {parte.toFixed(0)}% de lo vendido en el período
                </p>

                <dl className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-100 pt-3 text-xs">
                  <div>
                    <dt className="text-slate-400">Ticket promedio</dt>
                    <dd className="mt-0.5 font-semibold tabular-nums text-slate-700">
                      {gs(f.ticket_promedio)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-slate-400">Última venta</dt>
                    <dd className="mt-0.5 font-semibold text-slate-700">{fmtFecha(f.ultima_venta)}</dd>
                  </div>
                </dl>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
