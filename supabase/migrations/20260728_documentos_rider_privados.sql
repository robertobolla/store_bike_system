-- ================================================================
-- El bucket de documentos de identidad pasa a PRIVADO.
--
-- Guarda pasaportes y DNIs de los riders: datos personales sensibles.
-- Siendo publico bastaba con que se filtrara una URL (un correo
-- reenviado, un historial, un log) para que el documento quedara a la
-- vista de cualquiera, sin necesidad de estar logueado. Las rutas llevan
-- UUID, pero eso es seguridad por oscuridad, no control de acceso.
--
-- COMPATIBILIDAD: en customers.id_document_url siguen guardadas las URLs
-- publicas de antes. No hace falta migrarlas: getRiderDocumentUrl()
-- extrae la ruta de esas URLs y firma un enlace temporal, asi que los
-- registros antiguos se siguen viendo. Lo que deja de funcionar es
-- abrir esas URLs directamente fuera de la app, que es justamente lo
-- que se quiere cerrar.
-- ================================================================

update storage.buckets
   set public = false
 where id = 'rider-documents';

-- Con el bucket privado, el acceso pasa a depender de estas politicas.
-- Mismo criterio que el resto de la app: cualquier usuario autenticado.
drop policy if exists rider_documents_read on storage.objects;
create policy rider_documents_read on storage.objects
  for select to authenticated
  using (bucket_id = 'rider-documents');

drop policy if exists rider_documents_write on storage.objects;
create policy rider_documents_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'rider-documents');

-- El alta usa upsert (se reemplaza el ID de un rider), asi que hace
-- falta poder actualizar el objeto ademas de crearlo.
drop policy if exists rider_documents_update on storage.objects;
create policy rider_documents_update on storage.objects
  for update to authenticated
  using (bucket_id = 'rider-documents');

drop policy if exists rider_documents_delete on storage.objects;
create policy rider_documents_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'rider-documents');
