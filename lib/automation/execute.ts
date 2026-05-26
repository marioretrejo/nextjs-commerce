import type { SupabaseClient } from '@supabase/supabase-js';
import { deliverWebhook } from '@/lib/webhooks/deliver';
import { twilio } from '@/lib/twilio/client';

interface AutomationRule {
  id: string;
  workspace_id: string;
  agent_id: string;
  action_type: string;
  action_config: Record<string, unknown>;
}

interface CallRecord {
  id?: string;
  retell_call_id?: string;
  contact_phone?: string | null;
  campaign_id?: string | null;
  outcome?: string | null;
  sentiment?: string | null;
  duration_seconds?: number;
}

export async function executeAutomationRule(
  rule: AutomationRule,
  call: CallRecord,
  admin: SupabaseClient
): Promise<void> {
  const config = rule.action_config;

  try {
    switch (rule.action_type) {
      case 'webhook': {
        await deliverWebhook(rule.workspace_id, 'automation.triggered', {
          rule_id: rule.id,
          call_id: call.retell_call_id,
          outcome: call.outcome,
          contact_phone: call.contact_phone
        });
        break;
      }

      case 'send_sms': {
        const to = (config['to_number'] as string | undefined) ?? call.contact_phone;
        const template = (config['message'] as string | undefined) ?? '';
        if (to && template) {
          const message = template
            .replace('{{outcome}}', call.outcome ?? '')
            .replace('{{phone}}', call.contact_phone ?? '');
          await twilio.sendSMS(to, message);
        }
        break;
      }

      case 'notify_team': {
        // Notify the workspace owner
        const { data: workspace } = await admin
          .from('workspaces')
          .select('owner_id')
          .eq('id', rule.workspace_id)
          .single();
        if (workspace) {
          const ws = workspace as { owner_id: string };
          await admin.from('notifications').insert({
            user_id: ws.owner_id,
            type: 'automation',
            title: (config['title'] as string | undefined) ?? 'Automation triggered',
            body: (config['message'] as string | undefined) ??
              `Call ${call.outcome}: ${call.contact_phone ?? 'unknown'}`
          });
        }
        break;
      }

      case 'add_to_campaign': {
        const targetCampaignId = config['campaign_id'] as string | undefined;
        if (targetCampaignId && call.contact_phone) {
          await admin.from('campaign_contacts').insert({
            campaign_id: targetCampaignId,
            phone: call.contact_phone,
            status: 'pending'
          });
        }
        break;
      }

      default:
        break;
    }
  } catch (err) {
    // Log but don't throw — one failing action shouldn't block the others
    console.error(`Automation rule ${rule.id} (${rule.action_type}) failed:`, err);
  }
}
