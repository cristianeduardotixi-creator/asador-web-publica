import { useState } from 'react';
import { Flame, LogOut, RefreshCw, User, AlertCircle } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import type { RestaurantTable } from '@/lib/types';
import { TableSelect } from './TableSelect';
import { OrderScreen } from './OrderScreen';

export function WaiterDashboard() {
  const { waiter, logout, refreshNetwork, network, networkEnforce, setNetworkEnforce } = useApp();
  const blockedByNetwork = networkEnforce === 'strict' && network?.checked && !network.onLan;
  const [bypassNetwork, setBypassNetwork] = useState(false);
  const [selected, setSelected] = useState<RestaurantTable | null>(null);

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col">
      <header className="bg-white border-b border-stone-200 px-4 py-2.5 flex items-center gap-3 shrink-0">
        <div className="w-9 h-9 rounded-xl bg-amber-600 flex items-center justify-center">
          <Flame className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <span className="font-semibold text-stone-800 text-sm">Comandero</span>
          {waiter && (
            <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-xs font-medium">
              <User className="w-3 h-3" /> {waiter.name}
            </span>
          )}
        </div>
        <button onClick={refreshNetwork} className="p-2 rounded-lg hover:bg-stone-100 touch-tap" title="Revisar red">
          <RefreshCw className="w-4 h-4 text-stone-500" />
        </button>
        <button onClick={logout} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-stone-600 hover:bg-stone-100 touch-tap">
          <LogOut className="w-4 h-4" /> Salir
        </button>
      </header>

      {selected ? (
        <OrderScreen table={selected} onBack={() => setSelected(null)} />
      ) : blockedByNetwork && !bypassNetwork ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="max-w-md text-center">
            <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-stone-800 mb-2">Red del restaurante requerida</h2>
            <p className="text-stone-500 text-sm mb-6">
              Conéctate a la red Wi-Fi del restaurante para utilizar el comandero.
              La aplicación solo funciona dentro del local por seguridad.
            </p>
            <button onClick={refreshNetwork} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 text-white font-medium hover:bg-amber-700 touch-tap">
              <RefreshCw className="w-4 h-4" /> Revisar conexión
            </button>
            <button
              onClick={() => setBypassNetwork(true)}
              className="block mx-auto mt-3 text-xs text-stone-400 hover:text-amber-600 underline"
            >
              Omitir (Modo Prueba)
            </button>
            {network && (
              <p className="text-xs text-stone-400 mt-4">{network.reason}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto touch-scroll">
          <TableSelect onSelect={setSelected} />
        </div>
      )}
    </div>
  );
}
