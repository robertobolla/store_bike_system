-- Comprobacion del sistema de facturacion.
-- Ejecutar en Supabase -> SQL Editor DESPUES de las cuatro migraciones.
-- Todas las filas tienen que decir OK.

select 'expenses.quantity' as comprueba,
       case when exists (select 1 from information_schema.columns
                          where table_name='expenses' and column_name='quantity')
            then 'OK' else 'FALTA — correr ajuste_gastos' end as estado
union all
select 'expenses.product_id eliminado',
       case when not exists (select 1 from information_schema.columns
                             where table_name='expenses' and column_name='product_id')
            then 'OK' else 'SIGUE AHI — correr ajuste_gastos' end
union all
select 'products.expense_id',
       case when exists (select 1 from information_schema.columns
                          where table_name='products' and column_name='expense_id')
            then 'OK' else 'FALTA — correr ajuste_gastos' end
union all
select 'documents.financing_snapshot',
       case when exists (select 1 from information_schema.columns
                          where table_name='documents' and column_name='financing_snapshot')
            then 'OK' else 'FALTA — correr emision' end
union all
-- Si la restriccion vieja de 4 tipos siguiera viva, todo recibo de cuota
-- seria rechazado al insertarlo.
select 'documents acepta RCP',
       case when exists (select 1 from pg_constraint con
                          join pg_class rel on rel.oid = con.conrelid
                         where rel.relname='documents' and con.contype='c'
                           and pg_get_constraintdef(con.oid) like '%RCP%')
            then 'OK' else 'FALTA — correr emision' end
union all
select 'funcion issue_document',
       case when exists (select 1 from pg_proc where proname='issue_document')
            then 'OK' else 'FALTA — correr emision' end
union all
-- Si tambien cubriera DELETE, borrar un documento fallaria por el
-- borrado en cascada de sus lineas.
select 'trigger de lineas solo en UPDATE',
       case when (select count(*) from pg_trigger
                   where tgname='trg_document_lines_block_edit' and not tgisinternal) = 1
                 and (select tgtype::int & 8 from pg_trigger
                       where tgname='trg_document_lines_block_edit' and not tgisinternal) = 0
            then 'OK' else 'CUBRE DELETE — correr emision' end
union all
select 'datos fiscales cargados',
       case when exists (select 1 from company_settings where id=1 and vat_number <> '')
            then 'OK' else 'FALTA — correr datos_empresa' end
union all
select 'gastos historicos migrados',
       case when exists (select 1 from expenses where source='stock')
            then 'OK' else 'FALTA — correr gastos_historicos' end
union all
-- Los dos importes tienen que coincidir: si no, alguna compra quedo
-- fuera o se conto dos veces.
select 'gastos cuadran con el stock',
       case when coalesce((select round(sum(price_paid),2) from products), 0)
               = coalesce((select round(sum(amount),2) from expenses where source='stock'), 0)
            then 'OK'
            else 'DESCUADRE: productos=' ||
                 coalesce((select round(sum(price_paid),2) from products), 0) ||
                 ' vs gastos=' ||
                 coalesce((select round(sum(amount),2) from expenses where source='stock'), 0)
       end
union all
select 'productos sin gasto asignado',
       case when (select count(*) from products where expense_id is null) = 0
            then 'OK'
            else (select count(*)::text from products where expense_id is null) || ' sin asignar'
       end;
