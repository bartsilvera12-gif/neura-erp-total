"use client";

import { useState } from "react";
import { apiCreateFacturaWithError } from "@/lib/api/client";

type IvaTipo = "exenta" | "iva_5" | "iva_10";

export type FacturarVentaModalProps = {
  clienteId: string;
  clienteNombre?: string;
  moneda?: "GS" | "USD";
  onClose: () => void;
  /** Se llama tras crear la factura con éxito (para refrescar la lista). */
  onCreated: () => void;
};

/**
 * Modal compartido "Facturar venta" (venta al contado). Reutilizable desde Clientes
 * (admin) y Gestión de Clientes (asesores). Permite marcar la factura como
 * En Amasso la factura podía marcarse comisionable y elegir vendedor. Acá no:
 * la comisión se acredita en la VENTA (`ventas.vendedor_id`), que es lo que lee
 * el reporte mensual, y `facturas` no tiene esas columnas.
 */
export default function FacturarVentaModal({
  clienteId,
  clienteNombre,
  moneda = "GS",
  onClose,
  onCreated,
}: FacturarVentaModalProps) {
  const [monto, setMonto] = useState("");
  const [descripcion, setDescripcion] = useState("Venta al contado");
  const [ivaTipo, setIvaTipo] = useState<IvaTipo>("iva_10");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function emitir() {
    const montoNum = parseFloat(monto) || 0;
    if (montoNum <= 0) {
      setError("El monto debe ser mayor a 0.");
      return;
    }
    setError(null);
    setGuardando(true);
    try {
      const hoy = new Date().toISOString().slice(0, 10);
      const result = await apiCreateFacturaWithError({
        cliente_id: clienteId,
        fecha: hoy,
        fecha_vencimiento: hoy,
        monto: montoNum,
        tipo: "contado",
        moneda,
        descripcion_linea: descripcion.trim() || "Venta al contado",
        iva_tipo: ivaTipo,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onCreated();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo emitir la factura.");
    } finally {
      setGuardando(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus:border-[#4FAEB2] focus:outline-none focus:ring-2 focus:ring-[#4FAEB2]/20";

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Facturar venta</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-slate-500 transition-colors hover:bg-slate-100"
          >
            ✕
          </button>
        </div>
        {clienteNombre ? (
          <p className="mb-3 truncate text-xs text-slate-500" title={clienteNombre}>
            Cliente: <span className="font-medium text-slate-700">{clienteNombre}</span>
          </p>
        ) : null}

        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Monto ({moneda})</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              placeholder="0"
              className={inputClass}
              autoFocus
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Descripción</label>
            <input
              type="text"
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">IVA</label>
            <select value={ivaTipo} onChange={(e) => setIvaTipo(e.target.value as IvaTipo)} className={inputClass}>
              <option value="iva_10">IVA 10%</option>
              <option value="iva_5">IVA 5%</option>
              <option value="exenta">Exenta</option>
            </select>
          </div>

          {error ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          ) : null}
        </div>

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={guardando}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void emitir()}
            disabled={guardando}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#4FAEB2] px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#3F8E91] disabled:opacity-60"
          >
            {guardando ? "Emitiendo…" : "Facturar venta"}
          </button>
        </div>
      </div>
    </div>
  );
}
