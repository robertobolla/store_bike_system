-- Reconstruye como gastos las compras de stock ya cargadas.
-- Ejecutar en Supabase -> SQL Editor. Idempotente.
--
-- POR QUE HACE FALTA:
-- hasta ahora el gasto de una compra no existia como registro propio: el
-- Balance lo leia de products.price_paid. Con la tabla expenses el gasto
-- pasa a ser una fila, y los 188 productos ya cargados se quedarian sin
-- ella. El dia que el Balance cambie de criterio esas compras
-- desapareceria y pareceria que la empresa gasto mucho menos.
--
-- COMO AGRUPA:
-- lo que se compro junto se reconstruye por fecha de compra + modelo +
-- precio. De los 188 productos, 183 tienen purchase_date; para los 5
-- restantes se usa date_added, que nunca es nulo. No es exacto al 100%
-- (dos compras del mismo modelo, mismo precio y mismo dia se fusionan en
-- una), pero el importe total del Balance sale correcto, que es lo que
-- importa.
--
-- SEGURO DE EJECUTAR AHORA:
-- el Balance sigue leyendo price_paid y todavia nadie lee expenses, asi
-- que esto no duplica nada. Cuando se cambie el Balance, los datos ya
-- estaran listos.
--
-- OJO al reejecutar: el filtro es expense_id is null, asi que una
-- segunda pasada barreria tambien los productos nuevos que aun no
-- tengan su gasto asignado. Es una migracion de una sola vez.

do $$
declare
  g            record;
  v_expense_id uuid;
  v_cat_id     uuid;
  v_desc       text;
  v_net        numeric;
  v_vat        numeric;
  v_amount     numeric;
begin
  select id into v_cat_id from expense_categories where name = 'Compra de Stock';

  for g in
    select
      coalesce(p.purchase_date, p.date_added::date) as fecha,
      p.model_id,
      p.price_paid,
      -- El campo se llamo 'bat_applied' hasta el commit que renombro
      -- BAT -> VAT, asi que los productos mas antiguos siguen guardando
      -- la clave vieja. Mirar solo 'vat_applied' los daria como compras
      -- sin impuestos y perderiamos el VAT soportado, que es deducible.
      -- La app hace este mismo fallback al leerlos (App.tsx:4577).
      coalesce(
        (p.custom_field_values->>'vat_applied')::boolean,
        (p.custom_field_values->>'bat_applied')::boolean,
        false
      ) as vat_applied,
      nullif(p.custom_field_values->>'cost_base', '')::numeric as cost_base,
      count(*)::int as unidades,
      array_agg(p.id) as product_ids
    from products p
    where p.expense_id is null
    group by 1, 2, 3, 4, 5
  loop
    select nullif(trim(coalesce(pm.brand, '') || ' ' || coalesce(pm.model_name, '')), '')
      into v_desc
      from product_models pm
     where pm.id = g.model_id;

    -- price_paid ya viene con el VAT dentro cuando se marco la casilla
    -- al cargar el producto; cost_base guarda el coste sin impuestos.
    v_amount := round(g.price_paid * g.unidades, 2);
    if g.vat_applied and g.cost_base is not null then
      v_net := round(g.cost_base * g.unidades, 2);
      v_vat := round(v_amount - v_net, 2);
    else
      v_net := v_amount;
      v_vat := 0;
    end if;

    insert into expenses (
      expense_date, category_id, description, quantity,
      amount, vat_rate, vat_amount, net_amount,
      source, source_id
    ) values (
      g.fecha,
      v_cat_id,
      coalesce(v_desc, 'Compra de stock') || ' (migrado)',
      g.unidades,
      v_amount,
      case when v_vat > 0 then 23 else 0 end,
      v_vat,
      v_net,
      'stock',
      null
    )
    returning id into v_expense_id;

    update products set expense_id = v_expense_id where id = any(g.product_ids);
  end loop;
end $$;
