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
  return d && m && y ? `${d}/${m}/${y}` : String(iso);
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

      <div className="rounded-2xl border border-[#4FAEB2]/30 bg-white p-6 shadow-sm ring-1 ring-[#4FAEB2]/10">
        {cargando && filas.length === 0 ? (
          <p className="py-16 text-center text-slate-400">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
            Cargando…
          </p>
        ) : filas.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">
            No hay ventas en el período elegido.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2">Vendedor</th>
                  <th className="px-3 py-2 text-right">Ventas</th>
                  <th className="px-3 py-2 text-right">Total</th>
                  <th className="px-3 py-2 text-right">Ticket promedio</th>
                  <th className="px-3 py-2 text-right">Participación</th>
                  <th className="px-3 py-2">Última venta</th>
                </tr>
              </thead>
              <tbody>
                {filas.map((f) => {
                  const parte = total > 0 ? (f.total / total) * 100 : 0;
                  return (
                    <tr key={f.vendedor} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2.5 font-medium text-slate-800">{f.vendedor}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">{f.ventas}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-900">
                        {gs(f.total)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                        {gs(f.ticket_promedio)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="inline-flex items-center gap-2">
                          <span className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                            <span
                              className="block h-full rounded-full bg-[#4FAEB2]"
                              style={{ width: `${parte}%` }}
                            />
                          </span>
                          <span className="tabular-nums text-slate-600">{parte.toFixed(0)}%</span>
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-500">{fmtFecha(f.ultima_venta)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
