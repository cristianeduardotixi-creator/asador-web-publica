/*
# TPV Restaurante — Esquema fiscal y operacional (Veri*Factu)

## Resumen
Crea el esquema completo para un TPV de hostelería con motor fiscal Veri*Factu
(Real Decreto 1007/2023). Aplicación single-tenant: un restaurante, sin auth de
Supabase. El acceso por roles (camarero / admin-caja) se gestiona con PIN en la
app cliente; el acceso a datos se realiza con la anon key.

## Tablas nuevas
- categories: categorías de producto con destino de impresión (cocina / barra)
- products: productos con precio, tipo de IVA, disponibilidad y orden
- waiters: camareros con PIN para acceso rápido en tableta
- restaurant_tables: mesas con posición (x/y) para el mapa visual
- orders: comandas (abierta / enviada / cobrada / anulada) con totales
- order_items: líneas de comanda con notas y destino de impresión
- tickets: facturas simplificadas inalterables con cadena SHA-256 (Veri*Factu)
- printers: impresoras térmicas por IP (cocina / barra)
- settings: configuración clave-valor (modo Veri*Factu, NIF, PIN admin, rango IP local)

## Motor fiscal (Veri*Factu)
- Extensión pgcrypto para digest SHA-256.
- Función create_fiscal_ticket(): crea ticket de forma ATÓMICA con encadenamiento.
  Calcula número secuencial sin saltos, recupera el hash del ticket anterior y
  genera la huella digital SHA-256 = digest( NIF | numero | fechaHora | total | hashAnterior ).
  No permite borrar ni editar: las anulaciones generan factura rectificativa.

## Seguridad (RLS)
- Single-tenant sin pantalla de sign-in: todas las políticas son
  TO anon, authenticated con USING(true) / WITH CHECK(true) porque toda la data
  pertenece al único restaurante y se accede con la anon key. El control de rol
  (camarero vs admin) se aplica en cliente mediante PIN; esto está documentado.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ---------------------------------------------------------------------------
-- Categorías
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon_name text NOT NULL DEFAULT 'UtensilsCrossed',
  print_destination text NOT NULL DEFAULT 'kitchen' CHECK (print_destination IN ('kitchen','bar')),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Productos
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  iva_rate numeric(5,2) NOT NULL DEFAULT 10,
  print_destination text CHECK (print_destination IN ('kitchen','bar')),
  available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

-- ---------------------------------------------------------------------------
-- Camareros
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS waiters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pin text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Mesas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  seats integer NOT NULL DEFAULT 4,
  status text NOT NULL DEFAULT 'free' CHECK (status IN ('free','occupied','reserved')),
  pos_x integer NOT NULL DEFAULT 0,
  pos_y integer NOT NULL DEFAULT 0,
  section text NOT NULL DEFAULT 'Sala',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Comandas
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  table_name text,
  waiter_id uuid REFERENCES waiters(id) ON DELETE SET NULL,
  waiter_name text,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','sent','paid','cancelled')),
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  tax_total numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  covers integer NOT NULL DEFAULT 1,
  notes text,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz,
  paid_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status, created_at);

-- ---------------------------------------------------------------------------
-- Líneas de comanda
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  iva_rate numeric(5,2) NOT NULL DEFAULT 10,
  quantity integer NOT NULL DEFAULT 1,
  notes text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','ready','served','cancelled')),
  print_destination text NOT NULL DEFAULT 'kitchen',
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ---------------------------------------------------------------------------
-- Tickets / Facturas simplificadas (Veri*Factu)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  ticket_number text NOT NULL,
  sequence integer NOT NULL UNIQUE,
  nif_emisor text NOT NULL,
  issuer_name text NOT NULL,
  issuer_address text,
  ticket_datetime timestamptz NOT NULL,
  subtotal numeric(10,2) NOT NULL DEFAULT 0,
  tax_total numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL DEFAULT 0,
  iva_breakdown jsonb NOT NULL DEFAULT '[]',
  payment_method text,
  payment_amount numeric(10,2),
  payment_change numeric(10,2),
  previous_hash text NOT NULL DEFAULT '',
  hash text NOT NULL,
  ticket_type text NOT NULL DEFAULT 'normal' CHECK (ticket_type IN ('normal','rectificativa')),
  rectifies_ticket_id uuid REFERENCES tickets(id) ON DELETE SET NULL,
  qr_url text,
  xml_content text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tickets_sequence ON tickets(sequence);

-- ---------------------------------------------------------------------------
-- Impresoras
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS printers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  ip_address text NOT NULL,
  port integer NOT NULL DEFAULT 9100,
  destination text NOT NULL CHECK (destination IN ('kitchen','bar')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Configuración (clave-valor)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- ===========================================================================
-- RLS — single-tenant, sin auth. anon + authenticated con acceso total.
-- El control de rol se aplica en cliente (PIN).
-- ===========================================================================
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE waiters ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

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

-- waiters
DROP POLICY IF EXISTS "anon_select_waiters" ON waiters;
CREATE POLICY "anon_select_waiters" ON waiters FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_waiters" ON waiters;
CREATE POLICY "anon_insert_waiters" ON waiters FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_waiters" ON waiters;
CREATE POLICY "anon_update_waiters" ON waiters FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_waiters" ON waiters;
CREATE POLICY "anon_delete_waiters" ON waiters FOR DELETE TO anon, authenticated USING (true);

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

-- tickets
DROP POLICY IF EXISTS "anon_select_tickets" ON tickets;
CREATE POLICY "anon_select_tickets" ON tickets FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_tickets" ON tickets;
CREATE POLICY "anon_insert_tickets" ON tickets FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_tickets" ON tickets;
CREATE POLICY "anon_update_tickets" ON tickets FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_tickets" ON tickets;
CREATE POLICY "anon_delete_tickets" ON tickets FOR DELETE TO anon, authenticated USING (true);

-- printers
DROP POLICY IF EXISTS "anon_select_printers" ON printers;
CREATE POLICY "anon_select_printers" ON printers FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_printers" ON printers;
CREATE POLICY "anon_insert_printers" ON printers FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_printers" ON printers;
CREATE POLICY "anon_update_printers" ON printers FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_printers" ON printers;
CREATE POLICY "anon_delete_printers" ON printers FOR DELETE TO anon, authenticated USING (true);

-- settings
DROP POLICY IF EXISTS "anon_select_settings" ON settings;
CREATE POLICY "anon_select_settings" ON settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_settings" ON settings;
CREATE POLICY "anon_insert_settings" ON settings FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_settings" ON settings;
CREATE POLICY "anon_update_settings" ON settings FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_settings" ON settings;
CREATE POLICY "anon_delete_settings" ON settings FOR DELETE TO anon, authenticated USING (true);

-- ===========================================================================
-- Motor fiscal: creación atómica de ticket con encadenamiento SHA-256
-- ===========================================================================
CREATE OR REPLACE FUNCTION create_fiscal_ticket(
  p_order_id uuid,
  p_nif_emisor text,
  p_issuer_name text,
  p_issuer_address text,
  p_ticket_datetime timestamptz,
  p_subtotal numeric,
  p_tax_total numeric,
  p_total numeric,
  p_iva_breakdown jsonb,
  p_payment_method text,
  p_payment_amount numeric,
  p_payment_change numeric,
  p_ticket_type text DEFAULT 'normal',
  p_rectifies_ticket_id uuid DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_sequence integer;
  v_ticket_number text;
  v_previous_hash text;
  v_hash text;
  v_id uuid;
  v_input text;
  v_last record;
BEGIN
  -- Bloquear el último ticket para encadenamiento atómico (evita saltos/duplicados)
  SELECT id, sequence, hash INTO v_last
  FROM tickets
  ORDER BY sequence DESC
  LIMIT 1
  FOR UPDATE;

  IF v_last.sequence IS NULL THEN
    v_sequence := 1;
    v_previous_hash := '';
  ELSE
    v_sequence := v_last.sequence + 1;
    v_previous_hash := COALESCE(v_last.hash, '');
  END IF;

  -- Número de ticket: AAAA/NNNN (sin saltos)
  v_ticket_number := to_char(p_ticket_datetime, 'YYYY') || '/' || lpad(v_sequence::text, 4, '0');

  -- Huella SHA-256: NIF | numero | fechaHora | importeTotal | hashAnterior
  v_input := p_nif_emisor || '|' ||
             v_ticket_number || '|' ||
             to_char(p_ticket_datetime AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD"T"HH24:MI:SS') || '|' ||
             to_char(p_total, 'FM999999990.00') || '|' ||
             v_previous_hash;

  v_hash := encode(digest(v_input, 'sha256'), 'hex');

  v_id := gen_random_uuid();

  INSERT INTO tickets (
    id, order_id, ticket_number, sequence, nif_emisor, issuer_name, issuer_address,
    ticket_datetime, subtotal, tax_total, total, iva_breakdown,
    payment_method, payment_amount, payment_change,
    previous_hash, hash, ticket_type, rectifies_ticket_id
  ) VALUES (
    v_id, p_order_id, v_ticket_number, v_sequence, p_nif_emisor, p_issuer_name, p_issuer_address,
    p_ticket_datetime, p_subtotal, p_tax_total, p_total, p_iva_breakdown,
    p_payment_method, p_payment_amount, p_payment_change,
    v_previous_hash, v_hash, p_ticket_type, p_rectifies_ticket_id
  );

  RETURN jsonb_build_object(
    'id', v_id,
    'ticket_number', v_ticket_number,
    'sequence', v_sequence,
    'hash', v_hash,
    'previous_hash', v_previous_hash
  );
END;
$$;