-- Borrado de documentos con retroceso de numeracion, y arreglo del trigger
-- de inmutabilidad para que no bloquee el borrado de un alquiler.
-- Ejecutar en Supabase -> SQL Editor. Idempotente.

-- ----------------------------------------------------------------
-- 1. TRIGGER DE INMUTABILIDAD: permitir desvincular (rental_id/sale_id
--    -> NULL).
--
-- Al borrar un alquiler, el ON DELETE SET NULL del FK intenta poner
-- documents.rental_id = NULL en sus documentos. Eso es un UPDATE, y el
-- trigger lo bloqueaba porque rental_id cambiaba -> el borrado del
-- alquiler fallaba entero.
--
-- Ahora solo se bloquea RE-vincular a OTRO alquiler/venta (cambiar a un
-- valor no nulo distinto). Poner a NULL (desvincular) se permite, que es
-- lo que hace el cascade. Los importes, numero y fechas siguen sin poder
-- tocarse.
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
  or (new.rental_id is distinct from old.rental_id and new.rental_id is not null)
  or (new.sale_id   is distinct from old.sale_id   and new.sale_id   is not null)
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

-- ----------------------------------------------------------------
-- 2. BORRADO DE DOCUMENTO CON RETROCESO DE NUMERACION
--
-- Un documento emitido normalmente no se borra (es fiscal). Pero durante
-- las pruebas hace falta limpiar y reusar el numero. Esta funcion borra
-- el documento y, SOLO si era el ultimo numero emitido de su tipo/anio,
-- retrocede el contador para que el proximo reuse ese numero.
--
-- Si se borra un numero del medio (no el ultimo), el contador NO
-- retrocede: reusarlo crearia un choque con los posteriores. Ese numero
-- queda como hueco, que es lo correcto.
-- ----------------------------------------------------------------
create or replace function delete_document(p_id uuid)
returns void language plpgsql as $$
declare
  v_type text;
  v_year int;
  v_seq  int;
begin
  select doc_type, year, seq into v_type, v_year, v_seq
    from documents where id = p_id;
  if not found then return; end if;

  -- Las lineas caen por ON DELETE CASCADE. rental_payments.document_id y
  -- documents.related_document_id se ponen a NULL por sus FK.
  delete from documents where id = p_id;

  -- Retroceder el contador solo si este era el ultimo numero emitido.
  update document_sequences
     set last_number = last_number - 1
   where doc_type = v_type and year = v_year and last_number = v_seq;
end;
$$;

grant execute on function delete_document(uuid) to authenticated;
