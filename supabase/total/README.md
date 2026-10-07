# Schema `total` — Total Electrodomésticos

Instancia dedicada sobre la Supabase self-hosted de `api.neura.com.py`.
Clon estructural de `asunhome`, **sin ninguna fila de datos del negocio**.

## Orden de ejecución

SQL Editor de Supabase, como `postgres`.

### 1. `00_setup_schema_total.sql`

Crea el schema `total` y clona la estructura de `asunhome`: tablas, PK,
UNIQUE, CHECK, índices, FKs, funciones, triggers, vistas, matviews, RLS y
policies, reapuntando toda referencia `asunhome.*` hacia `total.*`.

Aborta si `total` ya existe, para no pisar datos.

**No toca `public` ni ningún otro schema.** Las funciones auxiliares de
clonación se crean dentro de `total` y se borran al terminar (PARTE 7). De
`asunhome` solo lee el catálogo; no le escribe nada.

### 2. Crear el usuario de login (a mano)

Supabase → Authentication → Users → **Add user**

- email: `admin@total.com`
- password: la que elijas
- Auto Confirm User: **sí**

Va por el panel y no por SQL a propósito: `auth.users` es de Supabase y no
corresponde escribirle desde acá.

### 3. `01_empresa_usuario_modulos.sql`

- Crea la empresa **TOTAL ELECTRODOMÉSTICOS** con id `8a8413c6-51bf-424b-a479-c442a2dc17a7`
- Copia los catálogos globales (`modulos`, `dashboard_views`) desde `asunhome`
- Vincula `admin@total.com` como rol `admin` de esa empresa
- Activa **solo** los módulos pedidos

Busca el usuario en `auth.users` por email. Si no lo encuentra, aborta con un
mensaje claro: falta el paso 2.

### 4. Exponer el schema

Settings → API → **Exposed schemas**: agregar `total`.

Esto lo hacés vos, como quedamos.

## Módulos activos

Dashboard · Ventas · Inventario (incluye Movimientos) · Clientes · Cobranzas ·
Compras · Pagos · Gastos · Reportes · Notas de crédito

Más Configuración y Usuarios, que el admin necesita para operar.

**Movimientos** no es un módulo aparte: es `/inventario/movimientos`, hijo de
Inventario.

**Gerencia** y **Tableros** no están. No existen como módulo en el catálogo
heredado, y las versiones de `neura-erp-sistemas-propio` leen de `proyectos`,
`proyecto_tareas` y `proyecto_estados`, tablas que este schema no tiene. Hay
que definir qué significan para una casa de electrodomésticos antes de armarlas.

## Independencia

- Schema propio `total`, sin tablas compartidas
- Id de empresa propio, distinto del de asunhome
- Usuario propio
- Ningún script escribe fuera de `total`
