-- Add current_total column to track accumulated consumption per table.
-- Stores the sum of all active (non-paid, non-cancelled) order_items for the table.
ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS current_total numeric(10,2) NOT NULL DEFAULT 0;

-- Function to recalculate current_total for a table based on all its active orders.
-- Sums price * quantity of every order_item in orders that are NOT 'paid' or 'cancelled',
-- excluding 'cancelled' items. Updates restaurant_tables.current_total.
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
