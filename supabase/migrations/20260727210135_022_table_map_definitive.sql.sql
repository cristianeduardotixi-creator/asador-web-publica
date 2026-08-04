/*
# Mapa de mesas definitivo + función unir mesas

- Añade columna merged_into a restaurant_tables
- Trigger: al liberar una mesa principal, libera y desune sus mesas secundarias
- Reemplaza todos los registros con la distribución exacta:
  Barra (4 vertical), Sala (8 en 2 columnas), Terraza (9 en rejilla)
*/

ALTER TABLE restaurant_tables ADD COLUMN IF NOT EXISTS merged_into uuid
  REFERENCES restaurant_tables(id) ON DELETE SET NULL;

-- Trigger: cuando una mesa principal pasa a 'free', liberar sus mesas unidas
CREATE OR REPLACE FUNCTION free_merged_tables()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'free' AND OLD.status <> 'free' THEN
    UPDATE restaurant_tables
      SET status = 'free', merged_into = NULL
      WHERE merged_into = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_free_merged ON restaurant_tables;
CREATE TRIGGER trg_free_merged
  AFTER UPDATE ON restaurant_tables
  FOR EACH ROW
  EXECUTE FUNCTION free_merged_tables();

-- Reemplazar todos los registros
DELETE FROM restaurant_tables;

INSERT INTO restaurant_tables (table_number, name, section, area, pos_x, pos_y, status, active, seats, current_total, merged_into) VALUES
-- ZONA BARRA (4 puestos en columna vertical)
('B1', 'B1', 'Barra', 'Barra', 1, 1, 'free', true, 1, 0, NULL),
('B2', 'B2', 'Barra', 'Barra', 1, 2, 'free', true, 1, 0, NULL),
('B3', 'B3', 'Barra', 'Barra', 1, 3, 'free', true, 1, 0, NULL),
('B4', 'B4', 'Barra', 'Barra', 1, 4, 'free', true, 1, 0, NULL),
-- ZONA SALA (8 mesas en 2 columnas)
('M1', 'M1', 'Sala', 'Sala', 1, 1, 'free', true, 4, 0, NULL),
('M2', 'M2', 'Sala', 'Sala', 2, 1, 'free', true, 4, 0, NULL),
('M3', 'M3', 'Sala', 'Sala', 1, 2, 'free', true, 4, 0, NULL),
('M4', 'M4', 'Sala', 'Sala', 2, 2, 'free', true, 4, 0, NULL),
('M5', 'M5', 'Sala', 'Sala', 1, 3, 'free', true, 4, 0, NULL),
('M6', 'M6', 'Sala', 'Sala', 2, 3, 'free', true, 4, 0, NULL),
('M7', 'M7', 'Sala', 'Sala', 1, 4, 'free', true, 4, 0, NULL),
('M8', 'M8', 'Sala', 'Sala', 2, 4, 'free', true, 4, 0, NULL),
-- ZONA TERRAZA (9 mesas en cuadrícula)
('T1', 'T1', 'Terraza', 'Terraza', 1, 1, 'free', true, 4, 0, NULL),
('T2', 'T2', 'Terraza', 'Terraza', 2, 1, 'free', true, 4, 0, NULL),
('T3', 'T3', 'Terraza', 'Terraza', 3, 1, 'free', true, 4, 0, NULL),
('T4', 'T4', 'Terraza', 'Terraza', 4, 1, 'free', true, 4, 0, NULL),
('T5', 'T5', 'Terraza', 'Terraza', 1, 2, 'free', true, 4, 0, NULL),
('T6', 'T6', 'Terraza', 'Terraza', 2, 2, 'free', true, 4, 0, NULL),
('T7', 'T7', 'Terraza', 'Terraza', 3, 2, 'free', true, 4, 0, NULL),
('T8', 'T8', 'Terraza', 'Terraza', 4, 2, 'free', true, 4, 0, NULL),
('T9', 'T9', 'Terraza', 'Terraza', 5, 2, 'free', true, 4, 0, NULL);
