-- ================================================================
-- RENUMERACION CRONOLOGICA DE DOCUMENTOS FISCALES
-- Ejecutar en Supabase -> SQL Editor. Re-ejecutable.
--
-- QUE HACE. Reasigna los numeros de documents para que el orden de la
-- numeracion coincida con el de las fechas de emision, por tipo y por
-- anio, y sin huecos: INV-2026-1001, 1002, 1003 ... en orden de
-- issue_date. Los empates de fecha conservan el orden que ya tenian.
--
-- POR QUE HIZO FALTA. Dos cosas rompieron el orden:
--   1. delete_document() retrocede el contador cuando se borra el ultimo
--      numero emitido, asi que el siguiente documento lo reutiliza. De
--      ahi salen facturas de agosto con numero de mayo.
--   2. Se cargaron facturas viejas despues de las nuevas, tomando el
--      numero del final.
--
-- POR QUE UN SOLO BLOQUE do. El editor SQL de Supabase confirma cada
-- sentencia por separado: un begin/commit escrito a mano no agrupa nada
-- y una tabla temporal no sobrevive de una sentencia a la siguiente. Un
-- unico statement, en cambio, es atomico siempre. Si algo falla a mitad
-- de camino, no queda nada a medias.
--
-- LO QUE NO ES. Esto no es una migracion de esquema: es un arreglo de
-- datos puntual. Si se vuelven a cargar documentos con fecha anterior a
-- los que ya existen, el orden se rompe otra vez y hay que re-ejecutarlo.
-- ================================================================

-- ----------------------------------------------------------------
-- PASO 0 (SOLO LECTURA). Correr esto primero y mirar el resultado.
-- "enviados_cliente" son los documentos que ya salieron de la empresa:
-- renumerarlos deja al cliente con un papel cuyo numero ya no existe.
-- El PASO 2 avisa pero no frena, asi que mirar este numero ANTES y
-- decidir a conciencia.
-- ----------------------------------------------------------------
select count(*)                                                   as documentos,
       count(*) filter (where sent_to_customer_at   is not null)  as enviados_cliente,
       count(*) filter (where sent_to_accounting_at is not null)  as enviados_conta,
       count(*) filter (where pdf_url is not null)                as con_pdf_archivado
from documents;

-- ----------------------------------------------------------------
-- PASO 1. La red de seguridad. Idempotente y sin efectos: solo crea la
-- tabla donde el PASO 2 deja la foto del antes.
-- ----------------------------------------------------------------
create table if not exists documents_renumber_backup (
  run_at      timestamptz not null default now(),
  id          uuid        not null,
  number_old  text        not null,
  seq_old     int         not null,
  pdf_url_old text
);

-- ----------------------------------------------------------------
-- PASO 2. La renumeracion. Un solo statement: o sale entero o no sale.
-- ----------------------------------------------------------------
do $$
declare
  v_enviados int;
  v_docs     int;
  v_unicos   int;
  v_corrida  timestamptz := now();
begin
  -- Foto del antes. Es la vuelta atras, y sobrevive al script a
  -- proposito. Cada corrida deja la suya, identificada por run_at.
  insert into documents_renumber_backup (run_at, id, number_old, seq_old, pdf_url_old)
  select v_corrida, id, number, seq, pdf_url from documents;

  -- Los documentos ya enviados al cliente se renumeran igual. Fue una
  -- decision explicita del 05/08/2026: eran 2, y a esos riders ya se les
  -- habia avisado del reordenamiento que se estaba haciendo.
  --
  -- Queda como aviso y no como abort porque la proxima vez puede haber
  -- cientos de documentos enviados, y ahi la respuesta ya no es obvia:
  -- hay que volver a decidirlo mirando cuales son.
  select count(*) into v_enviados from documents where sent_to_customer_at is not null;
  if v_enviados > 0 then
    raise notice
      'AVISO: % documento(s) ya enviados al cliente se estan renumerando. El PDF que tienen ellos queda con un numero que ya no existe.',
      v_enviados;
  end if;

  -- El candado de inmutabilidad bloquea justamente cambiar el numero,
  -- que es lo que hay que hacer aqui.
  alter table documents disable trigger trg_documents_block_edit;

  -- Dos fases. number es UNIQUE, asi que no se puede mover 1005 -> 1004
  -- mientras 1004 siga ocupado. Primero todos a un valor temporal unico.
  -- seq no se toca todavia: el orden final se calcula con el viejo.
  update documents set number = '~' || id::text;

  with orden as (
    select id, doc_type, year,
           1000 + row_number() over (partition by doc_type, year
                                     order by issue_date, created_at, seq) as seq_nuevo
    from documents
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
         -- impreso adentro: si el numero cambia, ese PDF pasa a mentir. Se
         -- suelta la referencia y la app lo regenera sola al abrirlo.
         pdf_url = case when m.numero_nuevo <> m.number_old then null else m.pdf_url_old end
    from mapa m
   where d.id = m.id;

  alter table documents enable trigger trg_documents_block_edit;

  -- Cinturon: si algo hubiera duplicado un numero, se aborta y el bloque
  -- entero se deshace. row_number() por particion no puede repetir, pero
  -- esto se paga una vez y cubre cualquier sorpresa futura.
  select count(*), count(distinct number) into v_docs, v_unicos from documents;
  if v_docs <> v_unicos then
    raise exception 'ABORTADO: quedarian % numeros repetidos.', v_docs - v_unicos;
  end if;

  -- Los contadores tienen que apuntar al ultimo numero real, o el proximo
  -- documento chocaria contra uno existente. RNT no se toca: no vive en
  -- documents.
  insert into document_sequences (doc_type, year, last_number)
  select doc_type, year, max(seq) from documents group by doc_type, year
  on conflict (doc_type, year) do update set last_number = excluded.last_number;

  raise notice 'Renumerados % documentos. Copia de seguridad: run_at = %', v_docs, v_corrida;
end $$;

-- ----------------------------------------------------------------
-- PASO 3. Verificacion. Las tres tienen que dar el resultado indicado.
-- ----------------------------------------------------------------

-- a) Cero filas = ninguna factura fuera de orden.
with o as (
  select doc_type, year, number, issue_date,
         row_number() over (partition by doc_type, year order by issue_date, created_at, seq) as pos_fecha,
         row_number() over (partition by doc_type, year order by seq) as pos_numero
  from documents)
select * from o where pos_fecha <> pos_numero;

-- b) huecos = 0 y desde = 1001 en cada tipo.
select doc_type, year, count(*) as docs, min(seq) as desde, max(seq) as hasta,
       max(seq) - min(seq) + 1 - count(*) as huecos
from documents group by 1,2 order by 1,2;

-- c) El contador coincide con el ultimo numero emitido.
select s.doc_type, s.year, s.last_number, max(d.seq) as ultimo_real
from document_sequences s
left join documents d on d.doc_type = s.doc_type and d.year = s.year
group by 1,2,3 order by 1,2;

-- ================================================================
-- VUELTA ATRAS. Solo si hace falta deshacer la ultima corrida.
-- Tambien un unico statement, por lo mismo.
-- ================================================================
-- do $$
-- declare v_corrida timestamptz;
-- begin
--   select max(run_at) into v_corrida from documents_renumber_backup;
--   alter table documents disable trigger trg_documents_block_edit;
--   update documents set number = '~' || id::text;
--   update documents d
--      set number = b.number_old, seq = b.seq_old, pdf_url = b.pdf_url_old
--     from documents_renumber_backup b
--    where b.id = d.id and b.run_at = v_corrida;
--   alter table documents enable trigger trg_documents_block_edit;
--   insert into document_sequences (doc_type, year, last_number)
--   select doc_type, year, max(seq) from documents group by doc_type, year
--   on conflict (doc_type, year) do update set last_number = excluded.last_number;
--   raise notice 'Revertida la corrida %', v_corrida;
-- end $$;
