import { Check, Printer, X, FileCode, ShieldCheck } from 'lucide-react';
import type { OrderItem, Ticket } from '@/lib/types';
import { Button, Badge } from '@/components/ui';
import { formatEUR, formatDateTime } from '@/lib/format';
import type { PrintResult } from '@/lib/print';
import { cn } from '@/lib/cn';

export function TicketView({
  ticket,
  items,
  printResults,
  onClose,
}: {
  ticket: Ticket;
  items: OrderItem[];
  printResults?: PrintResult[] | null;
  onClose: () => void;
}) {
  const showXml = () => {
    const blob = new Blob([ticket.xml_content ?? ''], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ticket_${ticket.ticket_number.replace('/', '-')}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden animate-slideUp">
      {/* Success header */}
      <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 px-5 py-4 text-white flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
          <Check className="w-6 h-6" />
        </div>
        <div className="flex-1">
          <p className="font-semibold">Cobro realizado</p>
          <p className="text-emerald-100 text-sm">Ticket fiscal generado (Veri*Factu)</p>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/15">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Receipt body */}
      <div className="p-5 font-mono text-sm text-stone-800">
        <div className="text-center mb-3">
          <p className="font-bold text-base">{ticket.issuer_name}</p>
          <p className="text-stone-600 text-xs">{ticket.issuer_address}</p>
          <p className="text-stone-600 text-xs">NIF: {ticket.nif_emisor}</p>
        </div>
        <div className="border-t border-dashed border-stone-300 my-2" />
        <div className="flex justify-between font-bold">
          <span>{ticket.ticket_type === 'rectificativa' ? 'FACTURA RECTIFICATIVA' : ticket.is_invoice ? 'FACTURA NOMINATIVA' : 'Factura simplificada'}</span>
        </div>
        <div className="flex justify-between"><span>Nº:</span><span>{ticket.ticket_number}</span></div>
        {ticket.rectifies_ticket_number && (
          <div className="flex justify-between text-red-600"><span>Rectifica:</span><span>{ticket.rectifies_ticket_number}</span></div>
        )}
        <div className="flex justify-between"><span>Fecha:</span><span>{formatDateTime(ticket.ticket_datetime)}</span></div>
        {ticket.is_invoice && ticket.recipient_name && (
          <>
            <div className="border-t border-dashed border-stone-300 my-2" />
            <p className="font-bold">Datos del cliente</p>
            <p>{ticket.recipient_name}</p>
            {ticket.recipient_nif && <div className="flex justify-between"><span>NIF:</span><span>{ticket.recipient_nif}</span></div>}
            {ticket.recipient_address && <p className="text-xs">{ticket.recipient_address}</p>}
            {ticket.recipient_phone && <div className="flex justify-between"><span>Tel:</span><span>{ticket.recipient_phone}</span></div>}
            {ticket.recipient_email && <div className="flex justify-between text-xs"><span>Email:</span><span>{ticket.recipient_email}</span></div>}
          </>
        )}
        <div className="border-t border-dashed border-stone-300 my-2" />
        {items.map((it) => (
          <div key={it.id} className="flex justify-between">
            <span>{it.quantity}× {it.product_name}</span>
            <span>{formatEUR(it.price * it.quantity)}</span>
          </div>
        ))}
        <div className="border-t border-dashed border-stone-300 my-2" />
        {ticket.iva_breakdown.map((b, i) => (
          <div key={i} className="flex justify-between text-xs text-stone-600">
            <span>IVA {b.rate}% · Base {formatEUR(b.base)}</span>
            <span>{formatEUR(b.quota)}</span>
          </div>
        ))}
        <div className="flex justify-between font-bold text-base mt-2">
          <span>TOTAL</span><span>{formatEUR(ticket.total)}</span>
        </div>
        {ticket.payment_method && (
          <>
            <div className="border-t border-dashed border-stone-300 my-2" />
            <div className="flex justify-between">
              <span>Pago:</span>
              <span>{ticket.payment_method === 'cash' ? 'Efectivo' : 'Tarjeta'}</span>
            </div>
            {ticket.payment_amount != null && (
              <div className="flex justify-between"><span>Entregado:</span><span>{formatEUR(ticket.payment_amount)}</span></div>
            )}
            {ticket.payment_change != null && (
              <div className="flex justify-between"><span>Cambio:</span><span>{formatEUR(ticket.payment_change)}</span></div>
            )}
          </>
        )}
        <div className="border-t border-dashed border-stone-300 my-2" />
        {/* QR placeholder */}
        <div className="flex flex-col items-center my-3">
          <div className="w-32 h-32 bg-white border-2 border-stone-800 rounded-lg flex items-center justify-center relative">
            <QrPlaceholder url={ticket.qr_url ?? ''} />
          </div>
          <p className="text-[10px] text-stone-500 text-center mt-1">Verifica en AEAT</p>
        </div>
        {/* Hash chain */}
        <div className="bg-stone-50 rounded-lg p-2 text-[10px] break-all">
          <p className="font-semibold text-stone-600">Huella Veri*Factu (SHA-256):</p>
          <p className="text-stone-700 mt-0.5">{ticket.hash}</p>
          {ticket.previous_hash && (
            <>
              <p className="font-semibold text-stone-600 mt-1">Hash anterior:</p>
              <p className="text-stone-500 mt-0.5">{ticket.previous_hash || '— inicio de cadena —'}</p>
            </>
          )}
        </div>
      </div>

      {/* Print results */}
      {printResults && printResults.length > 0 && (
        <div className="px-5 pb-3 space-y-1.5">
          {printResults.map((r, i) => (
            <div key={i} className={cn('flex items-center gap-2 p-2.5 rounded-lg text-sm', r.success ? 'bg-emerald-50 text-emerald-800' : 'bg-amber-50 text-amber-800')}>
              <Printer className="w-4 h-4 shrink-0" />
              <span className="font-medium flex-1">{r.printer.name}</span>
              <Badge color={r.success ? 'emerald' : 'orange'}>
                {r.success ? 'Impreso' : r.simulated ? 'Simulado' : 'Error'}
              </Badge>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="px-5 pb-5 pt-2 flex gap-2">
        <Button variant="secondary" className="flex-1 flex items-center justify-center gap-1.5" onClick={showXml}>
          <FileCode className="w-4 h-4" /> XML AEAT
        </Button>
        <Button variant="primary" className="flex-1 flex items-center justify-center gap-1.5" onClick={onClose}>
          <ShieldCheck className="w-4 h-4" /> Cerrar
        </Button>
      </div>
    </div>
  );
}

/** Renderiza un QR real usando el API de Google Charts (sólo para preview). */
function QrPlaceholder({ url }: { url: string }) {
  if (!url) return <span className="text-stone-400 text-xs">Sin QR</span>;
  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(url)}`;
  return <img src={qrSrc} alt="QR Veri*Factu" className="w-full h-full object-contain rounded" />;
}
