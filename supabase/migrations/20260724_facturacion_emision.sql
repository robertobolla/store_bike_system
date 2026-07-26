-- Emision atomica de documentos. Complementa a 20260724_facturacion.sql.
-- Ejecutar en Supabase -> SQL Editor. Idempotente.
--
-- POR QUE ESTA FUNCION Y NO DOS LLAMADAS DESDE EL CLIENTE:
-- pedir el numero con next_document_code() y despues insertar la fila
-- son dos viajes distintos. Si el insert falla (red, validacion, un
-- campo mal), el numero ya se consumio y la secuencia queda con un
-- hueco: INV-2026-1004, INV-2026-1006. En una numeracion fiscal eso
-- hay que justificarlo. Aqui numero, cabecera y lineas se insertan
-- dentro de la misma transaccion: o sale todo o no sale nada.

-- ----------------------------------------------------------------
-- VENTA FINANCIADA
--
-- El VAT de una venta de bienes se devenga completo en la entrega, no
-- repartido entre las cuotas. Por eso:
--
--   entrega -> INV por el total de la venta, con el VAT completo.
--              Es el documento fiscal que declara el impuesto.
--   cuota   -> RCP, un recibo de pago SIN VAT. Si cada cuota llevara
--              su VAT, el mismo impuesto se declararia siete veces
--              sobre una venta a 6 plazos.
--
-- El recibo muestra "Installment 1/6", el total de la venta, lo pagado
-- hasta la fecha y el saldo restante. Esos numeros cambian con cada
-- cuota, asi que se congelan al emitir: el recibo de la cuota 1 tiene
-- que seguir diciendo lo que decia entonces, no lo que dice el plan hoy.
-- ----------------------------------------------------------------
alter table documents add column if not exists financing_snapshot jsonb;

-- RCP es un quinto tipo que no estaba en el documento original del
-- cliente. Arranca en 1001 como los demas (document_start_number ya
-- devuelve 1001 para todo lo que no sea RNT).
-- Se borra por contenido y no por nombre. Un "drop constraint if exists
-- documents_doc_type_check" da por hecho como nombro Postgres el check
-- en linea; si no acertara, se saltaria en silencio, la restriccion
-- vieja de cuatro tipos seguiria viva y todo RCP seria rechazado al
-- insertarlo. Buscando en pg_constraint no depende del nombre.
do $$
declare
  c record;
begin
  for c in
    select con.conname
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
     where rel.relname = 'documents'
       and con.contype = 'c'
       and pg_get_constraintdef(con.oid) ilike '%doc_type%'
  loop
    execute format('alter table documents drop constraint %I', c.conname);
  end loop;
end $$;

alter table documents add constraint documents_doc_type_check
  check (doc_type in ('INV','DEP','REF','CN','RCP'));

-- El trigger de las lineas se recrea solo sobre UPDATE. Una version
-- anterior lo declaraba "before update or delete": con esa, borrar un
-- documento falla, porque el borrado en cascada dispara el trigger sobre
-- sus lineas y la excepcion aborta la operacion entera. Las lineas
-- siguen sin poder editarse, que es lo que importa.
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

-- El trigger de inmutabilidad de la migracion anterior no conocia esta
-- columna. Se recrea incluyendola: un saldo congelado que se pueda
-- reescribir despues no sirve de nada.
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
  or new.customer_snapshot  is distinct from old.customer_snapshot
  or new.company_snapshot   is distinct from old.company_snapshot
  or new.financing_snapshot is distinct from old.financing_snapshot then
    raise exception
      'Documento % ya emitido: no se pueden cambiar numero, fechas ni importes. Emitir una nota de credito.',
      old.number;
  end if;
  return new;
end;
$$;

create or replace function issue_document(p jsonb)
returns documents
language plpgsql
as $$
declare
  v_year int;
  v_code text;
  v_doc  documents;
  v_line jsonb;
  v_i    int := 0;
begin
  v_year := extract(year from (p->>'issue_date')::date)::int;
  v_code := next_document_code(p->>'doc_type', v_year);

  insert into documents (
    doc_type, number, year, seq,
    rental_id, sale_id, customer_id, related_document_id,
    issue_date, status,
    subtotal, vat_rate, vat_amount, total,
    payment_method, payment_date,
    customer_snapshot, company_snapshot, financing_snapshot,
    billing_period_start, billing_period_end, auto_generated,
    notes, created_by
  ) values (
    p->>'doc_type',
    v_code,
    v_year,
    split_part(v_code, '-', 3)::int,
    nullif(p->>'rental_id','')::uuid,
    nullif(p->>'sale_id','')::uuid,
    nullif(p->>'customer_id','')::uuid,
    nullif(p->>'related_document_id','')::uuid,
    (p->>'issue_date')::date,
    coalesce(p->>'status', 'pending'),
    coalesce((p->>'subtotal')::numeric, 0),
    coalesce((p->>'vat_rate')::numeric, 23),
    coalesce((p->>'vat_amount')::numeric, 0),
    coalesce((p->>'total')::numeric, 0),
    coalesce(p->>'payment_method', ''),
    nullif(p->>'payment_date','')::date,
    coalesce(p->'customer_snapshot', '{}'::jsonb),
    coalesce(p->'company_snapshot',  '{}'::jsonb),
    p->'financing_snapshot',
    nullif(p->>'billing_period_start','')::date,
    nullif(p->>'billing_period_end','')::date,
    coalesce((p->>'auto_generated')::boolean, false),
    coalesce(p->>'notes', ''),
    nullif(p->>'created_by','')::uuid
  )
  returning * into v_doc;

  for v_line in
    select value from jsonb_array_elements(coalesce(p->'lines', '[]'::jsonb))
  loop
    insert into document_lines (
      document_id, description, quantity, unit_price, line_total, vat_rate, sort_order
    ) values (
      v_doc.id,
      coalesce(v_line->>'description', ''),
      coalesce((v_line->>'quantity')::numeric, 1),
      coalesce((v_line->>'unit_price')::numeric, 0),
      coalesce((v_line->>'line_total')::numeric, 0),
      coalesce((v_line->>'vat_rate')::numeric, 23),
      v_i
    );
    v_i := v_i + 1;
  end loop;

  return v_doc;
end;
$$;

grant execute on function issue_document(jsonb) to authenticated;
