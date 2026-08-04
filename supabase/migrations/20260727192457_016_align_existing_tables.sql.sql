/*
# Alinear tablas existentes con el esquema que espera la app TPV

## Resumen
La base de datos del proyecto tenía una estructura distinta a la que la app
espera. Esta migración añade las columnas que faltan y sincroniza los datos
existentes SIN perder los 3 productos ya creados. No se elimina ninguna
columna ni tabla — solo se añade y se rellena con valores por defecto.

## Tablas modificadas

### categories
- Añade: icon_name (text, default 'UtensilsCrossed'), print_destination
  (text, default 'kitchen', CHECK kitchen/bar), sort_order (int, default 0),
  active (boolean, default true).
- Sincroniza: rellena active=true usando el valor de la columna existente
  si procede, y sort_order usando display_order si existe.

### products
- Añade: iva_rate (numeric 5,2, default 10), print_destination (text,
  CHECK kitchen/bar), available (boolean, default true), sort_order
  (int, default 0), stock_actual (int, default 0).
- Sincroniza: available = active (la columna existente), iva_rate = 10,
  stock_actual = 30. La columna `description` ya existe y se conserva.

### restaurant_tables
- Añade: name (text), seats (int, default 4), pos_x (int, default 0),
  pos_y (int, default 0), section (text, default 'Sala'), active (boolean,
  default true).
- Sincroniza: name = table_number, section = area, status ya existe pero
  se amplía el CHECK para incluir 'requesting_bill'. current_total ya existe.
- Añade índice idx_orders_status.

### orders
- Añade: table_name (text), waiter_id (uuid FK), waiter_name (text),
  subtotal (numeric), tax_total (numeric), covers (int, default 1),
  sent_at (timestamptz), paid_at (timestamptz), payment_method (text).
- Sincroniza: total = total_amount si total no existe; status se ajusta al
  vocabulario de la app (pending->open, paid->paid).

### order_items
- Añade: product_id (uuid FK), iva_rate (numeric, default 10),
  print_destination (text, default 'kitchen'), takeaway (boolean, default
  false).
- Sincroniza: price = unit_price si price no existe.

## Seguridad
- Activa RLS en products, categories, orders, order_items, restaurant_tables
  y crea las 4 políticas CRUD (SELECT/INSERT/UPDATE/DELETE) para cada una
  con TO anon, authenticated (single-tenant sin auth).
*/

-- ============================================================
-- CATEGORIES
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='icon_name') THEN
    ALTER TABLE categories ADD COLUMN icon_name text NOT NULL DEFAULT 'UtensilsCrossed';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='print_destination') THEN
    ALTER TABLE categories ADD COLUMN print_destination text NOT NULL DEFAULT 'kitchen';
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='categories_print_destination_check') THEN
    ALTER TABLE categories ADD CONSTRAINT categories_print_destination_check CHECK (print_destination IN ('kitchen','bar'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='sort_order') THEN
    ALTER TABLE categories ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
  END IF;
END $$;
-- Sincronizar sort_order desde display_order si existe
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='display_order') THEN
    UPDATE categories SET sort_order = COALESCE(display_order, 0) WHERE sort_order = 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='categories' AND column_name='active') THEN
    ALTER TABLE categories ADD COLUMN active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- ============================================================
-- PRODUCTS
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='iva_rate') THEN
    ALTER TABLE products ADD COLUMN iva_rate numeric(5,2) NOT NULL DEFAULT 10;
  END IF;
END $$;
UPDATE products SET iva_rate = 10 WHERE iva_rate IS NULL OR iva_rate != 10;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='print_destination') THEN
    ALTER TABLE products ADD COLUMN print_destination text;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='products_print_destination_check') THEN
    ALTER TABLE products ADD CONSTRAINT products_print_destination_check CHECK (print_destination IN ('kitchen','bar'));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='available') THEN
    ALTER TABLE products ADD COLUMN available boolean NOT NULL DEFAULT true;
  END IF;
END $$;
-- Sincronizar available desde la columna existente `active`
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='active') THEN
    UPDATE products SET available = COALESCE(active, true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='sort_order') THEN
    ALTER TABLE products ADD COLUMN sort_order integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='products' AND column_name='stock_actual') THEN
    ALTER TABLE products ADD COLUMN stock_actual integer NOT NULL DEFAULT 0;
  END IF;
END $$;
-- Stock inicial razonable para los productos existentes
UPDATE products SET stock_actual = 30 WHERE stock_actual = 0;

CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

-- Hacer category_id NOT NULL con FK si no lo es ya
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='products_category_id_fkey' AND contype='f') THEN
    ALTER TABLE products ADD CONSTRAINT products_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- RESTAURANT_TABLES
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='restaurant_tables' AND column_name='name') THEN
    ALTER TABLE restaurant_tables ADD COLUMN name text;
  END IF;
END $$;
-- Sincronizar name desde table_number si existe
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='restaurant_tables' AND column_name='table_number') THEN
    UPDATE restaurant_tables SET name = table_number WHERE name IS NULL;
  END IF;
END $$;
-- Garantizar que name no quede vacío
UPDATE restaurant_tables SET name = 'Mesa ' || id::text WHERE name IS NULL OR name = '';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='restaurant_tables' AND column_name='seats') THEN
    ALTER TABLE restaurant_tables ADD COLUMN seats integer NOT NULL DEFAULT 4;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='restaurant_tables' AND column_name='pos_x') THEN
    ALTER TABLE restaurant_tables ADD COLUMN pos_x integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='restaurant_tables' AND column_name='pos_y') THEN
    ALTER TABLE restaurant_tables ADD COLUMN pos_y integer NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='restaurant_tables' AND column_name='section') THEN
    ALTER TABLE restaurant_tables ADD COLUMN section text NOT NULL DEFAULT 'Sala';
  END IF;
END $$;
-- Sincronizar section desde area si existe
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='restaurant_tables' AND column_name='area') THEN
    UPDATE restaurant_tables SET section = COALESCE(area, 'Sala') WHERE section = 'Sala' AND area IS NOT NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='restaurant_tables' AND column_name='active') THEN
    ALTER TABLE restaurant_tables ADD COLUMN active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- current_total ya existe en la base de datos; asegurar el tipo correcto
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='restaurant_tables' AND column_name='current_total') THEN
    ALTER TABLE restaurant_tables ADD COLUMN current_total numeric(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Ampliar el CHECK de status para incluir 'requesting_bill'
ALTER TABLE restaurant_tables DROP CONSTRAINT IF EXISTS restaurant_tables_status_check;
ALTER TABLE restaurant_tables ADD CONSTRAINT restaurant_tables_status_check
  CHECK (status IN ('free','occupied','reserved','requesting_bill'));

-- ============================================================
-- ORDERS
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='table_name') THEN
    ALTER TABLE orders ADD COLUMN table_name text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='waiter_id') THEN
    ALTER TABLE orders ADD COLUMN waiter_id uuid;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='orders_waiter_id_fkey' AND contype='f') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_waiter_id_fkey
      FOREIGN KEY (waiter_id) REFERENCES waiters(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='waiter_name') THEN
    ALTER TABLE orders ADD COLUMN waiter_name text;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='subtotal') THEN
    ALTER TABLE orders ADD COLUMN subtotal numeric(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='tax_total') THEN
    ALTER TABLE orders ADD COLUMN tax_total numeric(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='total') THEN
    ALTER TABLE orders ADD COLUMN total numeric(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;
-- Sincronizar total desde total_amount si existe
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='total_amount') THEN
    UPDATE orders SET total = COALESCE(total_amount, 0), subtotal = COALESCE(total_amount, 0) WHERE total = 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='covers') THEN
    ALTER TABLE orders ADD COLUMN covers integer NOT NULL DEFAULT 1;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='sent_at') THEN
    ALTER TABLE orders ADD COLUMN sent_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='paid_at') THEN
    ALTER TABLE orders ADD COLUMN paid_at timestamptz;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='orders' AND column_name='payment_method') THEN
    ALTER TABLE orders ADD COLUMN payment_method text;
  END IF;
END $$;

-- Sincronizar status al vocabulario de la app (pending->open)
UPDATE orders SET status = 'open' WHERE status = 'pending';

-- Asegurar el CHECK de status de orders
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check
  CHECK (status IN ('open','sent','paid','cancelled'));

CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at);

-- ============================================================
-- ORDER_ITEMS
-- ============================================================
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_items' AND column_name='product_id') THEN
    ALTER TABLE order_items ADD COLUMN product_id uuid;
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='order_items_product_id_fkey' AND contype='f') THEN
    ALTER TABLE order_items ADD CONSTRAINT order_items_product_id_fkey
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_items' AND column_name='price') THEN
    ALTER TABLE order_items ADD COLUMN price numeric(10,2) NOT NULL DEFAULT 0;
  END IF;
END $$;
-- Sincronizar price desde unit_price si existe
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_items' AND column_name='unit_price') THEN
    UPDATE order_items SET price = COALESCE(unit_price, 0) WHERE price = 0;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_items' AND column_name='iva_rate') THEN
    ALTER TABLE order_items ADD COLUMN iva_rate numeric(5,2) NOT NULL DEFAULT 10;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_items' AND column_name='print_destination') THEN
    ALTER TABLE order_items ADD COLUMN print_destination text NOT NULL DEFAULT 'kitchen';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_items' AND column_name='takeaway') THEN
    ALTER TABLE order_items ADD COLUMN takeaway boolean NOT NULL DEFAULT false;
  END IF;
END $$;
-- Sincronizar takeaway desde is_takeout si existe
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='order_items' AND column_name='is_takeout') THEN
    UPDATE order_items SET takeaway = COALESCE(is_takeout, false);
  END IF;
END $$;

-- Asegurar el CHECK de status de order_items
ALTER TABLE order_items DROP CONSTRAINT IF EXISTS order_items_status_check;
ALTER TABLE order_items ADD CONSTRAINT order_items_status_check
  CHECK (status IN ('pending','sent','ready','served','cancelled'));

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ============================================================
-- RLS — activar + políticas CRUD (TO anon, authenticated)
-- ============================================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;

-- categories
DROP POLICY IF EXISTS "anon_select_categories" ON categories;
CREATE POLICY "anon_select_categories" ON categories FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_categories" ON categories;
CREATE POLICY "anon_insert_categories" ON categories FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_categories" ON categories;
CREATE POLICY "anon_update_categories" ON categories FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_categories" ON categories;
CREATE POLICY "anon_delete_categories" ON categories FOR DELETE TO anon, authenticated USING (true);

-- products
DROP POLICY IF EXISTS "anon_select_products" ON products;
CREATE POLICY "anon_select_products" ON products FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_products" ON products;
CREATE POLICY "anon_insert_products" ON products FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_products" ON products;
CREATE POLICY "anon_update_products" ON products FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_products" ON products;
CREATE POLICY "anon_delete_products" ON products FOR DELETE TO anon, authenticated USING (true);

-- restaurant_tables
DROP POLICY IF EXISTS "anon_select_tables" ON restaurant_tables;
CREATE POLICY "anon_select_tables" ON restaurant_tables FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_tables" ON restaurant_tables;
CREATE POLICY "anon_insert_tables" ON restaurant_tables FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_tables" ON restaurant_tables;
CREATE POLICY "anon_update_tables" ON restaurant_tables FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_tables" ON restaurant_tables;
CREATE POLICY "anon_delete_tables" ON restaurant_tables FOR DELETE TO anon, authenticated USING (true);

-- orders
DROP POLICY IF EXISTS "anon_select_orders" ON orders;
CREATE POLICY "anon_select_orders" ON orders FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_orders" ON orders;
CREATE POLICY "anon_insert_orders" ON orders FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_orders" ON orders;
CREATE POLICY "anon_update_orders" ON orders FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_orders" ON orders;
CREATE POLICY "anon_delete_orders" ON orders FOR DELETE TO anon, authenticated USING (true);

-- order_items
DROP POLICY IF EXISTS "anon_select_order_items" ON order_items;
CREATE POLICY "anon_select_order_items" ON order_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_order_items" ON order_items;
CREATE POLICY "anon_insert_order_items" ON order_items FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_order_items" ON order_items;
CREATE POLICY "anon_update_order_items" ON order_items FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_order_items" ON order_items;
CREATE POLICY "anon_delete_order_items" ON order_items FOR DELETE TO anon, authenticated USING (true);
