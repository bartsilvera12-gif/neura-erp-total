/**
 * Contacto del emisor para el XML de SIFEN (`dTelEmi` / `dEmailE`).
 *
 * Lo primero que se usa es lo cargado en Configuración → Facturación
 * electrónica (va a `empresas.telefono` / `empresas.email`). Esto es el
 * respaldo para que la emisión no se frene cuando ese dato está vacío: el
 * teléfono es el mismo que ya sale impreso en el membrete de los documentos
 * de Total, así que no se inventa nada.
 *
 * SIFEN exige `dTelEmi` con 8 a 15 dígitos. `dEmailE` es opcional: cuando no
 * hay correo, el elemento no se manda (un `<dEmailE></dEmailE>` vacío lo
 * rechaza la SET).
 */

/** Primer teléfono del membrete de Total. Conviene que el cliente lo confirme. */
export const SIFEN_EMISOR_TELEFONO = "0983918520";

/** Sin correo confirmado por el cliente todavía. Si se carga uno, ese gana. */
export const SIFEN_EMISOR_EMAIL = "";

/** Teléfono a declarar: lo cargado en Configuración, o el del membrete. */
export function telefonoEmisor(cargado: string | null | undefined): string {
  const d = String(cargado ?? "").replace(/\D/g, "");
  return d.length >= 8 && d.length <= 15 ? d : SIFEN_EMISOR_TELEFONO;
}

/** Correo a declarar: lo cargado en Configuración, o el de respaldo (puede ser ""). */
export function emailEmisor(cargado: string | null | undefined): string {
  const e = String(cargado ?? "").trim();
  return e || SIFEN_EMISOR_EMAIL;
}
