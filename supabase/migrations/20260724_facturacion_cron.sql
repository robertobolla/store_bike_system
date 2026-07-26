-- Programacion de la facturacion semanal automatica.
-- Ejecutar en Supabase -> SQL Editor DESPUES de desplegar las Edge
-- Functions, y sustituyendo los dos marcadores de abajo.
--
-- Corre TODOS LOS DIAS, no una vez por semana. Cada alquiler tiene su
-- propio dia de cobro segun cuando empezo, asi que no hay un lunes
-- comun: la funcion mira cada dia quien vence hoy. Ademas, si un dia
-- falla, al siguiente se pone al dia solo.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- ----------------------------------------------------------------
-- ANTES DE EJECUTAR, sustituir:
--
--   TU_SERVICE_ROLE_KEY  -> Project Settings > API > service_role
--   TU_CRON_SECRET       -> el mismo valor que pongas en el secret
--                           CRON_SECRET de las Edge Functions:
--                           supabase secrets set CRON_SECRET=...
--
-- El CRON_SECRET existe porque esta funcion emite documentos fiscales y
-- manda emails: sin el, cualquiera que diera con la URL podria disparar
-- una tanda de facturas.
-- ----------------------------------------------------------------

-- Idempotente: si ya estaba programada, se reemplaza en vez de duplicar.
select cron.unschedule('facturacion-semanal')
 where exists (select 1 from cron.job where jobname = 'facturacion-semanal');

select cron.schedule(
  'facturacion-semanal',
  -- 06:00 UTC. Temprano, para que la factura este en el correo del
  -- rider a primera hora del dia en que le toca pagar.
  '0 6 * * *',
  $$
  select net.http_post(
    url     := 'https://uykcffkwookeglnovffz.supabase.co/functions/v1/run-weekly-billing',
    headers := jsonb_build_object(
                 'Content-Type',  'application/json',
                 'Authorization', 'Bearer TU_SERVICE_ROLE_KEY',
                 'x-cron-secret', 'TU_CRON_SECRET'
               ),
    body    := '{}'::jsonb
  );
  $$
);

-- Comprobar que quedo programada:
--   select jobname, schedule, active from cron.job;
--
-- Ver las ultimas ejecuciones:
--   select start_time, status, return_message
--     from cron.job_run_details
--    where jobid = (select jobid from cron.job where jobname='facturacion-semanal')
--    order by start_time desc limit 10;
