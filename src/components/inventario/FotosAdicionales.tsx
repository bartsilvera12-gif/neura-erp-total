"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fotos adicionales del producto para la tienda web (además de la principal).
 *
 * Hasta 2, o sea 3 por producto: sirven para mostrar detalles, como el
 * exterior y el interior de un ropero. En la tienda se ven como galería en la
 * ficha del producto.
 *
 * - `FotosAdicionales`: producto ya creado (Editar). Sube y quita al momento.
 * - `FotosAdicionalesPendientes`: producto nuevo. Guarda los archivos hasta que
 *   el producto existe; los sube `subirFotosAdicionales` después de crearlo.
 */

export const MAX_FOTOS_ADICIONALES = 2;
const ACCEPT = "image/jpeg,image/png,image/webp";
const MIME_OK = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024;

interface Foto {
  ref: string;
  url: string | null;
}

function validar(f: File): string | null {
  if (!MIME_OK.includes(f.type)) return "Formato no permitido. Usá JPG, PNG o WebP.";
  if (f.size > MAX_BYTES) return "Imagen demasiado grande (máx. 5 MB).";
  return null;
}

function Miniatura({ url, onQuitar, busy }: { url: string | null; onQuitar: () => void; busy: boolean }) {
  return (
    <div className="relative w-28 h-28 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden shrink-0">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="Foto adicional" className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-xs text-slate-400">Sin vista previa</div>
      )}
      <button
        type="button"
        onClick={onQuitar}
        disabled={busy}
        aria-label="Quitar foto"
        className="absolute top-1 right-1 w-7 h-7 rounded-full bg-white/90 border border-slate-200 text-red-600 hover:bg-red-50 text-sm leading-none disabled:opacity-50"
      >
        ×
      </button>
    </div>
  );
}

function BotonAgregar({ busy, onFile }: { busy: boolean; onFile: (f: File) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      disabled={busy}
      className="w-28 h-28 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:border-[#0EA5E9] hover:text-[#0EA5E9] text-sm flex flex-col items-center justify-center gap-1 shrink-0 disabled:opacity-50"
    >
      <span className="text-2xl leading-none">+</span>
      {busy ? "Subiendo..." : "Agregar foto"}
      <input
        ref={ref}
        type="file"
        accept={ACCEPT}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </button>
  );
}

function Ayuda({ error }: { error: string | null }) {
  return (
    <>
      <p className="mt-1.5 text-xs text-slate-400">
        Hasta {MAX_FOTOS_ADICIONALES} fotos más, además de la principal, para mostrar detalles en la
        tienda web (por ejemplo, el interior). JPG, PNG o WebP — máx. 5 MB cada una.
      </p>
      {error && <p className="mt-1.5 text-xs text-red-600">{error}</p>}
    </>
  );
}

export function FotosAdicionales({ productoId }: { productoId: string }) {
  const [fotos, setFotos] = useState<Foto[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    fetch(`/api/productos/${productoId}/fotos`, { credentials: "include", cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        if (vigente && json?.success) setFotos(json.data?.fotos ?? []);
      })
      .catch(() => {});
    return () => {
      vigente = false;
    };
  }, [productoId]);

  async function llamar(input: RequestInfo, init: RequestInit, fallo: string) {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(input, { ...init, credentials: "include" });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) setError(json?.error ?? fallo);
      else setFotos(json.data?.fotos ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error de red");
    } finally {
      setBusy(false);
    }
  }

  function subir(f: File) {
    const err = validar(f);
    if (err) return setError(err);
    const fd = new FormData();
    fd.append("file", f);
    void llamar(`/api/productos/${productoId}/fotos`, { method: "POST", body: fd }, "No se pudo subir la imagen");
  }

  function quitar(ref: string) {
    void llamar(
      `/api/productos/${productoId}/fotos?ref=${encodeURIComponent(ref)}`,
      { method: "DELETE" },
      "No se pudo quitar la foto"
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {fotos.map((f) => (
          <Miniatura key={f.ref} url={f.url} busy={busy} onQuitar={() => quitar(f.ref)} />
        ))}
        {fotos.length < MAX_FOTOS_ADICIONALES && <BotonAgregar busy={busy} onFile={subir} />}
      </div>
      <Ayuda error={error} />
    </div>
  );
}

/** Foto elegida para un producto que todavía no existe, con su vista previa. */
export interface FotoPendiente {
  file: File;
  preview: string;
}

export function FotosAdicionalesPendientes({
  archivos,
  onChange,
}: {
  archivos: FotoPendiente[];
  onChange: (archivos: FotoPendiente[]) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {archivos.map((a) => (
          <Miniatura
            key={a.preview}
            url={a.preview}
            busy={false}
            onQuitar={() => {
              URL.revokeObjectURL(a.preview);
              onChange(archivos.filter((x) => x !== a));
            }}
          />
        ))}
        {archivos.length < MAX_FOTOS_ADICIONALES && (
          <BotonAgregar
            busy={false}
            onFile={(f) => {
              const err = validar(f);
              setError(err);
              if (!err) onChange([...archivos, { file: f, preview: URL.createObjectURL(f) }]);
            }}
          />
        )}
      </div>
      <Ayuda error={error} />
    </div>
  );
}

/** Sube las fotos de un producto recién creado. Devuelve los errores, si hubo. */
export async function subirFotosAdicionales(productoId: string, archivos: FotoPendiente[]): Promise<string[]> {
  const errores: string[] = [];
  for (const { file: f } of archivos) {
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch(`/api/productos/${productoId}/fotos`, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.success) errores.push(`${f.name}: ${json?.error ?? "no se pudo subir"}`);
    } catch (err) {
      errores.push(`${f.name}: ${err instanceof Error ? err.message : "error de red"}`);
    }
  }
  return errores;
}
