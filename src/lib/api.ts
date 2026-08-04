import { supabase } from './supabase';
import type {
  Category,
  Order,
  OrderItem,
  Printer,
  Product,
  RestaurantTable,
  SettingsMap,
  Ticket,
  Waiter,
  IvaBreakdownEntry,
  CashSession,
  CashMovement,
  Reservation,
} from './types';
import { buildAeatXml, buildQrUrl, computeFingerprint, formatAeatDate, formatAeatTime } from './fiscal';

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .eq('active', true)
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function fetchProducts(categoryId?: string): Promise<Product[]> {
  let q = supabase.from('products').select('*').order('sort_order');
  if (categoryId) q = q.eq('category_id', categoryId);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function fetchAllProducts(): Promise<Product[]> {
  const { data, error } = await supabase.from('products').select('*').order('sort_order');
  if (error) throw error;
  return data ?? [];
}

export async function fetchWaiters(): Promise<Waiter[]> {
  const { data, error } = await supabase
    .from('waiters')
    .select('*')
    .eq('active', true)
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function fetchAllWaiters(): Promise<Waiter[]> {
  const { data, error } = await supabase
    .from('waiters')
    .select('*')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

export async function createWaiter(name: string, pin: string): Promise<void> {
  const { error } = await supabase
    .from('waiters')
    .insert({ name, pin, active: true });
  if (error) throw error;
}

export async function updateWaiter(id: string, patch: Partial<Waiter>): Promise<void> {
  const { error } = await supabase.from('waiters').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteWaiter(id: string): Promise<void> {
  const { error } = await supabase.from('waiters').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchTables(): Promise<RestaurantTable[]> {
  const { data, error } = await supabase
    .from('restaurant_tables')
    .select('*')
    .order('section, pos_y, pos_x');
  if (error) throw error;
  return data ?? [];
}

export async function fetchPrinters(): Promise<Printer[]> {
  const { data, error } = await supabase.from('printers').select('*').order('destination');
  if (error) throw error;
  return data ?? [];
}

export async function fetchSettings(): Promise<SettingsMap> {
  const { data, error } = await supabase.from('settings').select('key, value');
  if (error) throw error;
  const map: SettingsMap = {};
  for (const r of data ?? []) map[r.key] = r.value;
  return map;
}

export async function upsertSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from('settings')
    .upsert({ key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}

export async function fetchOrders(status?: string): Promise<Order[]> {
  let q = supabase.from('orders').select('*').order('created_at', { ascending: false });
  if (status) q = q.eq('status', status);
  const { data, error } = await q.limit(200);
  if (error) throw error;
  return data ?? [];
}

export async function fetchActiveOrdersWithItems(): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .in('status', ['open', 'sent'])
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((o) => ({
    ...o,
    items: (o.order_items ?? []).sort((a: OrderItem, b: OrderItem) => a.created_at.localeCompare(b.created_at)),
  }));
}

// Aggregate ALL active orders + items for a given table.
// A table may have multiple orders during a sitting (e.g. drinks first,
// then food). This fetches every order (open or sent) for that table
// and returns the combined items + merged totals so the cobro modal
// shows the full consumption, not just the last order.
export async function fetchTableConsumption(tableId: string): Promise<{
  orders: Order[];
  items: OrderItem[];
  subtotal: number;
  tax_total: number;
  total: number;
}> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .in('status', ['open', 'sent'])
    .eq('table_id', tableId)
    .order('created_at', { ascending: true });
  if (error) throw error;

  const orders = (data ?? []) as unknown as (Order & { order_items: OrderItem[] })[];
  const items: OrderItem[] = [];
  for (const o of orders) {
    const active = (o.order_items ?? []).filter(
      (it) => it.status !== 'cancelled' && it.status !== 'served',
    );
    items.push(...active);
  }
  const totals = computeTotals(items);
  return {
    orders: orders.map((o) => ({ ...o, items: o.order_items })),
    items,
    ...totals,
  };
}

export async function fetchOrderItems(orderId: string): Promise<OrderItem[]> {
  const { data, error } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

export interface NewOrderInput {
  table_id: string | null;
  table_name: string | null;
  waiter_id: string | null;
  waiter_name: string | null;
  covers: number;
  notes?: string | null;
}

// Finds an existing active order for the table, or creates a new one.
// An "active" order is one with status NOT IN ('paid', 'cancelled').
// This prevents orphaning previous comandas when a second round is sent.
export async function getOrCreateActiveOrder(input: NewOrderInput): Promise<Order> {
  if (input.table_id) {
    const { data: existing, error: qErr } = await supabase
      .from('orders')
      .select('*')
      .eq('table_id', input.table_id)
      .in('status', ['open', 'sent'])
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();
    if (qErr) {
      console.error('[Supabase] Error buscando comanda activa:', qErr.message, qErr.code, qErr.details);
      throw new Error(`Error al buscar comanda activa: ${qErr.message}`);
    }
    if (existing) return existing;
  }
  return createOrder(input);
}

export async function createOrder(input: NewOrderInput): Promise<Order> {
  const { data, error } = await supabase
    .from('orders')
    .insert({
      table_id: input.table_id,
      table_name: input.table_name,
      waiter_id: input.waiter_id,
      waiter_name: input.waiter_name,
      covers: input.covers,
      status: 'open',
      subtotal: 0,
      tax_total: 0,
      total: 0,
      total_amount: 0,
      notes: input.notes ?? null,
    })
    .select('*')
    .single();
  if (error) {
    console.error('[Supabase] Error al insertar order:', error.message, error.code, error.details);
    throw new Error(`Error al crear comanda: ${error.message}`);
  }
  return data;
}

export const TAKEAWAY_SUPPLEMENT = 1;

function buildOrderItemRow(orderId: string, product: Product, quantity: number, notes: string, takeaway: boolean) {
  const unitPrice = takeaway ? product.price + TAKEAWAY_SUPPLEMENT : product.price;
  return {
    order_id: orderId,
    product_id: product.id,
    product_name: takeaway ? `${product.name} (Para Llevar)` : product.name,
    price: unitPrice,
    unit_price: unitPrice,
    iva_rate: product.iva_rate,
    quantity,
    notes: notes || null,
    status: 'pending',
    print_destination: product.print_destination ?? 'kitchen',
    takeaway,
  };
}

export async function addOrderItem(
  orderId: string,
  product: Product,
  quantity: number,
  notes: string,
  takeaway = false,
): Promise<OrderItem> {
  const { data, error } = await supabase
    .from('order_items')
    .insert(buildOrderItemRow(orderId, product, quantity, notes, takeaway))
    .select('*')
    .single();
  if (error) {
    console.error('[Supabase] Error al insertar order_item:', error.message, error.code, error.details);
    throw new Error(`Error al añadir plato: ${error.message}`);
  }
  return data;
}

export interface CartLineInput {
  product: Product;
  quantity: number;
  notes: string;
  takeaway: boolean;
}

export async function batchAddOrderItems(orderId: string, lines: CartLineInput[]): Promise<OrderItem[]> {
  const rows = lines
    .filter((l) => l.quantity > 0)
    .map((l) => buildOrderItemRow(orderId, l.product, l.quantity, l.notes, l.takeaway));
  if (rows.length === 0) return [];
  const { data, error } = await supabase
    .from('order_items')
    .insert(rows)
    .select('*');
  if (error) {
    console.error('[Supabase] Error al insertar order_items (batch):', error.message, error.code, error.details);
    throw new Error(`Error al añadir platos: ${error.message}`);
  }
  return (data ?? []) as OrderItem[];
}

export async function updateOrderItem(
  itemId: string,
  patch: Partial<OrderItem>,
): Promise<void> {
  const { error } = await supabase.from('order_items').update(patch).eq('id', itemId);
  if (error) throw error;
}

export async function deleteOrderItem(itemId: string): Promise<void> {
  const { error } = await supabase.from('order_items').delete().eq('id', itemId);
  if (error) throw error;
}

/** Cancela un item ya enviado (status='sent' o 'served'). Requiere PIN de admin.
 *  Marca el item como 'cancelled' y restaura stock si procede. */
export async function cancelOrderItem(itemId: string): Promise<OrderItem> {
  const { data: item, error: fErr } = await supabase
    .from('order_items')
    .select('*')
    .eq('id', itemId)
    .single();
  if (fErr) throw new Error('No se pudo encontrar el item a anular');
  const canceled = item as OrderItem;

  const { error: uErr } = await supabase
    .from('order_items')
    .update({ status: 'cancelled' })
    .eq('id', itemId);
  if (uErr) throw new Error('Error al anular el item');

  if (canceled.status === 'sent' && canceled.product_id) {
    await supabase.rpc('increment_stock', {
      p_product_id: canceled.product_id,
      p_qty: canceled.quantity,
    }).catch(() => {});
  }

  const items = await fetchOrderItems(canceled.order_id);
  const active = items.filter((it) => it.status !== 'cancelled');
  const totals = computeTotals(active);
  await supabase.from('orders').update({
    subtotal: totals.subtotal,
    tax_total: totals.tax_total,
    total: totals.total,
    total_amount: totals.total,
  }).eq('id', canceled.order_id);

  return canceled;
}

export async function setTableStatus(tableId: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('restaurant_tables')
    .update({ status })
    .eq('id', tableId);
  if (error) throw error;
}

export async function mergeTable(secondaryId: string, primaryId: string): Promise<void> {
  const { error: migErr } = await supabase
    .from('orders')
    .update({ table_id: primaryId })
    .eq('table_id', secondaryId)
    .in('status', ['open', 'sent']);
  if (migErr) throw migErr;
  const { error } = await supabase
    .from('restaurant_tables')
    .update({ merged_into: primaryId, status: 'occupied' })
    .eq('id', secondaryId);
  if (error) throw error;
}

export async function unmergeTable(tableId: string): Promise<void> {
  const { error } = await supabase
    .from('restaurant_tables')
    .update({ merged_into: null, status: 'free' })
    .eq('id', tableId);
  if (error) throw error;
}

function computeTotals(items: OrderItem[]): {
  subtotal: number;
  tax_total: number;
  total: number;
  breakdown: IvaBreakdownEntry[];
} {
  const byRate = new Map<number, { base: number; quota: number }>();
  let subtotal = 0;
  for (const it of items) {
    const line = it.price * it.quantity;
    subtotal += line;
    const base = line / (1 + it.iva_rate / 100);
    const quota = line - base;
    const cur = byRate.get(it.iva_rate) ?? { base: 0, quota: 0 };
    cur.base += base;
    cur.quota += quota;
    byRate.set(it.iva_rate, cur);
  }
  const breakdown: IvaBreakdownEntry[] = [...byRate.entries()]
    .map(([rate, v]) => ({
      rate,
      base: Math.round(v.base * 100) / 100,
      quota: Math.round(v.quota * 100) / 100,
    }))
    .sort((a, b) => a.rate - b.rate);
  const tax_total = breakdown.reduce((s, b) => s + b.quota, 0);
  return {
    subtotal: Math.round(subtotal * 100) / 100,
    tax_total: Math.round(tax_total * 100) / 100,
    total: Math.round(subtotal * 100) / 100,
    breakdown,
  };
}

// Recalculate restaurant_tables.current_total by summing all active
// (non-cancelled) order_items across all active orders for the table.
export async function recalcTableTotal(tableId: string): Promise<number> {
  const { data, error } = await supabase.rpc('recalc_table_total', {
    p_table_id: tableId,
  });
  if (error) {
    console.error('[Supabase] Error recalculando total de mesa:', error.message, error.code, error.details);
    throw new Error(`Error al recalcular total de mesa: ${error.message}`);
  }
  return data as number;
}

export async function sendOrder(orderId: string, tableId?: string): Promise<{ order: Order; items: OrderItem[] }> {
  // Only process NEW items (status='pending'). Items from previous comandas
  // that are already 'sent' must NOT be re-sent or have stock re-decremented.
  const allItems = await fetchOrderItems(orderId);
  const newItems = allItems.filter((it) => it.status === 'pending');

  // Mark only the new items as sent
  for (const it of newItems) {
    await supabase.from('order_items').update({ status: 'sent' }).eq('id', it.id);
  }

  // Decrement stock ONLY for the newly sent items (not previously sent ones)
  for (const it of newItems) {
    if (it.product_id) {
      await supabase.rpc('decrement_stock', {
        p_product_id: it.product_id,
        p_qty: it.quantity,
      });
    }
  }

  // Recalculate order totals based on ALL active items (old + new)
  const activeItems = allItems.filter((it) => it.status !== 'cancelled');
  const totals = computeTotals(activeItems);
  const { error: upErr } = await supabase
    .from('orders')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      subtotal: totals.subtotal,
      tax_total: totals.tax_total,
      total: totals.total,
      total_amount: totals.total,
    })
    .eq('id', orderId);
  if (upErr) {
    console.error('[Supabase] Error al actualizar order (sendOrder):', upErr.message, upErr.code, upErr.details);
    throw new Error(`Error al enviar comanda: ${upErr.message}`);
  }

  // Recalculate the table's accumulated current_total across ALL active orders
  if (tableId) {
    await recalcTableTotal(tableId).catch(() => {});
  }

  const { data: order, error: oErr } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();
  if (oErr) throw oErr;
  return { order, items: allItems.map((i) => ({ ...i, status: i.status === 'cancelled' ? i.status : 'sent' as const })) };
}

export async function addStock(productId: string, quantity: number): Promise<void> {
  const { error } = await supabase.rpc('increment_stock', {
    p_product_id: productId,
    p_qty: quantity,
  });
  if (error) throw error;
}

export async function setStock(productId: string, quantity: number): Promise<void> {
  const { error } = await supabase
    .from('products')
    .update({ stock_actual: quantity })
    .eq('id', productId);
  if (error) throw error;
}

export interface CustomerData {
  name: string;
  nif: string;
  address: string;
  phone: string;
  email: string;
  customer_id?: string | null;
}

/** Busca clientes por NIF/CIF o por nombre (partial match, case-insensitive). */
export async function searchCustomers(query: string): Promise<Customer[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const { data, error } = await supabase
    .from('customers')
    .select('*')
    .or(`tax_id.ilike.%${q}%,name.ilike.%${q}%`)
    .order('name')
    .limit(10);
  if (error) throw error;
  return (data ?? []) as Customer[];
}

/** Crea un nuevo cliente fiscal. Si el NIF ya existe, actualiza los datos. */
export async function saveCustomer(c: CustomerData): Promise<Customer> {
  const row = {
    tax_id: c.nif || null,
    name: c.name,
    address: c.address || null,
    postal_code: null,
    city: null,
    phone: c.phone || null,
    email: c.email || null,
  };
  if (c.nif) {
    const { data: existing } = await supabase
      .from('customers')
      .select('*')
      .eq('tax_id', c.nif)
      .maybeSingle();
    if (existing) {
      const { data, error } = await supabase
        .from('customers')
        .update(row)
        .eq('id', (existing as Customer).id)
        .select('*')
        .single();
      if (error) throw error;
      return data as Customer;
    }
  }
  const { data, error } = await supabase
    .from('customers')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;
  return data as Customer;
}

export async function payOrder(
  orderId: string,
  method: 'cash' | 'card',
  amount: number,
  change: number,
  settings: SettingsMap,
  customer?: CustomerData,
): Promise<Ticket> {
  const items = await fetchOrderItems(orderId);
  const totals = computeTotals(items);
  const { data: order, error: oErr } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .single();
  if (oErr) throw oErr;

  const now = new Date();
  const nif = settings.restaurant_nif || settings.verifactu_nif || 'B00000000';
  const mode = (settings.verifactu_mode as 'SANDBOX' | 'LIVE') || 'SANDBOX';
  const issuerName = settings.restaurant_legal_name || settings.verifactu_issuer_name || 'Restaurante';
  const issuerAddress = settings.restaurant_address || settings.verifactu_issuer_address || '';
  const commercialName = settings.restaurant_name || settings.restaurant_trade_name || issuerName;
  const phone = settings.restaurant_phone || '';
  const email = settings.restaurant_email || '';

  const { data: fiscal, error: fErr } = await supabase.rpc('create_fiscal_ticket', {
    p_order_id: orderId,
    p_nif_emisor: nif,
    p_issuer_name: issuerName,
    p_issuer_address: issuerAddress,
    p_ticket_datetime: now.toISOString(),
    p_subtotal: totals.subtotal,
    p_tax_total: totals.tax_total,
    p_total: totals.total,
    p_iva_breakdown: totals.breakdown,
    p_payment_method: method,
    p_payment_amount: amount,
    p_payment_change: change,
    p_commercial_name: commercialName,
    p_phone: phone,
    p_email: email,
    p_is_invoice: !!customer,
    p_recipient_name: customer?.name ?? null,
    p_recipient_nif: customer?.nif ?? null,
    p_recipient_address: customer?.address ?? null,
    p_recipient_phone: customer?.phone ?? null,
    p_recipient_email: customer?.email ?? null,
  });
  if (fErr) throw fErr;
  if (!fiscal) throw new Error('No se pudo generar el ticket fiscal');

  const { data: ticket, error: tErr } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', fiscal.id)
    .single();
  if (tErr) throw tErr;

  const qrUrl = buildQrUrl(
    mode,
    nif,
    fiscal.ticket_number,
    now,
    totals.total,
    fiscal.hash,
  );
  const xml = buildAeatXml(mode, ticket, issuerName, issuerAddress);

  await supabase
    .from('tickets')
    .update({ qr_url: qrUrl, xml_content: xml })
    .eq('id', fiscal.id);

  await supabase
    .from('orders')
    .update({ status: 'paid', paid_at: now.toISOString(), payment_method: method })
    .eq('id', orderId);

  if (order.table_id) {
    await setTableStatus(order.table_id, 'free');
    await recalcTableTotal(order.table_id).catch(() => {});
  }

  return { ...ticket, qr_url: qrUrl, xml_content: xml };
}

// Pay ALL active orders for a table in a single fiscal ticket.
// A table may accumulate multiple orders during a sitting (drinks, then food).
// This aggregates every active order_item across all open/sent orders for that
// table, generates ONE fiscal ticket for the combined total, then marks every
// order as paid and frees the table.
export async function payTable(
  tableId: string,
  method: 'cash' | 'card',
  amount: number,
  change: number,
  settings: SettingsMap,
  customer?: CustomerData,
): Promise<Ticket> {
  const { orders, items } = await fetchTableConsumption(tableId);
  if (orders.length === 0) throw new Error('No hay comandas activas en esta mesa');
  if (items.length === 0) throw new Error('No hay productos pendientes de cobro en esta mesa');

  const totals = computeTotals(items);
  const primaryOrder = orders[0];
  const now = new Date();
  const nif = settings.restaurant_nif || settings.verifactu_nif || 'B00000000';
  const mode = (settings.verifactu_mode as 'SANDBOX' | 'LIVE') || 'SANDBOX';
  const issuerName = settings.restaurant_legal_name || settings.verifactu_issuer_name || 'Restaurante';
  const issuerAddress = settings.restaurant_address || settings.verifactu_issuer_address || '';
  const commercialName = settings.restaurant_name || settings.restaurant_trade_name || issuerName;
  const phone = settings.restaurant_phone || '';
  const email = settings.restaurant_email || '';

  const { data: fiscal, error: fErr } = await supabase.rpc('create_fiscal_ticket', {
    p_order_id: primaryOrder.id,
    p_nif_emisor: nif,
    p_issuer_name: issuerName,
    p_issuer_address: issuerAddress,
    p_ticket_datetime: now.toISOString(),
    p_subtotal: totals.subtotal,
    p_tax_total: totals.tax_total,
    p_total: totals.total,
    p_iva_breakdown: totals.breakdown,
    p_payment_method: method,
    p_payment_amount: amount,
    p_payment_change: change,
    p_commercial_name: commercialName,
    p_phone: phone,
    p_email: email,
    p_is_invoice: !!customer,
    p_recipient_name: customer?.name ?? null,
    p_recipient_nif: customer?.nif ?? null,
    p_recipient_address: customer?.address ?? null,
    p_recipient_phone: customer?.phone ?? null,
    p_recipient_email: customer?.email ?? null,
  });
  if (fErr) throw fErr;
  if (!fiscal) throw new Error('No se pudo generar el ticket fiscal');

  const { data: ticket, error: tErr } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', fiscal.id)
    .single();
  if (tErr) throw tErr;

  const qrUrl = buildQrUrl(mode, nif, fiscal.ticket_number, now, totals.total, fiscal.hash);
  const xml = buildAeatXml(mode, ticket, issuerName, issuerAddress);

  await supabase
    .from('tickets')
    .update({ qr_url: qrUrl, xml_content: xml })
    .eq('id', fiscal.id);

  // Mark ALL orders for this table as paid
  await supabase
    .from('orders')
    .update({ status: 'paid', paid_at: now.toISOString(), payment_method: method, customer_id: customer?.customer_id ?? null })
    .in('id', orders.map((o) => o.id));

  // Mark all items as served (completed)
  await supabase
    .from('order_items')
    .update({ status: 'served' })
    .in('order_id', orders.map((o) => o.id));

  // Link the ticket to the customer
  if (customer?.customer_id) {
    await supabase.from('tickets').update({ customer_id: customer.customer_id }).eq('id', fiscal.id);
  }

  // Free the table and reset its accumulated total
  await setTableStatus(tableId, 'free');
  await recalcTableTotal(tableId).catch(() => {});

  return { ...ticket, qr_url: qrUrl, xml_content: xml };
}

export async function fetchTickets(limit = 100): Promise<Ticket[]> {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .order('sequence', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function fetchTicket(id: string): Promise<Ticket | null> {
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function voidTicket(
  ticketId: string,
  settings: SettingsMap,
): Promise<{ rectificativa: Ticket; originalNumber: string }> {
  const { data: result, error: rpcErr } = await supabase.rpc('void_ticket', {
    p_original_ticket_id: ticketId,
    p_reason: 'Anulación por error de cobro',
  });
  if (rpcErr) throw rpcErr;
  if (!result) throw new Error('No se pudo anular el ticket');

  // Fetch the rectificativa ticket
  const { data: rect, error: rErr } = await supabase
    .from('tickets')
    .select('*')
    .eq('id', result.rectificativa_id)
    .single();
  if (rErr) throw rErr;

  // Build QR + XML for the rectificativa
  const now = new Date(rect.ticket_datetime);
  const nif = settings.restaurant_nif || settings.verifactu_nif || 'B00000000';
  const mode = (settings.verifactu_mode as 'SANDBOX' | 'LIVE') || 'SANDBOX';
  const issuerName = settings.restaurant_legal_name || settings.verifactu_issuer_name || 'Restaurante';
  const issuerAddress = settings.restaurant_address || settings.verifactu_issuer_address || '';

  const qrUrl = buildQrUrl(
    mode,
    nif,
    rect.ticket_number,
    now,
    rect.total,
    rect.hash,
  );
  const xml = buildAeatXml(mode, rect, issuerName, issuerAddress);

  await supabase
    .from('tickets')
    .update({ qr_url: qrUrl, xml_content: xml })
    .eq('id', rect.id);

  return {
    rectificativa: { ...rect, qr_url: qrUrl, xml_content: xml },
    originalNumber: result.original_number,
  };
}

export async function fetchTodayTickets(): Promise<Ticket[]> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('tickets')
    .select('*')
    .gte('ticket_datetime', start.toISOString())
    .order('sequence', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

// =========================================================
// CASH MANAGEMENT (Caja)
// =========================================================

export async function fetchTodayCashSession(): Promise<CashSession | null> {
  const today = new Date().toISOString().slice(0, 10);
  const { data, error } = await supabase
    .from('cash_sessions')
    .select('*')
    .eq('session_date', today)
    .maybeSingle();
  if (error) throw error;
  return data as CashSession | null;
}

export async function openCashSession(amount: number, openedBy: string): Promise<CashSession> {
  const { data, error } = await supabase
    .from('cash_sessions')
    .insert({
      session_date: new Date().toISOString().slice(0, 10),
      opening_amount: amount,
      status: 'open',
      opened_by: openedBy,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as CashSession;
}

export async function closeCashSession(
  sessionId: string,
  realCash: number,
  expectedCash: number,
  closedBy: string,
  notes?: string,
): Promise<CashSession> {
  const difference = Math.round((realCash - expectedCash) * 100) / 100;
  const { data, error } = await supabase
    .from('cash_sessions')
    .update({
      status: 'closed',
      closing_amount: realCash,
      expected_cash: expectedCash,
      difference,
      closed_by: closedBy,
      closed_at: new Date().toISOString(),
      notes: notes ?? null,
    })
    .eq('id', sessionId)
    .select('*')
    .single();
  if (error) throw error;
  return data as CashSession;
}

export async function fetchCashMovements(sessionId: string): Promise<CashMovement[]> {
  const { data, error } = await supabase
    .from('cash_movements')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as CashMovement[];
}

export async function addCashMovement(
  sessionId: string,
  amount: number,
  reason: string,
  type: 'exit' | 'entry' = 'exit',
  createdBy?: string,
): Promise<CashMovement> {
  const { data, error } = await supabase
    .from('cash_movements')
    .insert({
      session_id: sessionId,
      amount,
      reason,
      type,
      created_by: createdBy ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data as CashMovement;
}

export async function deleteCashMovement(id: string): Promise<void> {
  const { error } = await supabase.from('cash_movements').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchCashSessions(limit = 90): Promise<CashSession[]> {
  const { data, error } = await supabase
    .from('cash_sessions')
    .select('*')
    .order('session_date', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as CashSession[];
}

// =========================================================
// RESERVATIONS
// =========================================================

export async function fetchReservations(date?: string): Promise<Reservation[]> {
  let q = supabase.from('reservations').select('*').order('reservation_time');
  if (date) q = q.eq('reservation_date', date);
  else q = q.eq('reservation_date', new Date().toISOString().slice(0, 10));
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Reservation[];
}

export async function createReservation(r: Omit<Reservation, 'id' | 'created_at'>): Promise<Reservation> {
  const { data, error } = await supabase
    .from('reservations')
    .insert(r)
    .select('*')
    .single();
  if (error) throw error;
  return data as Reservation;
}

export async function updateReservation(id: string, patch: Partial<Reservation>): Promise<void> {
  const { error } = await supabase.from('reservations').update(patch).eq('id', id);
  if (error) throw error;
}

export async function deleteReservation(id: string): Promise<void> {
  const { error } = await supabase.from('reservations').delete().eq('id', id);
  if (error) throw error;
}

// =========================================================
// MOVE TABLE (traspasar comanda)
// =========================================================

export async function moveTable(fromId: string, toId: string): Promise<void> {
  // Migrate all active orders from one table to another
  const { error: oErr } = await supabase
    .from('orders')
    .update({ table_id: toId })
    .eq('table_id', fromId)
    .in('status', ['open', 'sent']);
  if (oErr) throw oErr;
  // Update table statuses: source becomes free, destination becomes occupied
  await setTableStatus(fromId, 'free');
  await setTableStatus(toId, 'occupied');
  await recalcTableTotal(toId).catch(() => {});
  await recalcTableTotal(fromId).catch(() => {});
}

export { computeFingerprint, formatAeatDate, formatAeatTime };
