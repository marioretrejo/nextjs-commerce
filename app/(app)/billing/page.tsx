import { createClient } from '@/lib/supabase/server';
import { getUserWorkspaces, getUser } from '@/lib/workspace';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import type { BillingInvoice, Plan } from '@/lib/supabase/types';
import { CreditCard, FileText, Zap, Check, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { EnterpriseInquiryModal } from '@/components/billing/enterprise-inquiry-modal';

interface PlanDef {
  name: Plan;
  label: string;
  price: number;
  minutes: number;
  agents: number;
  campaigns: number;
  features: string[];
}

const PLANS: PlanDef[] = [
  {
    name: 'free',
    label: 'Free',
    price: 0,
    minutes: 50,
    agents: 1,
    campaigns: 1,
    features: [
      '50 minutes / month',
      '1 AI agent',
      '1 campaign',
      'Basic analytics',
      'Email support',
    ],
  },
  {
    name: 'pro',
    label: 'Pro',
    price: 79,
    minutes: 1000,
    agents: 5,
    campaigns: 20,
    features: [
      '1,000 minutes / month',
      '5 AI agents',
      '20 campaigns',
      'Advanced analytics',
      'QA scoring',
      'Priority support',
      'CRM integrations',
    ],
  },
  {
    name: 'scale',
    label: 'Scale',
    price: 299,
    minutes: 5000,
    agents: -1,
    campaigns: -1,
    features: [
      '5,000 minutes / month',
      'Unlimited agents',
      'Unlimited campaigns',
      'Full analytics suite',
      'Custom QA criteria',
      'White-label',
      'Dedicated support',
      'Custom integrations',
    ],
  },
];

async function handleUpgrade(plan: Plan) {
  'use server';
  const res = await fetch(`${process.env['NEXT_PUBLIC_APP_URL'] ?? ''}/api/billing/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  });
  if (!res.ok) throw new Error('Checkout failed — please try again.');
  const d = await res.json() as { url: string };
  if (d.url) {
    const { redirect } = await import('next/navigation');
    redirect(d.url);
  }
  throw new Error('No checkout URL returned — please try again.');
}

async function handlePortal() {
  'use server';
  const res = await fetch(`${process.env['NEXT_PUBLIC_APP_URL'] ?? ''}/api/billing/portal`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Portal access failed — please try again.');
  const d = await res.json() as { url: string };
  if (d.url) {
    const { redirect } = await import('next/navigation');
    redirect(d.url);
  }
  throw new Error('No portal URL returned — please try again.');
}

export default async function BillingPage() {
  const [workspaces, user] = await Promise.all([getUserWorkspaces(), getUser()]);
  const workspace = workspaces[0];

  let invoices: BillingInvoice[] = [];
  if (workspace) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('billing_invoices')
      .select('*')
      .eq('workspace_id', workspace.id)
      .order('created_at', { ascending: false })
      .limit(20);
    invoices = (data as BillingInvoice[]) ?? [];
  }

  const currentPlan = workspace?.plan ?? user?.plan ?? 'free';
  const minutesUsed = workspace?.minutes_used ?? user?.minutes_used ?? 0;
  const minutesLimit = workspace?.minutes_limit ?? user?.minutes_limit ?? 50;
  const minutesPct = minutesLimit > 0 ? Math.min(100, Math.round((minutesUsed / minutesLimit) * 100)) : 0;

  const planDef: PlanDef = (PLANS.find(p => p.name === currentPlan) ?? PLANS[0]) as PlanDef;

  function planBadge(plan: Plan) {
    const map: Record<Plan, string> = {
      free:  'border-[#e0e0e0] text-[#6b6b6b] bg-white',
      pro:   'bg-[#f5f5f5] text-[#0a0a0a] border-[#e0e0e0]',
      scale: 'bg-[#0a0a0a] text-white border-transparent',
    };
    return <Badge className={map[plan]}>{plan.charAt(0).toUpperCase() + plan.slice(1)}</Badge>;
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">Billing</h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">Manage your subscription, minutes, and invoices.</p>
        </div>
        {user?.stripe_customer_id ? (
          <form action={handlePortal}>
            <Button variant="outline" type="submit">
              <CreditCard className="w-4 h-4 mr-2" />
              Manage Billing
            </Button>
          </form>
        ) : null}
      </div>

      {/* Current plan + usage */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Current Plan</CardTitle>
              {planBadge(currentPlan as Plan)}
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold text-[#0a0a0a] mb-1">
              {planDef.price === 0 ? 'Free' : `$${planDef.price}/mo`}
            </p>
            <p className="text-sm text-[#6b6b6b] mb-4">
              {planDef.minutes.toLocaleString()} minutes · {planDef.agents === -1 ? 'Unlimited' : planDef.agents} agents
            </p>
            {currentPlan !== 'scale' && (
              <form action={handleUpgrade.bind(null, currentPlan === 'free' ? 'pro' : 'scale')}>
                <Button type="submit" size="sm" className="w-full">
                  <Zap className="w-4 h-4 mr-1" />
                  Upgrade to {currentPlan === 'free' ? 'Pro' : 'Scale'}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Minutes Usage</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-2 mb-2">
              <p className="text-3xl font-bold text-[#0a0a0a]">{minutesUsed.toLocaleString()}</p>
              <p className="text-sm text-[#6b6b6b] mb-1">/ {minutesLimit.toLocaleString()} min</p>
            </div>
            <Progress value={minutesPct} className="h-2 mb-2" />
            <p className="text-xs text-[#6b6b6b]">
              {minutesPct}% used · {Math.max(0, minutesLimit - minutesUsed).toLocaleString()} minutes remaining
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Plan comparison */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Plan Comparison</CardTitle>
          <CardDescription>Choose the plan that fits your team.</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <div className="grid grid-cols-4 divide-x divide-[#e0e0e0] border-t border-[#e0e0e0]">
            {PLANS.map((plan) => {
              const isCurrent = plan.name === currentPlan;
              return (
                <div key={plan.name} className={`p-6 ${isCurrent ? 'bg-[#f5f5f5]' : ''}`}>
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-[#0a0a0a]">{plan.label}</p>
                    {isCurrent && (
                      <Badge className="bg-[#0a0a0a] text-white border-transparent text-xs">Current</Badge>
                    )}
                  </div>
                  <p className="text-2xl font-bold text-[#0a0a0a] mb-4">
                    {plan.price === 0 ? 'Free' : `$${plan.price}/mo`}
                  </p>
                  <ul className="space-y-2 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-xs text-[#6b6b6b]">
                        <Check className="w-3.5 h-3.5 text-[#0a0a0a] shrink-0 mt-0.5" />
                        {f}
                      </li>
                    ))}
                  </ul>
                  {!isCurrent && plan.name !== 'free' && (
                    <form action={handleUpgrade.bind(null, plan.name)}>
                      <Button type="submit" variant={plan.name === 'scale' ? 'default' : 'outline'} size="sm" className="w-full text-xs">
                        Upgrade to {plan.label}
                      </Button>
                    </form>
                  )}
                </div>
              );
            })}

            {/* Enterprise column */}
            <div className="p-6 bg-[#0a0a0a] text-white">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-semibold">Enterprise</p>
              </div>
              <p className="text-2xl font-bold mb-4">Custom</p>
              <ul className="space-y-2 mb-6">
                {[
                  'Custom minute volume',
                  'Custom per-minute rate',
                  'Dedicated infrastructure',
                  'BYOT with privacy mode',
                  'Custom data residency',
                  'White label + custom domain',
                  'SLA guarantee',
                  'Dedicated account manager',
                  'BAA / NDA / custom contracts',
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-[#a0a0a0]">
                    <Check className="w-3.5 h-3.5 text-white shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <EnterpriseInquiryModal />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Invoice history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Invoice History
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {invoices.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#6b6b6b]">
              No invoices yet. Invoices appear here once you subscribe to a paid plan.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-[1fr_1fr_1fr_1fr_80px] gap-3 px-5 py-3 border-t border-[#e0e0e0] text-xs font-medium text-[#6b6b6b] uppercase tracking-wide">
                <span>Invoice</span>
                <span>Period</span>
                <span>Amount</span>
                <span>Status</span>
                <span />
              </div>
              <div className="divide-y divide-[#e0e0e0]">
                {invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="grid grid-cols-[1fr_1fr_1fr_1fr_80px] gap-3 px-5 py-4 text-sm items-center hover:bg-[#f5f5f5]"
                  >
                    <span className="font-mono text-xs text-[#6b6b6b]">
                      {inv.stripe_invoice_id.slice(0, 16)}…
                    </span>
                    <span className="text-[#6b6b6b] text-xs">
                      {inv.period_start && inv.period_end
                        ? `${format(new Date(inv.period_start), 'MMM d')} – ${format(new Date(inv.period_end), 'MMM d, yyyy')}`
                        : '—'}
                    </span>
                    <span className="font-medium text-[#0a0a0a]">
                      {new Intl.NumberFormat('en-US', { style: 'currency', currency: inv.currency.toUpperCase() }).format(inv.amount / 100)}
                    </span>
                    <span>
                      <Badge
                        className={inv.status === 'paid'
                          ? 'bg-[#f5f5f5] text-[#0a0a0a] border-[#e0e0e0] text-xs'
                          : 'bg-[#0a0a0a] text-white border-transparent text-xs'}
                      >
                        {inv.status.charAt(0).toUpperCase() + inv.status.slice(1)}
                      </Badge>
                    </span>
                    <span>
                      {inv.pdf_url && (
                        <a
                          href={inv.pdf_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-[#6b6b6b] hover:text-[#0a0a0a]"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          PDF
                        </a>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
