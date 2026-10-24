"use client";

/**
 * Gestión del Cliente: panel de mostrador.
 *
 * Se busca al cliente una vez y se ve todo lo suyo junto: su ficha, lo que
 * debe con el detalle de cuotas, y el historial de gestiones.
 *
 * Portado de Amasso, pero con la deuda leída de donde está de verdad. Allá el
 * módulo giraba alrededor de `facturas`, porque el negocio es por suscripción
 * y la factura ES la deuda. Acá la deuda son las CUENTAS POR COBRAR con sus
 * cuotas, y `facturas` son los documentos fiscales (SIFEN). Mostrar `facturas`
 * como saldo cobrable hacía que la misma deuda apareciera dos veces con montos
 * distintos, y el botón de cobrar de esta pantalla escribía en otra tabla: no
 * descontaba cuotas ni entraba a caja.
 *
 * Por eso el bloque de deuda es el MISMO componente que usa Reportes → Estado
 * de cuenta, con el mismo circuito de cobro ya probado. Una sola verdad.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Search, Users } from "lucide-react";
import { EstadoCuentaClienteBlock } from "@/components/cobros/EstadoCuentaClienteBlock";
import { getClientes, clienteNombre } from "@/lib/clientes/storage";
import { getTipificaciones, saveTipificacion } from "@/lib/gestion-clientes/storage";
import type { Cliente } from "@/lib/clientes/types";
import type { Tipificacion, TipoGestion, ResultadoTipificacion } from "@/lib/gestion-clientes/types";

const TIPOS_GESTION: TipoGestion[] = [
  "Consulta",
  "Reclamo",
  "Seguimiento",
  "Promesa de pago",
  "Soporte técnico",
  "Cambio plan",
];
const RESULTADOS: ResultadoTipificacion[] = ["Pendiente", "Resuelto", "Escalar"];

const RESULTADO_BADGE: Record<ResultadoTipificacion, string> = {
  Pendiente: "bg-amber-100 text-amber-700",
  Resuelto: "bg-emerald-100 text-emerald-700",
  Escalar: "bg-rose-100 text-rose-700",
};

function formatFechaHora(iso: string) {
  try {
    const d = new Date(iso);
    const f = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    return `${f} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

/** Un solo campo busca por todo lo que el mostrador tiene a mano. */
function coincide(c: Cliente, q: string): boolean {
  const t = q.trim().toLowerCase();
  if (!t) return true;
  return [c.empresa, c.nombre_contacto, c.ruc, c.documento, c.telefono, c.email]
    .filter(Boolean)
    .some((v) => String(v).toLowerCase().includes(t));
}

export default function GestionClientesPanel() {
  const router = useRouter();
  const params = useSearchParams();
  const clienteParam = params.get("cliente");

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [cargandoClientes, setCargandoClientes] = useState(true);
  const [query, setQuery] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(clienteParam);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let vivo = true;
    getClientes()
      .then((cs) => { if (vivo) { setClientes(cs); setCargandoClientes(false); } })
      .catch(() => { if (vivo) setCargandoClientes(false); });
    return () => { vivo = false; };
  }, []);

  // Cerrar el desplegable al clickear afuera.
  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const resultados = useMemo(
    () => clientes.filter((c) => coincide(c, query)).slice(0, 20),
    [clientes, query]
  );
  const selected = useMemo(
    () => clientes.find((c) => c.id === selectedId) ?? null,
    [clientes, selectedId]
  );

  function elegir(c: Cliente) {
    setSelectedId(c.id);
    setQuery("");
    setAbierto(false);
    router.replace(`/gestion-clientes?cliente=${encodeURIComponent(c.id)}`, { scroll: false });
  }

  function limpiar() {
    setSelectedId(null);
    setQuery("");
    router.replace("/gestion-clientes", { scroll: false });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#4FAEB2]">Gestión</p>
          <h1 className="text-2xl font-bold text-slate-900">Gestión del Cliente</h1>
          <p className="mt-0.5 text-sm text-slate-500">Panel operativo · deuda, cuotas y gestiones en un solo lugar.</p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
          <Users className="h-3.5 w-3.5 text-[#4FAEB2]" />
          {cargandoClientes ? "cargando…" : `${clientes.length} en cartera`}
        </span>
      </div>

      {/* Buscador */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div ref={contenedorRef} className="relative mx-auto max-w-2xl">
          <div className="mb-3 text-center">
            <h2 className="text-base font-semibold text-slate-800">
              {selected ? "Buscar otro cliente" : "Buscá un cliente"}
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Un solo campo cubre nombre, RUC, documento, teléfono y correo.
            </p>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              aria-label="Buscar cliente"
              value={query}
              onChange={(e) => { setQuery(e.target.value); setAbierto(true); }}
              onFocus={() => setAbierto(true)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && resultados[0]) elegir(resultados[0]);
                if (e.key === "Escape") setAbierto(false);
              }}
              placeholder="Nombre, RUC, documento, teléfono, correo…"
              className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#4FAEB2] focus:ring-2 focus:ring-[#4FAEB2]/20"
            />
          </div>

          {abierto && query.trim() !== "" && (
            <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
              {cargandoClientes ? (
                <p className="px-3 py-3 text-center text-xs text-slate-400">Cargando clientes…</p>
              ) : resultados.length === 0 ? (
                <p className="px-3 py-3 text-center text-xs text-slate-400">Sin coincidencias.</p>
              ) : (
                <div className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                  {resultados.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => elegir(c)}
                      className="block w-full px-3 py-2 text-left hover:bg-slate-50"
                    >
                      <span className="text-sm font-medium text-slate-800">{clienteNombre(c)}</span>
                      <span className="block text-[11px] text-slate-500">
                        {c.ruc ? `RUC ${c.ruc}` : c.documento ? `Doc. ${c.documento}` : "Sin documento"}
                        {c.telefono ? ` · ${c.telefono}` : ""}
                      </span>
                    </button>
                  ))}
                </div>
              )}
              <p className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-[10px] text-slate-400">
                Enter abre el primero · Esc cierra
              </p>
            </div>
          )}
        </div>
      </div>

      {selected && (
        <>
          <FichaCliente cliente={selected} onLimpiar={limpiar} />
          {/* Mismo bloque (y mismo circuito de cobro) que Reportes → Estado de
              cuenta: las cuotas se imputan y el efectivo entra a caja. */}
          <EstadoCuentaClienteBlock clienteId={selected.id} />
          <Tipificaciones cliente={selected} />
        </>
      )}
    </div>
  );
}

function FichaCliente({ cliente, onLimpiar }: { cliente: Cliente; onLimpiar: () => void }) {
  const datos = [
    { label: "RUC / Documento", value: cliente.ruc || cliente.documento || "—" },
    { label: "Contacto", value: cliente.nombre_contacto || "—" },
    { label: "Teléfono", value: cliente.telefono || "—" },
    { label: "Correo", value: cliente.email || "—" },
    { label: "Dirección", value: cliente.direccion || "—" },
    { label: "Tipo", value: cliente.tipo_cliente === "empresa" ? "Empresa" : "Persona" },
  ];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{clienteNombre(cliente)}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {cliente.ruc ? `RUC ${cliente.ruc}` : cliente.documento ? `Doc. ${cliente.documento}` : "Sin documento"}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/clientes/${cliente.id}`}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Ver ficha completa
          </Link>
          <button
            type="button"
            onClick={onLimpiar}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-50"
          >
            Cambiar cliente
          </button>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
        {datos.map((d) => (
          <div key={d.label}>
            <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">{d.label}</dt>
            <dd className="mt-0.5 text-sm text-slate-700">{d.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function Tipificaciones({ cliente }: { cliente: Cliente }) {
  const [filas, setFilas] = useState<Tipificacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [tipo, setTipo] = useState<TipoGestion>("Consulta");
  const [resultado, setResultado] = useState<ResultadoTipificacion>("Pendiente");
  const [observacion, setObservacion] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    try {
      setFilas(await getTipificaciones(cliente.id));
    } catch {
      setFilas([]);
    } finally {
      setCargando(false);
    }
  }, [cliente.id]);

  useEffect(() => { void cargar(); }, [cargar]);

  async function registrar() {
    if (!observacion.trim()) { setError("Escribí qué pasó en la gestión."); return; }
    setGuardando(true);
    setError(null);
    try {
      const ok = await saveTipificacion({
        cliente_id: cliente.id,
        usuario: "ADMINISTRADOR",
        tipo_gestion: tipo,
        resultado,
        observacion,
      });
      if (!ok) throw new Error("No se pudo registrar la gestión.");
      setObservacion("");
      setResultado("Pendiente");
      await cargar();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo registrar la gestión.");
    } finally {
      setGuardando(false);
    }
  }

  const campo = "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[#4FAEB2] focus:ring-2 focus:ring-[#4FAEB2]/20";

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="text-base font-semibold text-slate-800">Gestiones</h2>
      <p className="mt-0.5 text-xs text-slate-500">Consultas, reclamos y promesas de pago de este cliente.</p>

      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_2fr_auto] sm:items-end">
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Tipo</span>
          <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoGestion)} className={campo}>
            {TIPOS_GESTION.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Resultado</span>
          <select value={resultado} onChange={(e) => setResultado(e.target.value as ResultadoTipificacion)} className={campo}>
            {RESULTADOS.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-semibold uppercase tracking-wide text-slate-400">Observación</span>
          <input
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
            placeholder="Qué pasó en la gestión…"
            className={campo}
          />
        </label>
        <button
          type="button"
          onClick={registrar}
          disabled={guardando}
          className="rounded-lg bg-[#4FAEB2] px-4 py-2 text-sm font-semibold text-white hover:bg-[#3F8E91] disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Registrar"}
        </button>
      </div>
      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}

      <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5 font-medium">Fecha</th>
              <th className="px-3 py-2.5 font-medium">Tipo</th>
              <th className="px-3 py-2.5 font-medium">Resultado</th>
              <th className="px-3 py-2.5 font-medium">Observación</th>
              <th className="px-3 py-2.5 font-medium">Usuario</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cargando ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Cargando…
              </td></tr>
            ) : filas.length === 0 ? (
              <tr><td colSpan={5} className="px-3 py-6 text-center text-slate-400">Todavía no hay gestiones registradas.</td></tr>
            ) : (
              filas.map((t) => (
                <tr key={t.id} className="hover:bg-slate-50">
                  <td className="px-3 py-2.5 text-slate-600">{formatFechaHora(t.fecha)}</td>
                  <td className="px-3 py-2.5 font-medium text-slate-700">{t.tipo_gestion}</td>
                  <td className="px-3 py-2.5">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${RESULTADO_BADGE[t.resultado]}`}>
                      {t.resultado}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-slate-600">{t.observacion}</td>
                  <td className="px-3 py-2.5 text-slate-500">{t.usuario}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
