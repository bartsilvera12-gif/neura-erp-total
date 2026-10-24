import GestionClientesPanel from "@/components/gestion-clientes/GestionClientesPanel";

/**
 * Gestión de clientes: panel operativo de mostrador. Se busca al cliente por
 * nombre, RUC, teléfono, correo o documento y se ve todo lo suyo en un lugar
 * —facturas, saldos y tipificaciones— sin ir salteando pantallas.
 *
 * Portado de Amasso. Allá el módulo gira alrededor de los planes de
 * suscripción; acá se queda con lo que aplica a una casa de electrodomésticos.
 */
export default function Page() {
  return <GestionClientesPanel />;
}
