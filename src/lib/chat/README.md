# Qué quedó acá

El módulo de chat/omnicanal venía del ERP de origen y Total no lo usa, así que
se sacó. Quedaron tres archivos que, pese al nombre de la carpeta, son
infraestructura y los usan clientes, facturación, SIFEN y el dashboard:

- `tenant-pg-chat-supabase-shim.ts` — habla con Postgres directo cuando el
  schema del tenant no está expuesto en PostgREST
- `postgrest-schema-error.ts` — detecta ese caso
- `types.ts` — los tipos que esos dos necesitan

Si alguna vez se renombran, hay que actualizar los imports en
`src/lib/clientes`, `src/lib/facturacion`, `src/lib/sifen` y `src/lib/supabase`.
