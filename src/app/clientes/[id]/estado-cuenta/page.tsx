"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Loader2, Banknote, Download, ChevronDown, ChevronUp } from "lucide-react";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";
import { generarYAbrirRecibo } from "@/lib/recibos/client";
import { RegistrarCobroModalCxc } from "@/components/cobros/RegistrarCobroModalCxc";
import { formatFechaDdMmAaaa } from "@/lib/fechas/calendario";

type Cuota = {
  numero_cuota: number;
  fecha_vencimiento: string;
  monto: number;
  saldo: number;
  estado: string;
  vencida: boolean;
};
type Plan = {
  total_cuotas: number;
  cuotas_pagadas: number;
  cuotas_pendientes: number;
  cuotas_vencidas: number;
  proxima_numero: number | null;
  proxima_vencimiento: string | null;
  proxima_saldo: number | null;
};
type Mov = {
  id: string;
  numero_venta: string | null;
  fecha_emision: string | null;
  fecha_vencimiento: string | null;
  total: number;
  cobrado: number;
  saldo: number;
  estado: string;
  vencida: boolean;
  /** Vacío en las cuentas viejas, de un solo vencimiento. */
  cuotas?: Cuota[];
  plan?: Plan | null;
};
type Cobro = { id: string; fecha_pago: string; monto: number; metodo_pago: string; referencia: string | null };
type Cliente = { id: string; nombre: string; ruc: string | null; telefono: string | null; direccion: string | null };
type Resumen = { total_vendido: number; saldo_pendiente: number; total_cobrado: number; vencido: number };

const ESTADO_BADGE: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-700",
  parcial: "bg-sky-100 text-sky-700",
  pagado: "bg-emerald-100 text-emerald-700",
  vencido: "bg-red-100 text-red-700",
  anulado: "bg-slate-100 text-slate-500",
};

function fmtGs(n: number) {
  return "Gs. " + Math.round(Number(n) || 0).toLocaleString("es-PY");
}
// Las fechas de emisión y vencimiento son días de calendario guardados a las
// 00:00 UTC: leerlos con la hora local de Asunción (UTC-3) los corría un día
// para atrás (una venta del 23 se mostraba como 22).
function fmtFecha(iso: string | null) {
  if (!iso) return "—";
  return formatFechaDdMmAaaa(iso);
}

export default function EstadoCuentaPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [resumen, setResumen] = useState<Resumen | null>(null);
  const [movs, setMovs] = useState<Mov[]>([]);
  const [cobros, setCobros] = useState<Cobro[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /** Cuentas con el detalle de cuotas desplegado. */
  const [verCuotas, setVerCuotas] = useState<Record<string, boolean>>({});

  const [cobrando, setCobrando] = useState<Mov | null>(null);
  const [reciboBusy, setReciboBusy] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetchWithSupabaseSession(`/api/clientes/${id}/estado-cuenta`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok || body?.success === false) {
        setError(body?.error ?? "No se pudo cargar el estado de cuenta.");
        return;
      }
      setCliente(body.data.cliente);
      setResumen(body.data.resumen);
      setMovs(body.data.movimientos ?? []);
      setCobros(body.data.cobros ?? []);
    } catch {
      setError("Error de red.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  function abrirCobro(m: Mov) {
    setCobrando(m);
  }

  if (loading) {
    return <div className="p-6 flex items-center gap-2 text-sm text-gray-500"><Loader2 className="h-4 w-4 animate-spin" /> Cargando…</div>;
  }
  if (!cliente || !resumen) {
    return (
      <div className="p-6 space-y-3">
        <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error ?? "Cliente no encontrado"}</div>
        <Link href="/clientes" className="text-sm text-[#4FAEB2] hover:underline">Volver a clientes</Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {toast && (
        <div className="fixed top-4 right-4 z-50 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white shadow-lg">✓ {toast}</div>
      )}

      <Link href="/clientes" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="h-4 w-4" /> Volver a clientes
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Banknote className="h-7 w-7 text-[#4FAEB2]" />
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Estado de cuenta</h1>
            <p className="text-gray-600">{cliente.nombre}{cliente.ruc ? ` · ${cliente.ruc}` : ""}</p>
          </div>
        </div>
        <a
          href={`/api/clientes/${id}/estado-cuenta/pdf?auto=1`}
          target="_blank"
          rel="noopener"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" /> Descargar estado de cuenta
        </a>
      </div>

      {error && <div className="rounded-md bg-red-50 border border-red-200 p-3 text-sm text-red-700">{error}</div>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-gray-400">Total vendido</div>
          <div className="mt-1 text-xl font-bold text-slate-800">{fmtGs(resumen.total_vendido)}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-emerald-600">Cobrado</div>
          <div className="mt-1 text-xl font-bold text-emerald-700">{fmtGs(resumen.total_cobrado)}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-amber-600">Saldo pendiente</div>
          <div className="mt-1 text-xl font-bold text-amber-700">{fmtGs(resumen.saldo_pendiente)}</div>
        </div>
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-red-500">Vencido</div>
          <div className="mt-1 text-xl font-bold text-red-700">{fmtGs(resumen.vencido)}</div>
        </div>
      </div>

      {/* Movimientos (créditos) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-semibold text-gray-700">Cuentas a crédito</h2></div>
        {movs.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">Este cliente no tiene ventas a crédito.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Venta</th>
                  <th className="py-2.5 px-4 font-medium">Emisión</th>
                  <th className="py-2.5 px-4 font-medium">Vencimiento</th>
                  <th className="py-2.5 px-4 font-medium text-center">Cuotas</th>
                  <th className="py-2.5 px-4 font-medium text-right">Total</th>
                  <th className="py-2.5 px-4 font-medium text-right">Cobrado</th>
                  <th className="py-2.5 px-4 font-medium text-right">Saldo</th>
                  <th className="py-2.5 px-4 font-medium">Estado</th>
                  <th className="py-2.5 px-4 font-medium text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movs.map((m) => (
                  <Fragment key={m.id}>
                  <tr>
                    <td className="py-2.5 px-4 font-mono font-medium text-gray-800">{m.numero_venta ?? "—"}</td>
                    <td className="py-2.5 px-4 text-gray-600">{fmtFecha(m.fecha_emision)}</td>
                    <td className={`py-2.5 px-4 ${m.vencida ? "font-semibold text-red-600" : "text-gray-600"}`}>{fmtFecha(m.fecha_vencimiento)}</td>
                    <td className="py-2.5 px-4 text-center">
                      {m.plan ? (
                        <button
                          type="button"
                          onClick={() => setVerCuotas((p) => ({ ...p, [m.id]: !p[m.id] }))}
                          className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
                          title="Ver el detalle de las cuotas"
                        >
                          <span className="tabular-nums">{m.plan.cuotas_pagadas}/{m.plan.total_cuotas}</span>
                          {m.plan.cuotas_vencidas > 0 && (
                            <span className="rounded-full bg-red-100 px-1.5 text-[10px] font-semibold text-red-700">
                              {m.plan.cuotas_vencidas} vencida{m.plan.cuotas_vencidas === 1 ? "" : "s"}
                            </span>
                          )}
                          {verCuotas[m.id] ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{fmtGs(m.total)}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums text-emerald-700">{fmtGs(m.cobrado)}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-semibold">{fmtGs(m.saldo)}</td>
                    <td className="py-2.5 px-4">
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${ESTADO_BADGE[m.vencida && m.estado !== "pagado" ? "vencido" : m.estado] ?? ESTADO_BADGE.pendiente}`}>
                        {m.vencida && m.estado !== "pagado" ? "Vencido" : m.estado.charAt(0).toUpperCase() + m.estado.slice(1)}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {m.estado === "pagado" || m.estado === "anulado" ? (
                        <span className="text-xs text-gray-400">—</span>
                      ) : (
                        <button onClick={() => abrirCobro(m)} className="rounded-lg bg-[#4FAEB2] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#3F8E91]">Registrar cobro</button>
                      )}
                    </td>
                  </tr>
                  {m.plan && verCuotas[m.id] && (m.cuotas?.length ?? 0) > 0 && (
                    <tr className="bg-slate-50/70">
                      <td colSpan={9} className="px-4 py-3">
                        <p className="mb-2 text-xs font-semibold text-slate-600">
                          Pagó {m.plan.cuotas_pagadas} de {m.plan.total_cuotas} cuotas,
                          {m.plan.cuotas_pendientes > 0 ? ` le faltan ${m.plan.cuotas_pendientes}` : " no le queda ninguna"}
                          {m.plan.proxima_vencimiento && (
                            <span className="font-normal text-slate-500">
                              {" "}· próxima: cuota {m.plan.proxima_numero} de {fmtGs(m.plan.proxima_saldo ?? 0)} el {fmtFecha(m.plan.proxima_vencimiento)}
                            </span>
                          )}
                        </p>
                        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                          <table className="w-full min-w-[520px] text-left text-xs">
                            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-500">
                              <tr>
                                <th className="px-3 py-2 font-medium">Cuota</th>
                                <th className="px-3 py-2 font-medium">Vence</th>
                                <th className="px-3 py-2 font-medium text-right">Monto</th>
                                <th className="px-3 py-2 font-medium text-right">Pagado</th>
                                <th className="px-3 py-2 font-medium text-right">Saldo</th>
                                <th className="px-3 py-2 font-medium">Estado</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(m.cuotas ?? []).map((q) => {
                                const estadoVisQ = q.vencida ? "vencido" : q.estado === "pagada" ? "pagado" : q.estado;
                                return (
                                  <tr key={q.numero_cuota}>
                                    <td className="px-3 py-2 font-medium text-slate-700">{q.numero_cuota}/{m.plan?.total_cuotas}</td>
                                    <td className={`px-3 py-2 ${q.vencida ? "font-semibold text-red-600" : "text-slate-600"}`}>{fmtFecha(q.fecha_vencimiento)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums">{fmtGs(q.monto)}</td>
                                    <td className="px-3 py-2 text-right tabular-nums text-emerald-700">{fmtGs(q.monto - q.saldo)}</td>
                                    <td className={`px-3 py-2 text-right tabular-nums ${q.saldo > 0 ? "font-semibold text-amber-600" : "text-slate-400"}`}>{fmtGs(q.saldo)}</td>
                                    <td className="px-3 py-2">
                                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${ESTADO_BADGE[estadoVisQ] ?? ESTADO_BADGE.pendiente}`}>
                                        {estadoVisQ.charAt(0).toUpperCase() + estadoVisQ.slice(1)}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </td>
                    </tr>
                  )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historial de cobros */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="border-b border-slate-100 px-4 py-3"><h2 className="text-sm font-semibold text-gray-700">Historial de cobros</h2></div>
        {cobros.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">Sin cobros registrados.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="py-2.5 px-4 font-medium">Fecha</th>
                  <th className="py-2.5 px-4 font-medium">Método</th>
                  <th className="py-2.5 px-4 font-medium">Referencia</th>
                  <th className="py-2.5 px-4 font-medium text-right">Monto</th>
                  <th className="py-2.5 px-4 font-medium text-right">Recibo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cobros.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2.5 px-4 text-gray-600">{fmtFecha(c.fecha_pago)}</td>
                    <td className="py-2.5 px-4 text-gray-700 capitalize">{c.metodo_pago}</td>
                    <td className="py-2.5 px-4 text-gray-500">{c.referencia ?? "—"}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums font-semibold text-emerald-700">{fmtGs(c.monto)}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        disabled={reciboBusy === c.id}
                        onClick={async () => {
                          if (reciboBusy) return;
                          setReciboBusy(c.id);
                          try {
                            const r = await generarYAbrirRecibo({ origen: "cobro_cxc", cobro_cliente_id: c.id });
                            if (r.ok) { setToast("Recibo generado"); setTimeout(() => setToast(null), 2500); }
                            else { setError(r.error ?? "No se pudo generar el recibo."); }
                          } finally {
                            setReciboBusy(null);
                          }
                        }}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed"
                      >
                        {reciboBusy === c.id ? <><Loader2 className="h-3 w-3 animate-spin" /> Abriendo…</> : "Recibo"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RegistrarCobroModalCxc
        open={!!cobrando}
        cuenta={cobrando ? { id: cobrando.id, numero_venta: cobrando.numero_venta, saldo: cobrando.saldo, cliente_nombre: cliente?.nombre ?? null, plan: cobrando.plan ?? null } : null}
        onClose={() => setCobrando(null)}
        onExito={async () => { setToast("Cobro registrado"); setTimeout(() => setToast(null), 2800); await cargar(); }}
      />
    </div>
  );
}
