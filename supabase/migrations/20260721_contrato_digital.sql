-- Contrato digital de alquiler (ELECTRIC BICYCLE RENTAL AGREEMENT)
-- Ejecutar en Supabase -> SQL Editor. Es idempotente: se puede correr dos veces sin romper nada.

-- Direccion del arrendatario. El contrato la imprime en el bloque LESSEE DETAILS.
alter table customers
  add column if not exists address text;

-- Copia congelada de los datos del alquiler en el momento de generar el enlace de firma.
-- Asi, si mas adelante cambia la tarifa o el deposito, el contrato firmado no se altera.
alter table rentals
  add column if not exists contract_snapshot jsonb;

-- Momento exacto de la firma (el contrato pide "Date and time").
alter table rentals
  add column if not exists contract_signed_at timestamptz;

-- Clausula 13: consentimiento opcional de uso de imagen. NULL = contrato aun sin firmar.
alter table rentals
  add column if not exists contract_image_consent boolean;

-- Codigo interno de inventario (B-018). El campo bike_serial pasa a guardar el
-- numero de serie real del fabricante, que es el que identifica legalmente la bici.
alter table delivery_checklists
  add column if not exists bike_ref text;
