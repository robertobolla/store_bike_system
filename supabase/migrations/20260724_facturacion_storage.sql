-- Bucket donde se archivan los PDFs emitidos.
-- Ejecutar en Supabase -> SQL Editor. Idempotente.
--
-- Es la "copia para The Fast Sheep": el cliente recibe su PDF por email
-- y aqui queda el archivo, con el mismo contenido y para siempre.
--
-- PRIVADO a proposito. Una factura lleva nombre, direccion e importes de
-- una persona identificable; con el bucket publico, cualquiera que
-- adivinara la ruta se descargaria las facturas de todos los riders. La
-- app las muestra generando URLs firmadas y temporales.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documents', 'documents', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['application/pdf'];

-- Solo usuarios logueados leen los documentos. Nadie sube ni borra desde
-- el cliente: los PDFs los escribe la Edge Function con la service role
-- key, que se salta estas politicas. Asi un documento archivado no se
-- puede sustituir desde el navegador.
drop policy if exists documents_read on storage.objects;
create policy documents_read on storage.objects
  for select to authenticated
  using (bucket_id = 'documents');
