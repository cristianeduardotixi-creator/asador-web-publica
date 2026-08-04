/*
# Funciones fiscales, de stock y datos iniciales

## Resumen
Crea las funciones PL/pgSQL que el motor fiscal Veri*Factu y el control de
stock necesitan, y semilla la tabla settings con los datos por defecto del
local "Asador Parla Este".

## Funciones creadas
1. create_fiscal_ticket(): creación atómica de ticket con encadenamiento
   SHA-256 por serie (T normales, R rectificativas), correlativo anual
   sin saltos. Soporta facturas nominativas con datos del cliente.
2. void_ticket(): anula un ticket emitiendo factura rectificativa R4,
   marca el original como voided, devuelve stock y reabre la mesa.
3. increment_stock(p_product_id, p_qty): suma unidades (entrada de género).
4. decrement_stock(p_product_id, p_qty): resta unidades (venta), floor 0.
5. recalc_table_total(p_table_id): recalcula current_total de una mesa
   sumando los order_items activos.

## Datos iniciales (settings)
- restaurant_name, restaurant_trade_name, restaurant_legal_name, restaurant_nif,
  restaurant_address, restaurant_phone, restaurant_email, default_iva_rate.
- admin_pin = "1234" (acceso al panel de administración).
- verifactu_mode = "SANDBOX".

## Seguridad
Sin cambios en RLS — las funciones operan bajo los permisos del caller, que
ya tiene CRUD vía las políticas existentes. recalc_table_total es
SECURITY DEFINER para poder actualizar restaurant_tables.
*/

-- ============================================================
-- 1. create_fiscal_ticket (serie T-YYYY-NNNNN + facturas nominativas)
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
  p_serie text DEFAULT 'T',
  p_ticket_type text DEFAULT 'normal',
  p_rectifies_ticket_id uuid DEFAULT NULL,
  p_rectifies_ticket_number text DEFAULT NULL,
  p_is_invoice boolean DEFAULT false,
  p_recipient_name text DEFAULT NULL,
  p_recipient_nif text DEFAULT NULL,
  p_recipient_address text DEFAULT NULL,
  p_recipient_phone text DEFAULT NULL,
  p_recipient_email text DEFAULT NULL
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

  SELECT id, sequence, hash INTO v_last
  FROM tickets
  WHERE serie = p_serie
    AND extract(year FROM ticket_datetime) = v_year
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

  v_ticket_number := p_serie || '-' || v_year::text || '-' || lpad(v_sequence::text, 5, '0');

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
    previous_hash, hash, ticket_type, rectifies_ticket_id, rectifies_ticket_number,
    serie, voided,
    is_invoice, recipient_name, recipient_nif, recipient_address, recipient_phone, recipient_email
  ) VALUES (
    v_id, p_order_id, v_ticket_number, v_sequence, p_nif_emisor, p_issuer_name, p_issuer_address,
    p_commercial_name, p_phone, p_email,
    p_ticket_datetime, p_subtotal, p_tax_total, p_total, p_iva_breakdown,
    p_payment_method, p_payment_amount, p_payment_change,
    v_previous_hash, v_hash, p_ticket_type, p_rectifies_ticket_id, p_rectifies_ticket_number,
    p_serie, false,
    p_is_invoice, p_recipient_name, p_recipient_nif, p_recipient_address, p_recipient_phone, p_recipient_email
  );

  RETURN jsonb_build_object(
    'id', v_id,
    'ticket_number', v_ticket_number,
    'sequence', v_sequence,
    'hash', v_hash,
    'previous_hash', v_previous_hash,
    'serie', p_serie
  );
END;
$$;

-- ============================================================
-- 2. void_ticket (anulación con rectificativa R4)
-- ============================================================
CREATE OR REPLACE FUNCTION void_ticket(
  p_original_ticket_id uuid,
  p_reason text DEFAULT 'Anulación por error de cobro'
)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
  v_original record;
  v_rect record;
  v_year integer;
  v_now timestamptz;
BEGIN
  v_now := now();
  v_year := extract(year FROM v_now);

  SELECT * INTO v_original
  FROM tickets
  WHERE id = p_original_ticket_id
  FOR UPDATE;

  IF v_original IS NULL THEN
    RAISE EXCEPTION 'Ticket no encontrado';
  END IF;

  IF v_original.voided = true THEN
    RAISE EXCEPTION 'Este ticket ya está anulado';
  END IF;

  IF v_original.ticket_type = 'rectificativa' THEN
    RAISE EXCEPTION 'No se puede anular una factura rectificativa';
  END IF;

  SELECT * INTO v_rect
  FROM create_fiscal_ticket(
    v_original.order_id,
    v_original.nif_emisor,
    v_original.issuer_name,
    v_original.issuer_address,
    v_now,
    -v_original.subtotal,
    -v_original.tax_total,
    -v_original.total,
    v_original.iva_breakdown,
    v_original.payment_method,
    -COALESCE(v_original.payment_amount, 0),
    -COALESCE(v_original.payment_change, 0),
    v_original.commercial_name,
    v_original.phone,
    v_original.email,
    'R',
    'rectificativa',
    v_original.id,
    v_original.ticket_number
  );

  UPDATE tickets SET voided = true WHERE id = p_original_ticket_id;

  IF v_original.order_id IS NOT NULL THEN
    UPDATE order_items oi
    SET status = 'cancelled'
    WHERE oi.order_id = v_original.order_id
      AND oi.status = 'sent';

    UPDATE products p
    SET stock_actual = p.stock_actual + sub.qty
    FROM (
      SELECT product_id, SUM(quantity) AS qty
      FROM order_items
      WHERE order_id = v_original.order_id
      GROUP BY product_id
    ) sub
    WHERE p.id = sub.product_id;

    UPDATE orders SET status = 'sent', paid_at = NULL
    WHERE id = v_original.order_id;
  END IF;

  RETURN jsonb_build_object(
    'rectificativa_id', v_rect.id,
    'rectificativa_number', v_rect.ticket_number,
    'rectificativa_hash', v_rect.hash,
    'original_number', v_original.ticket_number
  );
END;
$$;

-- ============================================================
-- 3. increment_stock / decrement_stock
-- ============================================================
CREATE OR REPLACE FUNCTION increment_stock(p_product_id uuid, p_qty integer)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_current integer;
BEGIN
  SELECT stock_actual INTO v_current
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado: %', p_product_id;
  END IF;

  UPDATE products
  SET stock_actual = v_current + p_qty
  WHERE id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_stock(p_product_id uuid, p_qty integer)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_current integer;
BEGIN
  SELECT stock_actual INTO v_current
  FROM products
  WHERE id = p_product_id
  FOR UPDATE;

  IF v_current IS NULL THEN
    RAISE EXCEPTION 'Producto no encontrado: %', p_product_id;
  END IF;

  UPDATE products
  SET stock_actual = GREATEST(0, v_current - p_qty)
  WHERE id = p_product_id;
END;
$$;

-- ============================================================
-- 4. recalc_table_total
-- ============================================================
CREATE OR REPLACE FUNCTION recalc_table_total(p_table_id uuid)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total numeric(10,2);
BEGIN
  SELECT COALESCE(SUM(oi.price * oi.quantity), 0)::numeric(10,2)
  INTO v_total
  FROM order_items oi
  INNER JOIN orders o ON oi.order_id = o.id
  WHERE o.table_id = p_table_id
    AND o.status NOT IN ('paid', 'cancelled')
    AND oi.status != 'cancelled';

  UPDATE restaurant_tables
  SET current_total = v_total
  WHERE id = p_table_id;

  RETURN v_total;
END;
$$;

-- ============================================================
-- 5. Datos iniciales (settings del local)
-- ============================================================
INSERT INTO settings (key, value, updated_at) VALUES
  ('restaurant_name', 'Asador Parla Este', now()),
  ('restaurant_trade_name', 'Asador Parla Este', now()),
  ('restaurant_legal_name', 'Asador Parla Este S.L.', now()),
  ('restaurant_nif', 'B12345678', now()),
  ('restaurant_address', 'C/ Real 15, 28923 Parla, Madrid', now()),
  ('restaurant_phone', '910 000 000', now()),
  ('restaurant_email', 'info@asadorparlaeste.es', now()),
  ('default_iva_rate', '10', now()),
  ('admin_pin', '1234', now()),
  ('verifactu_mode', 'SANDBOX', now())
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();

-- IVA 10% en todos los productos (normativa hostelería)
UPDATE products SET iva_rate = 10 WHERE iva_rate IS NULL OR iva_rate != 10;
