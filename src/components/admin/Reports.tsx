import { useState, useEffect, useCallback } from 'react';
import { BarChart3, Download, FileSpreadsheet, Loader2, TrendingUp, Calendar } from 'lucide-react';
import { Button, Card, Badge, Spinner } from '@/components/ui';
import { cn } from '@/lib/cn';
import { formatEUR, formatDate } from '@/lib/format';
import { fetchTickets } from '@/lib/api';
import { useApp } from '@/context/AppContext';
import type { Ticket, IvaBreakdownEntry } from '@/lib/types';

export function Reports() {
  const { settings } = useApp();
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));

  const load = useCallback(async () => {
    try {
      const all = await fetchTickets(2000);
      const filtered = all.filter((t) => {
        const d = new Date(t.ticket_datetime);
        return d.toISOString().slice(0, 7) === month;
      });
      setTickets(filtered);
    } catch (e) {
      console.error('Reports load error:', e);
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const activeTickets = tickets.filter((t) => !t.voided && t.ticket_type === 'normal');
  const voidedTickets = tickets.filter((t) => t.voided || t.ticket_type === 'rectificativa');

  const totalSales = activeTickets.reduce((s, t) => s + t.total, 0);
  const cashSales = activeTickets.filter((t) => t.payment_method === 'cash').reduce((s, t) => s + t.total, 0);
  const cardSales = activeTickets.filter((t) => t.payment_method === 'card').reduce((s, t) => s + t.total, 0);

  // IVA breakdown by rate
  const ivaMap = new Map<number, { base: number; quota: number }>();
  for (const t of activeTickets) {
    for (const b of (t.iva_breakdown as IvaBreakdownEntry[] | null) ?? []) {
      const cur = ivaMap.get(b.rate) ?? { base: 0, quota: 0 };
      cur.base += b.base;
      cur.quota += b.quota;
      ivaMap.set(b.rate, cur);
    }
  }
  const ivaBreakdown = [...ivaMap.entries()].map(([rate, v]) => ({
    rate,
    base: Math.round(v.base * 100) / 100,
    quota: Math.round(v.quota * 100) / 100,
  })).sort((a, b) => a.rate - b.rate);

  const totalBase = ivaBreakdown.reduce((s, b) => s + b.base, 0);
  const totalQuota = ivaBreakdown.reduce((s, b) => s + b.quota, 0);

  // Daily breakdown
  const dailyMap = new Map<string, { total: number; count: number }>();
  for (const t of activeTickets) {
    const day = new Date(t.ticket_datetime).toISOString().slice(0, 10);
    const cur = dailyMap.get(day) ?? { total: 0, count: 0 };
    cur.total += t.total;
    cur.count += 1;
    dailyMap.set(day, cur);
  }
  const daily = [...dailyMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  function exportCSV() {
    const rows = [
      ['Numero', 'Fecha', 'Hora', 'Tipo', 'Metodo pago', 'Base', 'IVA', 'Total', 'NIF Cliente', 'Nombre Cliente', 'Anulado'],
      ...activeTickets.map((t) => {
        const d = new Date(t.ticket_datetime);
        return [
          t.ticket_number,
          d.toISOString().slice(0, 10),
          d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' }),
          t.is_invoice ? 'Factura' : 'Ticket',
          t.payment_method === 'cash' ? 'Efectivo' : 'Tarjeta',
          (totalBase / activeTickets.length).toFixed(2),
          (totalQuota / activeTickets.length).toFixed(2),
          t.total.toFixed(2),
          t.recipient_nif ?? '',
          t.recipient_name ?? '',
          t.voided ? 'SI' : 'NO',
        ];
      }),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(';')).join('\n');
    const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `informe_${month}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportPDF() {
    const w = window.open('', '_blank', 'width=800,height=900');
    if (!w) return;
    const restaurantName = settings.restaurant_name ?? 'Restaurante';
    const nif = settings.restaurant_nif ?? '';
    const address = settings.restaurant_address ?? '';
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Informe ${month}</title>
    <style>
      body{font-family:Arial,sans-serif;margin:40px;color:#333}
      h1{font-size:22px;margin-bottom:5px}
      h2{font-size:16px;margin-top:30px;border-bottom:2px solid #ccc;padding-bottom:5px}
      table{width:100%;border-collapse:collapse;margin-top:10px;font-size:12px}
      th{background:#f5f5f5;padding:8px;text-align:left;border:1px solid #ddd}
      td{padding:6px 8px;border:1px solid #ddd}
      .total{font-weight:bold;font-size:14px}
      .right{text-align:right}
      .header{text-align:center;margin-bottom:30px}
      @media print{body{margin:15px}}
    </style></head><body>
    <div class="header">
      <h1>${restaurantName}</h1>
      <p>NIF: ${nif} · ${address}</p>
      <h2>Informe mensual: ${month}</h2>
    </div>
    <h2>Resumen</h2>
    <table>
      <tr><td>Total facturado</td><td class="right total">${formatEUR(totalSales)}</td></tr>
      <tr><td>Efectivo</td><td class="right">${formatEUR(cashSales)}</td></tr>
      <tr><td>Tarjeta</td><td class="right">${formatEUR(cardSales)}</td></tr>
      <tr><td>Tickets emitidos</td><td class="right">${activeTickets.length}</td></tr>
      ${voidedTickets.length > 0 ? `<tr><td>Anulaciones</td><td class="right">${voidedTickets.length}</td></tr>` : ''}
    </table>
    <h2>Desglose de IVA</h2>
    <table>
      <tr><th>Tipo IVA</th><th>Base imponible</th><th>Cuota IVA</th><th class="right">Total</th></tr>
      ${ivaBreakdown.map((b) => `<tr><td>${b.rate}%</td><td class="right">${formatEUR(b.base)}</td><td class="right">${formatEUR(b.quota)}</td><td class="right">${formatEUR(b.base + b.quota)}</td></tr>`).join('')}
      <tr class="total"><td>Total</td><td class="right">${formatEUR(totalBase)}</td><td class="right">${formatEUR(totalQuota)}</td><td class="right">${formatEUR(totalSales)}</td></tr>
    </table>
    <h2>Desglose diario</h2>
    <table>
      <tr><th>Fecha</th><th>Tickets</th><th class="right">Total</th></tr>
      ${daily.map(([day, v]) => `<tr><td>${formatDate(day)}</td><td>${v.count}</td><td class="right">${formatEUR(v.total)}</td></tr>`).join('')}
    </table>
    <p style="margin-top:40px;font-size:10px;color:#999;text-align:center">
      Documento generado el ${new Date().toLocaleString('es-ES')}
    </p>
    </body></html>`;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Informes</h1>
          <p className="text-stone-500 text-sm">Facturación mensual y desglose de IVA para la gestoría</p>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6">
        <Calendar className="w-5 h-5 text-stone-400" />
        <input type="month" value={month} onChange={(e) => setMonth(e.target.value)}
          className="px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
        <div className="flex-1" />
        <Button variant="secondary" size="sm" className="flex items-center gap-1.5" onClick={exportCSV}>
          <FileSpreadsheet className="w-4 h-4" /> Excel/CSV
        </Button>
        <Button variant="secondary" size="sm" className="flex items-center gap-1.5" onClick={exportPDF}>
          <Download className="w-4 h-4" /> PDF
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner className="w-8 h-8" /></div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2 text-stone-500 text-sm"><TrendingUp className="w-4 h-4" /> Total facturado</div>
              <p className="text-xl font-bold text-stone-800">{formatEUR(totalSales)}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2 text-emerald-600 text-sm"><TrendingUp className="w-4 h-4" /> Efectivo</div>
              <p className="text-xl font-bold text-emerald-700">{formatEUR(cashSales)}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2 text-blue-600 text-sm"><TrendingUp className="w-4 h-4" /> Tarjeta</div>
              <p className="text-xl font-bold text-blue-700">{formatEUR(cardSales)}</p>
            </Card>
            <Card className="p-4">
              <div className="flex items-center gap-2 mb-2 text-stone-500 text-sm"><BarChart3 className="w-4 h-4" /> Tickets</div>
              <p className="text-xl font-bold text-stone-800">{activeTickets.length}</p>
            </Card>
          </div>

          {/* IVA breakdown */}
          <Card className="p-5 mb-6">
            <h3 className="font-semibold text-stone-800 mb-4">Desglose de IVA</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-stone-200">
                    <th className="text-left py-2 text-stone-500 font-medium">Tipo IVA</th>
                    <th className="text-right py-2 text-stone-500 font-medium">Base imponible</th>
                    <th className="text-right py-2 text-stone-500 font-medium">Cuota IVA</th>
                    <th className="text-right py-2 text-stone-500 font-medium">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {ivaBreakdown.map((b) => (
                    <tr key={b.rate} className="border-b border-stone-100">
                      <td className="py-2.5 font-medium text-stone-700">{b.rate}%</td>
                      <td className="py-2.5 text-right text-stone-700">{formatEUR(b.base)}</td>
                      <td className="py-2.5 text-right text-stone-700">{formatEUR(b.quota)}</td>
                      <td className="py-2.5 text-right font-semibold text-stone-800">{formatEUR(b.base + b.quota)}</td>
                    </tr>
                  ))}
                  <tr className="border-t-2 border-stone-300">
                    <td className="py-3 font-bold text-stone-800">Total</td>
                    <td className="py-3 text-right font-bold text-stone-800">{formatEUR(totalBase)}</td>
                    <td className="py-3 text-right font-bold text-stone-800">{formatEUR(totalQuota)}</td>
                    <td className="py-3 text-right font-bold text-stone-800">{formatEUR(totalSales)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* Daily breakdown */}
          <Card className="p-5">
            <h3 className="font-semibold text-stone-800 mb-4">Desglose diario</h3>
            <div className="space-y-1.5 max-h-[40vh] overflow-y-auto touch-scroll">
              {daily.map(([day, v]) => (
                <div key={day} className="flex items-center justify-between py-2 border-b border-stone-100 last:border-0 text-sm">
                  <span className="text-stone-700">{formatDate(day)}</span>
                  <div className="flex items-center gap-4">
                    <span className="text-stone-400 text-xs">{v.count} tickets</span>
                    <span className="font-semibold text-stone-800">{formatEUR(v.total)}</span>
                  </div>
                </div>
              ))}
              {daily.length === 0 && (
                <p className="text-stone-400 text-sm text-center py-6">No hay ventas en este periodo.</p>
              )}
            </div>
          </Card>

          {voidedTickets.length > 0 && (
            <Card className="p-4 mt-4 border-red-200">
              <div className="flex items-center gap-2 text-sm text-red-700">
                <Badge color="red">{voidedTickets.length} anulados</Badge>
                <span>Tickets anulados o rectificativos en este periodo</span>
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
