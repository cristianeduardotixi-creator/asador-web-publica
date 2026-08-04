/*
# Añadir payment_method a orders

## Resumen
Añade una columna `payment_method` a la tabla `orders` para registrar
el método de pago (cash/card) cuando se cobra una mesa. Esto permite
saber cómo se pagó cada comanda sin tener que consultar la tabla tickets.

## Cambios
1. Tabla `orders`: nueva columna `payment_method` (text, nullable).
   Valores esperados: 'cash', 'card' o NULL (no cobrado aún).
2. Seguridad: sin cambios en RLS — las políticas CRUD existentes de
   orders ya cubren la nueva columna (TO anon, authenticated).
*/

ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method text;
