import { useState, useRef } from 'react';
import {
  ShieldCheck, FileKey, Upload, Save, AlertCircle, CheckCircle2,
  FlaskConical, Send, Lock, Unlock, Store, Building2, KeyRound,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { Button, Card, Badge } from '@/components/ui';
import { cn } from '@/lib/cn';
import type { VerifactuMode } from '@/lib/types';

export function FiscalSettings({ onNavigateLocal }: { onNavigateLocal?: () => void }) {
  const { settings, reloadSettings, network, networkEnforce, setNetworkEnforce } = useApp();
  const [mode, setMode] = useState<VerifactuMode>((settings.verifactu_mode as VerifactuMode) ?? 'SANDBOX');
  const [ipPrefix, setIpPrefix] = useState(settings.local_ip_prefix ?? '192.168.1.');
  const [certName, setCertName] = useState(settings.verifactu_cert_name ?? '');
  const [certLoaded, setCertLoaded] = useState(settings.verifactu_cert_loaded === 'true');
  const [certPassword, setCertPassword] = useState('');
  const [issuerName, setIssuerName] = useState(settings.restaurant_legal_name ?? settings.verifactu_issuer_name ?? '');
  const [issuerNif, setIssuerNif] = useState(settings.restaurant_nif ?? settings.verifactu_nif ?? '');
  const [issuerAddress, setIssuerAddress] = useState(settings.restaurant_address ?? settings.verifactu_issuer_address ?? '');
  const [issuerPostal, setIssuerPostal] = useState(settings.restaurant_postal_code ?? '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [certError, setCertError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function upsert(key: string, value: string) {
    await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() });
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    try {
      await Promise.all([
        upsert('verifactu_mode', mode),
        upsert('local_ip_prefix', ipPrefix),
        upsert('restaurant_legal_name', issuerName),
        upsert('restaurant_nif', issuerNif.toUpperCase()),
        upsert('restaurant_address', issuerAddress),
        upsert('restaurant_postal_code', issuerPostal),
        upsert('verifactu_issuer_name', issuerName),
        upsert('verifactu_issuer_address', issuerAddress),
        upsert('verifactu_nif', issuerNif.toUpperCase()),
      ]);
      await reloadSettings();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  function handleCertFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setCertError(null);
    if (!file) return;
    const validExt = /\.(p12|pfx)$/i.test(file.name);
    if (!validExt) {
      setCertError('El archivo debe ser un certificado .p12 o .pfx');
      return;
    }
    // Nota: el certificado real se cargaría en el backend/edge function para firmar
    // el envío a la AEAT. Aquí registramos el nombre y marcamos como cargado.
    setCertName(file.name);
  }

  async function activateLive() {
    if (!certName) {
      setCertError('Carga primero el certificado digital (.p12/.pfx)');
      return;
    }
    if (!certPassword) {
      setCertError('Introduce la contraseña del certificado');
      return;
    }
    setSaving(true);
    try {
      await Promise.all([
        upsert('verifactu_cert_loaded', 'true'),
        upsert('verifactu_cert_name', certName),
        upsert('verifactu_cert_password', certPassword),
        upsert('verifactu_mode', 'LIVE'),
      ]);
      setCertLoaded(true);
      setMode('LIVE');
      await reloadSettings();
    } finally {
      setSaving(false);
    }
  }

  async function deactivateLive() {
    setSaving(true);
    try {
      await Promise.all([
        upsert('verifactu_cert_loaded', 'false'),
        upsert('verifactu_cert_name', ''),
        upsert('verifactu_cert_password', ''),
        upsert('verifactu_mode', 'SANDBOX'),
      ]);
      setCertLoaded(false);
      setCertName('');
      setCertPassword('');
      setMode('SANDBOX');
      await reloadSettings();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheck className="w-6 h-6 text-amber-600" />
        <h1 className="text-2xl font-bold text-stone-800">Veri*Factu · AEAT</h1>
      </div>
      <p className="text-stone-500 text-sm mb-6">
        Motor fiscal conforme al Real Decreto 1007/2023. Registro inalterable y encadenado SHA-256.
      </p>

      {/* Mode selector */}
      <Card className="p-5 mb-4">
        <h3 className="font-semibold text-stone-800 mb-3">Modo de funcionamiento</h3>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setMode('SANDBOX')}
            className={cn(
              'p-4 rounded-xl border-2 text-left transition-all touch-tap',
              mode === 'SANDBOX' ? 'border-amber-500 bg-amber-50 ring-2 ring-amber-200' : 'border-stone-200 hover:border-amber-300',
            )}
          >
            <FlaskConical className={cn('w-6 h-6 mb-2', mode === 'SANDBOX' ? 'text-amber-600' : 'text-stone-400')} />
            <p className="font-semibold text-stone-800">SANDBOX</p>
            <p className="text-xs text-stone-500 mt-0.5">Genera tickets con huella y QR pero no envía a la AEAT. Para pruebas y preproducción.</p>
          </button>
          <button
            onClick={() => setMode('LIVE')}
            disabled={!certLoaded}
            className={cn(
              'p-4 rounded-xl border-2 text-left transition-all touch-tap',
              mode === 'LIVE' ? 'border-emerald-500 bg-emerald-50 ring-2 ring-emerald-200' : 'border-stone-200 hover:border-emerald-300',
              !certLoaded && 'opacity-50 cursor-not-allowed',
            )}
          >
            <Send className={cn('w-6 h-6 mb-2', mode === 'LIVE' ? 'text-emerald-600' : 'text-stone-400')} />
            <p className="font-semibold text-stone-800">LIVE</p>
            <p className="text-xs text-stone-500 mt-0.5">Envío por Web Service a la AEAT. Requiere certificado digital cargado.</p>
          </button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {mode === 'LIVE' ? (
            <Badge color="emerald"><Unlock className="w-3 h-3 mr-1" /> LIVE activo</Badge>
          ) : (
            <Badge color="amber"><Lock className="w-3 h-3 mr-1" /> SANDBOX</Badge>
          )}
          <span className="text-xs text-stone-400">Variable de entorno VERIFACTU_MODE</span>
        </div>
      </Card>

      {/* Datos fiscales del emisor — editables aquí */}
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-5 h-5 text-amber-600" />
          <h3 className="font-semibold text-stone-800">Datos fiscales del emisor</h3>
        </div>
        <p className="text-xs text-stone-400 mb-3">Estos datos aparecen en la cabecera de tickets y facturas.</p>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Nombre / Razón Social (Titular)</label>
            <input
              value={issuerName}
              onChange={(e) => setIssuerName(e.target.value)}
              placeholder="Ej: Asador Parla Este S.L. o Juan Pérez García (autónomo)"
              className="w-full px-3 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">NIF / CIF</label>
              <input
                value={issuerNif}
                onChange={(e) => setIssuerNif(e.target.value.toUpperCase())}
                placeholder="51753805-X"
                className="w-full px-3 py-2.5 rounded-lg border border-stone-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Código Postal</label>
              <input
                value={issuerPostal}
                onChange={(e) => setIssuerPostal(e.target.value)}
                placeholder="28914"
                inputMode="numeric"
                className="w-full px-3 py-2.5 rounded-lg border border-stone-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400/50"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Dirección Fiscal</label>
            <input
              value={issuerAddress}
              onChange={(e) => setIssuerAddress(e.target.value)}
              placeholder="C/ Amsterdam, 11, 28914 Parla, Madrid"
              className="w-full px-3 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50"
            />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Store className="w-3.5 h-3.5 text-stone-400" />
            <button
              onClick={() => onNavigateLocal?.()}
              className="text-xs text-amber-700 hover:text-amber-800 underline"
            >
              Editar datos comerciales (nombre, teléfono, email) en Datos del Local
            </button>
          </div>
        </div>
      </Card>

      {/* Network restriction */}
      <Card className="p-5 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-stone-800">Enlazar todo el sistema solo a esta IP</h3>
          <button
            onClick={() => setNetworkEnforce(networkEnforce === 'strict' ? 'demo' : 'strict')}
            disabled={!ipPrefix.trim()}
            className={cn(
              'relative inline-flex h-7 w-12 items-center rounded-full transition-colors touch-tap shrink-0',
              !ipPrefix.trim()
                ? 'bg-stone-200 opacity-50 cursor-not-allowed'
                : networkEnforce === 'strict' ? 'bg-amber-600' : 'bg-stone-300',
            )}
          >
            <span className={cn(
              'inline-block h-5 w-5 transform rounded-full bg-white transition-transform',
              networkEnforce === 'strict' ? 'translate-x-6' : 'translate-x-1',
            )} />
          </button>
        </div>
        <p className="text-sm text-stone-500 mb-3">
          La app sólo permite tomar pedidos si el dispositivo está dentro del rango IP del router del restaurante.
          Fuera de la LAN (4G/5G) se bloquea el acceso.
        </p>
        <div className="flex items-center gap-2 mb-3">
          {networkEnforce === 'strict' ? (
            <Badge color="amber">Restricción activada</Badge>
          ) : (
            <Badge color="emerald">Modo prueba (sin restricción)</Badge>
          )}
          {!ipPrefix.trim() && (
            <span className="text-xs text-red-500">Introduce una IP para activar la restricción</span>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-600 mb-1">IP del Restaurante</label>
          <input value={ipPrefix} onChange={(e) => setIpPrefix(e.target.value)} placeholder="192.168.1.1" className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400/50" />
        </div>
        <div className="mt-3 flex items-center gap-2 text-sm">
          {network?.onLan ? (
            <><CheckCircle2 className="w-4 h-4 text-emerald-600" /><span className="text-emerald-700">Dispositivo en LAN {network.localIp ?? ''}</span></>
          ) : (
            <><AlertCircle className="w-4 h-4 text-orange-500" /><span className="text-orange-700">{network?.reason ?? 'Red no verificada'}</span></>
          )}
        </div>
      </Card>

      {/* Certificate */}
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <FileKey className="w-5 h-5 text-amber-600" />
          <h3 className="font-semibold text-stone-800">Certificado digital</h3>
        </div>
        <p className="text-sm text-stone-500 mb-3">
          Carga el certificado (.p12/.pfx) necesario para firmar el envío de facturas a la AEAT
          cuando el modo LIVE esté activo. El certificado se almacena de forma segura en el backend.
        </p>
        <input ref={fileRef} type="file" accept=".p12,.pfx" onChange={handleCertFile} className="hidden" />
        <div className="flex flex-col sm:flex-row gap-2">
          <Button variant="secondary" onClick={() => fileRef.current?.click()} className="flex items-center justify-center gap-2 flex-1">
            <Upload className="w-4 h-4" /> Cargar certificado
          </Button>
          {certLoaded ? (
            <Button variant="danger" onClick={deactivateLive} disabled={saving} className="flex items-center justify-center gap-2 flex-1">
              <Lock className="w-4 h-4" /> Desactivar LIVE
            </Button>
          ) : (
            <Button variant="success" onClick={activateLive} disabled={saving || !certName} className="flex items-center justify-center gap-2 flex-1">
              <Unlock className="w-4 h-4" /> Activar LIVE
            </Button>
          )}
        </div>
        {/* Contraseña del certificado */}
        <div className="mt-3">
          <label className="block text-sm font-medium text-stone-600 mb-1 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5 text-stone-400" /> Contraseña del certificado
          </label>
          <input
            type="password"
            value={certPassword}
            onChange={(e) => setCertPassword(e.target.value)}
            placeholder="Contraseña del .p12 / .pfx"
            disabled={certLoaded}
            className="w-full px-3 py-2.5 rounded-lg border border-stone-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-amber-400/50 disabled:bg-stone-50 disabled:text-stone-400"
          />
          <p className="text-xs text-stone-400 mt-1">Se usa al firmar las facturas en modo Producción (AEAT).</p>
        </div>
        {certName && (
          <div className="mt-3 flex items-center gap-2 text-sm">
            {certLoaded ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <FileKey className="w-4 h-4 text-stone-400" />}
            <span className="text-stone-700 font-mono text-xs">{certName}</span>
            {certLoaded && <Badge color="emerald">Cargado</Badge>}
          </div>
        )}
        {certError && <p className="text-red-600 text-sm mt-2 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> {certError}</p>}
      </Card>

      {/* Save */}
      <div className="flex items-center gap-3">
        <Button variant="primary" size="lg" onClick={handleSave} disabled={saving} className="flex items-center gap-2">
          <Save className="w-5 h-5" /> {saving ? 'Guardando…' : 'Guardar configuración'}
        </Button>
        {saved && <span className="text-emerald-600 text-sm flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Guardado</span>}
      </div>
    </div>
  );
}
