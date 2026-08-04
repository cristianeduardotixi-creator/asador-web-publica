/*
# Fix order creation: unit_price NOT NULL + total_amount never updated

## Root cause
The live `order_items` table has a legacy `unit_price` column that was
created NOT NULL with NO default. The application only inserts into the
`price` column, leaving `unit_price` NULL — which violates the NOT NULL
constraint and silently rejects every order item insert. As a result,
orders are created empty and `orders.total` stays 0.00.

## Changes
1. `order_items.unit_price`: drop NOT NULL constraint, set DEFAULT 0,
   and backfill from the `price` column so existing rows are consistent.
2. `orders.total_amount`: set DEFAULT 0 so new orders without items
   don't stay NULL. Backfill from `total` for consistency.

## Security
No RLS changes. Existing policies (TO anon, authenticated) remain intact.
*/

-- order_items.unit_price: make nullable + default 0
ALTER TABLE order_items ALTER COLUMN unit_price DROP NOT NULL;
ALTER TABLE order_items ALTER COLUMN unit_price SET DEFAULT 0;

-- Backfill unit_price from price where it is NULL
UPDATE order_items SET unit_price = price WHERE unit_price IS NULL;

-- orders.total_amount: ensure default + backfill from total
ALTER TABLE orders ALTER COLUMN total_amount SET DEFAULT 0;
UPDATE orders SET total_amount = total WHERE total_amount IS NULL OR total_amount = 0;