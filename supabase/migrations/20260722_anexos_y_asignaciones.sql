-- Cambios de bici/condiciones en un alquiler vivo + anexos firmables al contrato.
-- Ejecutar en Supabase -> SQL Editor. Idempotente.

-- ----------------------------------------------------------------
-- 1. HISTORIAL DE ASIGNACION DE BICI
-- Un alquiler puede pasar por varias bicis (averia, cambio). Cada tramo
-- registra desde/hasta para poder atribuir los cobros a la bici que
-- realmente estaba en uso cuando se cobraron.
-- ----------------------------------------------------------------
create table if not exists rental_bike_assignments (
  id          uuid primary key default gen_random_uuid(),
  rental_id   uuid not null references rentals(id) on delete cascade,
  product_id  uuid not null references products(id),
  from_date   date not null,
  to_date     date,            -- null = tramo vigente
  created_at  timestamptz not null default now()
);

create index if not exists idx_rba_rental on rental_bike_assignments(rental_id);
create index if not exists idx_rba_product on rental_bike_assignments(product_id);

-- Siembra para los alquileres que ya existen: cada uno estuvo con su bici
-- actual desde su fecha de inicio. Solo inserta los que aun no tienen tramo.
insert into rental_bike_assignments (rental_id, product_id, from_date, to_date)
select r.id, r.bike_id, r.start_date, r.end_date
from rentals r
where r.bike_id is not null
  and not exists (
    select 1 from rental_bike_assignments a where a.rental_id = r.id
  );

-- ----------------------------------------------------------------
-- 2. ANEXOS AL CONTRATO
-- El contrato firmado nunca se modifica: cada cambio genera un anexo
-- numerado que lo referencia y que el rider firma por separado.
-- ----------------------------------------------------------------
create table if not exists rental_contract_amendments (
  id              uuid primary key default gen_random_uuid(),
  rental_id       uuid not null references rentals(id) on delete cascade,
  number          int  not null,          -- Anexo Nº, correlativo por alquiler
  effective_date  date not null,
  -- Lista de cambios: [{ label, before, after }]
  changes         jsonb not null default '[]'::jsonb,
  -- Datos del contrato tras aplicar el anexo, congelados al emitirlo
  snapshot_after  jsonb,
  -- Texto libre opcional (motivo del cambio)
  note            text,
  customer_name   text not null default '',
  customer_email  text not null default '',
  email_lang      text not null default 'en',
  status          text not null default 'pending',   -- pending | signed
  signature_url   text,
  signed_at       timestamptz,
  created_at      timestamptz not null default now(),
  unique (rental_id, number)
);

create index if not exists idx_rca_rental on rental_contract_amendments(rental_id);

-- ----------------------------------------------------------------
-- 3. PERMISOS
-- Sin esto la app lee las tablas vacias: PostgREST necesita los grants
-- de rol, y con RLS activo ademas una politica que lo permita.
-- El rider firma su anexo SIN estar logueado, asi que anon necesita
-- poder leerlo y actualizar la firma, igual que ya ocurre hoy con el
-- contrato sobre la tabla rentals.
-- ----------------------------------------------------------------
grant select, insert, update, delete on rental_bike_assignments to authenticated;
grant select on rental_bike_assignments to anon;
grant select, insert, update, delete on rental_contract_amendments to authenticated;
grant select, update on rental_contract_amendments to anon;

alter table rental_bike_assignments enable row level security;
alter table rental_contract_amendments enable row level security;

drop policy if exists rba_auth on rental_bike_assignments;
create policy rba_auth on rental_bike_assignments
  for all to authenticated using (true) with check (true);

drop policy if exists rba_anon_read on rental_bike_assignments;
create policy rba_anon_read on rental_bike_assignments
  for select to anon using (true);

drop policy if exists rca_auth on rental_contract_amendments;
create policy rca_auth on rental_contract_amendments
  for all to authenticated using (true) with check (true);

drop policy if exists rca_anon_read on rental_contract_amendments;
create policy rca_anon_read on rental_contract_amendments
  for select to anon using (true);

drop policy if exists rca_anon_sign on rental_contract_amendments;
create policy rca_anon_sign on rental_contract_amendments
  for update to anon using (true) with check (true);
