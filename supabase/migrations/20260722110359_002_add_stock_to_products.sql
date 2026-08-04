/*
# Añadir control de stock a productos

## Resumen
Añade una columna `stock_actual` a la tabla `products` para el control de inventario.
Cada vez que se envía una comanda, la aplicación descuenta las unidades vendidas.
No se permite stock negativo desde la lógica de la app (0 = agotado).

## Cambios
1. Tabla modificada: `products`
   - Nueva columna `stock_actual` (integer, NOT NULL, default 0):
     cantidad de unidades disponibles del producto.
2. Inicialización: se asigna un stock inicial razonable a los productos existentes
   (50 unidades para bebidas/café, 30 para cocina) para que el inventario
   sea funcional desde el primer momento.
3. Seguridad: sin cambios en RLS (las políticas existentes de products ya
   cubren CRUD para anon/authenticated).
*/

ALTER TABLE products ADD COLUMN IF NOT EXISTS stock_actual integer NOT NULL DEFAULT 0;

-- Stock inicial razonable para productos ya existentes
UPDATE products
SET stock_actual = CASE
  WHEN print_destination = 'bar' THEN 50
  WHEN print_destination IS NULL THEN 50
  ELSE 30
END
WHERE stock_actual = 0;