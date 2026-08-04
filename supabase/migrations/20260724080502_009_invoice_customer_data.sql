/*
# Facturas nominativas con datos del cliente

## Resumen
Añade soporte para emitir facturas nominativas (con datos del receptor/cliente)
además de los tickets simplificados actuales. Cuando se active la opción de
factura nominativa, el ticket registrado e impreso incluirá los datos completos
del cliente (nombre/razón social, NIF/CIF, dirección, teléfono, email).

## Cambios
1. Nuevas columnas en `tickets`:
   - `is_invoice` (boolean, default false): marca si es factura nominativa.
   - `recipient_name` (text): nombre o razón social del cliente.
   - `recipient_nif` (text): NIF/CIF/DNI del cliente.
   - `recipient_address` (text): dirección del cliente.
   - `recipient_phone` (text): teléfono del cliente.
   - `recipient_email` (text): email del cliente.

2. Función `create_fiscal_ticket` actualizada:
   - Añade los parámetros p_is_invoice, p_recipient_name, p_recipient_nif,
     p_recipient_address, p_recipient_phone, p_recipient_email (todos con
     defaults para mantener compatibilidad con llamadas existentes).
   - Restaura los parámetros p_serie y p_rectifies_ticket_number que estaban
     definidos en la migración 006 pero no se aplicaron a la función en vivo.
   - El INSERT incluye las nuevas columnas.

## Seguridad
- No se añaden políticas nuevas: las columnas nuevas quedan cubiertas por las
  políticas CRUD existentes de `tickets` (TO anon, authenticated con
  USING(true)/WITH CHECK(true) — single-tenant sin auth, ya documentado).
*/
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS is_invoice boolean NOT NULL DEFAULT false;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS recipient_name text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS recipient_nif text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS recipient_address text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS recipient_phone text;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS recipient_email text;

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
