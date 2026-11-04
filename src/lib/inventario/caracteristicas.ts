/**
 * Características del producto para la tienda web.
 *
 * Se escriben como texto libre, una por renglón, porque cada tipo de producto
 * tiene las suyas (una licuadora: potencia y capacidad; una silla: material y
 * medidas). Se guardan en `web_producto.ficha`, la columna que lee la tienda
 * (vista `web_catalogo`) y que también edita el panel de la web: hay un solo
 * lugar donde viven, se carguen desde donde se carguen.
 *
 * Un renglón con dos puntos se separa en etiqueta y valor ("Potencia: 600 W");
 * uno sin dos puntos queda entero como valor ("Apta para lavavajillas").
 *
 * Misma regla que `src/lib/catalogo/caracteristicas.ts` de la web
 * (total-electrodomesticos-web): si se cambia una, cambiar la otra.
 */

export interface LineaFicha {
  etiqueta: string;
  valor: string;
}

function lineaDeFicha({ etiqueta, valor }: LineaFicha): string {
  const e = String(etiqueta ?? "").trim();
  const v = String(valor ?? "").trim();
  return e && v ? `${e}: ${v}` : e || v;
}

/** Lo guardado, como se ve en el campo de texto. */
export function textoDeFicha(ficha: unknown): string {
  if (!Array.isArray(ficha)) return "";
  return ficha
    .filter((x): x is LineaFicha => x != null && typeof x === "object")
    .map(lineaDeFicha)
    .filter(Boolean)
    .join("\n");
}

/** Lo escrito en el campo, listo para guardar. */
export function fichaDeTexto(texto: string): LineaFicha[] {
  return texto
    .split(/\r?\n/)
    // Viñetas que se pegan de otro lado: "- ", "• ", "* "
    .map((l) => l.replace(/^\s*[-•*·]\s+/, "").trim())
    .filter(Boolean)
    .map((l) => {
      const i = l.indexOf(":");
      if (i <= 0) return { etiqueta: "", valor: l };
      const etiqueta = l.slice(0, i).trim();
      const valor = l.slice(i + 1).trim();
      return valor ? { etiqueta, valor } : { etiqueta: "", valor: etiqueta };
    });
}
