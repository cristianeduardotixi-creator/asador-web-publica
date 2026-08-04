/*
# Datos del local, IVA 10% y serie fiscal T-YYYY-NNNNN

## Resumen
1. Añade settings de datos del local (nombre comercial, razón social, NIF,
   dirección, teléfono, email) y configura los valores por defecto
   para "Asador Parla Este".
2. Cambia el IVA por defecto al 10% en todos los productos existentes
   (normativa de hostelería en España, IVA reducido).
3. Modifica create_fiscal_ticket para generar números de factura con
   serie T-YYYY-NNNNN (ej: T-2026-00001), correlativos anuales sin saltos.
4. Añade columnes a tickets: commercial_name, phone, email para que
   los tickets impresos incluyan los datos completos del local.
5. Crea un bucket de Storage para logos del restaurante.

## Cambios detallados

### Settings (datos del local)
- `restaurant_name` = "Asador Parla Este"
- `restaurant_trade_name` = "Asador Parla Este"
- `restaurant_legal_name` = "Asador Parla Este S.L."
- `restaurant_nif` = "B12345678"
- `restaurant_address` = "C/ Real 15, 28923 Parla, Madrid"
- `restaurant_phone` = "910 000 000"
- `restaurant_email` = "info@asadorparlaeste.es"
- `default_iva_rate` = "10"

### Tabla products
- UPDATE iva_rate = 10 para todos los productos (IVA reducido hostelería).

### Tabla tickets
- Nueva columna `commercial_name` (text, nullable): nombre comercial del local.
- Nueva columna `phone` (text, nullable): teléfono de contacto.
- Nueva columna `email` (text, nullable): email de contacto.

### Función create_fiscal_ticket
- Modificada para aceptar p_commercial_name, p_phone, p_email.
- Número de ticket cambia de YYYY/NNNN a T-YYYY-NNNNN (serie + año + correlativo).
- El correlativo se reinicia cada año (busca el max sequence del año actual).

### Storage
- Crea bucket público `logos` para subir el logo del restaurante.
*/

-- ============================================================
-- 1. Settings: datos del local por defecto
-- ============================================================
INSERT INTO settings (key, value, updated_at) VALUES
  ('restaurant_name', 'Asador Parla Este', now()),
  ('restaurant_trade_name', 'Asador Parla Este', now()),
  ('restaurant_legal_name', 'Asador Parla Este S.L.', now()),
  ('restaurant_nif', 'B12345678', now()),
  ('restaurant_address', 'C/ Real 15, 28923 Parla, Madrid', now()),
  ('restaurant_phone', '910 000 000', now()),
  ('restaurant_email', 'info@asadorparlaeste.es', now()),
  ('default_iva_rate', '10', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- Migrar las settings fiscales existentes a las nuevas claves si están vacías
INSERT INTO settings (key, value, updated_at)
SELECT 'restaurant_nif', value, now() FROM settings WHERE key = 'verifactu_nif'
ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value, updated_at)
SELECT 'restaurant_legal_name', value, now() FROM settings WHERE key = 'verifactu_issuer_name'
ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value, updated_at)
SELECT 'restaurant_address', value, now() FROM settings WHERE key = 'verifactu_issuer_address'
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- 2. IVA 10% en todos los productos (normativa hostelería)
-- ============================================================
UPDATE products SET iva_rate = 10 WHERE iva_rate != 10;

-- ============================================================
-- 3. Nuevas columnas en tickets
-- ============================================================
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS commercial_name text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS email text;

-- ============================================================
-- 4. Función create_fiscal_ticket actualizada (serie T-YYYY-NNNNN)
-- ============================================================
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
  p_commercial_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_email text DEFAULT NULL,
  p_ticket_type text DEFAULT 'normal',
  p_rectifies_ticket_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_year integer;
  v_sequence integer;
  v_ticket_number text;
  v_previous_hash text;
  v_hash text;
  v_id uuid;
  v_input text;
  v_last record;
BEGIN
  v_year := extract(year FROM p_ticket_datetime);

  -- Bloquear el último ticket del año actual para encadenamiento atómico
  SELECT id, sequence, hash INTO v_last
  FROM tickets
  WHERE extract(year FROM ticket_datetime) = v_year
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

  -- Número de ticket: T-AAAA-NNNNN (serie + año + correlativo, sin saltos)
  v_ticket_number := 'T-' || v_year::text || '-' || lpad(v_sequence::text, 5, '0');

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
    commercial_name, phone, email,
    ticket_datetime, subtotal, tax_total, total, iva_breakdown,
    payment_method, payment_amount, payment_change,
    previous_hash, hash, ticket_type, rectifies_ticket_id
  ) VALUES (
    v_id, p_order_id, v_ticket_number, v_sequence, p_nif_emisor, p_issuer_name, p_issuer_address,
    p_commercial_name, p_phone, p_email,
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