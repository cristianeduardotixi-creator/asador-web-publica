-- Add "Para Llevar" modifier to order_items.
-- When true, a +1.00 EUR supplement is baked into the stored unit price
-- (price column already holds the effective price the customer pays).
ALTER TABLE order_items
  ADD COLUMN IF NOT EXISTS takeaway boolean NOT NULL DEFAULT false;

-- Make sure realtime picks up the new column shape (no-op if already published).
COMMENT ON COLUMN order_items.takeaway IS 'true = Para Llevar (+1 EUR supplement included in price)';
