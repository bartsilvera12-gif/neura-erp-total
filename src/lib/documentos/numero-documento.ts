/**
 * Formato de los números de documento fiscal paraguayos.
 *
 * Un número de factura se escribe `001-001-0000123`: tres dígitos de
 * establecimiento, tres de punto de expedición y siete de correlativo. Los
 * campos del ERP lo pedían con un ejemplo en el placeholder pero no lo
 * aplicaban, así que quedaban cargados como `0010010000123` — difíciles de
 * leer y de cotejar contra la factura de papel.
 *
 * Se formatea mientras se escribe y se guarda con los guiones.
 */

const DIGITOS = 13; // 3 + 3 + 7

/**
 * Devuelve el número con los guiones puestos, a medida que se tipea.
 *
 * Acepta que peguen el número ya formateado, con espacios o con guiones de
 * más: se queda solo con los dígitos y los reparte. Nunca pasa de 13 dígitos.
 */
export function formatearNumeroDocumento(valor: string): string {
  const d = String(valor ?? "").replace(/\D/g, "").slice(0, DIGITOS);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
}

/** Solo los dígitos, para comparar dos números escritos distinto. */
export function soloDigitos(valor: string): string {
  return String(valor ?? "").replace(/\D/g, "");
}

/** `true` cuando están los 13 dígitos. Un número a medias no sirve. */
export function numeroDocumentoCompleto(valor: string): boolean {
  return soloDigitos(valor).length === DIGITOS;
}

/**
 * Número de timbrado.
 *
 * El timbrado que emite la SET es un número de 8 dígitos (12345678), NO el
 * 001-001-0000001 de la factura. El campo del ERP sugería el formato de la
 * factura en su placeholder, y por eso se le había aplicado el mismo
 * formateo: eso rompía timbrados reales, convirtiéndolos en "123-456-78".
 *
 * Acá solo se limpia: dígitos, hasta 8.
 */
export function formatearTimbrado(valor: string): string {
  return String(valor ?? "").replace(/\D/g, "").slice(0, 8);
}
