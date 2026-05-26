'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Bot, Building2, CheckCircle2, ChevronRight, Phone, Rocket, Sparkles, X } from 'lucide-react';
import confetti from 'canvas-confetti';

interface OnboardingWizardProps {
  userId: string;
  userName: string | null;
  workspaceId: string;
}

const STEPS = [
  { id: 1, title: 'Welcome', icon: Sparkles },
  { id: 2, title: 'Your Business', icon: Building2 },
  { id: 3, title: 'First Agent', icon: Bot },
  { id: 4, title: 'Phone Number', icon: Phone },
  { id: 5, title: "You're Ready!", icon: Rocket },
];

const INDUSTRIES = [
  'SaaS / Technology', 'Real Estate', 'Healthcare', 'Insurance',
  'Financial Services', 'E-commerce', 'Staffing / HR', 'Other',
];

const TEAM_SIZES = ['Just me', '2–10', '11–50', '51–200', '200+'];

const LANGUAGES = [
  { value: 'es-419', label: 'Spanish (LATAM)' },
  { value: 'es-ES', label: 'Spanish (Spain)' },
  { value: 'en-US', label: 'English (US)' },
  { value: 'pt-BR', label: 'Portuguese (Brazil)' },
];

export function OnboardingWizard({ userId: _userId, userName, workspaceId }: OnboardingWizardProps) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [agentError, setAgentError] = useState<string | null>(null);

  const [company, setCompany] = useState('');
  const [industry, setIndustry] = useState('');
  const [teamSize, setTeamSize] = useState('');
  const [agentName, setAgentName] = useState('');
  const [agentObjective, setAgentObjective] = useState('');
  const [agentLanguage, setAgentLanguage] = useState('es-419');
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);

  const firstName = userName?.split(' ')[0] ?? 'there';

  const fireConfetti = useCallback(() => {
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 } });
    setTimeout(() => confetti({ particleCount: 60, spread: 120, origin: { y: 0.3 }, angle: 60 }), 300);
    setTimeout(() => confetti({ particleCount: 60, spread: 120, origin: { y: 0.3 }, angle: 120 }), 500);
  }, []);

  useEffect(() => {
    if (step === 5) fireConfetti();
  }, [step, fireConfetti]);

  async function markComplete() {
    await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboarding_completed: true }),
    });
  }

  // Bug fix #6: save business data when advancing from step 2
  async function handleStep2Next() {
    setLoading(true);
    try {
      await fetch('/api/me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ company: company || undefined }),
      });
    } catch {
      // non-blocking — profile save failure shouldn't block onboarding
    } finally {
      setLoading(false);
      setStep(3);
    }
  }

  // Bug fix #1 (workspace_id) + Bug fix #4 (error handling)
  async function handleStep3Next() {
    if (!agentName.trim()) return;
    setLoading(true);
    setAgentError(null);
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id: workspaceId,
          name: agentName,
          language: agentLanguage,
          objective: agentObjective,
          personality: 'Friendly, professional, and helpful.',
          system_prompt: `You are ${agentName}, a voice AI assistant. ${agentObjective}`,
        }),
      });

      if (res.ok) {
        const data = await res.json() as { id: string };
        setCreatedAgentId(data.id);
        setStep(4);
      } else {
        const err = await res.json() as { error?: string };
        const msg = err.error ?? 'Failed to create agent. Please try again.';
        setAgentError(msg);
        toast.error(msg);
        // Stay on step 3 — don't advance silently on failure
      }
    } catch {
      const msg = 'Network error. Check your connection and try again.';
      setAgentError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  async function handleFinish() {
    setLoading(true);
    await markComplete();
    router.push('/dashboard');
    router.refresh();
  }

  async function handleSkipToFinish() {
    await markComplete();
    setStep(5);
  }

  if (dismissed) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="relative w-full max-w-xl mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Skip button — only on steps 1-4 */}
        {step < 5 && (
          <button
            onClick={async () => { await markComplete(); setDismissed(true); }}
            className="absolute top-4 right-4 p-1.5 text-[#6b6b6b] hover:text-[#0a0a0a] transition-colors rounded-full hover:bg-[#f5f5f5]"
            aria-label="Skip onboarding"
          >
            <X className="h-4 w-4" />
          </button>
        )}

        {/* Step indicator */}
        <div className="flex items-center gap-1.5 px-8 pt-6 pb-0">
          {STEPS.map((s) => (
            <div key={s.id} className="flex items-center gap-1.5">
              <div
                className={[
                  'h-2 w-2 rounded-full transition-all',
                  step > s.id ? 'bg-green-500' : step === s.id ? 'bg-[#0a0a0a] w-6' : 'bg-[#e0e0e0]',
                ].join(' ')}
              />
            </div>
          ))}
          <span className="ml-auto text-xs text-[#6b6b6b]">{step} / {STEPS.length}</span>
        </div>

        {/* Content */}
        <div className="px-8 py-6">

          {/* Step 1 — Welcome */}
          {step === 1 && (
            <div className="text-center py-4">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f5f5f5]">
                <Sparkles className="h-8 w-8 text-[#0a0a0a]" />
              </div>
              <h2 className="text-2xl font-bold text-[#0a0a0a] mb-2">Welcome to VoiceOS, {firstName}!</h2>
              <p className="text-[#6b6b6b] mb-6">
                Let&apos;s get you set up in under 2 minutes. We&apos;ll create your first AI voice agent and get you ready to make calls.
              </p>
              <div className="grid grid-cols-3 gap-3 mb-8">
                {[
                  { icon: Bot, label: 'Create an agent' },
                  { icon: Phone, label: 'Set up calling' },
                  { icon: Rocket, label: 'Launch campaigns' },
                ].map(({ icon: Icon, label }) => (
                  <div key={label} className="flex flex-col items-center gap-2 rounded-xl border border-[#e0e0e0] p-4">
                    <Icon className="h-5 w-5 text-[#0a0a0a]" />
                    <span className="text-xs font-medium text-[#0a0a0a]">{label}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStep(2)}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#0a0a0a] text-white py-3 font-medium hover:bg-[#333] transition-colors"
              >
                Let&apos;s get started <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Step 2 — Business info */}
          {step === 2 && (
            <div>
              <div className="mb-5">
                <h2 className="text-xl font-bold text-[#0a0a0a]">Tell us about your business</h2>
                <p className="text-sm text-[#6b6b6b] mt-1">This helps us personalise your experience.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[#0a0a0a]">Company name</label>
                  <input
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Acme Inc."
                    className="mt-1 w-full rounded-lg border border-[#e0e0e0] px-3 py-2 text-sm outline-none focus:border-[#0a0a0a] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#0a0a0a]">Industry</label>
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    {INDUSTRIES.map((ind) => (
                      <button
                        key={ind}
                        onClick={() => setIndustry(ind)}
                        className={[
                          'rounded-lg border px-3 py-2 text-sm text-left transition-colors',
                          industry === ind
                            ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white'
                            : 'border-[#e0e0e0] text-[#0a0a0a] hover:border-[#0a0a0a]',
                        ].join(' ')}
                      >
                        {ind}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-[#0a0a0a]">Team size</label>
                  <div className="mt-1 flex flex-wrap gap-2">
                    {TEAM_SIZES.map((s) => (
                      <button
                        key={s}
                        onClick={() => setTeamSize(s)}
                        className={[
                          'rounded-lg border px-3 py-2 text-sm transition-colors',
                          teamSize === s
                            ? 'border-[#0a0a0a] bg-[#0a0a0a] text-white'
                            : 'border-[#e0e0e0] text-[#0a0a0a] hover:border-[#0a0a0a]',
                        ].join(' ')}
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setStep(1)} className="flex-1 rounded-lg border border-[#e0e0e0] py-2.5 text-sm font-medium text-[#0a0a0a] hover:bg-[#f5f5f5] transition-colors">
                  Back
                </button>
                {/* Bug fix #6: save business data before advancing */}
                <button
                  onClick={handleStep2Next}
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#0a0a0a] text-white py-2.5 text-sm font-medium hover:bg-[#333] transition-colors disabled:opacity-50"
                >
                  {loading ? 'Saving…' : <> Continue <ChevronRight className="h-4 w-4" /></>}
                </button>
              </div>
            </div>
          )}

          {/* Step 3 — First Agent */}
          {step === 3 && (
            <div>
              <div className="mb-5">
                <h2 className="text-xl font-bold text-[#0a0a0a]">Create your first agent</h2>
                <p className="text-sm text-[#6b6b6b] mt-1">Give your AI voice agent a name and purpose.</p>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-[#0a0a0a]">Agent name <span className="text-red-500">*</span></label>
                  <input
                    value={agentName}
                    onChange={(e) => { setAgentName(e.target.value); setAgentError(null); }}
                    placeholder="e.g. Sales Assistant, Sofia, Max"
                    className="mt-1 w-full rounded-lg border border-[#e0e0e0] px-3 py-2 text-sm outline-none focus:border-[#0a0a0a] transition-colors"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#0a0a0a]">What will this agent do?</label>
                  <textarea
                    value={agentObjective}
                    onChange={(e) => setAgentObjective(e.target.value)}
                    placeholder="e.g. Qualify inbound leads, book demos, and collect contact info."
                    rows={3}
                    className="mt-1 w-full rounded-lg border border-[#e0e0e0] px-3 py-2 text-sm outline-none focus:border-[#0a0a0a] transition-colors resize-none"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-[#0a0a0a]">Primary language</label>
                  <select
                    value={agentLanguage}
                    onChange={(e) => setAgentLanguage(e.target.value)}
                    className="mt-1 w-full rounded-lg border border-[#e0e0e0] px-3 py-2 text-sm outline-none focus:border-[#0a0a0a] transition-colors bg-white"
                  >
                    {LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>{l.label}</option>
                    ))}
                  </select>
                </div>
                {/* Bug fix #4: show error if creation failed */}
                {agentError && (
                  <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                    {agentError}
                  </p>
                )}
              </div>
              <div className="mt-6 flex gap-3">
                <button onClick={() => setStep(2)} className="flex-1 rounded-lg border border-[#e0e0e0] py-2.5 text-sm font-medium text-[#0a0a0a] hover:bg-[#f5f5f5] transition-colors">
                  Back
                </button>
                <button
                  onClick={handleStep3Next}
                  disabled={!agentName.trim() || loading}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#0a0a0a] text-white py-2.5 text-sm font-medium hover:bg-[#333] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Creating…' : <>Create agent <ChevronRight className="h-4 w-4" /></>}
                </button>
              </div>
            </div>
          )}

          {/* Step 4 — Phone number (optional) */}
          {step === 4 && (
            <div>
              <div className="mb-5">
                <h2 className="text-xl font-bold text-[#0a0a0a]">Get a phone number</h2>
                <p className="text-sm text-[#6b6b6b] mt-1">You need a number to make outbound calls. You can do this later too.</p>
              </div>
              <div className="rounded-xl border border-[#e0e0e0] p-5 mb-4">
                <div className="flex items-start gap-3">
                  <Phone className="h-5 w-5 text-[#0a0a0a] mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-[#0a0a0a]">Provision a number from the Numbers page</p>
                    <p className="text-xs text-[#6b6b6b] mt-1">
                      VoiceOS supports Twilio numbers in 16+ countries. Head to the Numbers page after setup to provision one.
                    </p>
                  </div>
                </div>
              </div>
              {createdAgentId && (
                <div className="rounded-xl border border-green-200 bg-green-50 p-4 mb-4 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-800">Agent created successfully!</p>
                    <p className="text-xs text-green-700 mt-0.5">Your agent is ready. You can configure it fully from the Agents page.</p>
                  </div>
                </div>
              )}
              {/* Bug fix #7: remove duplicate buttons — Back goes to step 3, Continue goes to step 5 */}
              <div className="mt-4 flex gap-3">
                <button
                  onClick={() => setStep(3)}
                  className="flex-1 rounded-lg border border-[#e0e0e0] py-2.5 text-sm font-medium text-[#0a0a0a] hover:bg-[#f5f5f5] transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSkipToFinish}
                  className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[#0a0a0a] text-white py-2.5 text-sm font-medium hover:bg-[#333] transition-colors"
                >
                  Continue <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 5 — Done */}
          {step === 5 && (
            <div className="text-center py-4">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#f5f5f5]">
                <Rocket className="h-8 w-8 text-[#0a0a0a]" />
              </div>
              <h2 className="text-2xl font-bold text-[#0a0a0a] mb-2">You&apos;re all set, {firstName}!</h2>
              <p className="text-[#6b6b6b] mb-8">
                Your account is ready. Head to the dashboard to see your agent and start building campaigns.
              </p>
              <div className="grid grid-cols-2 gap-3 mb-8 text-left">
                {[
                  { icon: Bot, label: 'Agent created', check: !!createdAgentId },
                  { icon: Building2, label: 'Profile configured', check: true },
                  { icon: Phone, label: 'Ready for calls', check: true },
                  { icon: Sparkles, label: 'AI features enabled', check: true },
                ].map(({ icon: Icon, label, check }) => (
                  <div key={label} className="flex items-center gap-2.5 rounded-xl border border-[#e0e0e0] p-3">
                    <CheckCircle2 className={['h-4 w-4', check ? 'text-green-500' : 'text-[#e0e0e0]'].join(' ')} />
                    <span className="text-sm font-medium text-[#0a0a0a]">{label}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleFinish}
                disabled={loading}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-[#0a0a0a] text-white py-3 font-medium hover:bg-[#333] transition-colors disabled:opacity-50"
              >
                {loading ? 'Setting up…' : <>Go to Dashboard <ChevronRight className="h-4 w-4" /></>}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
