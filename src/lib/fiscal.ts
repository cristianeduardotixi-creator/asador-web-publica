/**
 * Motor fiscal Veri*Factu (Real Decreto 1007/2023).
 *
 * La cadena SHA-256 la calcula y persiste la base de datos de forma atómica
 * (función create_fiscal_ticket). Este módulo cliente:
 *  - construye la huella de verificación (para mostrarla / reimprimirla),
 *  - genera la URL de verificación de la AEAT para el QR,
 *  - genera el XML AltaFactuSistemaFacturacion.
 */
import type { IvaBreakdownEntry, Ticket, VerifactuMode } from './types';

const AEAT_VERIFY_BASE_SANDBOX = 'https://preprod1factura.agenciatributaria.gob.es/act400';
const AEAT_VERIFY_BASE_LIVE = 'https://www1.agenciatributaria.gob.es/act400';

export function aeathVerifyBaseUrl(mode: VerifactuMode): string {
  return mode === 'LIVE' ? AEAT_VERIFY_BASE_LIVE : AEAT_VERIFY_BASE_SANDBOX;
}

/**
 * URL oficial de verificación AEAT para el QR del ticket.
 * Formato: <base>?<query> donde query contiene NIF, número, fecha y hash.
 */
export function buildQrUrl(
  mode: VerifactuMode,
  nif: string,
  ticketNumber: string,
  datetime: Date,
  total: number,
  hash: string,
): string {
  const base = aeathVerifyBaseUrl(mode);
  const params = new URLSearchParams();
  params.set('veri', '1');
  params.set('nif', nif);
  params.set('numfra', ticketNumber);
  params.set('fecha', formatAeatDate(datetime));
  params.set('hora', formatAeatTime(datetime));
  params.set('importe', total.toFixed(2));
  params.set('huella', hash);
  return `${base}?${params.toString()}`;
}

export function formatAeatDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatAeatTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export async function computeFingerprint(
  nif: string,
  ticketNumber: string,
  datetime: Date,
  total: number,
  previousHash: string,
): Promise<string> {
  const input = [
    nif,
    ticketNumber,
    formatAeatDate(datetime) + 'T' + formatAeatTime(datetime),
    total.toFixed(2),
    previousHash,
  ].join('|');
  return sha256Hex(input);
}

/** SHA-256 en hex usando Web Crypto. */
export async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Genera el XML AltaFactuSistemaFacturacion (esquema AEAT Veri*Factu).
 */
export function buildAeatXml(
  mode: VerifactuMode,
  ticket: Ticket,
  issuerName: string,
  issuerAddress: string,
): string {
  const recipientName = ticket.recipient_name ?? '';
  const recipientNif = ticket.recipient_nif ?? '';
  const recipientAddress = ticket.recipient_address ?? '';
  const dt = new Date(ticket.ticket_datetime);
  const rect = ticket.ticket_type === 'rectificativa';
  const enc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const ivaLines = ticket.iva_breakdown
    .map(
      (b: IvaBreakdownEntry) =>
        `      <TipoImpositivo>${b.rate.toFixed(2)}</TipoImpositivo>\n` +
        `      <BaseImponible>${b.base.toFixed(2)}</BaseImponible>\n` +
        `      <CuotaRepercutida>${b.quota.toFixed(2)}</CuotaRepercutida>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<altafactusistemafacturacion xmlns="https://www2.agenciatributaria.gob.es/FilesImport/2024/1.0/AltaFactuSistemaFacturacion">
  <cabecera>
    <titular>
      <nif>${enc(ticket.nif_emisor)}</nif>
      <nombre>${enc(issuerName)}</nombre>
      <direccion>${enc(issuerAddress)}</direccion>
    </titular>
    <entidadSucedida/>
  </cabecera>
  <registrofacturacion>
    <resumenfactura>
      <tipoFactura>${rect ? 'R4' : 'F1'}</tipoFactura>${rect && ticket.rectifies_ticket_number ? `
      <facturasrectificadas>
        <facturarectificada>
          <idfactura>
            <idemisor>${enc(ticket.nif_emisor)}</idemisor>
            <numfactura>${enc(ticket.rectifies_ticket_number)}</numfactura>
          </idfactura>
        </facturarectificada>
      </facturasrectificadas>` : ''}
      <idfactura>
        <idemisor>${enc(ticket.nif_emisor)}</idemisor>
        <numfactura>${enc(ticket.ticket_number)}</numfactura>
        <fechaexpedicionfactura>${formatAeatDate(dt)}</fechaexpedicionfactura>
        <horaexpedicionfactura>${formatAeatTime(dt)}</horaexpedicionfactura>
      </idfactura>${ticket.is_invoice && recipientNif ? `
      <destinatarios>
        <destinatario>
          <nif>${enc(recipientNif)}</nif>
          <nombrerazon>${enc(recipientName)}</nombrerazon>
          <direccion>${enc(recipientAddress)}</direccion>
        </destinatario>
      </destinatarios>` : ''}
      <descripresumenfactura>
        <tipodescripcionfactura>DET</tipodescripcionfactura>
        <detalleiva>
${ivaLines}
        </detalleiva>
        <basesintotalimponible>0.00</basesintotalimponible>
        <totalbasesimponible>${ticket.subtotal.toFixed(2)}</totalbasesimponible>
        <totalcuotarepercutida>${ticket.tax_total.toFixed(2)}</totalcuotarepercutida>
        <totalfactura>${ticket.total.toFixed(2)}</totalfactura>
        <metodopago>${ticket.payment_method ?? ''}</metodopago>
      </descripresumenfactura>
      <huellaverifactu>${ticket.hash}</huellaverifactu>
      <huellaanterior>${ticket.previous_hash}</huellaanterior>
    </resumenfactura>
    <sistemaInformatico>
      <nombre>TPV ${issuerName.slice(0, 40)}</nombre>
      <idSistemaInformatico>1</idSistemaInformatico>
      <version>1.0</version>
      <numInstalacion>1</numInstalacion>
      <numSerieDispositivo>WEB-TPV-001</numSerieDispositivo>
      <tipoDispositivo>WEB</tipoDispositivo>
      <modoverifactu>${mode}</modoverifactu>
    </sistemaInformatico>
  </registrofacturacion>
</altafactusistemafacturacion>`;
}
