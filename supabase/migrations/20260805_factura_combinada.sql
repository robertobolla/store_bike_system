-- Factura combinada: alquiler + articulos de tienda en un solo documento.
-- Ejecutar en Supabase -> SQL Editor. Idempotente.
--
-- EL PROBLEMA. Cuando el rider paga la semana y ademas se lleva un casco,
-- al banco entra UN movimiento de 120. Con una factura de 70 y otra de 50
-- no hay forma comoda de casar ese movimiento con los papeles. La factura
-- tiene que decir 120, con el alquiler y el casco como lineas.
--
-- POR QUE REEMPLAZAR Y NO AMPLIAR. La factura semanal de 70 ya existe: la
-- emitio el cron en estado 'pending'. No se le puede agregar una linea ni
-- subirle el importe, y es a proposito: el trigger de inmutabilidad congela
-- los importes y document_lines rechaza cualquier UPDATE. Asi que la de 70
-- se borra y en su lugar nace la de 120.
--
-- EL NUMERO SE HEREDA, NO SE CONSUME. La factura nueva se queda con el
-- numero de la que sustituye. Es lo que evita el hueco: si la de 70 era la
-- INV-2026-1070 y desde el lunes se emitieron otras, borrarla y tomar el
-- siguiente numero dejaria un salto 1069 -> 1071 en una numeracion que el
-- resto del sistema mantiene correlativa y sin huecos. Reusandolo no hay
-- nada que justificar: la 1070 es la de 120. El PDF archivado vive en
-- {year}/{number}.pdf y se sube con upsert, asi que la version de 70 queda
-- pisada por la definitiva y no sobrevive ni en el bucket.
--
-- SOLO SOBRE FACTURAS PENDIENTES. Reemplazar una ya cobrada borraria el
-- documento de un cobro real. La funcion lo rechaza.

-- ----------------------------------------------------------------
-- 1. INSERT COMPARTIDO
--
-- Emitir y reemplazar solo se diferencian en de donde sale el numero. El
-- resto (cabecera, snapshots, lineas) es identico, y tenerlo dos veces
-- garantiza que dentro de seis meses una copia tenga una columna que la
-- otra no.
-- ----------------------------------------------------------------
create or replace function write_document(p jsonb, p_code text, p_year int)
returns documents
language plpgsql
as $$
declare
  v_doc  documents;
  v_line jsonb;
  v_i    int := 0;
begin
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
    p_code,
    p_year,
    split_part(p_code, '-', 3)::int,
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

-- ----------------------------------------------------------------
-- 2. EMISION NORMAL
-- Mismo contrato que antes: pide el proximo numero y escribe. Lo unico que
-- cambia es que el insert ya no vive aqui.
-- ----------------------------------------------------------------
create or replace function issue_document(p jsonb)
returns documents
language plpgsql
as $$
declare
  v_year int;
begin
  v_year := extract(year from (p->>'issue_date')::date)::int;
  return write_document(p, next_document_code(p->>'doc_type', v_year), v_year);
end;
$$;

-- ----------------------------------------------------------------
-- 3. REEMPLAZO
--
-- Borra la factura pendiente y escribe la nueva con SU MISMO NUMERO, todo
-- en la misma transaccion: entre el delete y el insert no hay ningun
-- instante en que ese numero no exista para nadie mas.
--
-- No usa delete_document() a proposito. Esa retrocede el contador cuando el
-- documento era el ultimo emitido; si la de 70 lo era, el contador quedaria
-- en 1069, aqui reusariamos el 1070 y la SIGUIENTE factura volveria a pedir
-- el 1070 y chocaria contra el unique de number. Aqui la secuencia no se
-- toca: el numero no se consume ni se devuelve, se hereda.
-- ----------------------------------------------------------------
create or replace function replace_document(p_old_id uuid, p jsonb)
returns documents
language plpgsql
as $$
declare
  v_old documents;
begin
  select * into v_old from documents where id = p_old_id for update;
  if not found then
    raise exception 'No existe el documento % que se queria reemplazar.', p_old_id;
  end if;

  -- Una factura cobrada documenta dinero que entro de verdad. Una nota de
  -- credito o un recibo de deposito tampoco se reemplazan: se corrigen por
  -- los caminos que ya existen.
  if v_old.doc_type <> 'INV' or v_old.status <> 'pending' then
    raise exception
      'Solo se reemplaza una factura pendiente. % es % en estado %.',
      v_old.number, v_old.doc_type, v_old.status;
  end if;

  -- Las lineas caen por ON DELETE CASCADE. rental_payments.document_id y
  -- el related_document_id de terceros se ponen a NULL por sus FK; el
  -- llamador vuelve a enlazar el cobro con la factura nueva.
  delete from documents where id = p_old_id;

  return write_document(p, v_old.number, v_old.year);
end;
$$;

-- write_document queda accesible porque issue_document y replace_document no
-- son SECURITY DEFINER: se ejecutan con el rol que llama, que necesita el
-- permiso. No abre nada nuevo, authenticated ya puede insertar en documents.
grant execute on function write_document(jsonb, text, int) to authenticated;
grant execute on function replace_document(uuid, jsonb) to authenticated;
