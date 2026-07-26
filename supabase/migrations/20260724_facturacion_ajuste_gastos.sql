-- Ajuste de la tabla expenses. Ejecutar ANTES de gastos_historicos.
-- Idempotente, y no hace nada en una base creada desde cero.
--
-- POR QUE EXISTE ESTE ARCHIVO:
-- 20260724_facturacion.sql se ejecuto con una version anterior del
-- diseno, en la que el gasto colgaba de un producto (expenses.product_id)
-- y no tenia cantidad. Despues se cambio a "un gasto por compra": cargar
-- 5 cascos crea 5 filas en products pero UN gasto de 5 x precio, que es
-- lo que coincide con la factura del proveedor.
--
-- El archivo original se actualizo, pero volver a ejecutarlo no arregla
-- una base existente: create table if not exists ve que la tabla ya esta
-- y se salta el bloque entero, columnas nuevas incluidas. De ahi este
-- ajuste con alter.

-- ----------------------------------------------------------------
-- 1. CANTIDAD
-- Para que Compras muestre "5 x Casco ABUS - 200 EUR" y no un importe
-- suelto sin contexto.
-- ----------------------------------------------------------------
alter table expenses add column if not exists quantity numeric not null default 1;

-- ----------------------------------------------------------------
-- 2. EL VINCULO CAMBIA DE SENTIDO
-- Antes: expenses.product_id -> un gasto apuntaba a un producto, lo que
-- obligaba a crear un gasto por unidad.
-- Ahora: products.expense_id -> varias unidades apuntan a la misma
-- compra. Al ser una columna unica por producto (y no una tabla de
-- union), una unidad no puede colgar de dos gastos: ahi esta la garantia
-- de que el mismo dinero no se cuenta dos veces.
-- ----------------------------------------------------------------
alter table products add column if not exists expense_id uuid
  references expenses(id) on delete set null;

create index if not exists idx_products_expense on products(expense_id);

drop index if exists idx_expenses_product;
alter table expenses drop column if exists product_id;

-- ----------------------------------------------------------------
-- 3. INDICE DE ORIGEN
-- El original cubria source <> 'manual', pensado para bloquear que un
-- producto generara dos gastos. Con el vinculo invertido esa garantia ya
-- la da products.expense_id, y el indice estorba: source_id queda null en
-- las compras de stock y el predicado deja de tener sentido. Se reduce a
-- mantenimiento, que si es uno a uno.
-- ----------------------------------------------------------------
drop index if exists idx_expenses_source;

create unique index if not exists idx_expenses_source
  on expenses(source, source_id)
  where source = 'maintenance' and source_id is not null;
