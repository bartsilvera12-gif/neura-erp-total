"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  RefreshCw,
  MessageCircle,
  Package,
  Truck,
  Check,
  Store,
  MapPin,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Search,
  X,
  Boxes,
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";

/**
 * Pedidos de la tienda web, como tablero.
 *
 * Portado del ERP de MANASTINA (PedidosWebDesktop). Cada columna es un estado
 * de la entrega y las tarjetas se arrastran de una a otra. En celular no hay
 * arrastre confiable, así que cada tarjeta lleva además flechas para moverla
 * —que en escritorio también sirven para quien prefiera no arrastrar.
 *
 * Diferencias con MANASTINA, por cómo son los datos de Total:
 *  - Donde allá el estado intermedio es 'enviado', acá es 'listo', que es el
 *    que ya admitía `total.web_pedido.estado`.
 *  - No hay "cobrar envío al entregar" ni observaciones del comprador: el
 *    checkout de Total no los pide. En su lugar, la cuarta tarjeta muestra
 *    cuánta plata hay parada en el tablero.
 */

type Pedido = {
  id: string;
  numero_pedido: string;
  fecha_pedido: string;
  estado_pago: string;
  estado_envio: string;
  esta_pagado: boolean;
  cliente_nombre: string;
  cliente_telefono: string | null;
  whatsapp_link: string | null;
  modalidad: string;
  ciudad_nombre: string | null;
  direccion: string | null;
  direccion_referencia: string | null;
  notas_internas: string | null;
  detalle: string;
  cantidad_articulos: number;
  total_cobrado: number;
};

const COLUMNAS = [
  {
    id: "preparando",
    titulo: "Para preparar",
    icono: Package,
    punto: "bg-amber-400",
    filo: "border-l-amber-300",
  },
  {
    id: "listo",
    titulo: "Listo para entregar",
    icono: Truck,
    punto: "bg-sky-400",
    filo: "border-l-sky-300",
  },
  {
    id: "entregado",
    titulo: "Entregados",
    icono: Check,
    punto: "bg-emerald-400",
    filo: "border-l-emerald-300",
  },
] as const;

const ORDEN = COLUMNAS.map((c) => c.id) as string[];

const gs = (n: number | null | undefined) =>
  "Gs. " + Number(n ?? 0).toLocaleString("es-PY").replace(/,/g, ".");

function cuandoFue(iso: string) {
  const d = new Date(iso);
  const horas = (Date.now() - d.getTime()) / 36e5;
  if (horas < 1) return "hace un rato";
  if (horas < 24) return `hace ${Math.floor(horas)} h`;
  if (horas < 48) return "ayer";
  return d.toLocaleDateString("es-PY", { day: "2-digit", month: "2-digit" });
}

export default function PedidosWebPage() {
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [sinTienda, setSinTienda] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [arrastrando, setArrastrando] = useState<string | null>(null);
  const [columnaActiva, setColumnaActiva] = useState<string | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("todos");
  const arrastradoRef = useRef<string | null>(null);

  const traer = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await fetch("/api/pedidos-web", { credentials: "include", cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.success) {
        setError(j?.error ?? "No se pudieron traer los pedidos.");
        return;
      }
      setPedidos((j.data?.pedidos ?? []) as Pedido[]);
      setSinTienda(j.data?.sin_tienda === true);
    } catch {
      setError("No se pudo conectar.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    void traer();
  }, [traer]);

  const mover = useCallback(
    async (id: string, estado: string) => {
      const antes = pedidos;
      // Se mueve en pantalla al instante; si el servidor rechaza, vuelve atrás.
      setPedidos((prev) => prev.map((p) => (p.id === id ? { ...p, estado_envio: estado } : p)));
      try {
        const r = await fetch("/api/pedidos-web", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ id, estado }),
        });
        if (!r.ok) {
          setPedidos(antes);
          const j = await r.json().catch(() => ({}));
          setError(j?.error ?? "No se pudo mover el pedido.");
        }
      } catch {
        setPedidos(antes);
        setError("No se pudo conectar.");
      }
    },
    [pedidos]
  );

  /**
   * Lo que se busca es la persona: quien despacha recuerda "el pedido de
   * Karen", no el número. Igual se busca también por número y por producto,
   * que son las otras dos formas de referirse a un pedido.
   */
  const filtrados = useMemo(() => {
    const t = busqueda.trim().toLowerCase();
    return pedidos.filter((p) => {
      if (estadoFiltro !== "todos" && p.estado_envio !== estadoFiltro) return false;
      if (!t) return true;
      return (
        (p.cliente_nombre ?? "").toLowerCase().includes(t) ||
        String(p.numero_pedido).toLowerCase().includes(t) ||
        (p.detalle ?? "").toLowerCase().includes(t) ||
        (p.cliente_telefono ?? "").includes(t) ||
        (p.ciudad_nombre ?? "").toLowerCase().includes(t)
      );
    });
  }, [pedidos, busqueda, estadoFiltro]);

  /**
   * Los pedidos recién entrados ('recibido', 'pagado', 'pago-pendiente')
   * caen en la primera columna: todavía no los tocó nadie.
   */
  const porColumna = useMemo(() => {
    const mapa: Record<string, Pedido[]> = { preparando: [], listo: [], entregado: [] };
    for (const p of filtrados) {
      if (p.estado_envio === "cancelado") continue;
      const col = ORDEN.includes(p.estado_envio) ? p.estado_envio : "preparando";
      mapa[col].push(p);
    }
    // Los entregados no se acumulan para siempre: los últimos 20 alcanzan.
    mapa.entregado = mapa.entregado.slice(0, 20);
    return mapa;
  }, [filtrados]);

  const porDespachar = porColumna.preparando.length + porColumna.listo.length;
  const plataParada = [...porColumna.preparando, ...porColumna.listo].reduce(
    (a, p) => a + Number(p.total_cobrado ?? 0),
    0
  );

  if (sinTienda) {
    return (
      <div className="p-8">
        <h1 className="mb-2 text-2xl font-semibold text-gray-900">Pedidos web</h1>
        <p className="max-w-xl text-gray-600">
          Todavía no está creada la vista <code className="font-mono">v_web_pedidos</code>.
          Hay que correr <code className="font-mono">07_pedidos_web_en_el_erp.sql</code>, que
          está en el repo de la tienda.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {/* Migaja de ubicación, igual que el resto de los módulos. */}
          <div className="flex items-center gap-2">
            <span className="inline-block h-2 w-2 rounded-full bg-[#4FAEB2] shadow-[0_0_0_3px_rgba(79,174,178,0.18)]" />
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#4FAEB2]">
              Comercial · Pedidos web
            </p>
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900">Pedidos web</h1>
          <p className="mt-1 max-w-2xl text-sm text-slate-500">
            Lo que se vendió en la tienda online y hay que despachar. Arrastrá las tarjetas
            para cambiarles el estado.
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

      {/* Resumen, con las mismas tarjetas KPI que usan Reportes y Caja. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          accent
          label="Por despachar"
          value={String(porDespachar)}
          icon={<Boxes className="h-4 w-4" />}
          hint={
            porDespachar === 0
              ? "todo al día"
              : `de ${filtrados.length} pedido${filtrados.length === 1 ? "" : "s"}`
          }
        />
        <StatCard
          label="Para preparar"
          value={String(porColumna.preparando.length)}
          icon={<Package className="h-4 w-4" />}
          hint="esperando en el local"
        />
        <StatCard
          label="Listos para entregar"
          value={String(porColumna.listo.length)}
          icon={<Truck className="h-4 w-4" />}
          hint="esperando al cliente"
        />
        <StatCard
          label="Parado en el tablero"
          value={gs(plataParada)}
          icon={<Wallet className="h-4 w-4" />}
          hint={plataParada === 0 ? "nada pendiente" : "en pedidos sin entregar"}
        />
      </div>

      {error && (
        <div className="mb-5 flex items-center justify-between gap-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-rose-500 hover:text-rose-700">
            ×
          </button>
        </div>
      )}

      <div className="rounded-2xl border border-[#4FAEB2]/30 bg-white p-6 shadow-sm ring-1 ring-[#4FAEB2]/10">
        <h2 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-700">
          <span className="inline-block h-3.5 w-1 rounded-full bg-[#4FAEB2]" />
          Tablero de entregas
        </h2>

        <div className="mb-5 flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar por cliente, número o producto…"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-9 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/20"
            />
            {busqueda && (
              <button
                onClick={() => setBusqueda("")}
                aria-label="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <select
            value={estadoFiltro}
            onChange={(e) => setEstadoFiltro(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-700 focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/20"
          >
            <option value="todos">Todos los estados</option>
            {COLUMNAS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.titulo}
              </option>
            ))}
          </select>

          {/* Solo aparece cuando hay algo filtrando, para no ocupar lugar de más. */}
          {(busqueda || estadoFiltro !== "todos") && (
            <span className="text-sm text-slate-500">
              {filtrados.length === 0
                ? "Ningún pedido coincide"
                : `${filtrados.length} de ${pedidos.length}`}
            </span>
          )}
        </div>

        {cargando && pedidos.length === 0 ? (
          <div className="py-20 text-center text-gray-400">
            <Loader2 className="mx-auto mb-3 h-6 w-6 animate-spin" />
            Cargando pedidos…
          </div>
        ) : pedidos.length === 0 ? (
          <p className="py-20 text-center text-sm text-gray-400">
            Todavía no entró ningún pedido por la tienda.
          </p>
        ) : (
          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-3">
            {COLUMNAS.map((col) => {
              const Icono = col.icono;
              const lista = porColumna[col.id] ?? [];
              const activa = columnaActiva === col.id;

              return (
                <section
                  key={col.id}
                  onDragOver={(e) => {
                    e.preventDefault();
                    if (columnaActiva !== col.id) setColumnaActiva(col.id);
                  }}
                  onDragLeave={() => setColumnaActiva((c) => (c === col.id ? null : c))}
                  onDrop={(e) => {
                    e.preventDefault();
                    const id = arrastradoRef.current;
                    setColumnaActiva(null);
                    setArrastrando(null);
                    arrastradoRef.current = null;
                    if (id) {
                      const p = pedidos.find((x) => x.id === id);
                      if (p && p.estado_envio !== col.id) void mover(id, col.id);
                    }
                  }}
                  className={`overflow-hidden rounded-xl border transition-colors ${
                    activa
                      ? "border-dashed border-[#4FAEB2] bg-[#E5F4F4]/60"
                      : "border-slate-200 bg-slate-50/70"
                  }`}
                >
                  <header className="flex items-center gap-2.5 border-b border-slate-200 bg-white px-4 py-3">
                    <span className={`inline-block h-2 w-2 rounded-full ${col.punto}`} />
                    <Icono className="h-4 w-4 text-slate-500" />
                    <h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      {col.titulo}
                    </h2>
                    <span className="ml-auto inline-flex h-6 min-w-[24px] items-center justify-center rounded-full bg-slate-100 px-2 text-xs font-semibold tabular-nums text-slate-600">
                      {lista.length}
                    </span>
                  </header>

                  <div className="min-h-[140px] space-y-3 p-3">
                    {lista.length === 0 ? (
                      <p className="py-8 text-center text-xs text-gray-400">
                        {activa ? "Soltalo acá" : "Sin pedidos"}
                      </p>
                    ) : (
                      lista.map((p) => {
                        const i = ORDEN.indexOf(col.id);
                        const seArrastra = arrastrando === p.id;
                        return (
                          <article
                            key={p.id}
                            draggable
                            onDragStart={() => {
                              arrastradoRef.current = p.id;
                              setArrastrando(p.id);
                            }}
                            onDragEnd={() => {
                              setArrastrando(null);
                              setColumnaActiva(null);
                              arrastradoRef.current = null;
                            }}
                            className={`cursor-grab rounded-xl border border-l-4 border-gray-200 bg-white ${col.filo} p-3.5 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing ${
                              seArrastra ? "opacity-40" : ""
                            }`}
                          >
                            <div className="mb-2 flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-gray-900">
                                  #{p.numero_pedido}
                                </p>
                                <p className="truncate text-sm text-gray-700">{p.cliente_nombre}</p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-sm font-semibold text-slate-900">
                                  {gs(p.total_cobrado)}
                                </p>
                                <p className="mt-0.5 text-[11px] text-slate-400">
                                  {cuandoFue(p.fecha_pedido)}
                                </p>
                              </div>
                            </div>

                            <p className="mb-2 rounded-lg bg-slate-100 px-2.5 py-2 text-xs text-slate-600">
                              {p.detalle || `${p.cantidad_articulos} artículo(s)`}
                            </p>

                            <p className="mb-2 flex max-w-full items-center gap-1.5 text-xs text-slate-500">
                              {p.modalidad === "retiro" ? (
                                <>
                                  <Store className="h-3.5 w-3.5 shrink-0" />
                                  Retira en el local
                                </>
                              ) : (
                                <>
                                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                                  <span className="truncate">
                                    {p.ciudad_nombre ?? "A coordinar"}
                                    {p.direccion ? ` · ${p.direccion}` : ""}
                                  </span>
                                </>
                              )}
                            </p>

                            {/* PagoPar todavía está simulado: mientras no haya
                                cobro real, avisar cuáles no están pagos. */}
                            {!p.esta_pagado && (
                              <p className="mb-2 flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs text-amber-800">
                                <Wallet className="h-3.5 w-3.5 shrink-0" />
                                Sin cobrar · {p.estado_pago}
                              </p>
                            )}

                            {p.notas_internas && (
                              <p className="mb-2 text-xs italic text-gray-500">
                                “{p.notas_internas}”
                              </p>
                            )}

                            <div className="flex items-center gap-1 border-t border-gray-100 pt-2">
                              <button
                                onClick={() => void mover(p.id, ORDEN[i - 1])}
                                disabled={i === 0}
                                title="Mover a la izquierda"
                                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
                              >
                                <ChevronLeft className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => void mover(p.id, ORDEN[i + 1])}
                                disabled={i === ORDEN.length - 1}
                                title="Mover a la derecha"
                                className="rounded-md p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700 disabled:opacity-30 disabled:hover:bg-transparent"
                              >
                                <ChevronRight className="h-4 w-4" />
                              </button>

                              {p.whatsapp_link && (
                                <a
                                  href={p.whatsapp_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()}
                                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 px-2.5 py-1.5 text-xs text-emerald-700 hover:bg-emerald-50"
                                >
                                  <MessageCircle className="h-3.5 w-3.5" />
                                  Escribirle
                                </a>
                              )}
                            </div>
                          </article>
                        );
                      })
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
