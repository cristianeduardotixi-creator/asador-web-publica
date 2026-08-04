/*
# Add description column to products

1. Changes
- Adds `description` (text, nullable) to the `products` table.
- Allows optional product descriptions to be stored and displayed.
2. Security
- No policy changes — existing product RLS policies already allow full CRUD.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'products' AND column_name = 'description'
  ) THEN
    ALTER TABLE products ADD COLUMN description text;
  END IF;
END $$;
