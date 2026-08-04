import { useEffect, useState } from 'react';
import { Receipt, Link2, Download, Search, ShieldCheck } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Card, Badge, Spinner, EmptyState } from '@/components/ui';
import { formatEUR, formatDateTime } from '@/lib/format';
import { fetchTickets } from '@/lib/api';
import type { Ticket } from '@/lib/types';

export function FiscalRegistry() {
  const { settings } = useApp();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Ticket | null>(null);

  useEffect(() => {
    fetchTickets(200)
      .then(setTickets)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const filtered = tickets.filter((t) =>
    !search ||
    t.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
    t.hash.toLowerCase().includes(search.toLowerCase()),
  );

  function downloadXml(t: Ticket) {
    const blob = new Blob([t.xml_content ?? ''], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ticket_${t.ticket_number.replace('/', '-')}.xml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function downloadAll() {
    const xml = tickets.map((t) => t.xml_content ?? '').filter(Boolean).join('\n\n');
    const blob = new Blob([xml], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'registro_fiscal_completo.xml';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 lg:p-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2">
            <Receipt className="w-6 h-6 text-amber-600" />
            <h1 className="text-2xl font-bold text-stone-800">Registro fiscal</h1>
          </div>
          <p className="text-stone-500 text-sm">Cadena inalterable de tickets Veri*Factu (SHA-256 encadenado).</p>
        </div>
        <button onClick={downloadAll} disabled={tickets.length === 0} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-stone-100 hover:bg-stone-200 text-sm text-stone-700 disabled:opacity-50 touch-tap">
          <Download className="w-4 h-4" /> Exportar XML
        </button>
      </div>

      {/* Chain integrity banner */}
      <Card className="p-4 mb-4 bg-stone-800 text-white border-0">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-8 h-8 text-amber-400" />
          <div className="flex-1">
            <p className="font-semibold">Registro inalterable y encadenado</p>
            <p className="text-stone-400 text-sm">
              {tickets.length} tickets · Cada huella incluye el hash del ticket anterior.
              No se permite borrar ni editar tickets emitidos.
            </p>
          </div>
          <Badge color="amber">{settings.verifactu_mode ?? 'SANDBOX'}</Badge>
        </div>
      </Card>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por número o huella…"
          className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8" /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Receipt className="w-12 h-12" />} title="No hay tickets" subtitle="Los tickets aparecerán aquí tras el primer cobro." />
      ) : (
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-stone-500 text-xs uppercase">
              <tr>
                <th className="text-left px-4 py-3 font-medium">#</th>
                <th className="text-left px-4 py-3 font-medium">Nº Ticket</th>
                <th className="text-left px-4 py-3 font-medium hidden sm:table-cell">Fecha</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Huella (SHA-256)</th>
                <th className="text-center px-4 py-3 font-medium hidden lg:table-cell">Cadena</th>
                <th className="text-right px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((t, idx) => (
                <tr
                  key={t.id}
                  onClick={() => setSelected(t)}
                  className="border-t border-stone-100 hover:bg-stone-50 cursor-pointer"
                >
                  <td className="px-4 py-3 text-stone-400 font-mono">{t.sequence}</td>
                  <td className="px-4 py-3 font-medium text-stone-800">
                    {t.ticket_number}
                    {t.ticket_type === 'rectificativa' && <Badge color="red"><span className="ml-1">Rect.</span></Badge>}
                    {t.voided && <Badge color="stone"><span className="ml-1">Anulado</span></Badge>}
                  </td>
                  <td className="px-4 py-3 text-stone-500 hidden sm:table-cell">{formatDateTime(t.ticket_datetime)}</td>
                  <td className="px-4 py-3 font-mono text-xs text-stone-500 hidden md:table-cell">{t.hash.slice(0, 16)}…</td>
                  <td className="px-4 py-3 text-center hidden lg:table-cell">
                    {idx < filtered.length - 1 && t.hash === filtered[idx + 1].previous_hash ? (
                      <Link2 className="w-4 h-4 text-emerald-600 mx-auto" />
                    ) : idx === filtered.length - 1 ? (
                      <span className="text-stone-300 text-xs">inicio</span>
                    ) : (
                      <Link2 className="w-4 h-4 text-red-400 mx-auto" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-stone-800">{formatEUR(t.total)}</td>
                  <td className="px-4 py-3">
                    <button onClick={(e) => { e.stopPropagation(); downloadXml(t); }} className="p-1.5 rounded-lg hover:bg-stone-200 touch-tap">
                      <Download className="w-4 h-4 text-stone-500" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Detail drawer (simple modal) */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <Card className="w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto" >
            <div className="flex items-center justify-between mb-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-bold text-stone-800">Ticket {selected.ticket_number}</h3>
              <button onClick={() => setSelected(null)} className="text-stone-400 hover:text-stone-600 text-2xl leading-none">&times;</button>
            </div>
            <div className="space-y-3 text-sm" onClick={(e) => e.stopPropagation()}>
              <Row label="Emisor" value={selected.commercial_name ?? selected.issuer_name} />
              <Row label="Tipo" value={selected.ticket_type === 'normal' ? 'Normal' : 'Rectificativa'} />
              {selected.voided && <Row label="Estado" value="ANULADO" />}
              {selected.rectifies_ticket_number && <Row label="Rectifica a" value={selected.rectifies_ticket_number} />}
              <Row label="Fecha" value={formatDateTime(selected.ticket_datetime)} />
              <Row label="NIF emisor" value={selected.nif_emisor} />
              <Row label="Base" value={formatEUR(selected.subtotal - selected.tax_total)} />
              <Row label="IVA" value={formatEUR(selected.tax_total)} />
              <Row label="Total" value={formatEUR(selected.total)} bold />
              <Row label="Pago" value={selected.payment_method === 'cash' ? 'Efectivo' : selected.payment_method === 'card' ? 'Tarjeta' : '—'} />
              <div className="border-t border-stone-100 pt-3">
                <p className="text-xs font-semibold text-stone-500 mb-1">Huella SHA-256</p>
                <p className="font-mono text-xs text-stone-700 break-all bg-stone-50 p-2 rounded">{selected.hash}</p>
              </div>
              <div>
                <p className="text-xs font-semibold text-stone-500 mb-1">Hash anterior</p>
                <p className="font-mono text-xs text-stone-400 break-all bg-stone-50 p-2 rounded">{selected.previous_hash || '— inicio de cadena —'}</p>
              </div>
              {selected.qr_url && (
                <div>
                  <p className="text-xs font-semibold text-stone-500 mb-1">URL de verificación AEAT</p>
                  <p className="font-mono text-xs text-blue-600 break-all">{selected.qr_url}</p>
                </div>
              )}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-stone-500">{label}</span>
      <span className={bold ? 'font-bold text-stone-800' : 'text-stone-700'}>{value}</span>
    </div>
  );
}
