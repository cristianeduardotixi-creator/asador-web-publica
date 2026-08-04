/*
# Clientes fiscales + categoría Envases/Tapers + enlace facturación

1. NUEVA TABLA: customers
   - Almacena datos fiscales de clientes reutilizables para facturas nominativas.
   - id (uuid PK), tax_id (NIF/CIF/NIE único e indexado), name, address, postal_code,
     city, phone, email, created_at.
   - RLS habilitada con CRUD completo para anon + authenticated (app sin login Supabase).

2. NUEVAS COLUMNAS
   - orders.customer_id (uuid, nullable, FK a customers.id ON DELETE SET NULL)
   - tickets.customer_id (uuid, nullable, FK a customers.id ON DELETE SET NULL)
   - Ambas permiten vincular una venta/ticket a un cliente registrado.

3. NUEVA CATEGORÍA: "Envases / Tapers"
   - Destino de impresión: bar (caja/barra).
   - Dos productos sueltos para venta independiente:
     * "Taper de aluminio" — 1,00 €
     * "Taper de plástico" — 1,00 €
   - IVA 10 %, stock alto por defecto, disponibles.

4. SEGURIDAD
   - RLS en customers con 4 políticas (SELECT/INSERT/UPDATE/DELETE) para anon, authenticated.
   - No se modifican políticas existentes de orders ni tickets.
*/

-- =========================================================
-- 1. TABLA customers
-- =========================================================
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_id text UNIQUE,
  name text NOT NULL,
  address text,
  postal_code text,
  city text,
  phone text,
  email text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_customers_tax_id ON customers (tax_id);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers (name);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_customers" ON customers;
CREATE POLICY "anon_select_customers" ON customers FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_customers" ON customers;
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_customers" ON customers;
CREATE POLICY "anon_update_customers" ON customers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_customers" ON customers;
CREATE POLICY "anon_delete_customers" ON customers FOR DELETE
  TO anon, authenticated USING (true);

-- =========================================================
-- 2. customer_id en orders y tickets
-- =========================================================
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id uuid
  REFERENCES customers(id) ON DELETE SET NULL;

ALTER TABLE tickets ADD COLUMN IF NOT EXISTS customer_id uuid
  REFERENCES customers(id) ON DELETE SET NULL;

-- =========================================================
-- 3. Categoría "Envases / Tapers" + productos
-- =========================================================
INSERT INTO categories (name, icon_name, color, print_destination, sort_order, active)
SELECT 'Envases / Tapers', 'Package', 'stone', 'bar', 90, true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Envases / Tapers');

INSERT INTO products (category_id, name, description, price, iva_rate, print_destination, available, sort_order, stock_actual)
SELECT c.id, 'Taper de aluminio', 'Envase de aluminio para takeaway', 1.00, 10, 'bar', true, 1, 999
FROM categories c
WHERE c.name = 'Envases / Tapers'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name = 'Taper de aluminio' AND p.category_id = c.id);

INSERT INTO products (category_id, name, description, price, iva_rate, print_destination, available, sort_order, stock_actual)
SELECT c.id, 'Taper de plástico', 'Envase de plástico para takeaway', 1.00, 10, 'bar', true, 2, 999
FROM categories c
WHERE c.name = 'Envases / Tapers'
  AND NOT EXISTS (SELECT 1 FROM products p WHERE p.name = 'Taper de plástico' AND p.category_id = c.id);
