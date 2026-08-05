-- Numeracion: se dejan de reusar numeros, y el reordenamiento
-- cronologico pasa a ser una funcion en vez de un script suelto.
-- Ejecutar en Supabase -> SQL Editor. Idempotente.
--
-- EL PROBLEMA QUE CIERRA. delete_document() retrocedia el contador
-- cuando el documento borrado era el ultimo numero emitido, para que el
-- siguiente lo reutilizara. Eso se escribio para limpiar datos de prueba
-- sin dejar la secuencia llena de huecos, y sobre datos de prueba estaba
-- bien. Sobre documentos reales hace otra cosa: el numero liberado se lo
-- lleva un documento nuevo, con fecha de hoy, mientras los numeros de
-- arriba siguen ocupados por documentos mas viejos. Asi aparecieron
-- facturas de agosto numeradas como si fueran de mayo.
--
-- Entre las dos cosas que un contador puede objetar, un hueco y un
-- numero reusado, el hueco es el que se explica: "esa factura se anulo".
-- Un numero que cambia de dueno no se explica.
--
-- A PARTIR DE AHORA: borrar un documento deja un hueco permanente. Es el
-- comportamiento correcto para un documento fiscal, y de paso vuelve a
-- poner el precio donde tiene que estar: borrar duele un poco.

-- ----------------------------------------------------------------
-- 1. BORRADO SIN RETROCESO DE CONTADOR
-- ----------------------------------------------------------------
create or replace function delete_document(p_id uuid)
returns void language plpgsql as $$
begin
  -- Las lineas caen por ON DELETE CASCADE. rental_payments.document_id y
  -- documents.related_document_id se ponen a NULL por sus FK.
  --
  -- El contador NO se toca: el numero borrado queda como hueco y no lo
  -- hereda nadie. Ver la cabecera de esta migracion.
  delete from documents where id = p_id;
end;
$$;

-- ----------------------------------------------------------------
-- 2. REORDENAMIENTO CRONOLOGICO COMO FUNCION
--
-- Quitar el reuso de numeros evita que la numeracion se desordene sola,
-- pero no cubre el otro caso: cargar hoy una factura con fecha de mayo.
-- Esa toma el numero del final y queda fuera de orden por definicion, y
-- no hay forma de impedirlo sin prohibir la carga de historicos.
--
-- Asi que el flujo pasa a ser: cargar los historicos que hagan falta y,
-- al terminar, llamar a esta funcion. Reasigna todos los numeros en
-- orden de issue_date, por tipo y anio, desde 1001 y sin huecos.
--
-- Es un unico statement a proposito: el editor SQL de Supabase confirma
-- sentencia por sentencia, asi que un begin/commit escrito a mano no
-- agrupa nada. Dentro de una funcion, o sale todo o no sale nada.
--
-- HAY QUE REVOCARLA EXPLICITAMENTE. Postgres concede EXECUTE a PUBLIC en
-- toda funcion nueva, asi que "no ponerle un grant" no la protege: la
-- deja abierta. Y como es security definer, corre como postgres y el RLS
-- no la frena. Sin el revoke de abajo, cualquiera con la clave anonima
-- —que viaja en el bundle del navegador— podria renumerar la facturacion
-- entera. Esto se ejecuta a conciencia desde el editor SQL, no desde un
-- boton y mucho menos desde afuera.
-- ----------------------------------------------------------------
create table if not exists documents_renumber_backup (
  run_at      timestamptz not null default now(),
  id          uuid        not null,
  number_old  text        not null,
  seq_old     int         not null,
  pdf_url_old text
);

create or replace function renumber_documents_chronologically()
returns table (doc_type text, anio int, documentos bigint, desde int, hasta int)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_corrida  timestamptz := now();
  v_enviados int;
  v_docs     int;
  v_unicos   int;
begin
  -- Foto del antes. Sobrevive a la llamada a proposito: es la vuelta
  -- atras, y cada corrida deja la suya identificada por run_at.
  insert into documents_renumber_backup (run_at, id, number_old, seq_old, pdf_url_old)
  select v_corrida, d.id, d.number, d.seq, d.pdf_url from documents d;

  select count(*) into v_enviados from documents where sent_to_customer_at is not null;
  if v_enviados > 0 then
    raise notice
      'AVISO: % documento(s) ya enviados al cliente se estan renumerando. El PDF que tiene el cliente queda con un numero que ya no existe.',
      v_enviados;
  end if;

  alter table documents disable trigger trg_documents_block_edit;

  -- Dos fases: number es UNIQUE, no se puede mover 1005 -> 1004 mientras
  -- 1004 siga ocupado. seq no se toca todavia, que es lo que desempata
  -- el orden de abajo.
  update documents set number = '~' || id::text;

  with orden as (
    select d.id, d.doc_type, d.year,
           1000 + row_number() over (partition by d.doc_type, d.year
                                     order by d.issue_date, d.created_at, d.seq) as seq_nuevo
    from documents d
  ),
  mapa as (
    select o.id, o.seq_nuevo,
           o.doc_type || '-' || o.year || '-' || lpad(o.seq_nuevo::text, 4, '0') as numero_nuevo,
           b.number_old, b.pdf_url_old
    from orden o
    join documents_renumber_backup b on b.id = o.id and b.run_at = v_corrida
  )
  update documents d
     set number  = m.numero_nuevo,
         seq     = m.seq_nuevo,
         -- El PDF archivado vive en {year}/{number}.pdf y lleva el numero
         -- impreso adentro: si el numero cambia, ese PDF pasa a mentir.
         -- Se suelta la referencia y se regenera.
         pdf_url = case when m.numero_nuevo <> m.number_old then null else m.pdf_url_old end
    from mapa m
   where d.id = m.id;

  alter table documents enable trigger trg_documents_block_edit;

  select count(*), count(distinct number) into v_docs, v_unicos from documents;
  if v_docs <> v_unicos then
    raise exception 'ABORTADO: quedarian % numeros repetidos.', v_docs - v_unicos;
  end if;

  -- Los contadores tienen que apuntar al ultimo numero real, o el proximo
  -- documento chocaria contra uno existente. RNT no se toca: no vive en
  -- documents.
  insert into document_sequences (doc_type, year, last_number)
  select d.doc_type, d.year, max(d.seq) from documents d group by d.doc_type, d.year
  on conflict (doc_type, year) do update set last_number = excluded.last_number;

  return query
    select d.doc_type, d.year, count(*), min(d.seq), max(d.seq)
      from documents d group by d.doc_type, d.year order by d.doc_type, d.year;
end;
$$;

-- El revoke es la parte que de verdad la protege. Ver la nota de arriba:
-- sin esto queda abierta a cualquiera con la clave anonima.
revoke all on function renumber_documents_chronologically() from public;
revoke all on function renumber_documents_chronologically() from anon, authenticated;

-- Mismo motivo para las de la migracion de la factura combinada:
-- write_document escribe un documento con el numero que se le pase, y
-- replace_document borra uno para reemplazarlo. Ninguna es security
-- definer, asi que el RLS ya las contiene, pero no hay razon para
-- dejarlas al alcance del rol anonimo.
revoke all on function write_document(jsonb, text, int) from public, anon;
revoke all on function replace_document(uuid, jsonb) from public, anon;
grant execute on function write_document(jsonb, text, int) to authenticated;
grant execute on function replace_document(uuid, jsonb) to authenticated;
