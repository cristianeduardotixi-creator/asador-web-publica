/*
# Estado "Pidiendo cuenta" en mesas

Añade el estado 'requesting_bill' a la restricción CHECK de
restaurant_tables.status para poder marcar mesas que han solicitado
la pre-cuenta. Distintivo visual naranja en el mapa de mesas.
*/

ALTER TABLE restaurant_tables DROP CONSTRAINT IF EXISTS restaurant_tables_status_check;
ALTER TABLE restaurant_tables ADD CONSTRAINT restaurant_tables_status_check
  CHECK (status IN ('free','occupied','reserved','requesting_bill'));
