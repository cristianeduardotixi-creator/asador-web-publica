/**
 * Generación de comandos ESC/POS para impresoras térmicas en red (puerto 9100).
 *
 * La app envía los comandos al agente de impresión local (LAN), que reenvía
 * por socket TCP a la impresora. Si el agente no está disponible, se simula.
 */
import type { Order, OrderItem, Printer, Ticket } from './types';
import { formatEUR, formatTime } from './format';

const ESC = '\x1b';
const GS = '\x1d';
const INIT = `${ESC}@`;
const BOLD_ON = `${ESC}E\x01`;
const BOLD_OFF = `${ESC}E\x00`;
const DOUBLE_ON = `${GS}!\x11`;
const DOUBLE_OFF = `${GS}!\x00`;
const CENTER = `${ESC}a\x01`;
const LEFT = `${ESC}a\x00`;
const CUT = `${GS}V\x41\x00`;
const LF = '\n';

export interface RestaurantHeader {
  commercialName: string;
  legalName: string;
  nif: string;
  address: string;
  postalCode: string;
  phone: string;
  email: string;
}

function pad(str: string, len: number): string {
  const s = str.length > len ? str.slice(0, len) : str;
  return s + ' '.repeat(Math.max(0, len - s.length));
}

function lineItem(qty: number, name: string, price: string, width = 32): string {
  const qtyStr = `${qty}x`;
  const left = `${pad(qtyStr, 4)} ${pad(name, width - 4 - 9)}`;
  return `${left}${pad(price, 9)}${LF}`;
}

function buildHeader(h: RestaurantHeader, w = 32): string {
  let raw = INIT + CENTER + BOLD_ON + DOUBLE_ON;
  raw += (h.commercialName || h.legalName || 'Restaurante').slice(0, 16);
  raw += DOUBLE_OFF + BOLD_OFF + LF;
  if (h.address) raw += h.address.slice(0, w) + LF;
  if (h.postalCode) raw += `C.P. ${h.postalCode} - Parla (Madrid)` + LF;
  if (h.nif) raw += `N.I.F.: ${h.nif}` + LF;
  if (h.phone) raw += `Tel: ${h.phone}` + LF;
  return raw;
}

export interface ComandaTicket {
  printer: Printer;
  lines: string[];
  raw: string;
}

/** Construye el contenido ESC/POS para una impresora concreta. */
export function buildComandaPrint(
  order: Order,
  items: OrderItem[],
  printer: Printer,
  header?: RestaurantHeader,
  fullCopy = false,
): ComandaTicket {
  const dest = printer.destination;
  // When fullCopy is true, send ALL items to BOTH printers (bar gets a full copy)
  const filtered = fullCopy ? items : items.filter((it) => it.print_destination === dest);
  const lines: string[] = [];
  const w = 32;

  let raw = INIT + CENTER + BOLD_ON + DOUBLE_ON;
  raw += dest === 'kitchen' ? '*** COCINA ***' : '*** BARRA ***';
  raw += DOUBLE_OFF + BOLD_OFF + LF + LF;

  if (header) {
    raw += BOLD_ON + (header.commercialName || header.legalName || '').slice(0, w) + BOLD_OFF + LF;
  }
  raw += BOLD_ON + `Mesa: ${order.table_name ?? '—'}` + BOLD_OFF + LF;
  raw += `Camarero: ${order.waiter_name ?? '—'}` + LF;
  raw += `Hora: ${formatTime(order.sent_at ?? order.created_at)}` + LF;
  raw += `Cubiertos: ${order.covers}` + LF;
  raw += '-'.repeat(w) + LF + LF;

  if (filtered.length === 0) {
    raw += CENTER + '(nada para esta impresora)' + LF + LF;
  } else {
    for (const it of filtered) {
      raw += LEFT + BOLD_ON + lineItem(it.quantity, it.product_name, '', w) + BOLD_OFF;
      if (it.takeaway) raw += `   [PARA LLEVAR]${LF}`;
      if (it.notes) raw += `   \u{1F4DD} "${it.notes}"${LF}`;
    }
  }

  raw += LF + '-'.repeat(w) + LF + CENTER + LF + CUT;
  lines.push(raw);
  return { printer, lines, raw };
}

/** Pre-cuenta informativa (no es documento fiscal). Formato 80mm. */
export function buildPrecuenta(
  order: Order,
  items: OrderItem[],
  header?: RestaurantHeader,
): string {
  const w = 32;
  let raw = buildHeader(header ?? { commercialName: '', legalName: '', nif: '', address: '', postalCode: '', phone: '', email: '' }, w);
  raw += '-'.repeat(w) + LF + CENTER + BOLD_ON + DOUBLE_ON;
  raw += 'PRE-CUENTA';
  raw += DOUBLE_OFF + BOLD_OFF + LF;
  raw += CENTER + BOLD_ON + 'BORRADOR' + BOLD_OFF + LF;
  raw += CENTER + 'DOCUMENTO NO VALIDO' + LF;
  raw += CENTER + 'COMO FACTURA' + LF;
  raw += '-'.repeat(w) + LF + LEFT;
  raw += `Mesa: ${order.table_name ?? '—'}${LF}`;
  raw += `Camarero: ${order.waiter_name ?? '—'}${LF}`;
  raw += `Fecha: ${new Date(order.sent_at ?? order.created_at).toLocaleString('es-ES')}${LF}`;
  raw += '-'.repeat(w) + LF;

  let total = 0;
  const byRate = new Map<number, { base: number; quota: number }>();
  for (const it of items) {
    const lineTotal = it.price * it.quantity;
    total += lineTotal;
    const base = lineTotal / (1 + it.iva_rate / 100);
    const quota = lineTotal - base;
    const cur = byRate.get(it.iva_rate) ?? { base: 0, quota: 0 };
    cur.base += base;
    cur.quota += quota;
    byRate.set(it.iva_rate, cur);
    const unitPrice = it.price;
    raw += lineItem(it.quantity, it.product_name, formatEUR(lineTotal), w);
    raw += `   ${formatEUR(unitPrice)} / ud${LF}`;
    if (it.takeaway) raw += `   [PARA LLEVAR]${LF}`;
    if (it.notes) raw += `   > ${it.notes}${LF}`;
  }
  raw += '-'.repeat(w) + LF;

  const baseTotal = total / 1.1;
  const taxTotal = total - baseTotal;
  for (const [rate, br] of byRate) {
    raw += `Base ${rate}%: ${formatEUR(br.base)}${LF}`;
    raw += `IVA ${rate}%: ${formatEUR(br.quota)}${LF}`;
  }
  raw += '-'.repeat(w) + LF;
  raw += `Base Imponible: ${formatEUR(baseTotal)}${LF}`;
  raw += `IVA Total: ${formatEUR(taxTotal)}${LF}`;
  raw += BOLD_ON + `TOTAL: ${formatEUR(total)}${BOLD_OFF}${LF}`;
  raw += '-'.repeat(w) + LF + CENTER;
  raw += 'Gracias por su visita' + LF + LF + CUT;
  return raw;
}

/** Ticket fiscal de barra en ESC/POS. El QR y la huella criptográfica se
 *  generan internamente pero NO se imprimen (ocultos temporalmente). */
export function buildFiscalReceipt(
  ticket: Ticket,
  items: OrderItem[],
  qrUrl: string,
  order?: { table_name: string | null; waiter_name: string | null } | null,
): string {
  void qrUrl; // QR generado internamente, no se imprime de momento
  const w = 32;
  const header: RestaurantHeader = {
    commercialName: ticket.commercial_name ?? ticket.issuer_name,
    legalName: ticket.issuer_name,
    nif: ticket.nif_emisor,
    address: ticket.issuer_address ?? '',
    postalCode: '',
    phone: ticket.phone ?? '',
    email: ticket.email ?? '',
  };
  const isRect = ticket.ticket_type === 'rectificativa';
  const isInvoice = ticket.is_invoice;
  const dt = new Date(ticket.ticket_datetime);
  const pad = (n: number) => String(n).padStart(2, '0');
  const dateStr = `${pad(dt.getDate())}/${pad(dt.getMonth() + 1)}/${dt.getFullYear()} ${pad(dt.getHours())}:${pad(dt.getMinutes())}`;

  let raw = buildHeader(header, w);
  raw += '-'.repeat(w) + LF + LEFT;

  // Cabecera de venta: Nº Ticket | Fecha/Hora | Mesa/Zona | Camarero
  raw += `N. Ticket: ${ticket.ticket_number}${LF}`;
  raw += `Fecha: ${dateStr}${LF}`;
  if (order?.table_name) raw += `Mesa/Zona: ${order.table_name}${LF}`;
  if (order?.waiter_name) raw += `Atendido por: ${order.waiter_name}${LF}`;

  if (isRect && ticket.rectifies_ticket_number) {
    raw += BOLD_ON + `Rectifica: ${ticket.rectifies_ticket_number}` + BOLD_OFF + LF;
  }

  // Bloque opcional "DATOS DEL CLIENTE" (factura nominativa)
  if (isInvoice && ticket.recipient_name) {
    raw += '-'.repeat(w) + LF + CENTER + BOLD_ON;
    raw += '--- DATOS DEL CLIENTE ---';
    raw += BOLD_OFF + LF + LEFT;
    raw += `Nombre/Razon: ${ticket.recipient_name}${LF}`;
    if (ticket.recipient_nif) raw += `NIF/CIF: ${ticket.recipient_nif}${LF}`;
    if (ticket.recipient_address) raw += `Direccion: ${ticket.recipient_address}${LF}`;
  }

  raw += '-'.repeat(w) + LF + LEFT;

  for (const it of items) {
    const lineTotal = isRect ? -(it.price * it.quantity) : it.price * it.quantity;
    raw += lineItem(it.quantity, it.product_name, formatEUR(lineTotal), w);
    raw += `   ${formatEUR(it.price)} / ud${LF}`;
  }
  raw += '-'.repeat(w) + LF;

  // Resumen económico e impuestos
  for (const b of ticket.iva_breakdown) {
    const base = isRect ? -b.base : b.base;
    const quota = isRect ? -b.quota : b.quota;
    raw += `Base Imp. ${b.rate}%: ${formatEUR(base)}${LF}`;
    raw += `IVA ${b.rate}%: ${formatEUR(quota)}${LF}`;
  }
  raw += '-'.repeat(w) + LF;
  const baseTotal = isRect ? -(ticket.subtotal - ticket.tax_total) : ticket.subtotal - ticket.tax_total;
  const taxTotal = isRect ? -ticket.tax_total : ticket.tax_total;
  const total = isRect ? -ticket.total : ticket.total;
  raw += `Subtotal: ${formatEUR(baseTotal)}${LF}`;
  raw += `IVA (10%): ${formatEUR(taxTotal)}${LF}`;
  raw += BOLD_ON + `TOTAL A PAGAR: ${formatEUR(total)}${BOLD_OFF}${LF}`;
  if (ticket.payment_method) {
    raw += `Pago: ${ticket.payment_method === 'cash' ? 'Efectivo' : 'Tarjeta'}${LF}`;
    if (ticket.payment_amount != null)
      raw += `Entregado: ${formatEUR(ticket.payment_amount)}${LF}`;
    if (ticket.payment_change != null)
      raw += `Cambio: ${formatEUR(ticket.payment_change)}${LF}`;
  }

  // Pie de página — sin QR ni huella visible
  raw += '-'.repeat(w) + LF + CENTER;
  raw += (isInvoice ? 'Factura completada' : 'Factura simplificada') + LF;
  raw += LF + 'Gracias por su visita!' + LF + LF + CUT;
  return raw;
}

/** Ticket de anulación para cocina. Se imprime cuando se cancela un item ya enviado. */
export function buildAnulacionTicket(
  order: Order,
  item: OrderItem,
  header?: RestaurantHeader,
): string {
  const w = 32;
  let raw = INIT + CENTER + BOLD_ON + DOUBLE_ON;
  raw += '*** ANULACION ***';
  raw += DOUBLE_OFF + BOLD_OFF + LF + LF;
  if (header) {
    raw += BOLD_ON + (header.commercialName || header.legalName || '').slice(0, w) + BOLD_OFF + LF;
  }
  raw += BOLD_ON + `Mesa: ${order.table_name ?? '—'}` + BOLD_OFF + LF;
  raw += `Camarero: ${order.waiter_name ?? '—'}` + LF;
  raw += `Hora: ${formatTime(new Date().toISOString())}` + LF;
  raw += '-'.repeat(w) + LF + LF;
  raw += LEFT + BOLD_ON + `ANULAR: ${item.quantity}x ${item.product_name}` + BOLD_OFF + LF;
  if (item.notes) raw += `   Nota: "${item.notes}"${LF}`;
  raw += LF + '-'.repeat(w) + LF + CENTER + LF + CUT;
  return raw;
}

