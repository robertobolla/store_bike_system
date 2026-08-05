-- ================================================================
-- Bucket de comprobantes de gastos.
--
-- Es el archivo de los recibos de compra: la foto del ticket o el PDF de
-- la factura del proveedor, guardada junto al gasto que documenta.
--
-- No se reutiliza el bucket 'documents' por dos motivos: alli solo se
-- admiten PDFs (un recibo suele ser una foto del papel) y ademas nadie
-- puede subir desde el navegador, porque esos PDFs los escribe la Edge
-- Function y no deben poder sustituirse desde el cliente.
--
-- PRIVADO, igual que 'documents': una factura de proveedor lleva datos
-- fiscales de la empresa. La app la muestra con URLs firmadas temporales.
-- ================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'expense-receipts', 'expense-receipts', false, 10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']
)
on conflict (id) do update
  set public = false,
      file_size_limit = 10485760,
      allowed_mime_types = array['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'];

-- Aqui SI se sube desde el navegador: el recibo lo adjunta la persona que
-- carga el gasto. Mismo criterio que el resto de la app: cualquier
-- usuario autenticado opera sobre el bucket.
drop policy if exists expense_receipts_read on storage.objects;
create policy expense_receipts_read on storage.objects
  for select to authenticated
  using (bucket_id = 'expense-receipts');

drop policy if exists expense_receipts_write on storage.objects;
create policy expense_receipts_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'expense-receipts');

drop policy if exists expense_receipts_update on storage.objects;
create policy expense_receipts_update on storage.objects
  for update to authenticated
  using (bucket_id = 'expense-receipts');

-- Poder borrar el adjunto es necesario para corregir una carga
-- equivocada; el gasto en si se borra por su propia via.
drop policy if exists expense_receipts_delete on storage.objects;
create policy expense_receipts_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'expense-receipts');
