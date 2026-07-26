-- Alarmas de stock: avisan cuando las unidades de un articulo caen a un
-- umbral configurado.
--
-- La alarma se guarda contra el serial_number, no contra el id de un
-- producto. En esta base el serial_number es el SKU: todas las unidades
-- de un mismo articulo comparten serial y cada unidad es una fila. Si la
-- alarma apuntara a una fila concreta, al vender esa unidad la alarma se
-- quedaria huerfana justo cuando hace falta.
--
-- Puede haber varias alarmas por articulo (p.ej. aviso a las 10 y aviso
-- critico a las 3), asi que no hay unicidad por producto.

create table if not exists stock_alarms (
  id            uuid primary key default gen_random_uuid(),
  -- SKU vigilado. Sin FK: apunta al serial compartido por el lote, no a
  -- una unidad.
  product_key   text    not null,
  -- Etiqueta opcional para distinguir varias alarmas del mismo articulo.
  label         text    not null default '',
  -- Se avisa cuando las unidades en stock son <= threshold. Con umbral 5
  -- y 6 unidades, vender una deja 5 y dispara: es lo que espera quien lo
  -- configura, y es como se explica en el modal.
  threshold     int     not null check (threshold >= 0),
  notify_email  text    not null default '',
  active        boolean not null default true,

  -- Cantidad con la que se aviso por ultima vez. Es lo que evita repetir
  -- el correo en cada recarga de la app: solo se vuelve a avisar cuando
  -- el stock sube por encima del umbral y despues vuelve a caer. Null =
  -- nunca se aviso, armada.
  last_notified_qty int,
  last_triggered_at timestamptz,

  created_at    timestamptz not null default now(),
  created_by    uuid references auth.users(id)
);

create index if not exists idx_stock_alarms_key on stock_alarms(product_key);

alter table stock_alarms enable row level security;

-- Mismo criterio que el resto de las tablas de la app: cualquier usuario
-- autenticado opera sobre ellas.
drop policy if exists sa_auth on stock_alarms;
create policy sa_auth on stock_alarms
  for all to authenticated using (true) with check (true);

-- ================================================================
-- RECLAMO ATOMICO DEL AVISO
-- Si la app esta abierta en dos sitios, las dos pestañas detectarian la
-- misma caida y mandarian el mismo correo. Esta funcion decide en la
-- base quien avisa: actualiza la fila solo si sigue armada y devuelve
-- true unicamente al que gano. La condicion y la escritura ocurren en la
-- misma sentencia, asi que no hay hueco entre comprobar y marcar.
-- ================================================================
create or replace function claim_stock_alarm(p_id uuid, p_qty int)
returns boolean language plpgsql security definer as $$
declare
  v_ok boolean;
begin
  update stock_alarms
     set last_notified_qty = p_qty,
         last_triggered_at = now()
   where id = p_id
     and active
     and p_qty <= threshold
     -- Armada: o nunca se aviso, o el ultimo aviso fue con el stock por
     -- encima del umbral (es decir, se recupero y ha vuelto a caer).
     and (last_notified_qty is null or last_notified_qty > threshold)
  returning true into v_ok;
  return coalesce(v_ok, false);
end;
$$;

-- ================================================================
-- RE-ARMADO
-- Cuando el stock se repone por encima del umbral hay que dejar la
-- alarma lista para volver a avisar. Se guarda la cantidad actual para
-- que la condicion de "armada" de arriba se cumpla en la siguiente
-- caida.
-- ================================================================
create or replace function rearm_stock_alarm(p_id uuid, p_qty int)
returns void language sql security definer as $$
  update stock_alarms
     set last_notified_qty = p_qty
   where id = p_id
     and p_qty > threshold
     and (last_notified_qty is null or last_notified_qty <= threshold);
$$;
