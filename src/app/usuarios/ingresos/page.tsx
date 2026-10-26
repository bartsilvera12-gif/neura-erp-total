"use client";

/**
 * Ingresos al sistema: quién entró y cuándo.
 *
 * Es la contraparte de la auditoría de ventas: las operaciones ya guardan quién
 * las hizo, pero sin esto no había forma de saber quién estuvo adentro ni desde
 * qué dispositivo.
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Loader2, RefreshCw } from "lucide-react";
import { fetchWithSupabaseSession } from "@/lib/api/fetch-with-supabase-session";

type Acceso = {
  id: string;
  usuario_nombre: string | null;
  email: string | null;
  fecha: string;
  user_agent: string | null;
};

function fmtFechaHora(iso: string) {
  try {
    const d = new Date(iso);
    const f = `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    return `${f} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  } catch {
    return iso;
  }
}

/** Del user-agent solo interesa desde qué tipo de equipo entró. */
function dispositivo(ua: string | null): string {
  if (!ua) return "—";
  const s = ua.toLowerCase();
  const movil = /iphone|android|ipad|mobile/.test(s);
  const nav = /edg\//.test(s) ? "Edge"
    : /chrome|crios/.test(s) ? "Chrome"
    : /firefox|fxios/.test(s) ? "Firefox"
    : /safari/.test(s) ? "Safari"
    : "Navegador";
  return `${nav} · ${movil ? "Celular" : "Computadora"}`;
}

export default function IngresosPage() {
  const [filas, setFilas] = useState<Acceso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const r = await fetchWithSupabaseSession("/api/accesos", { cache: "no-store" });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || !j?.success) throw new Error(j?.error ?? "No se pudieron cargar los ingresos.");
      setFilas((j.data?.accesos ?? []) as Acceso[]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudieron cargar los ingresos.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { void cargar(); }, [cargar]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link href="/usuarios" className="inline-flex items-center gap-1 text-xs font-medium text-[#4FAEB2] hover:underline">
            <ArrowLeft className="h-3.5 w-3.5" /> Usuarios
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">Ingresos al sistema</h1>
          <p className="mt-0.5 text-sm text-slate-500">Quién entró, cuándo y desde qué equipo. Últimos 300.</p>
        </div>
        <button
          type="button"
          onClick={() => void cargar()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Actualizar
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[620px] text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">Fecha y hora</th>
              <th className="px-4 py-3 font-medium">Usuario</th>
              <th className="px-4 py-3 font-medium">Correo</th>
              <th className="px-4 py-3 font-medium">Equipo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cargando ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Cargando…
              </td></tr>
            ) : filas.length === 0 ? (
              <tr><td colSpan={4} className="px-4 py-8 text-center text-slate-400">
                Todavía no hay ingresos registrados. Se anotan desde el próximo inicio de sesión.
              </td></tr>
            ) : (
              filas.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 tabular-nums text-slate-600">{fmtFechaHora(a.fecha)}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-800">{a.usuario_nombre ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-600">{a.email ?? "—"}</td>
                  <td className="px-4 py-2.5 text-slate-500">{dispositivo(a.user_agent)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
