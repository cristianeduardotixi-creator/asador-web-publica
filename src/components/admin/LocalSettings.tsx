import { useState, useRef, useEffect } from 'react';
import {
  Store, Save, Upload, Image as ImageIcon, CheckCircle2, AlertCircle,
  Building2, Phone, Mail, FileText, Percent, Loader2,
} from 'lucide-react';
import { useApp } from '@/context/AppContext';
import { supabase } from '@/lib/supabase';
import { Button, Card, Badge } from '@/components/ui';
import { cn } from '@/lib/cn';

export function LocalSettings() {
  const { settings, reloadSettings } = useApp();
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Local form state
  const [restaurantName, setRestaurantName] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [legalName, setLegalName] = useState('');
  const [nif, setNif] = useState('');
  const [address, setAddress] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [ivaRate, setIvaRate] = useState('10');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Sync from settings on mount and when settings load
  useEffect(() => {
    setRestaurantName(settings.restaurant_name ?? '');
    setTradeName(settings.restaurant_trade_name ?? settings.restaurant_name ?? '');
    setLegalName(settings.restaurant_legal_name ?? '');
    setNif(settings.restaurant_nif ?? settings.verifactu_nif ?? '');
    setAddress(settings.restaurant_address ?? settings.verifactu_issuer_address ?? '');
    setPostalCode(settings.restaurant_postal_code ?? '');
    setPhone(settings.restaurant_phone ?? '');
    setEmail(settings.restaurant_email ?? '');
    setIvaRate(settings.default_iva_rate ?? '10');
    setLogoUrl(settings.restaurant_logo ?? null);
  }, [settings]);

  async function upsert(key: string, value: string) {
    await supabase.from('settings').upsert({ key, value, updated_at: new Date().toISOString() });
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      await Promise.all([
        upsert('restaurant_name', restaurantName),
        upsert('restaurant_trade_name', tradeName || restaurantName),
        upsert('restaurant_legal_name', legalName),
        upsert('restaurant_nif', nif.toUpperCase()),
        upsert('restaurant_address', address),
        upsert('restaurant_postal_code', postalCode),
        upsert('restaurant_phone', phone),
        upsert('restaurant_email', email),
        upsert('default_iva_rate', ivaRate),
        // Sync fiscal settings
        upsert('verifactu_issuer_name', legalName),
        upsert('verifactu_issuer_address', address),
        upsert('verifactu_nif', nif.toUpperCase()),
      ]);
      await reloadSettings();
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('El archivo debe ser una imagen (PNG, JPG, etc.)');
      return;
    }
    setUploading(true);
    setError(null);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64String = reader.result as string;
        await upsert('restaurant_logo', base64String);
        await reloadSettings();
        setLogoUrl(base64String);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error al subir el logo');
      } finally {
        setUploading(false);
      }
    };
    reader.onerror = () => {
      setError('Error al leer el archivo de imagen');
      setUploading(false);
    };
    reader.readAsDataURL(file);
  }

  const inputClass = 'w-full px-3 py-2.5 rounded-lg border border-stone-300 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400/50 transition-shadow';

  return (
    <div className="p-4 lg:p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <Store className="w-6 h-6 text-amber-600" />
        <h1 className="text-2xl font-bold text-stone-800">Datos del Local y Fiscales</h1>
      </div>
      <p className="text-stone-500 text-sm mb-6">
        Estos datos aparecen automáticamente en la cabecera de tickets impresos y facturas simplificadas.
      </p>

      {/* Logo section */}
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <ImageIcon className="w-5 h-5 text-amber-600" />
          <h3 className="font-semibold text-stone-800">Logo del restaurante</h3>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-24 h-24 rounded-2xl border-2 border-dashed border-stone-300 bg-stone-50 flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt="Logo" className="w-full h-full object-contain" />
            ) : (
              <ImageIcon className="w-8 h-8 text-stone-300" />
            )}
          </div>
          <div className="flex-1">
            <input ref={fileRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            <Button
              variant="secondary"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-2"
            >
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {uploading ? 'Subiendo…' : 'Subir / Cambiar logo'}
            </Button>
            <p className="text-xs text-stone-400 mt-2">Formato PNG o JPG. Se recomienda logo cuadrado.</p>
          </div>
        </div>
      </Card>

      {/* Restaurant data */}
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <Building2 className="w-5 h-5 text-amber-600" />
          <h3 className="font-semibold text-stone-800">Datos del local</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Nombre comercial</label>
            <input
              value={restaurantName}
              onChange={(e) => setRestaurantName(e.target.value)}
              placeholder="Ej: Asador Parla Este"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Razón social / Nombre del titular</label>
            <input
              value={legalName}
              onChange={(e) => setLegalName(e.target.value)}
              placeholder="Ej: Asador Parla Este S.L. o Juan Pérez García (autónomo)"
              className={inputClass}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">NIF / CIF / DNI</label>
            <input
              value={nif}
              onChange={(e) => setNif(e.target.value.toUpperCase())}
              placeholder="B12345678 o 12345678X"
              className={cn(inputClass, 'font-mono')}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">Dirección completa del local</label>
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="C/ Amsterdam, 11"
              className={inputClass}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Código Postal</label>
              <input
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value)}
                placeholder="28914"
                inputMode="numeric"
                className={cn(inputClass, 'font-mono')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Teléfono</label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="910 000 000"
                  className={cn(inputClass, 'pl-10')}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-600 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="info@restaurante.es"
                  type="email"
                  className={cn(inputClass, 'pl-10')}
                />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Fiscal config */}
      <Card className="p-5 mb-4">
        <div className="flex items-center gap-2 mb-3">
          <FileText className="w-5 h-5 text-amber-600" />
          <h3 className="font-semibold text-stone-800">Configuración fiscal</h3>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-stone-600 mb-1">IVA aplicable (hostelería)</label>
            <div className="flex items-center gap-2">
              <div className="relative w-32">
                <Percent className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                <input
                  value={ivaRate}
                  onChange={(e) => setIvaRate(e.target.value)}
                  inputMode="decimal"
                  className={cn(inputClass, 'pl-10 font-semibold')}
                />
              </div>
              <span className="text-sm text-stone-500">
                IVA reducido del 10% aplicable a comidas y bebidas en hostelería (vigente en España).
              </span>
            </div>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 space-y-1.5">
            <p className="text-sm text-amber-800 font-medium flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4" /> Facturas simplificadas con serie T-AAAA-NNNNN
            </p>
            <p className="text-xs text-amber-700">
              Las facturas se numeran correlativamente por año sin saltos (ej: T-2026-00001).
              El encadenamiento SHA-256 garantiza registros inalterables conforme al Veri*Factu (RD 1007/2023).
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Badge color="emerald">Base imponible desglosada</Badge>
              <Badge color="emerald">Cuota IVA desglosada</Badge>
              <Badge color="stone">QR Veri*Factu oculto</Badge>
              <Badge color="emerald">Encadenamiento SHA-256</Badge>
            </div>
          </div>
        </div>
      </Card>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3 mb-4 flex items-center gap-2 text-sm text-red-700">
          <AlertCircle className="w-4 h-4" /> {error}
        </div>
      )}

      <div className="flex items-center gap-3">
        <Button variant="primary" size="lg" onClick={handleSave} disabled={saving} className="flex items-center gap-2">
          <Save className="w-5 h-5" /> {saving ? 'Guardando…' : 'Guardar datos del local'}
        </Button>
        {saved && (
          <span className="text-emerald-600 text-sm flex items-center gap-1">
            <CheckCircle2 className="w-4 h-4" /> Guardado correctamente
          </span>
        )}
      </div>
    </div>
  );
}