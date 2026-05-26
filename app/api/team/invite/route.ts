import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { sendTeamInvite } from '@/lib/email';
import crypto from 'crypto';
import { z } from 'zod';
import { apiError, apiOk, parseBody } from '@/lib/api';

const InviteSchema = z.object({
  email: z.string().email(),
  role: z.enum(['admin', 'editor', 'viewer']).default('editor'),
  workspace_id: z.string().uuid().optional(),
});

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError('Unauthorized', 401);

  const parsed = parseBody(InviteSchema, await req.json());
  if (!parsed.success) return parsed.response;
  const { email, role, workspace_id } = parsed.data;

  // Get the workspace to invite to (default to user's first workspace)
  let wsId = workspace_id;
  if (!wsId) {
    const { data: ws } = await supabase
      .from('workspaces')
      .select('id')
      .eq('owner_id', user.id)
      .single();
    wsId = (ws as { id: string } | null)?.id;
  }

  if (!wsId) return apiError('Workspace not found', 404);

  const { data: ws } = await supabase
    .from('workspaces')
    .select('id, name')
    .eq('id', wsId)
    .single();
  if (!ws) return apiError('Workspace not found', 404);

  const workspace = ws as { id: string; name: string };
  const admin = createAdminClient();

  // Check if user already exists
  const { data: existingUser } = await admin
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  const inviteeId = (existingUser as { id: string } | null)?.id ?? null;
  const inviteToken = crypto.randomUUID();

  const { data, error } = await admin.from('workspace_members').upsert({
    workspace_id: wsId,
    user_id: inviteeId,
    role: role ?? 'editor',
    status: inviteeId ? 'active' : 'pending',
    invite_email: inviteeId ? null : email,
    invited_by: user.id,
    invite_token: inviteeId ? null : inviteToken
  }, { onConflict: 'workspace_id,user_id' }).select().single();

  if (error) {
    console.error('[team/invite] upsert error:', error);
    return apiError('Internal server error', 500);
  }

  // Send invite email for new (pending) members
  if (!inviteeId) {
    const inviterName = (user.user_metadata?.['full_name'] as string | undefined) ?? user.email ?? 'A teammate';
    const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? 'https://voiceos.app';
    sendTeamInvite({ to: email, inviterName, workspaceName: workspace.name, inviteToken, appUrl })
      .catch(console.error);
  }

  return apiOk(data, 201);
}
