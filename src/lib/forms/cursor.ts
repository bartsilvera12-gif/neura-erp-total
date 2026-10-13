/**
 * Normalizar lo que se escribe sin perder la posición del cursor.
 *
 * Los formularios pasan algunos campos a MAYÚSCULAS y el correo a minúsculas
 * mientras se tipea. Al ser inputs controlados, React vuelve a pintar con un
 * texto distinto del que tenía el DOM y el navegador manda el cursor al final.
 *
 * Eso rompía escribir en el medio de un campo ya cargado: si el correo decía
 * "@gmail.com" y se intentaba escribir "empresa" al principio, cada letra
 * saltaba al final y quedaba "e@gmail.compresa".
 *
 * Mayúsculas y minúsculas no cambian el largo del texto, así que la posición
 * del cursor sigue siendo válida: se vuelve a poner después del repintado.
 */
export function normalizarConservandoCursor(
  el: HTMLInputElement | HTMLTextAreaElement,
  normalizar: (valor: string) => string
): string {
  const original = el.value;
  const valor = normalizar(original);

  const inicio = el.selectionStart;
  const fin = el.selectionEnd;

  // Solo se restaura cuando el largo no cambió. Si una normalización futura
  // agrega o saca caracteres, la posición vieja ya no significa lo mismo y es
  // preferible dejar el cursor donde lo ponga el navegador.
  if (inicio !== null && valor.length === original.length && valor !== original) {
    requestAnimationFrame(() => {
      try {
        el.setSelectionRange(inicio, fin ?? inicio);
      } catch {
        /* el campo pudo desmontarse o perder el foco */
      }
    });
  }

  return valor;
}

/** Un correo con forma de correo. No valida que exista, solo que esté bien escrito. */
export function correoValido(valor: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(valor.trim());
}

/** Nombre de persona: letras, espacios y los signos que de verdad aparecen. */
export function nombrePersonaValido(valor: string): boolean {
  return /^[A-Za-zÁÉÍÓÚÜÑáéíóúüñ' .-]+$/.test(valor.trim());
}

/** Teléfono: dígitos y los separadores de siempre, al menos 6 dígitos. */
export function telefonoValido(valor: string): boolean {
  const v = valor.trim();
  if (!/^[\d\s()+-]+$/.test(v)) return false;
  return v.replace(/\D/g, "").length >= 6;
}
