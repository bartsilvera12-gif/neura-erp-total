"use client";

/**
 * Campo "Características del producto" para la tienda web.
 *
 * Texto libre, una por renglón: cada tipo de producto tiene las suyas. Se ven
 * en la solapa Características de la ficha del producto en la tienda; las tres
 * primeras, también en la tarjeta del listado.
 */
export function CaracteristicasTiendaField({
  value,
  onChange,
  labelClass,
  inputClass,
}: {
  value: string;
  onChange: (v: string) => void;
  labelClass: string;
  inputClass: string;
}) {
  return (
    <div>
      <label className={labelClass} htmlFor="caracteristicas-tienda">
        Características del producto
        <span className="text-xs font-normal text-gray-500 ml-2">(se muestran en la tienda web)</span>
      </label>
      <textarea
        id="caracteristicas-tienda"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={"Una por renglón. Ej:\nPotencia: 600 W\nCapacidad: 1,5 L\nVaso de vidrio"}
        rows={5}
        className={inputClass}
      />
      <p className="mt-1 text-xs text-gray-500">
        Escribí las que correspondan a este artículo. Con dos puntos se separa el nombre del valor
        (&quot;Material: madera&quot;); también se puede escribir una frase suelta.
      </p>
    </div>
  );
}
