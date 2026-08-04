/*
# Funciones de stock: increment y decrement

## Resumen
Crea dos funciones PL/pgSQL para gestionar el stock de productos de forma segura:
- `increment_stock(p_product_id, p_qty)`: suma unidades (entrada de género).
- `decrement_stock(p_product_id, p_qty)`: resta unidades (venta). No permite
  valores negativos: si el stock resultante fuera < 0, se fija a 0.

Ambas son atómicas y usan FOR UPDATE para evitar condiciones de carrera.

## Seguridad
Sin cambios en RLS. Las funciones son ejecutables por anon/authenticated
(SECUURITY DEFINER no se usa; operan bajo los permisos del caller, que ya
tiene CRUD sobre products vía las políticas existentes).
*/

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