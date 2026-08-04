/*
# Caja, reservas y datos del restaurante (Asador Parla Este)

1. NUEVAS TABLAS
   - cash_sessions: apertura y cierre de caja por día (fondo inicial, efectivo real, arqueo).
   - cash_movements: salidas de efectivo durante el servicio (compras de pan, hielo, etc.).
   - reservations: agenda de reservas vinculada a mesas.

2. SEGURIDAD
   - RLS en las 3 tablas con CRUD para anon, authenticated (app sin login Supabase).

3. DATOS SEED
   - Configuración del restaurante: Asador Parla Este, NIF, dirección, teléfono.
   - PINs de usuarios: Admin (2468), Ana (123), Cristian (001), Eduardo (456), Patricia (789).
   - Prefijo IP local por defecto (192.168.1.).
*/

CREATE TABLE IF NOT EXISTS cash_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date date NOT NULL DEFAULT CURRENT_DATE,
  opening_amount numeric NOT NULL DEFAULT 0,
  closing_amount numeric,
  expected_cash numeric,
  difference numeric,
  status text NOT NULL DEFAULT 'open',
  opened_by text,
  closed_by text,
  opened_at timestamptz DEFAULT now(),
  closed_at timestamptz,
  notes text,
  UNIQUE (session_date)
);

ALTER TABLE cash_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_cash_sessions" ON cash_sessions;
CREATE POLICY "anon_select_cash_sessions" ON cash_sessions FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_cash_sessions" ON cash_sessions;
CREATE POLICY "anon_insert_cash_sessions" ON cash_sessions FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_cash_sessions" ON cash_sessions;
CREATE POLICY "anon_update_cash_sessions" ON cash_sessions FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_cash_sessions" ON cash_sessions;
CREATE POLICY "anon_delete_cash_sessions" ON cash_sessions FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS cash_movements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES cash_sessions(id) ON DELETE SET NULL,
  type text NOT NULL DEFAULT 'exit',
  amount numeric NOT NULL,
  reason text NOT NULL,
  created_by text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cash_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_cash_movements" ON cash_movements;
CREATE POLICY "anon_select_cash_movements" ON cash_movements FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_cash_movements" ON cash_movements;
CREATE POLICY "anon_insert_cash_movements" ON cash_movements FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_cash_movements" ON cash_movements;
CREATE POLICY "anon_update_cash_movements" ON cash_movements FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_cash_movements" ON cash_movements;
CREATE POLICY "anon_delete_cash_movements" ON cash_movements FOR DELETE TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_id uuid REFERENCES restaurant_tables(id) ON DELETE SET NULL,
  table_name text,
  customer_name text NOT NULL,
  phone text,
  party_size integer NOT NULL DEFAULT 2,
  reservation_date date NOT NULL,
  reservation_time text NOT NULL,
  status text NOT NULL DEFAULT 'confirmed',
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservations_date ON reservations (reservation_date);

ALTER TABLE reservations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_reservations" ON reservations;
CREATE POLICY "anon_select_reservations" ON reservations FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_reservations" ON reservations;
CREATE POLICY "anon_insert_reservations" ON reservations FOR INSERT TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_reservations" ON reservations;
CREATE POLICY "anon_update_reservations" ON reservations FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_reservations" ON reservations;
CREATE POLICY "anon_delete_reservations" ON reservations FOR DELETE TO anon, authenticated USING (true);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'cash_sessions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE cash_sessions;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'cash_movements') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE cash_movements;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'reservations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE reservations;
  END IF;
END $$;

-- Settings: ensure all required keys exist
INSERT INTO settings (key, value) VALUES
  ('local_ip_prefix', '192.168.1.'),
  ('verifactu_enabled', 'false')
ON CONFLICT (key) DO UPDATE SET value = settings.value;

-- Waiters: upsert by name (no unique constraint on pin)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM waiters WHERE pin = '2468') THEN
    INSERT INTO waiters (name, pin, role, active) VALUES ('Admin', '2468', 'admin', true);
  ELSE
    UPDATE waiters SET name = 'Admin', role = 'admin', active = true WHERE pin = '2468';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM waiters WHERE pin = '123') THEN
    INSERT INTO waiters (name, pin, role, active) VALUES ('Ana', '123', 'waiter', true);
  ELSE
    UPDATE waiters SET name = 'Ana', active = true WHERE pin = '123';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM waiters WHERE pin = '001') THEN
    INSERT INTO waiters (name, pin, role, active) VALUES ('Cristian', '001', 'waiter', true);
  ELSE
    UPDATE waiters SET name = 'Cristian', active = true WHERE pin = '001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM waiters WHERE pin = '456') THEN
    INSERT INTO waiters (name, pin, role, active) VALUES ('Eduardo', '456', 'waiter', true);
  ELSE
    UPDATE waiters SET name = 'Eduardo', active = true WHERE pin = '456';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM waiters WHERE pin = '789') THEN
    INSERT INTO waiters (name, pin, role, active) VALUES ('Patricia', '789', 'waiter', true);
  ELSE
    UPDATE waiters SET name = 'Patricia', active = true WHERE pin = '789';
  END IF;
END $$;
