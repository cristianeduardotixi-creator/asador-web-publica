import { useState } from 'react';
import { Lock, User, ShieldCheck, ArrowRight, Wifi, WifiOff } from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { Button } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { NetworkState } from '@/lib/network';

export function LoginScreen() {
  const { waiters, settings, login, network, networkEnforce, refreshNetwork } = useApp();
  const [mode, setMode] = useState<'waiter' | 'admin'>('waiter');
  const [selectedWaiter, setSelectedWaiter] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);

  const blockedByNetwork =
    networkEnforce === 'strict' && network?.checked && !network.onLan;

  function handleDigit(d: string) {
    if (pin.length >= 6) return;
    setPin((p) => p + d);
    setError(null);
  }
  function handleBackspace() {
    setPin((p) => p.slice(0, -1));
    setError(null);
  }
  function handleClear() {
    setPin('');
    setError(null);
  }

  function handleSubmit() {
    if (mode === 'admin') {
      const adminUser = waiters.find((x) => x.role === 'admin');
      const adminPin = adminUser?.pin || settings.admin_pin || '9999';
      if (pin === adminPin) {
        login('admin', adminUser ?? undefined);
      } else {
        setError('PIN de administrador incorrecto');
        setPin('');
      }
      return;
    }
    const w = waiters.find((x) => x.id === selectedWaiter);
    if (!w) {
      setError('Selecciona un camarero');
      return;
    }
    if (pin === w.pin) {
      login('waiter', w);
    } else {
      setError('PIN incorrecto');
      setPin('');
    }
  }

  const digits = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 p-3">
      <div className="w-full max-w-sm">
        {/* Restaurant name — compact so keypad fits without scroll */}
        <div className="flex flex-col items-center mb-3">
          <h1 className="text-base font-bold tracking-tight text-stone-800 text-center leading-tight">
            {settings.restaurant_name || 'Asador Parla Este'}
          </h1>
          <p className="text-stone-400 text-[11px] mt-0.5">TPV · Veri*Factu</p>
        </div>

        {/* Role toggle */}
        <div className="flex gap-2 p-1 bg-stone-200 rounded-xl mb-3">
          <button
            onClick={() => { setMode('waiter'); setPin(''); setError(null); }}
            className={cn('flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium text-sm transition-all touch-tap', mode === 'waiter' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500')}
          >
            <User className="w-4 h-4" /> Camarero
          </button>
          <button
            onClick={() => { setMode('admin'); setPin(''); setError(null); setSelectedWaiter(null); }}
            className={cn('flex-1 flex items-center justify-center gap-2 py-2 rounded-lg font-medium text-sm transition-all touch-tap', mode === 'admin' ? 'bg-white text-stone-800 shadow-sm' : 'text-stone-500')}
          >
            <ShieldCheck className="w-4 h-4" /> Admin / Caja
          </button>
        </div>

        {blockedByNetwork ? (
          <div className="bg-red-50 border-2 border-red-200 rounded-2xl p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3">
              <WifiOff className="w-7 h-7 text-red-600" />
            </div>
            <h3 className="text-base font-semibold text-red-900 mb-2">Conéctate al Wi-Fi del restaurante para trabajar</h3>
            <p className="text-red-600 text-sm mb-3">
              {network?.reason}
            </p>
            <Button variant="secondary" size="sm" onClick={refreshNetwork}>
              Reintentar conexión
            </Button>
          </div>
        ) : (
          <>
            {mode === 'waiter' && (
              <div className="mb-3">
                <label className="block text-xs font-medium text-stone-600 mb-1.5">Camarero</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {waiters.filter((w) => w.role !== 'admin').map((w) => (
                    <button
                      key={w.id}
                      onClick={() => { setSelectedWaiter(w.id); setPin(''); setError(null); }}
                      className={cn(
                        'py-2.5 rounded-xl font-medium text-sm transition-all touch-tap',
                        selectedWaiter === w.id
                          ? 'bg-amber-600 text-white shadow-md scale-105'
                          : 'bg-white text-stone-600 border border-stone-200 hover:border-amber-300',
                      )}
                    >
                      {w.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mb-3">
              <label className="block text-xs font-medium text-stone-600 mb-1.5 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                {mode === 'admin' ? 'PIN de administrador' : 'PIN del camarero'}
              </label>
              <div className="flex items-center justify-center gap-2 mb-1">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className={cn(
                      'w-3.5 h-3.5 rounded-full transition-all',
                      i < pin.length ? 'bg-amber-600 scale-110' : 'bg-stone-200',
                    )}
                  />
                ))}
              </div>
              {error && <p className="text-red-600 text-xs text-center mt-1">{error}</p>}
            </div>

            {/* Keypad — compact */}
            <div className="grid grid-cols-3 gap-1.5">
              {digits.map((d) => {
                if (d === 'clear') return <button key="clear" onClick={handleClear} className="py-2.5 text-sm font-medium bg-stone-100 text-stone-600 rounded-lg border border-stone-200 hover:bg-stone-200 transition-all touch-tap active:scale-95">Limpiar</button>;
                if (d === 'back') return <button key="back" onClick={handleBackspace} className="py-2.5 text-lg font-medium bg-stone-100 text-stone-600 rounded-lg border border-stone-200 hover:bg-stone-200 transition-all touch-tap active:scale-95">←</button>;
                return (
                  <button
                    key={d}
                    onClick={() => handleDigit(d)}
                    className="py-2.5 text-xl font-medium bg-white text-stone-800 rounded-lg border border-stone-200 hover:border-amber-400 hover:bg-amber-50 transition-all touch-tap active:scale-95"
                  >
                    {d}
                  </button>
                );
              })}
            </div>

            <button
              onClick={handleSubmit}
              disabled={pin.length === 0 || (mode === 'waiter' && !selectedWaiter)}
              className="w-full mt-2.5 py-3 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-semibold flex items-center justify-center gap-2 transition-all touch-tap"
            >
              Entrar <ArrowRight className="w-5 h-5" />
            </button>

            {/* Network status */}
            <div className="flex justify-center mt-3">
              <NetworkPill network={network} enforce={networkEnforce} onRetry={refreshNetwork} />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NetworkPill({
  network,
  enforce,
  onRetry,
}: {
  network: NetworkState | null;
  enforce: 'strict' | 'demo';
  onRetry: () => void;
}) {
  const onLan = network?.onLan;
  return (
    <button
      onClick={onRetry}
      className="flex items-center gap-2 text-sm bg-stone-200 hover:bg-stone-300 px-3 py-2 rounded-lg transition-colors text-stone-600"
    >
      {onLan ? <Wifi className="w-4 h-4 text-emerald-600" /> : <WifiOff className="w-4 h-4 text-orange-500" />}
      <span>
        {onLan ? `Red local${enforce === 'strict' ? ' (strict)' : ''}` : 'Fuera de LAN'}
      </span>
    </button>
  );
}