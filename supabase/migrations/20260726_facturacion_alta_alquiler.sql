-- Cierra dos huecos que dejaban un alquiler nuevo fuera del sistema de
-- facturacion. Los dos se detectaron sobre datos reales: el ultimo
-- alquiler dado de alta quedo sin codigo RNT y sin fecha de proximo
-- cobro, asi que ni aparecia referenciado en sus documentos ni entraba
-- nunca en la facturacion semanal.
--
-- La correccion va en la base y no en la app a proposito: el alta puede
-- venir del asistente, de una edicion o de un script, y los tres tienen
-- que quedar consistentes. Si dependiera del front, cada camino nuevo
-- volveria a olvidarse.

-- ================================================================
-- 1. CODIGO RNT AUTOMATICO
-- La migracion de facturacion solo sembro los alquileres que existian
-- ese dia; no habia nada que diera codigo a los siguientes. El RNT es
-- lo que enlaza un alquiler con sus facturas y es lo que se imprime en
-- el PDF, asi que no puede quedar en blanco.
-- ================================================================
create or replace function rentals_set_code()
returns trigger language plpgsql as $$
begin
  if new.rental_code is null then
    new.rental_code := next_document_code(
      'RNT',
      extract(year from coalesce(new.start_date, current_date))::int
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rentals_set_code on rentals;
create trigger trg_rentals_set_code
  before insert on rentals
  for each row execute function rentals_set_code();

-- ================================================================
-- 2. FECHA DEL PRIMER COBRO AUTOMATICO
-- auto_invoice viene con default true, pero next_invoice_date no tiene
-- default. El cron filtra por next_invoice_date not null, asi que un
-- alquiler semanal insertado sin esa fecha se marcaba como
-- "auto-facturado" y aun asi no se facturaba nunca: fallaba en silencio,
-- que es la peor forma de fallar cuando hay dinero de por medio.
--
-- El primer cobro va una semana despues del inicio porque la primera
-- semana se cobra y factura en la entrega.
-- ================================================================
create or replace function rentals_set_next_invoice_date()
returns trigger language plpgsql as $$
begin
  if new.auto_invoice
     and new.rate_type = 'semanal'
     and new.next_invoice_date is null
     and new.start_date is not null then
    new.next_invoice_date := new.start_date + 7;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_rentals_set_next_invoice_date on rentals;
create trigger trg_rentals_set_next_invoice_date
  before insert on rentals
  for each row execute function rentals_set_next_invoice_date();

-- ================================================================
-- 3. ARREGLO DE LOS ALQUILERES YA AFECTADOS
-- ================================================================
do $$
declare
  r record;
begin
  for r in
    select id, start_date, extract(year from start_date)::int as yr
    from rentals
    where rental_code is null
    order by start_date, created_at
  loop
    update rentals set rental_code = next_document_code('RNT', r.yr) where id = r.id;
  end loop;
end $$;

-- Los que ya estan en marcha arrancan en su PROXIMO dia de cobro, no
-- en su fecha de inicio: cobrarles de golpe todas las semanas atrasadas
-- seria incorrecto (esos cobros ya se registraron a mano) y ademas les
-- llegaria una rafaga de correos.
--
-- La fecha se calcula como el siguiente multiplo de 7 dias contado
-- desde el inicio, no como "hoy + 7". Asi se respeta el dia de la
-- semana que el rider ya tiene como dia de pago: un alquiler que
-- empezo un viernes sigue cobrandose en viernes.
update rentals
   set next_invoice_date =
         start_date + ((floor((current_date - start_date)::numeric / 7) + 1) * 7)::int
 where auto_invoice
   and rate_type = 'semanal'
   and status = 'Activo'
   and next_invoice_date is null
   and start_date is not null
   and start_date <= current_date;
