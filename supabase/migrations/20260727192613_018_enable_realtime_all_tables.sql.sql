/*
# Publicar tablas en realtime

## Resumen
Añade products, categories, printers, waiters, settings y tickets a la
publicación supabase_realtime para que la app reciba cambios en tiempo real.
orders, order_items y restaurant_tables ya estaban publicadas.

## Cambios
- ALTER PUBLICATION supabase_realtime ADD TABLE para cada tabla faltante.
*/
ALTER PUBLICATION supabase_realtime ADD TABLE products;
ALTER PUBLICATION supabase_realtime ADD TABLE categories;
ALTER PUBLICATION supabase_realtime ADD TABLE printers;
ALTER PUBLICATION supabase_realtime ADD TABLE waiters;
ALTER PUBLICATION supabase_realtime ADD TABLE settings;
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
