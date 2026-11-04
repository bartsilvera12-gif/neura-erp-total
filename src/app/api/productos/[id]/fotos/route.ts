import { NextRequest, NextResponse } from "next/server";
import { getTenantSupabaseFromAuth } from "@/lib/supabase/tenant-api";
import { successResponse, errorResponse } from "@/lib/api/response";
import { API_ERRORS } from "@/lib/api/errors";
import {
  ALLOWED_IMAGE_MIME,
  MAX_FOTOS_ADICIONALES,
  MAX_IMAGE_BYTES,
  PRODUCTOS_IMAGENES_BUCKET,
  buildProductoImagenExtraPath,
  ensureProductosImagenesBucket,
  pathBelongsToEmpresa,
  signProductoImagen,
} from "@/lib/inventario/imagen-storage";
import type { AppSupabaseClient } from "@/lib/supabase/schema";

/**
 * Fotos adicionales del producto para la tienda web.
 *
 * La principal sigue en `productos.imagen_path` (ver ../imagen). Las demás van
 * en `web_producto.galeria`, que es lo que la tienda muestra como galería y lo
 * que también edita el panel de la web. Cada elemento es una ruta del bucket
 * `productos-imagenes` (subida desde acá) o una URL completa (pegada a mano en
 * el panel de la web); la tienda resuelve las dos.
 */

interface Foto {
  /** Lo que se guarda en `galeria`: ruta del bucket o URL. */
  ref: string;
  /** Para la vista previa en el ERP. */
  url: string | null;
}

const esUrl = (ref: string) => /^https?:\/\//i.test(ref);

async function existeProducto(sb: AppSupabaseClient, empresaId: string, productoId: string) {
  const { data, error } = await sb
    .from("productos")
    .select("id")
    .eq("empresa_id", empresaId)
    .eq("id", productoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return Boolean(data);
}

/** `null` = el producto todavía no tiene fila en web_producto. */
async function leerGaleria(sb: AppSupabaseClient, empresaId: string, productoId: string): Promise<string[] | null> {
  const { data, error } = await sb
    .from("web_producto")
    .select("galeria")
    .eq("empresa_id", empresaId)
    .eq("producto_id", productoId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const g = (data as { galeria?: unknown }).galeria;
  return Array.isArray(g) ? g.filter((x): x is string => typeof x === "string" && x.length > 0) : [];
}

async function escribirGaleria(
  sb: AppSupabaseClient,
  empresaId: string,
  productoId: string,
  galeria: string[],
  existia: boolean
) {
  if (existia) {
    const { error } = await sb
      .from("web_producto")
      .update({ galeria, updated_at: new Date().toISOString() })
      .eq("empresa_id", empresaId)
      .eq("producto_id", productoId);
    if (error) throw new Error(error.message);
    return;
  }
  // `slug` quedó obsoleta en esta tabla pero sigue siendo NOT NULL: se guarda
  // el id, como hace el panel de la web. Crear la fila no publica el producto.
  const { error } = await sb.from("web_producto").insert({
    producto_id: productoId,
    empresa_id: empresaId,
    slug: productoId,
    galeria,
  });
  if (error) throw new Error(error.message);
}

async function conVistaPrevia(sb: AppSupabaseClient, galeria: string[]): Promise<Foto[]> {
  return Promise.all(
    galeria.map(async (ref) => ({
      ref,
      url: esUrl(ref) ? ref : await signProductoImagen(sb, ref, 3600),
    }))
  );
}

export async function GET(request: NextRequest, ctxParams: { params: Promise<{ id: string }> }) {
  try {
    const { id: productoId } = await ctxParams.params;
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const { supabase, auth } = ctx;

    if (!(await existeProducto(supabase, auth.empresa_id, productoId))) {
      return NextResponse.json(errorResponse(API_ERRORS.NOT_FOUND), { status: 404 });
    }
    const galeria = (await leerGaleria(supabase, auth.empresa_id, productoId)) ?? [];
    return NextResponse.json(
      successResponse({ fotos: await conVistaPrevia(supabase, galeria), maximo: MAX_FOTOS_ADICIONALES })
    );
  } catch (err) {
    console.error("[/api/productos/[id]/fotos GET]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudieron cargar las fotos."), { status: 500 });
  }
}

export async function POST(request: NextRequest, ctxParams: { params: Promise<{ id: string }> }) {
  try {
    const { id: productoId } = await ctxParams.params;
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const { supabase, auth } = ctx;
    const empresaId = auth.empresa_id;

    if (!(await existeProducto(supabase, empresaId, productoId))) {
      return NextResponse.json(errorResponse(API_ERRORS.NOT_FOUND), { status: 404 });
    }

    const actual = await leerGaleria(supabase, empresaId, productoId);
    const galeria = actual ?? [];
    if (galeria.length >= MAX_FOTOS_ADICIONALES) {
      return NextResponse.json(
        errorResponse(`Ya tiene ${MAX_FOTOS_ADICIONALES} fotos adicionales. Quitá una para subir otra.`),
        { status: 400 }
      );
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json(errorResponse("Falta el archivo (campo 'file')."), { status: 400 });
    }
    if (!ALLOWED_IMAGE_MIME.has(file.type)) {
      return NextResponse.json(errorResponse("Formato no permitido. Usá JPG, PNG o WebP."), { status: 400 });
    }
    if (file.size > MAX_IMAGE_BYTES) {
      const mb = (MAX_IMAGE_BYTES / 1024 / 1024).toFixed(0);
      return NextResponse.json(errorResponse(`Imagen demasiado grande (máx. ${mb} MB).`), { status: 413 });
    }

    try {
      await ensureProductosImagenesBucket(supabase);
    } catch (bucketErr) {
      console.error("[/api/productos/[id]/fotos POST] ensureBucket", bucketErr instanceof Error ? bucketErr.message : bucketErr);
    }

    const path = buildProductoImagenExtraPath(empresaId, productoId, file.type);
    const up = await supabase.storage
      .from(PRODUCTOS_IMAGENES_BUCKET)
      .upload(path, Buffer.from(await file.arrayBuffer()), { contentType: file.type, upsert: false });
    if (up.error) {
      console.error("[/api/productos/[id]/fotos POST] upload", up.error.message);
      return NextResponse.json(errorResponse(`No se pudo subir la imagen: ${up.error.message}`), { status: 500 });
    }

    const nueva = [...galeria, path];
    try {
      await escribirGaleria(supabase, empresaId, productoId, nueva, actual !== null);
    } catch (e) {
      // Sin la fila, el archivo quedaría huérfano en el bucket.
      await supabase.storage.from(PRODUCTOS_IMAGENES_BUCKET).remove([path]);
      throw e;
    }

    return NextResponse.json(successResponse({ fotos: await conVistaPrevia(supabase, nueva) }));
  } catch (err) {
    console.error("[/api/productos/[id]/fotos POST]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudo subir la imagen."), { status: 500 });
  }
}

/** Quita una foto: `?ref=<ruta o URL>`, tal como vino en el GET. */
export async function DELETE(request: NextRequest, ctxParams: { params: Promise<{ id: string }> }) {
  try {
    const { id: productoId } = await ctxParams.params;
    const ctx = await getTenantSupabaseFromAuth(request);
    if (!ctx) return NextResponse.json(errorResponse(API_ERRORS.UNAUTHORIZED), { status: 401 });
    const { supabase, auth } = ctx;
    const empresaId = auth.empresa_id;

    const ref = request.nextUrl.searchParams.get("ref") ?? "";
    if (!ref) return NextResponse.json(errorResponse("Falta la foto a quitar."), { status: 400 });

    if (!(await existeProducto(supabase, empresaId, productoId))) {
      return NextResponse.json(errorResponse(API_ERRORS.NOT_FOUND), { status: 404 });
    }
    const actual = await leerGaleria(supabase, empresaId, productoId);
    if (!actual || !actual.includes(ref)) {
      return NextResponse.json(errorResponse(API_ERRORS.NOT_FOUND), { status: 404 });
    }

    const nueva = actual.filter((x) => x !== ref);
    await escribirGaleria(supabase, empresaId, productoId, nueva, true);

    // El archivo se borra solo si es nuestro: una URL pegada a mano no se toca,
    // y la ruta tiene que ser de esta empresa y de este producto.
    if (!esUrl(ref) && pathBelongsToEmpresa(ref, empresaId) && ref.split("/")[1] === productoId) {
      await supabase.storage.from(PRODUCTOS_IMAGENES_BUCKET).remove([ref]);
    }

    return NextResponse.json(successResponse({ fotos: await conVistaPrevia(supabase, nueva) }));
  } catch (err) {
    console.error("[/api/productos/[id]/fotos DELETE]", err instanceof Error ? err.message : err);
    return NextResponse.json(errorResponse("No se pudo quitar la foto."), { status: 500 });
  }
}
