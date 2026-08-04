import { useState } from 'react';
import { Plus, Pencil, Trash2, Save, Printer, Wifi, AlertCircle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { Button, Card, Modal, Badge } from '@/components/ui';
import type { Printer as PrinterType } from '@/lib/types';

export function PrinterConfig() {
  const { printers, settings, reload, reloadSettings } = useApp();
  const [editing, setEditing] = useState<PrinterType | null>(null);
  const [creating, setCreating] = useState(false);
  const [agentUrl, setAgentUrl] = useState(settings.print_agent_url ?? '');

  async function savePrinter(p: Partial<PrinterType>) {
    if (editing) {
      await supabase.from('printers').update({
        name: p.name, ip_address: p.ip_address, port: p.port,
        destination: p.destination, active: p.active,
      }).eq('id', editing.id);
    } else {
      await supabase.from('printers').insert({
        name: p.name, ip_address: p.ip_address, port: p.port ?? 9100,
        destination: p.destination, active: p.active ?? true,
      });
    }
    await reload();
    setEditing(null);
    setCreating(false);
  }

  async function deletePrinter(p: PrinterType) {
    if (!confirm(`¿Eliminar la impresora "${p.name}"?`)) return;
    await supabase.from('printers').delete().eq('id', p.id);
    await reload();
  }

  async function toggleActive(p: PrinterType) {
    await supabase.from('printers').update({ active: !p.active }).eq('id', p.id);
    await reload();
  }

  async function saveAgentUrl() {
    await upsertSetting('print_agent_url', agentUrl);
    await reloadSettings();
  }
  async function upsertSetting(key: string, value: string) {
    await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() });
  }

  return (
    <div className="p-4 lg:p-8 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-stone-800">Impresoras en red</h1>
          <p className="text-stone-500 text-sm">Mapeo de impresoras térmicas por IP local (puerto 9100).</p>
        </div>
        <Button variant="primary" onClick={() => setCreating(true)} className="flex items-center gap-2">
          <Plus className="w-4 h-4" /> Nueva impresora
        </Button>
      </div>

      {/* Print agent URL */}
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Wifi className="w-5 h-5 text-amber-600" />
          <h3 className="font-semibold text-stone-800">Agente de impresión local</h3>
        </div>
        <p className="text-sm text-stone-500 mb-3">
          El agente es un pequeño servicio en la LAN que recibe los comandos ESC/POS desde la web
          y los reenvía por TCP al IP:puerto de cada impresora. Si no responde, la impresión se simula.
        </p>
        <div className="flex gap-2">
          <input
            value={agentUrl}
            onChange={(e) => setAgentUrl(e.target.value)}
            placeholder="http://192.168.1.50:3000/print"
            className="flex-1 px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
          />
          <Button variant="primary" onClick={saveAgentUrl}>Guardar</Button>
        </div>
      </Card>

      {/* Printers list */}
      <div className="grid gap-3">
        {printers.map((p) => (
          <Card key={p.id} className="p-4 flex items-center gap-4">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${p.active ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-400'}`}>
              <Printer className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-stone-800">{p.name}</span>
                <Badge color={p.destination === 'bar' ? 'blue' : 'orange'}>
                  {p.destination === 'bar' ? 'Barra' : 'Cocina'}
                </Badge>
                {!p.active && <Badge color="stone">Inactiva</Badge>}
              </div>
              <div className="text-sm text-stone-500 font-mono mt-0.5">{p.ip_address}:{p.port}</div>
            </div>
            <div className="flex gap-1">
              <button onClick={() => toggleActive(p)} className="text-xs px-2.5 py-1.5 rounded-lg bg-stone-100 hover:bg-stone-200 touch-tap">
                {p.active ? 'Desactivar' : 'Activar'}
              </button>
              <button onClick={() => setEditing(p)} className="p-1.5 rounded-lg hover:bg-stone-100 touch-tap">
                <Pencil className="w-4 h-4 text-stone-500" />
              </button>
              <button onClick={() => deletePrinter(p)} className="p-1.5 rounded-lg hover:bg-red-50 touch-tap">
                <Trash2 className="w-4 h-4 text-red-500" />
              </button>
            </div>
          </Card>
        ))}
        {printers.length === 0 && (
          <Card className="p-8 text-center text-stone-400">
            <AlertCircle className="w-10 h-10 mx-auto mb-2 text-stone-300" />
            No hay impresoras configuradas.
          </Card>
        )}
      </div>

      {(editing || creating) && (
        <PrinterForm printer={editing} onSave={savePrinter} onClose={() => { setEditing(null); setCreating(false); }} />
      )}
    </div>
  );
}

function PrinterForm({ printer, onSave, onClose }: { printer: PrinterType | null; onSave: (p: Partial<PrinterType>) => void; onClose: () => void }) {
  const [name, setName] = useState(printer?.name ?? '');
  const [ip, setIp] = useState(printer?.ip_address ?? '192.168.1.');
  const [port, setPort] = useState(String(printer?.port ?? 9100));
  const [dest, setDest] = useState<'kitchen' | 'bar'>(printer?.destination ?? 'kitchen');
  const [active, setActive] = useState(printer?.active ?? true);

  return (
    <Modal open onClose={onClose} title={printer ? 'Editar impresora' : 'Nueva impresora'} size="sm">
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1">Nombre</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej. Cocina, Barra…" className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <label className="block text-sm font-medium text-stone-600 mb-1">Dirección IP</label>
            <input value={ip} onChange={(e) => setIp(e.target.value)} placeholder="192.168.1.200" className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Puerto</label>
            <input value={port} onChange={(e) => setPort(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1">Destino</label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setDest('kitchen')} className={`py-2.5 rounded-lg text-sm font-medium border-2 transition-all touch-tap ${dest === 'kitchen' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-stone-200 text-stone-600'}`}>
              Cocina
            </button>
            <button onClick={() => setDest('bar')} className={`py-2.5 rounded-lg text-sm font-medium border-2 transition-all touch-tap ${dest === 'bar' ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-stone-200 text-stone-600'}`}>
              Barra
            </button>
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-stone-600">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="rounded" />
          Activa
        </label>
        <div className="flex gap-2 pt-2">
          <Button variant="secondary" className="flex-1" onClick={onClose}>Cancelar</Button>
          <Button variant="primary" className="flex-1 flex items-center justify-center gap-2" disabled={!name || !ip} onClick={() => onSave({ name, ip_address: ip, port: parseInt(port) || 9100, destination: dest, active })}>
            <Save className="w-4 h-4" /> Guardar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
