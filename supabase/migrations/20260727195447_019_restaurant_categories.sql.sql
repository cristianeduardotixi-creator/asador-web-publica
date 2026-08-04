/*
# Categorías personalizadas del restaurante

Añade columna `color` a categories e inserta las 8 categorías del restaurante
con icono y color distintivos. Preserva la categoría "Parrilladas" existente
(actualiza sus metadatos) para no romper la relación con los productos ya
creados.
*/

ALTER TABLE categories ADD COLUMN IF NOT EXISTS color text NOT NULL DEFAULT 'amber';

-- Actualizar la categoría "Parrilladas" existente (mantiene su id y la
-- relación con los 3 productos ya creados).
UPDATE categories
SET icon_name = 'Flame',
    color = 'red',
    print_destination = 'kitchen',
    sort_order = 0,
    active = true
WHERE name = 'Parrilladas';

-- Insertar el resto de categorías (idempotente: no duplica si ya existen).
INSERT INTO categories (name, icon_name, color, print_destination, sort_order, active)
SELECT * FROM (VALUES
  ('Entrantes',          'Salad',           'green',  'kitchen', 1, true),
  ('Sopas',              'Soup',            'amber',  'kitchen', 2, true),
  ('Raciones',           'Pizza',           'orange', 'kitchen', 3, true),
  ('Mariscos',           'Fish',            'cyan',   'kitchen', 4, true),
  ('Platos a la carta',  'UtensilsCrossed', 'teal',   'kitchen', 5, true),
  ('Bebidas',            'Wine',            'sky',    'bar',     6, true),
  ('Envases / Tapers',   'Package',         'stone',  'kitchen', 7, true)
) AS v(name, icon_name, color, print_destination, sort_order, active)
WHERE NOT EXISTS (SELECT 1 FROM categories c WHERE c.name = v.name);
