-- ============================================================================
-- TPV RESTAURANTE — ESQUEMA COMPLETO PARA SUPABASE EXTERNO
-- ============================================================================
-- Ejecutar en: Supabase SQL Editor (vhaxjtxzzgfiqfltzonl.supabase.co)
-- Este script crea TODAS las tablas, políticas RLS, funciones, datos iniciales
-- y activa Realtime en una sola pasada. Es idempotente (se puede re-ejecutar).
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===========================================================================
-- 1. TABLAS
-- ===========================================================================

CREATE TABLE IF NOT EXISTS categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  icon_name text NOT NULL DEFAULT 'UtensilsCrossed',
  print_destination text NOT NULL DEFAULT 'kitchen' CHECK (print_destination IN ('kitchen','bar')),
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  name text NOT NULL,
  price numeric(10,2) NOT NULL DEFAULT 0,
  iva_rate numeric(5,2) NOT NULL DEFAULT 10,
  print_destination text CHECK (print_destination IN ('kitchen','bar')),
  available boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  stock_actual integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);

CREATE TABLE IF NOT EXISTS waiters (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  pin text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS restaurant_tables (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  seats integer NOT NULL DEFAULT 4,
  status text NOT NULL DEFAULT 'free' CHECK (status IN ('free','occupied','reserved','requesting_bill')),
  pos_x integer NOT NULL DEFAULT 0,
  pos_y integer NOT NULL DEFAULT 0,
  section text NOT NULL DEFAULT 'Sala',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

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
  takeaway boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
COMMENT ON COLUMN order_items.takeaway IS 'true = Para Llevar (+1 EUR supplement included in price)';

CREATE TABLE IF NOT EXISTS tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid REFERENCES orders(id) ON DELETE SET NULL,
  ticket_number text NOT NULL,
  sequence integer NOT NULL UNIQUE,
  nif_emisor text NOT NULL,
  issuer_name text NOT NULL,
  issuer_address text,
  commercial_name text,
  phone text,
  email text,
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
  rectifies_ticket_number text,
  serie text DEFAULT 'T',
  voided boolean DEFAULT false,
  is_invoice boolean NOT NULL DEFAULT false,
  recipient_name text,
  recipient_nif text,
  recipient_address text,
  recipient_phone text,
  recipient_email text,
  qr_url text,
  xml_content text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tickets_sequence ON tickets(sequence);

CREATE TABLE IF NOT EXISTS printers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  ip_address text NOT NULL,
  port integer NOT NULL DEFAULT 9100,
  destination text NOT NULL CHECK (destination IN ('kitchen','bar')),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- ===========================================================================
-- 2. RLS — single-tenant sin auth, acceso total via anon key
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

-- Helper: crea las 4 políticas CRUD para una tabla
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['categories','products','waiters','restaurant_tables','orders','order_items','tickets','printers','settings'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'anon_select_' || t, t);
    EXECUTE format('CREATE POLICY %I ON %I FOR SELECT TO anon, authenticated USING (true)', 'anon_select_' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'anon_insert_' || t, t);
    EXECUTE format('CREATE POLICY %I ON %I FOR INSERT TO anon, authenticated WITH CHECK (true)', 'anon_insert_' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'anon_update_' || t, t);
    EXECUTE format('CREATE POLICY %I ON %I FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true)', 'anon_update_' || t, t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I', 'anon_delete_' || t, t);
    EXECUTE format('CREATE POLICY %I ON %I FOR DELETE TO anon, authenticated USING (true)', 'anon_delete_' || t, t);
  END LOOP;
END $$;

-- ===========================================================================
-- 3. STORAGE — bucket logos + políticas
-- ===========================================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "logos_public_read" ON storage.objects;
CREATE POLICY "logos_public_read" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'logos');
DROP POLICY IF EXISTS "logos_write" ON storage.objects;
CREATE POLICY "logos_write" ON storage.objects FOR INSERT
  TO anon, authenticated WITH CHECK (bucket_id = 'logos');
DROP POLICY IF EXISTS "logos_update" ON storage.objects;
CREATE POLICY "logos_update" ON storage.objects FOR UPDATE
  TO anon, authenticated USING (bucket_id = 'logos') WITH CHECK (bucket_id = 'logos');
DROP POLICY IF EXISTS "logos_delete" ON storage.objects;
CREATE POLICY "logos_delete" ON storage.objects FOR DELETE
  TO anon, authenticated USING (bucket_id = 'logos');

-- ===========================================================================
-- 4. FUNCIONES — stock y motor fiscal Veri*Factu
-- ===========================================================================

CREATE OR REPLACE FUNCTION increment_stock(p_product_id uuid, p_qty integer)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_current integer;
BEGIN
  SELECT stock_actual INTO v_current FROM products WHERE id = p_product_id FOR UPDATE;
  IF v_current IS NULL THEN RAISE EXCEPTION 'Producto no encontrado: %', p_product_id; END IF;
  UPDATE products SET stock_actual = v_current + p_qty WHERE id = p_product_id;
END $$;

CREATE OR REPLACE FUNCTION decrement_stock(p_product_id uuid, p_qty integer)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE v_current integer;
BEGIN
  SELECT stock_actual INTO v_current FROM products WHERE id = p_product_id FOR UPDATE;
  IF v_current IS NULL THEN RAISE EXCEPTION 'Producto no encontrado: %', p_product_id; END IF;
  UPDATE products SET stock_actual = GREATEST(0, v_current - p_qty) WHERE id = p_product_id;
END $$;

CREATE OR REPLACE FUNCTION create_fiscal_ticket(
  p_order_id uuid, p_nif_emisor text, p_issuer_name text, p_issuer_address text,
  p_ticket_datetime timestamptz, p_subtotal numeric, p_tax_total numeric, p_total numeric,
  p_iva_breakdown jsonb, p_payment_method text, p_payment_amount numeric, p_payment_change numeric,
  p_commercial_name text DEFAULT NULL, p_phone text DEFAULT NULL, p_email text DEFAULT NULL,
  p_serie text DEFAULT 'T', p_ticket_type text DEFAULT 'normal',
  p_rectifies_ticket_id uuid DEFAULT NULL, p_rectifies_ticket_number text DEFAULT NULL,
  p_is_invoice boolean DEFAULT false, p_recipient_name text DEFAULT NULL,
  p_recipient_nif text DEFAULT NULL, p_recipient_address text DEFAULT NULL,
  p_recipient_phone text DEFAULT NULL, p_recipient_email text DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_year integer; v_sequence integer; v_ticket_number text;
  v_previous_hash text; v_hash text; v_id uuid; v_input text; v_last record;
BEGIN
  v_year := extract(year FROM p_ticket_datetime);
  SELECT id, sequence, hash INTO v_last FROM tickets
  WHERE serie = p_serie AND extract(year FROM ticket_datetime) = v_year
  ORDER BY sequence DESC LIMIT 1 FOR UPDATE;
  IF v_last.sequence IS NULL THEN v_sequence := 1; v_previous_hash := '';
  ELSE v_sequence := v_last.sequence + 1; v_previous_hash := COALESCE(v_last.hash, ''); END IF;
  v_ticket_number := p_serie || '-' || v_year::text || '-' || lpad(v_sequence::text, 5, '0');
  v_input := p_nif_emisor || '|' || v_ticket_number || '|' ||
    to_char(p_ticket_datetime AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD"T"HH24:MI:SS') || '|' ||
    to_char(p_total, 'FM999999990.00') || '|' || v_previous_hash;
  v_hash := encode(digest(v_input, 'sha256'), 'hex');
  v_id := gen_random_uuid();
  INSERT INTO tickets (
    id, order_id, ticket_number, sequence, nif_emisor, issuer_name, issuer_address,
    commercial_name, phone, email, ticket_datetime, subtotal, tax_total, total, iva_breakdown,
    payment_method, payment_amount, payment_change, previous_hash, hash, ticket_type,
    rectifies_ticket_id, rectifies_ticket_number, serie, voided,
    is_invoice, recipient_name, recipient_nif, recipient_address, recipient_phone, recipient_email
  ) VALUES (
    v_id, p_order_id, v_ticket_number, v_sequence, p_nif_emisor, p_issuer_name, p_issuer_address,
    p_commercial_name, p_phone, p_email, p_ticket_datetime, p_subtotal, p_tax_total, p_total, p_iva_breakdown,
    p_payment_method, p_payment_amount, p_payment_change, v_previous_hash, v_hash, p_ticket_type,
    p_rectifies_ticket_id, p_rectifies_ticket_number, p_serie, false,
    p_is_invoice, p_recipient_name, p_recipient_nif, p_recipient_address, p_recipient_phone, p_recipient_email
  );
  RETURN jsonb_build_object('id', v_id, 'ticket_number', v_ticket_number, 'sequence', v_sequence,
    'hash', v_hash, 'previous_hash', v_previous_hash, 'serie', p_serie);
END $$;

CREATE OR REPLACE FUNCTION void_ticket(
  p_original_ticket_id uuid, p_reason text DEFAULT 'Anulación por error de cobro'
) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE
  v_original record; v_rect record; v_year integer; v_now timestamptz;
BEGIN
  v_now := now(); v_year := extract(year FROM v_now);
  SELECT * INTO v_original FROM tickets WHERE id = p_original_ticket_id FOR UPDATE;
  IF v_original IS NULL THEN RAISE EXCEPTION 'Ticket no encontrado'; END IF;
  IF v_original.voided = true THEN RAISE EXCEPTION 'Este ticket ya está anulado'; END IF;
  IF v_original.ticket_type = 'rectificativa' THEN RAISE EXCEPTION 'No se puede anular una factura rectificativa'; END IF;
  SELECT * INTO v_rect FROM create_fiscal_ticket(
    v_original.order_id, v_original.nif_emisor, v_original.issuer_name, v_original.issuer_address,
    v_now, -v_original.subtotal, -v_original.tax_total, -v_original.total, v_original.iva_breakdown,
    v_original.payment_method, -COALESCE(v_original.payment_amount, 0), -COALESCE(v_original.payment_change, 0),
    v_original.commercial_name, v_original.phone, v_original.email,
    'R', 'rectificativa', v_original.id, v_original.ticket_number
  );
  UPDATE tickets SET voided = true WHERE id = p_original_ticket_id;
  IF v_original.order_id IS NOT NULL THEN
    UPDATE order_items SET status = 'cancelled' WHERE order_id = v_original.order_id AND status = 'sent';
    UPDATE products p SET stock_actual = p.stock_actual + sub.qty
    FROM (SELECT product_id, SUM(quantity) AS qty FROM order_items WHERE order_id = v_original.order_id GROUP BY product_id) sub
    WHERE p.id = sub.product_id;
    UPDATE orders SET status = 'sent', paid_at = NULL WHERE id = v_original.order_id;
  END IF;
  RETURN jsonb_build_object('rectificativa_id', v_rect.id, 'rectificativa_number', v_rect.ticket_number,
    'rectificativa_hash', v_rect.hash, 'original_number', v_original.ticket_number);
END $$;

-- ===========================================================================
-- 5. DATOS INICIALES — Categorías (incluye Envases / Táperes)
-- ===========================================================================

INSERT INTO categories (id, name, icon_name, print_destination, sort_order, active) VALUES
  ('f6110efd-c6ba-4f0e-89a3-1c82c78ee84b', 'Parrilladas', 'Flame', 'kitchen', 1, true),
  ('6c52c9a5-939e-4da8-ba44-a946bd6f8355', 'Platos a la carta', 'UtensilsCrossed', 'kitchen', 2, true),
  ('41f895be-20c3-41b6-aac7-a9f7a6494ffb', 'Entrantes', 'Soup', 'kitchen', 3, true),
  ('30bbf937-ca54-48f2-abb2-718c073b7cd2', 'Sopas', 'Soup', 'kitchen', 4, true),
  ('fb18b93e-f3f5-4278-8126-52b4841d869a', 'Bebidas', 'CupSoda', 'bar', 5, true),
  ('6ccec4ab-266b-4a11-956e-ea50ca89e2cd', 'Cafés y tés', 'Coffee', 'bar', 6, true),
  ('acbc10a5-6203-4517-accd-65c26136583e', 'Postres', 'Cake', 'kitchen', 7, true),
  ('e8a1c2b3-4d5e-6f7a-8b9c-0d1e2f3a4b5c', 'Envases / Táperes', 'Package', 'bar', 8, true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, icon_name = EXCLUDED.icon_name,
  print_destination = EXCLUDED.print_destination, sort_order = EXCLUDED.sort_order, active = EXCLUDED.active;

-- ===========================================================================
-- 6. DATOS INICIALES — Productos
-- ===========================================================================

INSERT INTO products (id, category_id, name, price, iva_rate, print_destination, available, sort_order, stock_actual) VALUES
  -- Parrilladas
  ('b4832b8f-d097-4d7a-b886-f1fd60d0ef8e', 'f6110efd-c6ba-4f0e-89a3-1c82c78ee84b', 'Entrecot de ternera 400g', 18.50, 10, 'kitchen', false, 1, 14),
  ('0e88e015-747e-4ef4-844a-171a5e0fe4c2', 'f6110efd-c6ba-4f0e-89a3-1c82c78ee84b', 'Secreto ibérico', 16.90, 10, 'kitchen', true, 2, 22),
  ('8802a935-2145-45d0-80f0-bc5f903fba3d', 'f6110efd-c6ba-4f0e-89a3-1c82c78ee84b', 'Pluma ibérica', 17.50, 10, 'kitchen', true, 3, 24),
  ('a0b21ead-879b-4307-8c97-12e01531053b', 'f6110efd-c6ba-4f0e-89a3-1c82c78ee84b', 'Churrasco de ternera', 15.90, 10, 'kitchen', true, 4, 29),
  -- Platos a la carta
  ('7502df69-a44a-4c74-b509-6e25573d4ed3', '6c52c9a5-939e-4da8-ba44-a946bd6f8355', 'Entrecote 400g', 18.50, 10, 'kitchen', true, 1, 20),
  ('436ada93-f019-4969-94ee-3bf2ffb6b0df', '6c52c9a5-939e-4da8-ba44-a946bd6f8355', 'Solomillo 250g', 22.00, 10, 'kitchen', true, 2, 15),
  ('b66bcdd9-104c-4256-8df7-3ba9eaa38c95', '6c52c9a5-939e-4da8-ba44-a946bd6f8355', 'Pollo asado', 12.50, 10, 'kitchen', true, 3, 25),
  ('28f7823f-cb43-43fb-a7f5-4dedcda18b8e', '6c52c9a5-939e-4da8-ba44-a946bd6f8355', 'Merluza a la plancha', 16.00, 10, 'kitchen', true, 4, 10),
  ('135aec6e-46a3-45f7-83a5-5437fedcbad2', '6c52c9a5-939e-4da8-ba44-a946bd6f8355', 'Risotto de setas', 11.00, 10, 'kitchen', true, 5, 18),
  ('6b4c2a83-90bf-47b1-9468-a39504139bbd', '6c52c9a5-939e-4da8-ba44-a946bd6f8355', 'Ensalada mixta', 7.50, 10, 'kitchen', true, 6, 30),
  -- Entrantes
  ('c69406ca-7cbe-4594-b214-c924f39ff771', '41f895be-20c3-41b6-aac7-a9f7a6494ffb', 'Croquetas caseras (6 ud)', 7.50, 10, 'kitchen', false, 1, 30),
  ('4e332579-56e5-4609-b9f5-8fa2e2f61b30', '41f895be-20c3-41b6-aac7-a9f7a6494ffb', 'Tabla de jamón ibérico', 14.00, 10, 'kitchen', true, 2, 30),
  ('a551c51b-b56d-429b-a8c6-b4bc52becf79', '41f895be-20c3-41b6-aac7-a9f7a6494ffb', 'Patatas bravas', 8.50, 10, 'kitchen', true, 3, 25),
  ('b589fc1b-af39-489e-9f53-5f0c935d5db4', '41f895be-20c3-41b6-aac7-a9f7a6494ffb', 'Tabla de quesos', 12.00, 10, 'kitchen', true, 4, 30),
  -- Sopas
  ('6726ac5c-a563-468a-9a57-97fff9c32a06', '30bbf937-ca54-48f2-abb2-718c073b7cd2', 'Sopa de marisco', 8.50, 10, 'kitchen', true, 1, 20),
  ('9baec018-e374-478e-bcca-f9ec6d3e623c', '30bbf937-ca54-48f2-abb2-718c073b7cd2', 'Sopa de pescado', 7.00, 10, 'kitchen', true, 2, 18),
  ('6e7d4024-7d8e-4bb2-98f7-c6ec7366312b', '30bbf937-ca54-48f2-abb2-718c073b7cd2', 'Consomé', 5.50, 10, 'kitchen', true, 3, 25),
  ('5f1efb4e-85c9-4bec-9935-49c1980fe433', '30bbf937-ca54-48f2-abb2-718c073b7cd2', 'Sopa de cocido', 6.50, 10, 'kitchen', true, 4, 20),
  -- Bebidas
  ('ed3e0c67-31a1-4ad4-9cee-ff75c6478130', 'fb18b93e-f3f5-4278-8126-52b4841d869a', 'Refresco lata', 2.50, 10, 'bar', true, 1, 49),
  ('6c9a1e97-f3ad-426e-8ca4-6f10cfaab088', 'fb18b93e-f3f5-4278-8126-52b4841d869a', 'Agua 50cl', 2.00, 10, 'bar', true, 2, 48),
  ('76bfa0b5-59ab-4c11-b503-e103de194c56', 'fb18b93e-f3f5-4278-8126-52b4841d869a', 'Cerveza caña', 2.80, 10, 'bar', true, 3, 47),
  ('0df60265-4f17-4ee8-b902-af7ee1e0ed40', 'fb18b93e-f3f5-4278-8126-52b4841d869a', 'Vino por copa', 3.50, 10, 'bar', true, 4, 50),
  ('c581211f-0e38-4efa-8112-504e5ef8aad7', 'fb18b93e-f3f5-4278-8126-52b4841d869a', 'Sangría jarra 1L', 12.00, 10, 'bar', true, 5, 48),
  -- Cafés y tés
  ('a3b67852-4f58-4715-9d78-1fbb682aa169', '6ccec4ab-266b-4a11-956e-ea50ca89e2cd', 'Café espresso', 1.40, 10, 'bar', false, 1, 50),
  ('26099913-5efc-48a0-b8ad-8c9d23f83a44', '6ccec4ab-266b-4a11-956e-ea50ca89e2cd', 'Café cortado', 1.50, 10, 'bar', true, 2, 49),
  ('ff7fedb1-7cd7-43b2-bb0b-c9d4b7736ca3', '6ccec4ab-266b-4a11-956e-ea50ca89e2cd', 'Capuccino', 1.80, 10, 'bar', true, 3, 48),
  ('da5e0e77-9ade-47bf-bd4c-5d5ea2c5db95', '6ccec4ab-266b-4a11-956e-ea50ca89e2cd', 'Té infusiones', 1.60, 10, 'bar', true, 4, 50),
  -- Postres
  ('eb9d97b4-40c2-4d49-8f35-574ca69dce54', 'acbc10a5-6203-4517-accd-65c26136583e', 'Tiramisú', 5.50, 10, 'kitchen', true, 1, 30),
  ('a34e4964-e425-4c39-b87c-ccaa708abe14', 'acbc10a5-6203-4517-accd-65c26136583e', 'Crema catalana', 5.00, 10, 'kitchen', true, 2, 29),
  ('c8944db5-a01d-438a-b291-47cd09572a89', 'acbc10a5-6203-4517-accd-65c26136583e', 'Tarta de queso', 5.50, 10, 'kitchen', true, 3, 30),
  -- Envases / Táperes (nueva categoría)
  ('f1a2b3c4-5d6e-7f8a-9b0c-1d2e3f4a5b6c', 'e8a1c2b3-4d5e-6f7a-8b9c-0d1e2f3a4b5c', 'Táper pequeño', 0.50, 10, 'bar', true, 1, 100),
  ('f2a3b4c5-6e7f-8a9b-0c1d-2e3f4a5b6c7d', 'e8a1c2b3-4d5e-6f7a-8b9c-0d1e2f3a4b5c', 'Táper grande', 1.00, 10, 'bar', true, 2, 100),
  ('f3a4b5c6-7f8a-9b0c-1d2e-3f4a5b6c7d8e', 'e8a1c2b3-4d5e-6f7a-8b9c-0d1e2f3a4b5c', 'Bolsa para llevar', 0.10, 10, 'bar', true, 3, 200)
ON CONFLICT (id) DO UPDATE SET category_id = EXCLUDED.category_id, name = EXCLUDED.name,
  price = EXCLUDED.price, iva_rate = EXCLUDED.iva_rate, print_destination = EXCLUDED.print_destination,
  available = EXCLUDED.available, sort_order = EXCLUDED.sort_order, stock_actual = EXCLUDED.stock_actual;

-- ===========================================================================
-- 7. DATOS INICIALES — Mesas
-- ===========================================================================

INSERT INTO restaurant_tables (id, name, seats, status, pos_x, pos_y, section, active) VALUES
  ('0b5e9036-3be1-4cff-ae75-2d7be0084d66', 'Mesa 1', 4, 'free', 1, 1, 'Sala', true),
  ('fc049990-89b0-4224-af25-a6c25bef382d', 'Mesa 2', 2, 'free', 2, 1, 'Sala', true),
  ('93a8a4b2-1b2b-4d8d-a26d-70a4e4ca175a', 'Mesa 3', 4, 'free', 3, 1, 'Sala', true),
  ('ad7f4118-6338-4f03-8c24-d5e2220a5c10', 'Mesa 4', 6, 'free', 1, 2, 'Sala', true),
  ('8451a119-d451-4981-ac12-1587962dd0e8', 'Mesa 5', 4, 'free', 2, 2, 'Sala', true),
  ('16fc413b-f4f0-45f6-a56b-4454dc23da67', 'Mesa 6', 2, 'free', 3, 2, 'Sala', true),
  ('4d5a32fd-38c1-4b68-ae2b-33ec3028e435', 'Barra 1', 1, 'free', 3, 3, 'Barra', true),
  ('adf28d84-0bdc-4811-b3b2-bec12c87ca54', 'Barra 2', 1, 'free', 4, 3, 'Barra', true),
  ('eedee02d-ea45-4173-af10-7b471f1164f2', 'Terraza 1', 4, 'free', 1, 3, 'Terraza', true),
  ('6b875a6a-ce49-424e-baf8-7f5c2e46b31c', 'Terraza 2', 4, 'free', 2, 3, 'Terraza', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, seats = EXCLUDED.seats, status = EXCLUDED.status,
  pos_x = EXCLUDED.pos_x, pos_y = EXCLUDED.pos_y, section = EXCLUDED.section, active = EXCLUDED.active;

-- ===========================================================================
-- 8. DATOS INICIALES — Camareros
-- ===========================================================================

INSERT INTO waiters (id, name, pin, active) VALUES
  ('8a9b64d7-8ad7-465b-9211-23a1ef48fa99', 'Cristian', '1234', true),
  ('3495a8ca-88df-4037-887d-85514bd43328', 'Carlos', '2345', true),
  ('d458b9d7-4cba-4350-a70e-92bb4fefa178', 'Marta', '3456', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, pin = EXCLUDED.pin, active = EXCLUDED.active;

-- ===========================================================================
-- 9. DATOS INICIALES — Configuración del local
-- ===========================================================================

INSERT INTO settings (key, value, updated_at) VALUES
  ('restaurant_name', 'Asador Parla Este', now()),
  ('restaurant_trade_name', 'Asador Parla Este', now()),
  ('restaurant_legal_name', 'Asador Parla Este', now()),
  ('restaurant_nif', '51753805-X', now()),
  ('restaurant_address', 'C/ Amsterdam, 11', now()),
  ('restaurant_postal_code', '28914', now()),
  ('restaurant_phone', '606 63 99 32 - 689 24 18 92', now()),
  ('restaurant_email', 'info@asadorparlaeste.es', now()),
  ('default_iva_rate', '10', now()),
  ('admin_pin', '1234', now()),
  ('verifactu_mode', 'SANDBOX', now()),
  ('verifactu_nif', 'B12345678', now()),
  ('verifactu_issuer_name', 'Restaurante La Parrilla S.L.', now()),
  ('verifactu_issuer_address', 'C/ Mayor 25, 28013 Madrid', now()),
  ('verifactu_cert_loaded', 'false', now()),
  ('verifactu_cert_name', '', now()),
  ('local_ip_prefix', '192.168.1.', now()),
  ('print_agent_url', 'http://192.168.1.50:3000/print', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- ===========================================================================
-- 10. REALTIME — activar publicación para todas las tablas operativas
-- ===========================================================================

ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_tables;
ALTER PUBLICATION supabase_realtime ADD TABLE orders;
ALTER PUBLICATION supabase_realtime ADD TABLE order_items;
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE categories;
ALTER PUBLICATION supabase_realtime ADD TABLE printers;

-- ============================================================================
-- FIN DEL SCRIPT
-- Verificación: ejecutar estas consultas para confirmar que todo se creó:
--   SELECT count(*) FROM categories;  -- debe dar 8
--   SELECT count(*) FROM products;    -- debe dar 33
--   SELECT count(*) FROM restaurant_tables;  -- debe dar 10
--   SELECT count(*) FROM waiters;     -- debe dar 3
--   SELECT count(*) FROM settings;    -- debe dar 18
-- ============================================================================
