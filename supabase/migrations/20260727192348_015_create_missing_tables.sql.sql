/*
# Crear tablas faltantes: waiters, printers, settings, tickets

## Resumen
La base de datos del proyecto "Asador Parla Este TPV" no tenía las tablas que
la app TPV necesita para camareros, impresoras, configuración y facturas
fiscales (Veri*Factu). Esta migración las crea sin tocar las tablas
existentes (products, categories, orders, order_items, restaurant_tables,
reservations, business_hours).

## Tablas nuevas
- waiters: camareros con PIN para acceso rápido en tableta.
- printers: impresoras térmicas por IP (cocina / barra).
- settings: configuración clave-valor (modo Veri*Factu, NIF, PIN admin, etc.).
- tickets: facturas simplificadas inalterables con cadena SHA-256 (Veri*Factu).

## Seguridad (RLS)
- Single-tenant sin auth: todas las políticas son TO anon, authenticated
  con USING(true) / WITH CHECK(true) porque toda la data pertenece al único
  restaurante y se accede con la anon key. El control de rol se aplica en
  cliente mediante PIN.
*/

CREATE EXTENSION IF NOT EXISTS pgcrypto;

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
  serie text NOT NULL DEFAULT 'T',
  voided boolean NOT NULL DEFAULT false,
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

-- ===========================================================================
-- RLS — single-tenant, sin auth. anon + authenticated con acceso total.
-- ===========================================================================
ALTER TABLE waiters ENABLE ROW LEVEL SECURITY;
ALTER TABLE printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;

-- waiters
DROP POLICY IF EXISTS "anon_select_waiters" ON waiters;
CREATE POLICY "anon_select_waiters" ON waiters FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_waiters" ON waiters;
CREATE POLICY "anon_insert_waiters" ON waiters FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_waiters" ON waiters;
CREATE POLICY "anon_update_waiters" ON waiters FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_waiters" ON waiters;
CREATE POLICY "anon_delete_waiters" ON waiters FOR DELETE TO anon, authenticated USING (true);

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

-- tickets
DROP POLICY IF EXISTS "anon_select_tickets" ON tickets;
CREATE POLICY "anon_select_tickets" ON tickets FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_tickets" ON tickets;
CREATE POLICY "anon_insert_tickets" ON tickets FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_tickets" ON tickets;
CREATE POLICY "anon_update_tickets" ON tickets FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_tickets" ON tickets;
CREATE POLICY "anon_delete_tickets" ON tickets FOR DELETE TO anon, authenticated USING (true);
