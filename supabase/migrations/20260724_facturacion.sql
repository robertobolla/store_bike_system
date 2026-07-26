-- Sistema de facturacion: documentos numerados, gastos unificados y
-- facturacion semanal automatica.
-- Ejecutar en Supabase -> SQL Editor. Idempotente: se puede correr dos veces.

-- ================================================================
-- 1. DATOS FISCALES DE LA EMPRESA
-- Una sola fila. La factura congela una copia de estos datos al
-- emitirse (documents.company_snapshot), asi que cambiar la direccion
-- manana no reescribe las facturas de ayer.
-- ================================================================
create table if not exists company_settings (
  id            int primary key default 1,
  legal_name    text not null default 'The Fast Sheep Limited',
  address       text not null default '',
  vat_number    text not null default '',
  cro_number    text not null default '',
  email         text not null default '',
  phone         text not null default '',
  logo_url      text not null default '',
  -- Correo interno que recibe copia de cada documento emitido.
  accounting_email text not null default 'facturacion@thefastsheep.com',
  -- Tipo de VAT por defecto. Los precios de la app son CON VAT incluido:
  -- base = total / 1.23, vat = total - base.
  default_vat_rate numeric not null default 23,
  invoice_footer text not null default '',
  constraint company_settings_single_row check (id = 1)
);

insert into company_settings (id) values (1) on conflict (id) do nothing;

-- ================================================================
-- 2. NUMERACION
-- Correlativa, sin huecos y por tipo de documento. Se reinicia cada
-- anio: INV-2026-1001 ... INV-2026-1237, y en enero vuelve a
-- INV-2027-1001.
--
-- IMPORTANTE: el numero se pide SIEMPRE con next_document_number().
-- Un max(numero)+1 desde el cliente da el mismo numero a dos usuarios
-- que emitan a la vez; aqui el ON CONFLICT DO UPDATE toma un lock de
-- fila y serializa las llamadas.
-- ================================================================
create table if not exists document_sequences (
  doc_type    text not null,
  year        int  not null,
  last_number int  not null,
  primary key (doc_type, year)
);

-- INV/DEP/REF/CN arrancan en 1001: el cliente reserva el hueco 1-1000
-- para cargar despues los documentos historicos de 2026.
-- RNT es interno (el cliente nunca lo ve) y arranca en 1.
create or replace function document_start_number(p_doc_type text)
returns int language sql immutable as $$
  select case p_doc_type when 'RNT' then 1 else 1001 end;
$$;

create or replace function next_document_number(p_doc_type text, p_year int)
returns int language plpgsql as $$
declare
  v_next int;
begin
  insert into document_sequences (doc_type, year, last_number)
  values (p_doc_type, p_year, document_start_number(p_doc_type))
  on conflict (doc_type, year) do update
    set last_number = document_sequences.last_number + 1
  returning last_number into v_next;
  return v_next;
end;
$$;

-- Devuelve el numero ya formateado: 'INV-2026-1001'.
create or replace function next_document_code(p_doc_type text, p_year int)
returns text language plpgsql as $$
begin
  return p_doc_type || '-' || p_year || '-' ||
         lpad(next_document_number(p_doc_type, p_year)::text, 4, '0');
end;
$$;

-- ================================================================
-- 3. RENTAL ID VISIBLE
-- Hoy los alquileres solo tienen UUID. El RNT es la clave que une
-- todos los documentos de un mismo alquiler.
-- ================================================================
alter table rentals add column if not exists rental_code text;

create unique index if not exists idx_rentals_code
  on rentals(rental_code) where rental_code is not null;

-- Siembra: los alquileres existentes reciben su codigo por orden de
-- fecha de inicio, agrupados por el anio en que empezaron.
do $$
declare
  r record;
begin
  for r in
    select id, start_date,
           extract(year from start_date)::int as yr
    from rentals
    where rental_code is null
    order by start_date, created_at
  loop
    update rentals
       set rental_code = next_document_code('RNT', r.yr)
     where id = r.id;
  end loop;
end $$;

-- ================================================================
-- 4. DOCUMENTOS (INV / DEP / REF / CN)
-- Una sola tabla con discriminador. Cada tipo mantiene su numeracion
-- independiente (punto 2 del documento del cliente) y todos quedan
-- unidos por rental_id, que es lo que pide el punto 3. Separarlos en
-- cuatro tablas duplicaria el motor de PDF y el listado sin aportar
-- nada.
-- ================================================================
create table if not exists documents (
  id          uuid primary key default gen_random_uuid(),
  doc_type    text not null check (doc_type in ('INV','DEP','REF','CN')),
  number      text not null unique,          -- INV-2026-1001
  year        int  not null,
  seq         int  not null,

  -- Vinculos. Un documento cuelga de un alquiler o de una venta.
  rental_id   uuid references rentals(id) on delete set null,
  sale_id     uuid references sales(id)   on delete set null,
  customer_id uuid references customers(id) on delete set null,
  -- CN -> la factura que corrige. REF -> el DEP que devuelve.
  related_document_id uuid references documents(id) on delete set null,

  issue_date  date not null default current_date,

  -- INV: pending | paid | cancelled
  -- DEP/REF: issued
  -- 'cancelled' solo para facturas emitidas por error que nunca se
  -- enviaron. Todo lo demas se corrige con una nota de credito.
  status      text not null default 'pending'
              check (status in ('pending','paid','cancelled','issued')),

  -- IMPORTES. Los precios de la app son CON VAT incluido, asi que
  -- total es lo que paga el cliente y la base sale de dividir:
  --   subtotal = round(total / 1.23, 2)
  --   vat_amount = total - subtotal
  -- Se guardan los tres para que el PDF y la declaracion no dependan
  -- de recalcular con redondeos distintos.
  -- Las notas de credito llevan importes NEGATIVOS.
  subtotal    numeric not null default 0,
  vat_rate    numeric not null default 23,
  vat_amount  numeric not null default 0,
  total       numeric not null default 0,

  payment_method text not null default '',   -- efectivo | transferencia | mixto
  payment_date   date,

  -- Copias congeladas en el momento de emitir.
  customer_snapshot jsonb not null default '{}'::jsonb,
  company_snapshot  jsonb not null default '{}'::jsonb,

  -- Periodo cubierto (facturas semanales de alquiler).
  billing_period_start date,
  billing_period_end   date,
  auto_generated       boolean not null default false,

  pdf_url             text,
  pdf_generated_at    timestamptz,
  sent_to_customer_at timestamptz,
  sent_to_accounting_at timestamptz,

  notes       text not null default '',
  created_at  timestamptz not null default now(),
  created_by  uuid
);

create index if not exists idx_documents_rental   on documents(rental_id);
create index if not exists idx_documents_sale     on documents(sale_id);
create index if not exists idx_documents_customer on documents(customer_id);
create index if not exists idx_documents_type_date on documents(doc_type, issue_date);
create index if not exists idx_documents_related  on documents(related_document_id);

-- Barrera anti-duplicado de la facturacion automatica: un alquiler no
-- puede tener dos facturas para la misma semana, pase lo que pase con
-- reintentos o con el cron ejecutandose dos veces.
create unique index if not exists idx_documents_rental_period
  on documents(rental_id, billing_period_start)
  where doc_type = 'INV' and billing_period_start is not null;

-- ----------------------------------------------------------------
-- LINEAS DE DETALLE
-- unit_price y line_total van CON VAT incluido, igual que el resto de
-- la app. El desglose se hace a nivel de documento.
-- ----------------------------------------------------------------
create table if not exists document_lines (
  id          uuid primary key default gen_random_uuid(),
  document_id uuid not null references documents(id) on delete cascade,
  description text not null default '',
  quantity    numeric not null default 1,
  unit_price  numeric not null default 0,
  line_total  numeric not null default 0,
  vat_rate    numeric not null default 23,
  sort_order  int not null default 0
);

create index if not exists idx_document_lines_doc on document_lines(document_id);

-- ----------------------------------------------------------------
-- INMUTABILIDAD
-- Un documento emitido no se edita nunca (punto 9). Se puede marcar
-- como pagado, adjuntarle el PDF o registrar el envio, pero el numero,
-- las fechas y los importes quedan congelados. Corregir un importe
-- exige emitir una nota de credito.
-- ----------------------------------------------------------------
create or replace function documents_block_edit()
returns trigger language plpgsql as $$
begin
  if new.number      is distinct from old.number
  or new.doc_type    is distinct from old.doc_type
  or new.issue_date  is distinct from old.issue_date
  or new.subtotal    is distinct from old.subtotal
  or new.vat_amount  is distinct from old.vat_amount
  or new.total       is distinct from old.total
  or new.rental_id   is distinct from old.rental_id
  or new.sale_id     is distinct from old.sale_id
  or new.customer_snapshot is distinct from old.customer_snapshot
  or new.company_snapshot  is distinct from old.company_snapshot then
    raise exception
      'Documento % ya emitido: no se pueden cambiar numero, fechas ni importes. Emitir una nota de credito.',
      old.number;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_documents_block_edit on documents;
create trigger trg_documents_block_edit
  before update on documents
  for each row execute function documents_block_edit();

-- Las lineas tampoco se editan una vez creado el documento. El DELETE
-- queda libre a proposito: si se bloquea, el borrado en cascada desde
-- documents falla y no hay forma de limpiar datos de prueba.
create or replace function document_lines_block_edit()
returns trigger language plpgsql as $$
begin
  raise exception 'Las lineas de un documento emitido no se pueden modificar.';
end;
$$;

drop trigger if exists trg_document_lines_block_edit on document_lines;
create trigger trg_document_lines_block_edit
  before update on document_lines
  for each row execute function document_lines_block_edit();

-- ================================================================
-- 5. GASTOS UNIFICADOS (punto 10)
-- Todo el dinero que sale de la cuenta en un solo sitio: compras de
-- stock, mantenimiento y gastos generales.
--
-- Regla anti-doble-conteo: un gasto = un punto de entrada. Si la
-- compra se registra en Stock, esa compra genera SU gasto y nadie
-- vuelve a subir la misma factura desde Balance.
--
-- La unidad de gasto es la COMPRA, no la unidad fisica. Cargar 5
-- cascos en Stock (el formulario tiene campo Cantidad) crea 5 filas en
-- products pero UN solo gasto de 5 x precio, que es lo que coincide
-- con la factura del proveedor. Las unidades apuntan a su gasto con
-- products.expense_id. Comprar 1 casco mas al dia siguiente es otra
-- compra y por tanto otro gasto: nada lo bloquea.
-- ================================================================
create table if not exists expense_categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  color      text not null default '#3b82f6',
  created_at timestamptz not null default now()
);

-- Las mismas categorias que hoy viven en localStorage.
insert into expense_categories (name, color) values
  ('Servicios',         '#3b82f6'),
  ('Alquiler de Local', '#10b981'),
  ('Marketing',         '#ec4899'),
  ('Sueldos',           '#f59e0b'),
  ('Impuestos',         '#ef4444'),
  ('Compra de Stock',   '#8b5cf6'),
  ('Mantenimiento',     '#14b8a6')
on conflict (name) do nothing;

create table if not exists expenses (
  id           uuid primary key default gen_random_uuid(),
  expense_date date not null,
  category_id  uuid references expense_categories(id) on delete set null,
  supplier_id  uuid references suppliers(id) on delete set null,
  description  text not null default '',

  -- amount es el TOTAL de la compra (todas las unidades, con VAT).
  -- OJO con la asimetria, es intencionada:
  --   ventas  -> el precio es CON VAT incluido, la base se divide /1.23
  --   compras -> el coste se carga SIN VAT y el 23% se suma encima,
  --              que es como funciona hoy el checkbox del form de Stock
  -- Por eso se guardan los tres importes y no se recalcula ninguno.
  quantity   numeric not null default 1,
  amount     numeric not null default 0,
  vat_rate   numeric not null default 0,
  vat_amount numeric not null default 0,
  net_amount numeric not null default 0,

  payment_method text not null default '',

  -- Factura del proveedor. El numero lo pone el proveedor: estos
  -- gastos NO consumen nuestra numeracion (punto 10 del documento).
  -- Ambos campos son opcionales: sueldos o alquiler del local no
  -- siempre traen factura.
  supplier_invoice_ref text,
  invoice_file_url     text,

  -- De donde vino el gasto. 'stock' se vincula al reves, desde
  -- products.expense_id, porque una compra cubre varias unidades.
  -- 'maintenance' apunta al maintenance_expenses de origen, que si es
  -- uno a uno.
  source    text not null default 'manual'
            check (source in ('manual','stock','maintenance')),
  source_id uuid,

  created_at timestamptz not null default now(),
  created_by uuid
);

create index if not exists idx_expenses_date     on expenses(expense_date);
create index if not exists idx_expenses_category on expenses(category_id);
create index if not exists idx_expenses_supplier on expenses(supplier_id);

-- Un mantenimiento no puede generar dos gastos.
create unique index if not exists idx_expenses_source
  on expenses(source, source_id)
  where source = 'maintenance' and source_id is not null;

-- ----------------------------------------------------------------
-- Cada unidad comprada apunta a su compra. La columna es UNICA por
-- producto (no una tabla de union), asi que una unidad no puede
-- pertenecer a dos gastos: ahi esta la garantia de que el mismo
-- dinero no se cuenta dos veces.
--
-- A partir de aqui el Balance suma expenses.amount y deja de sumar
-- products.price_paid, que pasa a ser el coste unitario informativo
-- para calcular la rentabilidad de cada bici.
-- ----------------------------------------------------------------
alter table products add column if not exists expense_id uuid
  references expenses(id) on delete set null;

create index if not exists idx_products_expense on products(expense_id);

-- ================================================================
-- 6. FACTURACION SEMANAL AUTOMATICA (punto 6)
-- Se genera una factura por semana mientras el alquiler este activo.
--
-- Freno: si el alquiler pasa a 'Devolucion en Proceso' (boton "Aviso
-- Devolucion"), la automatica se detiene de inmediato. La ultima
-- semana, si hay que cobrarla, se emite a mano. Al cancelar el aviso
-- se reanuda desde la siguiente fecha de cobro, sin recuperar las
-- semanas saltadas.
-- ================================================================
alter table rentals add column if not exists auto_invoice boolean not null default true;
alter table rentals add column if not exists next_invoice_date date;

-- Siembra: proxima fecha de cobro = el siguiente multiplo de 7 dias
-- desde el inicio que caiga a partir de hoy. Es el mismo calculo que
-- ya hace la ficha del alquiler para mostrar "Proximo pago".
update rentals
   set next_invoice_date = start_date +
       (ceil(greatest(current_date - start_date, 0) / 7.0) * 7)::int
 where next_invoice_date is null
   and status in ('Activo', 'Devolucion en Proceso', 'Devolución en Proceso')
   and rate_type = 'semanal';

-- Enlace del cobro con su factura, para no facturar dos veces el
-- mismo pago ni dejar pagos sin documento.
alter table rental_payments add column if not exists document_id uuid
  references documents(id) on delete set null;

-- ================================================================
-- 7. PERMISOS
-- Sin los grants PostgREST devuelve tablas vacias. El rol manager
-- puede ver y crear facturas, asi que no hace falta distinguir roles
-- a nivel de base: se resuelve en la UI como el resto de la app.
-- Nada de esto es accesible para anon: son datos contables.
-- ================================================================
grant select, insert, update on company_settings to authenticated;
grant select, insert, update, delete on document_sequences to authenticated;
grant select, insert, update, delete on documents to authenticated;
grant select, insert, update, delete on document_lines to authenticated;
grant select, insert, update, delete on expense_categories to authenticated;
grant select, insert, update, delete on expenses to authenticated;
grant execute on function next_document_number(text, int) to authenticated;
grant execute on function next_document_code(text, int) to authenticated;

alter table company_settings   enable row level security;
alter table document_sequences enable row level security;
alter table documents          enable row level security;
alter table document_lines     enable row level security;
alter table expense_categories enable row level security;
alter table expenses           enable row level security;

drop policy if exists cs_auth on company_settings;
create policy cs_auth on company_settings
  for all to authenticated using (true) with check (true);

drop policy if exists ds_auth on document_sequences;
create policy ds_auth on document_sequences
  for all to authenticated using (true) with check (true);

drop policy if exists doc_auth on documents;
create policy doc_auth on documents
  for all to authenticated using (true) with check (true);

drop policy if exists dl_auth on document_lines;
create policy dl_auth on document_lines
  for all to authenticated using (true) with check (true);

drop policy if exists ec_auth on expense_categories;
create policy ec_auth on expense_categories
  for all to authenticated using (true) with check (true);

drop policy if exists exp_auth on expenses;
create policy exp_auth on expenses
  for all to authenticated using (true) with check (true);
