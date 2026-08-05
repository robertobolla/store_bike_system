-- ================================================================
-- Fecha de robo / perdida de un producto.
--
-- Hasta ahora el reporte de robo/perdida solo guardaba el estado
-- ('Robada' | 'Perdida' | 'Perdida/Garda'), sin fecha. Sin ella no se
-- puede medir cada cuanto se pierde una bici, que es la metrica que
-- pide el panel de Rentabilidad.
--
-- No hay nada que sembrar: al crear esta columna no existia ningun
-- producto en estado robado/perdido, asi que la serie empieza limpia.
-- ================================================================
alter table products add column if not exists lost_date date;

-- Los que ya estuvieran marcados (por si se reporta alguno entre el
-- despliegue del SQL y el del frontend) se fechan con su ultima
-- actualizacion conocida, para no dejarlos fuera del calculo.
update products
   set lost_date = coalesce(purchase_date, date_added::date)
 where lost_date is null
   and status in ('Robada', 'Perdida', 'Perdida/Garda');
