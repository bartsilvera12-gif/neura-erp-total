"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import StatCard from "@/components/ui/StatCard";
import ExportExcelButton from "@/components/ui/ExportExcelButton";
import MesSelector from "@/components/reportes/MesSelector";
import { getConciliacionReporte } from "@/lib/reportes/storage";
import { mesActualAsuncion } from "@/lib/fechas/asuncion-bounds";
import type { ConciliacionReporte, ConciliacionMovRow } from "@/lib/reportes/types";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

function formatGs(v: number) {
  return `Gs. ${Math.round(v).toLocaleString("es-PY")}`;
}
function formatFecha(iso: string) {
  try {
    const d = new Date(iso);
    const fch = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    const hh = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return `${fch} ${hh}`;
  } catch {
    return iso;
  }
}
const METODO: Record<string, string> = {
  efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta",
  qr: "QR", billetera: "Billetera", otro: "Otro",
};
const metodoLabel = (m: string | null) => (m ? METODO[m] ?? m : "—");
const ESTADO_BADGE: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-700",
  aprobado: "bg-emerald-100 text-emerald-700",
  rechazado: "bg-red-100 text-red-700",
};
const ESTADO_LBL: Record<string, string> = { pendiente: "Pendiente", aprobado: "Aprobado", rechazado: "Rechazado" };

export default function ConciliacionReportePage() {
  const [mes, setMes] = useState(mesActualAsuncion());
  const [data, setData] = useState<ConciliacionReporte | null>(null);
  const [movs, setMovs] = useState<ConciliacionMovRow[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancel = false;
    setCargando(true);
    getConciliacionReporte(mes).then((d) => { if (!cancel) { setData(d); setMovs(d?.movimientos ?? []); setCargando(false); } });
    return () => { cancel = true; };
  }, [mes]);

  async function setEstado(m: ConciliacionMovRow, estado: "aprobado" | "rechazado" | "pendiente") {
    if (busy) return;
    setBusy(m.id);
    const prev = m.estado;
    setMovs((arr) => arr.map((x) => (x.id === m.id ? { ...x, estado } : x)));
    try {
      const res = await fetchWithSupabaseSession("/api/reportes/conciliacion/movimiento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: m.tipo, id: m.id, estado }),
      });
      const body = await res.json();
      if (!res.ok || body?.success === false) {
        setMovs((arr) => arr.map((x) => (x.id === m.id ? { ...x, estado: prev } : x)));
      }
    } catch {
      setMovs((arr) => arr.map((x) => (x.id === m.id ? { ...x, estado: prev } : x)));
    } finally {
      setBusy(null);
    }
  }

  const cuentaEstado = (e: string) => movs.filter((m) => m.estado === e).length;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Zentra · Reportes"
        title="Conciliación bancaria"
        description="Cobros por transferencia y tarjeta. El efectivo no se concilia."
        backHref="/reportes"
        backLabel="Reportes"
        actions={
          <div className="flex items-center gap-3">
            <MesSelector mes={mes} onChange={setMes} />
            <ExportExcelButton url={`/api/reportes/conciliacion/export?mes=${mes}`} />
          </div>
        }
      />

      {cargando ? (
        <p className="text-slate-500 animate-pulse">Cargando…</p>
      ) : !data ? (
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6 text-slate-500">
          No se pudo cargar la conciliación.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatCard compact label="Total a conciliar" value={formatGs(data.totalCobrado)} accent hint="transferencia + tarjeta" />
            <StatCard compact label="Pendientes" value={String(cuentaEstado("pendiente"))} hint="por aprobar/rechazar" />
            <StatCard compact label="Aprobados" value={String(cuentaEstado("aprobado"))} />
            <StatCard compact label="Rechazados" value={String(cuentaEstado("rechazado"))} />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            {/* Por método */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <h2 className="text-base font-semibold text-slate-800 mb-4">Por método</h2>
              {data.porMetodo.length === 0 ? (
                <p className="text-sm text-slate-400">Sin cobros con detalle.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="py-2.5 pr-4 font-medium">Método</th>
                      <th className="py-2.5 pr-4 font-medium text-right">Operaciones</th>
                      <th className="py-2.5 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.porMetodo.map((m, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="py-2.5 pr-4 text-slate-700">{metodoLabel(m.clave)}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums text-slate-600">{m.cantidad}</td>
                        <td className="py-2.5 text-right tabular-nums font-semibold text-slate-800">{formatGs(m.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Por entidad */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
              <h2 className="text-base font-semibold text-slate-800 mb-4">Por entidad / caja</h2>
              {data.porEntidad.length === 0 ? (
                <p className="text-sm text-slate-400">Sin cobros con detalle.</p>
              ) : (
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b text-slate-500">
                      <th className="py-2.5 pr-4 font-medium">Entidad</th>
                      <th className="py-2.5 pr-4 font-medium text-right">Operaciones</th>
                      <th className="py-2.5 font-medium text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.porEntidad.map((e, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-0">
                        <td className="py-2.5 pr-4 text-slate-700">{e.clave}</td>
                        <td className="py-2.5 pr-4 text-right tabular-nums text-slate-600">{e.cantidad}</td>
                        <td className="py-2.5 text-right tabular-nums font-semibold text-slate-800">{formatGs(e.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Movimientos del mes con conciliación (aprobar / rechazar) */}
          <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
            <h2 className="text-base font-semibold text-slate-800 mb-4">Movimientos del mes</h2>
            {movs.length === 0 ? (
              <p className="text-sm text-slate-400">No hay cobros por transferencia o tarjeta en el período.</p>
            ) : (
              /* Esto era una tabla de 9 columnas con 1000px de ancho minimo: no
                 entraba, la columna Accion quedaba cortada, y los intentos de
                 arreglarlo con scroll horizontal solo agregaron un degrade que
                 parecia un defecto. Una tabla obliga a que todas las filas
                 compartan anchos; una lista no. Cada movimiento es una fila
                 flexible que se reacomoda sola y nunca se corta. */
              <ul className="m-0 flex list-none flex-col gap-2 p-0">
                {movs.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-xl border border-slate-200 px-4 py-3"
                  >
                    <div className="min-w-[120px]">
                      <p className="text-xs tabular-nums text-slate-600">{formatFecha(m.fecha)}</p>
                      <p className="font-mono text-[11px] text-slate-400">{m.numero ?? "—"}</p>
                    </div>

                    <span className="inline-block rounded-full bg-sky-50 px-2 py-0.5 text-xs font-medium text-sky-700">
                      {metodoLabel(m.metodo_pago)}
                    </span>

                    <div className="min-w-[150px] flex-1">
                      <p className="text-sm text-slate-700">
                        {m.entidad_codigo ? (
                          <span className="font-mono text-xs text-slate-400">{m.entidad_codigo} · </span>
                        ) : null}
                        {m.entidad ?? "—"}
                      </p>
                      {m.titular && <p className="text-xs text-slate-500">{m.titular}</p>}
                    </div>

                    <div className="text-right">
                      <p className="tabular-nums text-sm font-semibold text-slate-800">{formatGs(m.monto)}</p>
                      {m.referencia && (
                        <p className="font-mono text-[11px] text-slate-400">N° {m.referencia}</p>
                      )}
                    </div>

                    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold ${ESTADO_BADGE[m.estado]}`}>
                      {ESTADO_LBL[m.estado]}
                    </span>

                    <div className="ml-auto flex shrink-0 gap-2">
                      {m.estado === "pendiente" ? (
                        <>
                          <button
                            disabled={busy === m.id}
                            onClick={() => setEstado(m, "aprobado")}
                            className="rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                          >
                            Aprobar
                          </button>
                          <button
                            disabled={busy === m.id}
                            onClick={() => setEstado(m, "rechazado")}
                            className="rounded-lg border border-red-300 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-50"
                          >
                            Rechazar
                          </button>
                        </>
                      ) : (
                        <button
                          disabled={busy === m.id}
                          onClick={() => setEstado(m, "pendiente")}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                        >
                          Revertir
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}
