/*
# Carta completa del restaurante (38 platos)

Inserta los platos en sus categorías correspondientes con print_destination='kitchen'
y description NULL. Limpia primero los platos de prueba previos en esas 5 categorías
para dejar la carta limpia y coherente.
*/

DELETE FROM products
 WHERE category_id IN (
   '5250fa0d-b2fc-4ac5-be24-bf63e438c596', -- Entrantes
   '4f088734-7749-479d-aaa2-543e524874dd', -- Sopas
   '164d0e3b-340a-408a-a22d-ef3a32b7a47d', -- Mariscos
   '71a11e17-f0df-491f-9cdb-a11c6cdb55d0', -- Parrilladas
   '67caefe1-8c11-4c4b-b876-f387d03002d9'  -- Platos a la carta
 );

-- 1. ENTRANTES
INSERT INTO products (category_id, name, description, price, print_destination, available, sort_order) VALUES
  ('5250fa0d-b2fc-4ac5-be24-bf63e438c596', 'Maduro con queso',      NULL, 7.00,  'kitchen', true, 1),
  ('5250fa0d-b2fc-4ac5-be24-bf63e438c596', 'Choclo con queso',      NULL, 5.80,  'kitchen', true, 2),
  ('5250fa0d-b2fc-4ac5-be24-bf63e438c596', 'Chochos con chicharrón',NULL, 12.50, 'kitchen', true, 3),
  ('5250fa0d-b2fc-4ac5-be24-bf63e438c596', 'Mote con chicharrón',   NULL, 11.90, 'kitchen', true, 4),
  ('5250fa0d-b2fc-4ac5-be24-bf63e438c596', 'Patacones con queso',   NULL, 8.00,  'kitchen', true, 5),
  ('5250fa0d-b2fc-4ac5-be24-bf63e438c596', 'Mote pillo',            NULL, 9.00,  'kitchen', true, 6);

-- 2. SOPAS
INSERT INTO products (category_id, name, description, price, print_destination, available, sort_order) VALUES
  ('4f088734-7749-479d-aaa2-543e524874dd', 'Yaguarlocro',           NULL, 11.50, 'kitchen', true, 1),
  ('4f088734-7749-479d-aaa2-543e524874dd', 'Caldo de pata',         NULL, 11.50, 'kitchen', true, 2),
  ('4f088734-7749-479d-aaa2-543e524874dd', 'Caldo de 31',           NULL, 11.00, 'kitchen', true, 3),
  ('4f088734-7749-479d-aaa2-543e524874dd', 'Ceviche mixto',         NULL, 15.50, 'kitchen', true, 4),
  ('4f088734-7749-479d-aaa2-543e524874dd', 'Ceviche de gamba',      NULL, 14.00, 'kitchen', true, 5),
  ('4f088734-7749-479d-aaa2-543e524874dd', 'Encebollado',           NULL, 11.50, 'kitchen', true, 6),
  ('4f088734-7749-479d-aaa2-543e524874dd', 'Encebollado mixto',     NULL, 14.00, 'kitchen', true, 7);

-- 3. MARISCOS
INSERT INTO products (category_id, name, description, price, print_destination, available, sort_order) VALUES
  ('164d0e3b-340a-408a-a22d-ef3a32b7a47d', 'Arroz con camarón',     NULL, 14.50, 'kitchen', true, 1),
  ('164d0e3b-340a-408a-a22d-ef3a32b7a47d', 'Camarones apanados',    NULL, 14.50, 'kitchen', true, 2),
  ('164d0e3b-340a-408a-a22d-ef3a32b7a47d', 'Encocado de gamba',     NULL, 15.00, 'kitchen', true, 3),
  ('164d0e3b-340a-408a-a22d-ef3a32b7a47d', 'Gamba al ajillo',       NULL, 15.00, 'kitchen', true, 4),
  ('164d0e3b-340a-408a-a22d-ef3a32b7a47d', 'Bandera marinera',      NULL, 22.00, 'kitchen', true, 5);

-- 4. PARRILLADAS
INSERT INTO products (category_id, name, description, price, print_destination, available, sort_order) VALUES
  ('71a11e17-f0df-491f-9cdb-a11c6cdb55d0', 'Parrillada XXL',        NULL, 32.00, 'kitchen', true, 1),
  ('71a11e17-f0df-491f-9cdb-a11c6cdb55d0', 'Parrillada M',          NULL, 16.50, 'kitchen', true, 2),
  ('71a11e17-f0df-491f-9cdb-a11c6cdb55d0', 'Parrillada S',          NULL, 13.50, 'kitchen', true, 3);

-- 5. PLATOS A LA CARTA
INSERT INTO products (category_id, name, description, price, print_destination, available, sort_order) VALUES
  ('67caefe1-8c11-4c4b-b876-f387d03002d9', 'Chicharrón de pescado', NULL, 14.00, 'kitchen', true, 1),
  ('67caefe1-8c11-4c4b-b876-f387d03002d9', 'Fritada',               NULL, 13.00, 'kitchen', true, 2),
  ('67caefe1-8c11-4c4b-b876-f387d03002d9', 'Tripitas al carbón',    NULL, 11.90, 'kitchen', true, 3),
  ('67caefe1-8c11-4c4b-b876-f387d03002d9', 'Apanado de carne',      NULL, 14.50, 'kitchen', true, 4),
  ('67caefe1-8c11-4c4b-b876-f387d03002d9', 'Hornado',               NULL, 13.50, 'kitchen', true, 5),
  ('67caefe1-8c11-4c4b-b876-f387d03002d9', 'Chaulafan',             NULL, 14.00, 'kitchen', true, 6),
  ('67caefe1-8c11-4c4b-b876-f387d03002d9', 'Dorada frita o al carbón', NULL, 14.50, 'kitchen', true, 7),
  ('67caefe1-8c11-4c4b-b876-f387d03002d9', 'Tortillas con caucara', NULL, 13.50, 'kitchen', true, 8),
  ('67caefe1-8c11-4c4b-b876-f387d03002d9', 'Churrasco',             NULL, 14.50, 'kitchen', true, 9),
  ('67caefe1-8c11-4c4b-b876-f387d03002d9', 'Bandera',               NULL, 14.90, 'kitchen', true, 10),
  ('67caefe1-8c11-4c4b-b876-f387d03002d9', 'Guatita',               NULL, 12.50, 'kitchen', true, 11),
  ('67caefe1-8c11-4c4b-b876-f387d03002d9', 'Papas con cuero',       NULL, 12.80, 'kitchen', true, 12),
  ('67caefe1-8c11-4c4b-b876-f387d03002d9', 'Menestra pollo/chuleta',NULL, 14.50, 'kitchen', true, 13),
  ('67caefe1-8c11-4c4b-b876-f387d03002d9', 'Salchipapa',            NULL, 9.00,  'kitchen', true, 14),
  ('67caefe1-8c11-4c4b-b876-f387d03002d9', 'Papi pollo',            NULL, 12.00, 'kitchen', true, 15);
