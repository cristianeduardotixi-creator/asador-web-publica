/*
# Camareros y administrador del restaurante

Añade columna `role` a waiters (waiter | admin) e inserta los 5 usuarios
del restaurante. Los PINs se guardan como text para conservar ceros
iniciales (p. ej. '001'). Sincroniza settings.admin_pin con el PIN del
usuario Admin para que el fallback del login siga funcionando.
*/

ALTER TABLE waiters ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'waiter';
ALTER TABLE waiters DROP CONSTRAINT IF EXISTS waiters_role_check;
ALTER TABLE waiters ADD CONSTRAINT waiters_role_check CHECK (role IN ('waiter','admin'));

-- Limpiar camareros de prueba previos para evitar duplicados/conflictos de PIN.
DELETE FROM waiters WHERE name IN ('Admin','Ana','Cristian','Eduardo','Patricia');

-- Insertar los 5 usuarios exactos del restaurante.
INSERT INTO waiters (name, pin, role, active) VALUES
  ('Admin',     '2468', 'admin',  true),
  ('Ana',       '123',  'waiter', true),
  ('Cristian',  '001',  'waiter', true),
  ('Eduardo',   '456',  'waiter', true),
  ('Patricia',  '789',  'waiter', true);

-- Sincronizar el PIN de admin en settings (fallback del login).
INSERT INTO settings (key, value, updated_at) VALUES ('admin_pin', '2468', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
