export const dynamic = 'force-dynamic';

import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import { BrandingCommandCenter } from './BrandingCommandCenter';

export default async function AdminBrandingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: me } = await supabase.from('users')
    .select('is_superadmin').eq('id', user.id).single();
  if (!(me as { is_superadmin: boolean } | null)?.is_superadmin) redirect('/dashboard');

  const admin = createAdminClient();
  const { data: workspaces } = await admin
    .from('workspaces')
    .select('id, name, plan, owner_id, branding, created_at')
    .order('created_at', { ascending: false })
    .limit(500);

  // Fetch owner emails
  const ownerIds = [...new Set((workspaces ?? []).map((w) => (w as { owner_id: string }).owner_id))];
  const { data: owners } = ownerIds.length
    ? await admin.from('users').select('id, name, email').in('id', ownerIds)
    : { data: [] };
  const ownerMap = Object.fromEntries((owners ?? []).map((u) => [u.id, u]));

  return (
    <BrandingCommandCenter
      workspaces={(workspaces ?? []).map((w) => ({
        id: w.id,
        name: w.name,
        plan: w.plan,
        owner: ownerMap[(w as { owner_id: string }).owner_id] ?? null,
        branding: w.branding as {
          app_name: string;
          logo_url: string | null;
          primary_color: string;
          favicon_url?: string | null;
        } | null,
        created_at: w.created_at,
      }))}
    />
  );
}
