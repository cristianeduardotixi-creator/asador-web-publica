/**
 * Enrutador de impresión en red local.
 *
 * Envía los comandos ESC/POS al agente de impresión LAN. El agente (un pequeño
 * servicio Node.js en el local) reenvía por TCP al IP:puerto de cada impresora.
 *
 * Si el agente no responde, se simula la impresión para demostración.
 */
import type { Order, OrderItem, Printer, Ticket } from './types';
import { buildComandaPrint, buildFiscalReceipt, buildPrecuenta, buildAnulacionTicket, type ComandaTicket, type RestaurantHeader } from './escpos';

export interface PrintResult {
  printer: Printer;
  success: boolean;
  simulated: boolean;
  error?: string;
}

async function sendToAgent(
  agentUrl: string,
  payload: { ip: string; port: number; raw: string },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 3000);
    const res = await fetch(`${agentUrl.replace(/\/$/, '')}/print`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Error de red' };
  }
}

/** Imprime una comanda en todas las impresoras necesarias (cocina + barra).
 *  La barra recibe SIEMPRE una copia completa de toda la comanda. */
export async function printComanda(
  order: Order,
  items: OrderItem[],
  printers: Printer[],
  agentUrl: string,
  header?: RestaurantHeader,
): Promise<PrintResult[]> {
  const activePrinters = printers.filter((p) => p.active);
  const hasKitchen = activePrinters.some((p) => p.destination === 'kitchen');
  const hasBar = activePrinters.some((p) => p.destination === 'bar');
  const results: PrintResult[] = [];

  for (const printer of activePrinters) {
    // Kitchen gets only kitchen items (normal behavior).
    // Bar gets a FULL COPY of all items (including kitchen items) so barra staff
    // know exactly what drinks to serve and what food was ordered for the table.
    const isBar = printer.destination === 'bar';
    const fullCopy = isBar && hasKitchen;
    const built = buildComandaPrint(order, items, printer, header, fullCopy);
    const r = await sendToAgent(agentUrl, {
      ip: printer.ip_address,
      port: printer.port,
      raw: built.raw,
    });
    results.push({
      printer,
      success: r.ok,
      simulated: !r.ok,
      error: r.error,
    });
  }
  return results;
}

/** Imprime el ticket fiscal en la impresora de barra. */
export async function printFiscalTicket(
  ticket: Ticket,
  items: OrderItem[],
  printers: Printer[],
  qrUrl: string,
  agentUrl: string,
  order?: { table_name: string | null; waiter_name: string | null } | null,
): Promise<PrintResult[]> {
  const bar = printers.find((p) => p.active && p.destination === 'bar');
  if (!bar) {
    return [{
      printer: { id: '', name: 'Barra', ip_address: '', port: 9100, destination: 'bar', active: false },
      success: false,
      simulated: true,
      error: 'No hay impresora de barra configurada',
    }];
  }
  const raw = buildFiscalReceipt(ticket, items, qrUrl, order);
  const r = await sendToAgent(agentUrl, { ip: bar.ip_address, port: bar.port, raw });
  return [{ printer: bar, success: r.ok, simulated: !r.ok, error: r.error }];
}

export interface PrecuentaPrintResult {
  printer: Printer;
  success: boolean;
  simulated: boolean;
  error?: string;
  raw?: string;
  previewHtml?: string;
}

/** Imprime una pre-cuenta informativa en la impresora de barra/caja.
 *  Si no hay impresora de barra activa o no responde, devuelve el contenido
 *  formateado (previewHtml) para mostrar un modal con window.print(). */
export async function printPrecuenta(
  order: Order,
  items: OrderItem[],
  printers: Printer[],
  agentUrl: string,
  header?: RestaurantHeader,
): Promise<PrecuentaPrintResult> {
  const bar = printers.find((p) => p.active && p.destination === 'bar');
  const raw = buildPrecuenta(order, items, header);
  if (!bar) {
    return {
      printer: { id: '', name: 'Barra', ip_address: '', port: 9100, destination: 'bar', active: false },
      success: false,
      simulated: true,
      error: 'No hay impresora de barra configurada',
      raw,
      previewHtml: precuentaToHtml(raw),
    };
  }
  const r = await sendToAgent(agentUrl, { ip: bar.ip_address, port: bar.port, raw });
  return {
    printer: bar,
    success: r.ok,
    simulated: !r.ok,
    error: r.error,
    raw: !r.ok ? raw : undefined,
    previewHtml: !r.ok ? precuentaToHtml(raw) : undefined,
  };
}

/** Convierte el raw ESC/POS de pre-cuenta a HTML simple para vista previa / window.print(). */
function precuentaToHtml(raw: string): string {
  const escaped = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  return `<div style="font-family:'Courier New',monospace;font-size:12px;white-space:pre;line-height:1.4;max-width:320px;margin:0 auto">${escaped}</div>`;
}

export type { ComandaTicket, RestaurantHeader };

/** Imprime un ticket de ANULACIÓN en la impresora de cocina.
 *  Notifica a cocina que debe detener la preparación del item. */
export async function printAnulacion(
  order: Order,
  item: OrderItem,
  printers: Printer[],
  agentUrl: string,
  header?: RestaurantHeader,
): Promise<PrintResult[]> {
  const kitchen = printers.filter((p) => p.active && p.destination === 'kitchen');
  if (kitchen.length === 0) {
    return [{
      printer: { id: '', name: 'Cocina', ip_address: '', port: 9100, destination: 'kitchen', active: false },
      success: false,
      simulated: true,
      error: 'No hay impresora de cocina configurada',
    }];
  }
  const results: PrintResult[] = [];
  for (const printer of kitchen) {
    const raw = buildAnulacionTicket(order, item, header);
    const r = await sendToAgent(agentUrl, { ip: printer.ip_address, port: printer.port, raw });
    results.push({ printer, success: r.ok, simulated: !r.ok, error: r.error });
  }
  return results;
}
