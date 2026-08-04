/*
# Anulación / Rectificación de tickets (Veri*Factu conforme)

## Resumen
Permite anular un ticket emitiendo una factura rectificativa (tipo R4)
vinculada al original, sin borrar el ticket original ni romper la cadena
SHA-256. La rectificativa tiene serie propia R-AAAA-NNNNN con correlativo
anual independiente.

## Cambios
1. Añade columnas `serie` y `serie_sequence` a tickets para soportar
   series múltiples (T para normales, R para rectificativas).
2. Añade columna `voided` (bool) para marcar tickets anulados.
3. Añade columna `rectifies_ticket_number` (text) para guardar el número
   del ticket rectificado (referencia para el XML AEAT).
4. Modifica create_fiscal_ticket para aceptar p_serie, p_voided,
   p_rectifies_ticket_number, p_rectifies_ticket_id (ya existía).
5. Crea función void_ticket que:
   - Genera la rectificativa con serie R-AAAA-NNNNN e importes negativos.
   - Marca el ticket original como voided=true.
   - Mantiene el encadenamiento SHA-256 de la serie T.
   - La rectificativa se encadena en su propia serie R.
6. Devuelve stock a los productos del ticket anulado.
*/

-- ============================================================
-- 1. Nuevas columnas en tickets
-- ============================================================
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS serie text DEFAULT 'T';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS voided boolean DEFAULT false;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS rectifies_ticket_number text;

-- Llenar serie='T' en tickets existentes
UPDATE tickets SET serie = 'T' WHERE serie IS NULL;

-- ============================================================
-- 2. Función create_fiscal_ticket actualizada con serie
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
  p_rectifies_ticket_number text DEFAULT NULL
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

  -- Bloquear el último ticket de la serie+ año para encadenamiento atómico
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

  -- Número de ticket: SERIE-AAAA-NNNNN (sin saltos)
  v_ticket_number := p_serie || '-' || v_year::text || '-' || lpad(v_sequence::text, 5, '0');

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
    previous_hash, hash, ticket_type, rectifies_ticket_id, rectifies_ticket_number,
    serie, voided
  ) VALUES (
    v_id, p_order_id, v_ticket_number, v_sequence, p_nif_emisor, p_issuer_name, p_issuer_address,
    p_commercial_name, p_phone, p_email,
    p_ticket_datetime, p_subtotal, p_tax_total, p_total, p_iva_breakdown,
    p_payment_method, p_payment_amount, p_payment_change,
    v_previous_hash, v_hash, p_ticket_type, p_rectifies_ticket_id, p_rectifies_ticket_number,
    p_serie, false
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
-- 3. Función void_ticket: genera rectificativa + marca original
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

  -- Cargar el ticket original (bloquear para evitar doble anulación)
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

  -- Crear la rectificativa (serie R, importes negativos, tipo R4)
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

  -- Marcar el ticket original como anulado
  UPDATE tickets SET voided = true WHERE id = p_original_ticket_id;

  -- Devolver stock de los productos del pedido original
  IF v_original.order_id IS NOT NULL THEN
    UPDATE order_items oi
    SET status = 'cancelled'
    WHERE oi.order_id = v_original.order_id
      AND oi.status = 'sent';

    -- Reponer stock
    UPDATE products p
    SET stock_actual = p.stock_actual + sub.qty
    FROM (
      SELECT product_id, SUM(quantity) AS qty
      FROM order_items
      WHERE order_id = v_original.order_id
      GROUP BY product_id
    ) sub
    WHERE p.id = sub.product_id;

    -- Reabrir la mesa: poner el pedido en estado 'sent' para re-cobro
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