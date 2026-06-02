'use client';

import { useState, useCallback, useRef } from 'react';
import { Search, Palette, X } from 'lucide-react';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';

interface BrandingWorkspace {
  id: string;
  name: string;
  plan: string;
  owner: { id: string; name: string; email: string } | null;
  branding: {
    app_name: string;
    logo_url: string | null;
    primary_color: string;
    favicon_url?: string | null;
  } | null;
  created_at: string;
}

interface Props {
  workspaces: BrandingWorkspace[];
}

export function BrandingCommandCenter({ workspaces: initial }: Props) {
  const [workspaces, setWorkspaces] = useState(initial);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  // Branding modal state
  const [brandingTarget, setBrandingTarget] = useState<BrandingWorkspace | null>(null);
  const [brandingForm, setBrandingForm] = useState({ app_name: '', logo_url: '', primary_color: '#0a0a0a' });
  const [brandingLoading, setBrandingLoading] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/svg+xml', 'image/png', 'image/jpeg', 'image/jpg'].includes(file.type)) {
      toast.error('Solo SVG, PNG o JPG permitidos');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('El archivo no debe exceder 5MB');
      return;
    }

    try {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result as string;
        setBrandingForm(f => ({ ...f, logo_url: dataUrl }));
        toast.success('Logo cargado exitosamente');
        if (logoInputRef.current) logoInputRef.current.value = '';
      };
      reader.readAsDataURL(file);
    } catch (err) {
      toast.error('Error al leer el archivo');
    }
  };

  const setWsLoading = (id: string, v: boolean) =>
    setLoading((p) => ({ ...p, [id]: v }));

  const filtered = workspaces.filter((w) =>
    !search ||
    w.name.toLowerCase().includes(search.toLowerCase()) ||
    w.owner?.email.toLowerCase().includes(search.toLowerCase())
  );

  const openBrandingModal = (ws: BrandingWorkspace) => {
    setBrandingForm({
      app_name:      ws.branding?.app_name      ?? '',
      logo_url:      ws.branding?.logo_url       ?? '',
      primary_color: ws.branding?.primary_color  ?? '#0a0a0a',
    });
    setBrandingTarget(ws);
  };

  const saveBranding = useCallback(async () => {
    if (!brandingTarget) return;
    setBrandingLoading(true);
    const payload = brandingForm.app_name.trim()
      ? {
          app_name:      brandingForm.app_name.trim(),
          logo_url:      brandingForm.logo_url.trim() || null,
          primary_color: brandingForm.primary_color || '#0a0a0a',
        }
      : null;
    try {
      const res = await fetch(`/api/admin/workspaces/${brandingTarget.id}/branding`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(((await res.json()) as { error: string }).error);
      setWorkspaces(prev => prev.map(w =>
        w.id === brandingTarget.id ? { ...w, branding: payload } : w
      ));
      toast.success(payload
        ? `Branding activado para "${brandingTarget.name}"`
        : `Branding eliminado para "${brandingTarget.name}"`);
      setBrandingTarget(null);
    } catch (e) { toast.error(String(e)); }
    finally { setBrandingLoading(false); }
  }, [brandingTarget, brandingForm]);

  const activeBranding = workspaces.filter(w => w.branding).length;

  return (
    <>
      {/* Branding Modal */}
      <Dialog open={!!brandingTarget} onOpenChange={(o) => { if (!o) setBrandingTarget(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Palette className="h-5 w-5 text-violet-600" />
              White-label Branding — {brandingTarget?.name}
            </DialogTitle>
            <DialogDescription>
              Personaliza el nombre, logo y color para este cliente.
              Deja <strong>App Name</strong> en blanco para desactivar el branding personalizado.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>App Name</Label>
              <Input
                placeholder="Ej. AcmeCalls, SalesBot Pro…"
                value={brandingForm.app_name}
                onChange={e => setBrandingForm(f => ({ ...f, app_name: e.target.value }))}
              />
              <p className="text-xs text-[#6b6b6b]">Reemplaza &ldquo;VoiceOS&rdquo; en la barra lateral y título de pestaña.</p>
            </div>
            <div className="space-y-1.5">
              <Label>Logo <span className="text-[#a0a0a0]">(opcional)</span></Label>
              <div className="space-y-2">
                <div className="flex gap-2">
                  <Input
                    placeholder="https://cdn.empresa.com/logo.png o cargado ↓"
                    value={brandingForm.logo_url}
                    onChange={e => setBrandingForm(f => ({ ...f, logo_url: e.target.value }))}
                    className="flex-1"
                  />
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept=".svg,.png,.jpg,.jpeg"
                    onChange={handleLogoFileSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => logoInputRef.current?.click()}
                    className="px-3"
                  >
                    Cargar
                  </Button>
                </div>
                <p className="text-xs text-[#6b6b6b]">SVG/PNG/JPG, fondo transparente, ~120×32px. Max 5MB.</p>
                {brandingForm.logo_url && brandingForm.logo_url.startsWith('data:') && (
                  <p className="text-xs text-green-600">✓ Logo cargado desde archivo</p>
                )}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Color primario</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={brandingForm.primary_color}
                  onChange={e => setBrandingForm(f => ({ ...f, primary_color: e.target.value }))}
                  className="h-9 w-14 cursor-pointer rounded border border-[#e5e5e5] p-0.5"
                />
                <Input
                  placeholder="#0a0a0a"
                  value={brandingForm.primary_color}
                  onChange={e => setBrandingForm(f => ({ ...f, primary_color: e.target.value }))}
                  className="flex-1 font-mono text-sm"
                />
              </div>
            </div>
            {brandingTarget?.branding && (
              <p className="rounded-lg bg-violet-50 px-3 py-2 text-xs text-violet-700 border border-violet-100">
                ✓ Branding activo — App: <strong>{brandingTarget.branding.app_name}</strong>
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            {brandingTarget?.branding && (
              <Button
                variant="outline"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => { setBrandingForm({ app_name: '', logo_url: '', primary_color: '#0a0a0a' }); }}
              >
                <X className="mr-1.5 h-3.5 w-3.5" /> Limpiar
              </Button>
            )}
            <Button variant="outline" onClick={() => setBrandingTarget(null)}>Cancel</Button>
            <Button onClick={saveBranding} disabled={brandingLoading} className="bg-violet-600 hover:bg-violet-700 text-white">
              {brandingLoading ? 'Guardando…' : 'Guardar Branding'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#1a1a1a]">White-Label Branding Manager</h1>
            <p className="text-sm text-[#6b6b6b] mt-0.5">
              {activeBranding} of {workspaces.length} workspaces have custom branding enabled
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-[#e5e5e5] bg-white px-3 py-2">
            <Search className="h-4 w-4 text-[#a0a0a0]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search workspaces or email…"
              className="w-52 text-sm outline-none placeholder:text-[#c0c0c0]"
            />
          </div>
        </div>

        {/* Workspaces list */}
        <div className="space-y-2">
          {filtered.map((ws) => (
            <div
              key={ws.id}
              className="rounded-xl border border-[#e5e5e5] bg-white hover:border-violet-200 transition-colors"
            >
              <div className="flex items-center justify-between px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-[#1a1a1a]">{ws.name}</span>
                    <Badge variant={ws.plan === 'scale' ? 'default' : 'secondary'} className="text-[10px] uppercase">
                      {ws.plan}
                    </Badge>
                    {ws.branding && (
                      <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold bg-violet-100 text-violet-700 border border-violet-200">
                        <Palette className="h-2.5 w-2.5" />
                        {ws.branding.app_name}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#a0a0a0] mt-0.5 truncate">
                    {ws.owner?.email ?? 'No owner'}
                  </p>
                </div>

                <button
                  onClick={() => openBrandingModal(ws)}
                  disabled={loading[ws.id]}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 ${
                    ws.branding
                      ? 'border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100'
                      : 'border-[#e5e5e5] bg-white text-[#606060] hover:bg-[#f5f5f5]'
                  }`}
                >
                  <Palette className="h-3.5 w-3.5" />
                  {ws.branding ? 'Edit Branding' : 'Add Branding'}
                </button>
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="py-12 text-center text-sm text-[#a0a0a0]">No workspaces found.</div>
          )}
        </div>
      </div>
    </>
  );
}
