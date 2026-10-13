"use client";

/**
 * Pagos: la plata que SALE (proveedores).
 *
 * Antes esta ruta mostraba Cobranzas, y /cobros era un redirect hacia acá: el
 * menú repetía el mismo panel en dos lugares. Ahora cada uno muestra lo suyo.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Banknote, Loader2, RefreshCw } from "lucide-react";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import StatCard from "@/components/ui/StatCard";

type Cuota = {
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
};

const METODOS = ["efectivo", "transferencia", "tarjeta", "cheque", "otro"] as const;

function fmtGs(n: number, moneda = "PYG") {
  return (moneda === "USD" ? "USD " : "Gs. ") + Math.round(Number(n) || 0).toLocaleString("es-PY");
}
function fmtFecha(iso: string | null) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).slice(0, 10).split("-");
  return d && m && y ? `${d}/${m}/${y}` : String(iso);
}
function diasDe(iso: string): number {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const v = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
  return Math.round((v.getTime() - hoy.getTime()) / 86400000);
}

const hoyISO = () => new Date().toISOString().slice(0, 10);

export default function PagosPage() {
  const [cuotas, setCuotas] = useState<Cuota[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<"pendientes" | "vencidas" | "todas">("pendientes");
  const [pagando, setPagando] = useState<Cuota | null>(null);

  const traer = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await fetchWithSupabaseSession("/api/cuentas-por-pagar", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.success) {
        setError(j?.error ?? "No se pudieron traer las cuotas.");
        return;
      }
      setCuotas((j.data?.cuotas ?? []) as Cuota[]);
    } catch {
      setError("No se pudo conectar.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void traer(); }, [traer]);

  const pendientes = useMemo(() => cuotas.filter((c) => c.saldo > 0), [cuotas]);
  const vencidas = useMemo(() => pendientes.filter((c) => diasDe(c.fecha_vencimiento) < 0), [pendientes]);
  const estaSemana = useMemo(
    () => pendientes.filter((c) => { const d = diasDe(c.fecha_vencimiento); return d >= 0 && d <= 7; }),
    [pendientes]
  );

  const vista = useMemo(() => {
    const base = filtro === "todas" ? cuotas : filtro === "vencidas" ? vencidas : pendientes;
    return [...base].sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento));
  }, [cuotas, pendientes, vencidas, filtro]);

  const totalDeuda = pendientes.reduce((a, c) => a + c.saldo, 0);
  const totalVencido = vencidas.reduce((a, c) => a + c.saldo, 0);

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Banknote className="h-7 w-7 text-[#4FAEB2]" />
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#4FAEB2]">
              Finanzas · Pagos
            </p>
            <h1 className="text-2xl font-bold text-gray-800">Pagos a proveedores</h1>
            <p className="text-sm text-gray-500">
              Lo que debés: cuotas de las compras a crédito y registro de pagos.
            </p>
          </div>
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

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard
          accent
          label="Deuda total"
          value={fmtGs(totalDeuda)}
          hint={`${pendientes.length} cuota${pendientes.length === 1 ? "" : "s"} sin pagar`}
        />
        <StatCard
          label="Vencido"
          value={fmtGs(totalVencido)}
          hint={vencidas.length === 0 ? "nada vencido" : `${vencidas.length} cuota${vencidas.length === 1 ? "" : "s"}`}
        />
        <StatCard
          label="Vence esta semana"
          value={String(estaSemana.length)}
          hint="próximos 7 días"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="rounded-2xl border border-[#4FAEB2]/30 bg-white p-6 shadow-sm ring-1 ring-[#4FAEB2]/10">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          {([["pendientes", "Sin pagar"], ["vencidas", "Vencidas"], ["todas", "Todas"]] as const).map(
            ([id, et]) => (
              <button
                key={id}
                onClick={() => setFiltro(id)}
                aria-pressed={filtro === id}
                className={`rounded-full border px-3.5 py-1.5 text-[13px] font-semibold ${
                  filtro === id
                    ? "border-[#4FAEB2] bg-[#4FAEB2] text-white"
                    : "border-slate-200 text-slate-600 hover:border-[#4FAEB2]"
                }`}
              >
                {et}
              </button>
            )
          )}
        </div>

        {cargando && cuotas.length === 0 ? (
          <p className="py-16 text-center text-slate-400">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
            Cargando cuotas…
          </p>
        ) : vista.length === 0 ? (
          <p className="py-16 text-center text-sm text-slate-400">
            {cuotas.length === 0
              ? "No hay compras a crédito cargadas todavía."
              : "No hay cuotas en este filtro."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-3 py-2">Proveedor</th>
                  <th className="px-3 py-2">Compra</th>
                  <th className="px-3 py-2">Cuota</th>
                  <th className="px-3 py-2">Vence</th>
                  <th className="px-3 py-2 text-right">Monto</th>
                  <th className="px-3 py-2 text-right">Saldo</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {vista.map((c) => {
                  const dias = diasDe(c.fecha_vencimiento);
                  const vencida = c.saldo > 0 && dias < 0;
                  return (
                    <tr key={c.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-3 py-2.5 font-medium text-slate-800">
                        {c.proveedor_nombre ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 font-mono text-[12px] text-slate-500">
                        {c.compra_numero_control ?? "—"}
                      </td>
                      <td className="px-3 py-2.5 tabular-nums text-slate-600">#{c.numero_cuota}</td>
                      <td className="px-3 py-2.5">
                        <span className={vencida ? "font-semibold text-rose-600" : "text-slate-600"}>
                          {fmtFecha(c.fecha_vencimiento)}
                        </span>
                        {vencida && (
                          <span className="ml-1.5 text-[11px] font-semibold text-rose-600">
                            {Math.abs(dias)} días
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-slate-600">
                        {fmtGs(c.monto, c.moneda)}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-slate-900">
                        {fmtGs(c.saldo, c.moneda)}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        {c.saldo > 0 ? (
                          <button
                            onClick={() => setPagando(c)}
                            className="rounded-lg bg-[#4FAEB2] px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-[#3F8E91]"
                          >
                            Pagar
                          </button>
                        ) : (
                          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[12px] font-semibold text-emerald-700">
                            Pagada
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagando && (
        <ModalPago
          cuota={pagando}
          cerrar={() => setPagando(null)}
          listo={() => { setPagando(null); void traer(); }}
        />
      )}
    </div>
  );
}

function ModalPago({
  cuota, cerrar, listo,
}: { cuota: Cuota; cerrar: () => void; listo: () => void }) {
  const [monto, setMonto] = useState(String(Math.round(cuota.saldo)));
  const [fecha, setFecha] = useState(hoyISO());
  const [metodo, setMetodo] = useState<string>("transferencia");
  const [referencia, setReferencia] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    const n = Number(monto);
    if (!Number.isFinite(n) || n <= 0) return setError("El monto debe ser mayor a 0.");
    if (n > cuota.saldo + 0.01) return setError(`No puede superar el saldo (${fmtGs(cuota.saldo, cuota.moneda)}).`);
    setGuardando(true);
    setError(null);
    try {
      const r = await fetchWithSupabaseSession("/api/cuentas-por-pagar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cuota_id: cuota.id,
          monto: n,
          fecha_pago: fecha,
          metodo_pago: metodo,
          referencia: referencia.trim() || null,
        }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.success) {
        setError(j?.error ?? "No se pudo registrar el pago.");
        return;
      }
      listo();
    } catch {
      setError("No se pudo conectar.");
    } finally {
      setGuardando(false);
    }
  }

  const campo = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/20";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 className="text-lg font-bold text-slate-900">Registrar pago</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          {cuota.proveedor_nombre ?? "Proveedor"} · cuota #{cuota.numero_cuota} ·
          saldo {fmtGs(cuota.saldo, cuota.moneda)}
        </p>

        <div className="mt-5 grid gap-3">
          <label className="text-[13px] font-semibold text-slate-700">
            Monto
            <input
              type="number" min="0" value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className={`mt-1 ${campo}`}
            />
          </label>
          <label className="text-[13px] font-semibold text-slate-700">
            Fecha
            <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} className={`mt-1 ${campo}`} />
          </label>
          <label className="text-[13px] font-semibold text-slate-700">
            Método
            <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className={`mt-1 ${campo}`}>
              {METODOS.map((m) => (
                <option key={m} value={m}>{m[0].toUpperCase() + m.slice(1)}</option>
              ))}
            </select>
          </label>
          <label className="text-[13px] font-semibold text-slate-700">
            Referencia <span className="font-normal text-slate-400">(opcional)</span>
            <input
              value={referencia} onChange={(e) => setReferencia(e.target.value)}
              placeholder="N.º de transferencia, cheque…"
              className={`mt-1 ${campo}`}
            />
          </label>
        </div>

        {error && (
          <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button onClick={cerrar} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium">
            Cancelar
          </button>
          <button
            onClick={() => void guardar()}
            disabled={guardando}
            className="rounded-lg bg-[#4FAEB2] px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {guardando ? "Guardando…" : "Registrar pago"}
          </button>
        </div>
      </div>
    </div>
  );
}
