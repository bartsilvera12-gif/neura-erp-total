/**
 * Asocia pathname del App Router a slug de `modulos.slug`.
 * `null` = no aplica gate de módulo (acceso con sesión).
 */

/** Orden del menú lateral (misma idea que Sidebar): primera entrada accesible = “home” sin dashboard. */
const SIDEBAR_SLUG_HREF_ORDER: { slug: string; href: string }[] = [
  { slug: "dashboard", href: "/" },
  { slug: "ventas", href: "/ventas" },
  { slug: "inventario", href: "/inventario" },
  { slug: "clientes", href: "/clientes" },
  { slug: "pedidos-web", href: "/pedidos-web" },
  { slug: "compras", href: "/compras" },
  { slug: "cobros", href: "/cobros" },
  { slug: "pagos", href: "/pagos" },
  { slug: "gastos", href: "/gastos" },
  { slug: "reportes", href: "/reportes" },
  { slug: "notas_credito", href: "/notas-credito" },
  { slug: "usuarios", href: "/usuarios" },
  { slug: "configuracion", href: "/configuracion" },
];


/**
 * Slugs otorgados explícitamente o por alias (p. ej. `clientes` incluye gestión de cartera).
 *
 * - `inactiveSlugs` opcional: slugs presentes en `empresa_modulos` con `activo=false`. Cuando un slug
 *   está en este set, ningún alias lo re-otorga (la desactivación explícita gana).
 * - `strict` opcional: si es `true`, se aplica allowlist estricta — solo `grantedSlugs` otorga acceso,
 *   los alias legacy (ventas → notas_credito) NO otorgan nada. Pensado para instancias dedicadas monocliente donde `empresa_modulos` es la única
 *   fuente de verdad. Default `false` para compatibilidad multi-tenant.
 */
export function isModuleSlugGranted(
  routeSlug: string,
  grantedSlugs: Set<string>,
  inactiveSlugs?: Set<string>,
  opts?: { strict?: boolean }
): boolean {
  if (grantedSlugs.has(routeSlug)) return true;
  if (inactiveSlugs?.has(routeSlug)) return false;
  if (opts?.strict) return false;
  if (routeSlug === "notas_credito" && grantedSlugs.has("ventas")) return true;
  return false;
}

/**
 * Acceso a un ítem del menú (super admin ve todo; resto según empresa_modulos ∩ usuario_modulos).
 *
 * - `inactiveSlugs` opcional: ver `isModuleSlugGranted`.
 * - `strict` opcional: ver `isModuleSlugGranted`. Permite ocultar items que no estén explícitamente
 *   activos en `empresa_modulos`, ignorando aliases legacy.
 */
export function canAccessSidebarSlug(
  slug: string,
  grantedSlugs: Set<string>,
  esSuperAdmin: boolean,
  inactiveSlugs?: Set<string>,
  opts?: { strict?: boolean }
): boolean {
  if (esSuperAdmin) return true;
  if (slug === "dashboard") return grantedSlugs.has("dashboard");
  return isModuleSlugGranted(slug, grantedSlugs, inactiveSlugs, opts);
}

/** Primera ruta de app a la que puede entrar el usuario (p. ej. tras login en `/` sin módulo dashboard). */
export function firstAccessibleHref(
  grantedSlugs: Set<string>,
  opts?: { superAdmin?: boolean; inactiveSlugs?: Set<string>; strict?: boolean }
): string {
  if (opts?.superAdmin) return "/";
  for (const { slug, href } of SIDEBAR_SLUG_HREF_ORDER) {
    if (
      canAccessSidebarSlug(slug, grantedSlugs, false, opts?.inactiveSlugs, { strict: opts?.strict })
    ) {
      return href;
    }
  }
  return "/login";
}

export function pathRequiresModuleSlug(pathname: string): string | null {
  const p = pathname.split("?")[0] ?? pathname;
  if (!p) return null;
  if (p === "/") return "dashboard";
  if (p.startsWith("/login")) return null;
  if (p.startsWith("/admin")) return null;
  if (p.startsWith("/api")) return null;
  if (p.startsWith("/usuarios")) return "usuarios";
  if (p.startsWith("/notas-credito")) return "notas_credito";
  if (p.startsWith("/ventas")) return "ventas";
  if (p.startsWith("/inventario")) return "inventario";
  if (p.startsWith("/pedidos-web")) return "pedidos-web";
  if (p.startsWith("/clientes")) return "clientes";
  if (p.startsWith("/proveedores")) return "compras";
  if (p.startsWith("/compras")) return "compras";
  if (p.startsWith("/gastos")) return "gastos";
  if (p.startsWith("/reportes")) return "reportes";
  if (p.startsWith("/pagos")) return "pagos";
  if (p.startsWith("/configuracion")) return "configuracion";
  return null;
}
