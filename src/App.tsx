import { useState } from 'react';
import { CreditCard, RefreshCw, AlertTriangle } from 'lucide-react';
import { AppProvider, useApp } from '@/context/AppContext';
import { LoginScreen } from '@/components/LoginScreen';
import { WaiterDashboard } from '@/components/WaiterDashboard';
import { AdminDashboardRoot } from '@/components/AdminDashboardRoot';
import { PaymentScreen } from '@/components/PaymentScreen';
import { MenuPublico } from './MenuPublico';
import { Spinner } from '@/components/ui';

function Shell() {
  const { role, loading, error } = useApp();
  const [adminTab, setAdminTab] = useState<'main' | 'payment'>('main');

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-stone-100">
        <Spinner className="w-10 h-10" />
        <p className="text-stone-500 text-sm">Cargando TPV…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-stone-100 p-6 text-center">
        <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-red-600" />
        </div>
        <p className="text-red-600 font-bold text-lg">Error de conexión</p>
        <p className="text-stone-500 text-sm max-w-md break-words whitespace-pre-line">{error}</p>
        <p className="text-stone-400 text-xs mt-1">Revisa la consola del navegador (F12) para más detalles.</p>
        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-stone-800 text-white font-medium hover:bg-stone-900 active:scale-95 transition-all"
        >
          <RefreshCw className="w-4 h-4" />
          Reintentar
        </button>
      </div>
    );
  }

  if (!role) return <LoginScreen />;
  if (role === 'waiter') return <WaiterDashboard />;

  if (adminTab === 'payment') {
    return <PaymentScreen onBack={() => setAdminTab('main')} />;
  }
  return (
    <div className="relative">
      <button
        onClick={() => setAdminTab('payment')}
        className="fixed bottom-6 right-6 z-40 flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-emerald-600 text-white shadow-xl shadow-emerald-600/30 hover:bg-emerald-700 active:scale-95 transition-all touch-tap"
      >
        <CreditCard className="w-5 h-5" />
        <span className="font-medium">Cobrar / Caja</span>
      </button>
      <AdminDashboardRoot />
    </div>
  );
}

export default function App() {
  // Si la ruta del navegador es /menu, mostramos la carta pública
  const isPublicMenu = window.location.pathname === '/menu';

  if (isPublicMenu) {
    return <MenuPublico />;
  }

  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}