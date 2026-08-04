/*
# Actualización de categorías de la carta
# Reorganiza las categorías al nuevo orden exacto:
# 1. Parrilladas
# 2. Platos a la carta
# 3. Entrantes
# 4. Sopas
# 5. Bebidas
# 6. Cafés y tés
# 7. Postres
*/

-- 1. Renombrar "Parrilladas y Carnes" → "Parrilladas"
UPDATE categories SET name = 'Parrilladas', sort_order = 1
WHERE id = 'f6110efd-c6ba-4f0e-89a3-1c82c78ee84b';

-- 2. Renombrar "Cafés y Tés" → "Cafés y tés" y reordenar
UPDATE categories SET name = 'Cafés y tés', sort_order = 6
WHERE id = '6ccec4ab-266b-4a11-956e-ea50ca89e2cd';

-- 3. Reordenar existentes
UPDATE categories SET sort_order = 3 WHERE id = '41f895be-20c3-41b6-aac7-a9f7a6494ffb'; -- Entrantes
UPDATE categories SET sort_order = 5 WHERE id = 'fb18b93e-f3f5-4278-8126-52b4841d869a'; -- Bebidas
UPDATE categories SET sort_order = 7 WHERE id = 'acbc10a5-6203-4517-accd-65c26136583e'; -- Postres

-- 4. Crear "Platos a la carta" (sort_order 2)
INSERT INTO categories (name, icon_name, print_destination, sort_order, active)
SELECT 'Platos a la carta', 'UtensilsCrossed', 'kitchen', 2, true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Platos a la carta');

-- 5. Crear "Sopas" (sort_order 4)
INSERT INTO categories (name, icon_name, print_destination, sort_order, active)
SELECT 'Sopas', 'Soup', 'kitchen', 4, true
WHERE NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Sopas');

-- 6. Productos de ejemplo para "Platos a la carta"
INSERT INTO products (category_id, name, price, iva_rate, print_destination, available, sort_order, stock_actual)
SELECT c.id, t.name, t.price, t.iva_rate, t.print_destination::text, true, t.sort_order, t.stock_actual
FROM categories c
CROSS JOIN (VALUES
  ('Entrecote 400g', 18.50, 10, 'kitchen', 1, 20),
  ('Solomillo 250g', 22.00, 10, 'kitchen', 2, 15),
  ('Pollo asado', 12.50, 10, 'kitchen', 3, 25),
  ('Merluza a la plancha', 16.00, 10, 'kitchen', 4, 12),
  ('Risotto de setas', 11.00, 10, 'kitchen', 5, 18),
  ('Ensalada mixta', 7.50, 10, 'kitchen', 6, 30)
) AS t(name, price, iva_rate, print_destination, sort_order, stock_actual)
WHERE c.name = 'Platos a la carta'
  AND NOT EXISTS (
    SELECT 1 FROM products p WHERE p.category_id = c.id AND p.name = t.name
  );

-- 7. Productos de ejemplo para "Sopas"
INSERT INTO products (category_id, name, price, iva_rate, print_destination, available, sort_order, stock_actual)
SELECT c.id, t.name, t.price, t.iva_rate, t.print_destination::text, true, t.sort_order, t.stock_actual
FROM categories c
CROSS JOIN (VALUES
  ('Sopa de marisco', 8.50, 10, 'kitchen', 1, 20),
  ('Sopa de pescado', 7.00, 10, 'kitchen', 2, 20),
  ('Consomé', 5.50, 10, 'kitchen', 3, 25),
  ('Sopa de cocido', 6.50, 10, 'kitchen', 4, 20)
) AS t(name, price, iva_rate, print_destination, sort_order, stock_actual)
WHERE c.name = 'Sopas'
  AND NOT EXISTS (
    SELECT 1 FROM products p WHERE p.category_id = c.id AND p.name = t.name
  );
