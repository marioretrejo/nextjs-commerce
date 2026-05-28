'use client';

import { useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  Bot, CheckCircle2, ChevronRight, Loader2,
  Phone, Headphones, Stethoscope, CreditCard, Sparkles, Lock,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { TopUpModal } from '@/components/billing/TopUpModal';
import confetti from 'canvas-confetti';

// ─── Use-case templates ────────────────────────────────────────────────────────

const USE_CASES = [
  {
    id: 'sales',
    icon: Phone,
    label: 'Sales Outbound',
    description: 'Prospect leads, qualify interest, and book demos automatically.',
    color: 'blue',
    agentName: 'Sales Agent',
    systemPrompt: `You are a professional sales representative making outbound calls on behalf of the company.

Your goal is to:
1. Introduce yourself and the company briefly and confidently.
2. Qualify the prospect — ask about their current situation and pain points.
3. Highlight 2-3 relevant benefits of our solution tailored to what they share.
4. Handle objections calmly and redirect the conversation.
5. If there is genuine interest, book a follow-up meeting or demo.

Guidelines:
- Keep your tone warm, professional, and conversational.
- Listen actively — do not interrupt.
- Never be pushy; if they are not interested, thank them and close gracefully.
- Keep calls under 5 minutes unless the prospect wants to continue.`,
    firstMessage: 'Hi, this is {agent_name} calling from {company_name}. I hope I\'m not catching you at a bad time — do you have just two minutes?',
  },
  {
    id: 'support',
    icon: Headphones,
    label: 'Customer Support',
    description: 'Handle inbound queries, resolve issues, and escalate when needed.',
    color: 'green',
    agentName: 'Support Agent',
    systemPrompt: `You are a customer support specialist handling inbound calls.

Your goal is to:
1. Greet the customer warmly and ask how you can help.
2. Listen carefully to their issue and ask clarifying questions if needed.
3. Resolve the issue using the information available to you.
4. If you cannot resolve it, escalate politely and set expectations for follow-up.
5. End every call by confirming the issue is resolved and asking if there is anything else.

Guidelines:
- Always stay calm, patient, and empathetic — even if the customer is frustrated.
- Apologize sincerely when appropriate, without admitting liability.
- Be concise — customers do not want long explanations.
- Always confirm the customer's name and issue before diving into solutions.`,
    firstMessage: 'Thank you for calling support. My name is {agent_name} — I\'m here to help. Could I get your name and a brief description of the issue?',
  },
  {
    id: 'medical',
    icon: Stethoscope,
    label: 'Medical Receptionist',
    description: 'Book appointments, handle intake, and answer clinic questions.',
    color: 'purple',
    agentName: 'Reception Assistant',
    systemPrompt: `You are a professional medical receptionist for a healthcare clinic.

Your responsibilities include:
1. Greeting patients warmly and directing their inquiry.
2. Scheduling, rescheduling, or canceling appointments.
3. Answering general questions about the clinic (hours, location, services offered).
4. Collecting basic intake information (name, date of birth, insurance) if needed.
5. Reminding patients of upcoming appointments or required documents.

Important guidelines:
- Never provide medical advice or diagnoses — always direct clinical questions to the medical team.
- Maintain strict patient privacy at all times.
- Be calm and reassuring, especially with anxious patients.
- Confirm all appointment details (date, time, doctor, location) before ending the call.`,
    firstMessage: 'Good day, thank you for calling. This is {agent_name} at the clinic. How can I assist you today?',
  },
];

interface Props {
  userId: string;
  userName: string | null;
  workspaceId: string;
}

// step 1 = choose use case, step 2 = agent created + payment wall, step 3 = done
type WizardStep = 1 | 2 | 3;

export function OnboardingWizard({ userName, workspaceId }: Props) {
  const router = useRouter();
  const [step, setStep]               = useState<WizardStep>(1);
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [loading, setLoading]         = useState(false);
  const [createdAgentId, setCreatedAgentId] = useState<string | null>(null);
  const [topUpOpen, setTopUpOpen]     = useState(false);
  const [dismissed, setDismissed]     = useState(false);

  const firstName = userName?.split(' ')[0] ?? 'there';

  const fireConfetti = useCallback(() => {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.5 } });
    setTimeout(() => confetti({ particleCount: 60, spread: 120, origin: { y: 0.3 }, angle: 60 }), 300);
    setTimeout(() => confetti({ particleCount: 60, spread: 120, origin: { y: 0.3 }, angle: 120 }), 500);
  }, []);

  useEffect(() => {
    if (step === 3) fireConfetti();
  }, [step, fireConfetti]);

  async function handleCreateAgent() {
    const uc = USE_CASES.find(u => u.id === selectedCase);
    if (!uc) return;
    setLoading(true);

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id:  workspaceId,
          name:          uc.agentName,
          system_prompt: uc.systemPrompt,
          first_message: uc.firstMessage,
          language:      'en-US',
          status:        'active',
        }),
      });

      if (res.ok) {
        const data = await res.json() as { id: string };
        setCreatedAgentId(data.id);
        setStep(2);
      } else {
        const err = await res.json() as { error?: string };
        toast.error(err.error ?? 'Failed to create agent.');
      }
    } catch {
      toast.error('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function markComplete() {
    await fetch('/api/me', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboarding_completed: true }),
    });
  }

  async function handleFinish() {
    setLoading(true);
    await markComplete();
    router.push('/dashboard');
    router.refresh();
  }

  if (dismissed) return null;

  const selectedUC = USE_CASES.find(u => u.id === selectedCase);

  // Color maps
  const colorMap: Record<string, { bg: string; text: string; border: string; iconBg: string }> = {
    blue:   { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-500',   iconBg: 'bg-blue-100'   },
    green:  { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-500',  iconBg: 'bg-green-100'  },
    purple: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-500', iconBg: 'bg-purple-100' },
  };

  return (
    <>
      {/* Full-screen overlay */}
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden">

          {/* Header */}
          <div className="bg-[#0a0a0a] px-8 py-6 text-white">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="h-5 w-5 text-amber-400" />
              <span className="text-xs font-semibold uppercase tracking-widest text-white/60">
                Step {step} of 2
              </span>
            </div>
            <h1 className="text-xl font-bold">
              {step === 1 && `Welcome, ${firstName}! What will you use VoiceOS for?`}
              {step === 2 && `Your agent is ready 🎉`}
              {step === 3 && `You're all set!`}
            </h1>
            <p className="text-sm text-white/60 mt-1">
              {step === 1 && 'We\'ll configure your first AI agent automatically based on your use case.'}
              {step === 2 && 'Add credit to activate your agent and start making calls.'}
              {step === 3 && 'Your workspace is active. Start building.'}
            </p>

            {/* Progress bar */}
            <div className="mt-4 flex gap-2">
              {[1, 2].map(s => (
                <div
                  key={s}
                  className={`h-1 flex-1 rounded-full transition-all duration-500 ${
                    step > s ? 'bg-white' : step === s ? 'bg-white/60' : 'bg-white/20'
                  }`}
                />
              ))}
            </div>
          </div>

          <div className="px-8 py-6">
            {/* ── Step 1: Use case selection ─────────────────────────────── */}
            {step === 1 && (
              <div className="space-y-3">
                {USE_CASES.map((uc) => {
                  const colors = colorMap[uc.color]!;
                  const Icon = uc.icon;
                  const isSelected = selectedCase === uc.id;
                  return (
                    <button
                      key={uc.id}
                      onClick={() => setSelectedCase(uc.id)}
                      className={`w-full flex items-center gap-4 rounded-xl border-2 p-4 text-left transition-all ${
                        isSelected
                          ? `${colors.bg} ${colors.border}`
                          : 'bg-white border-[#e0e0e0] hover:border-[#0a0a0a]/30'
                      }`}
                    >
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                        isSelected ? colors.iconBg : 'bg-[#f5f5f5]'
                      }`}>
                        <Icon className={`h-5 w-5 ${isSelected ? colors.text : 'text-[#6b6b6b]'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm ${isSelected ? colors.text : 'text-[#0a0a0a]'}`}>
                          {uc.label}
                        </p>
                        <p className="text-xs text-[#6b6b6b] mt-0.5">{uc.description}</p>
                      </div>
                      {isSelected && <CheckCircle2 className={`h-5 w-5 shrink-0 ${colors.text}`} />}
                    </button>
                  );
                })}

                <Button
                  className="w-full mt-2"
                  size="lg"
                  disabled={!selectedCase || loading}
                  onClick={handleCreateAgent}
                >
                  {loading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating your agent…</>
                  ) : (
                    <><Bot className="h-4 w-4 mr-2" /> Create My {selectedUC?.label ?? ''} Agent <ChevronRight className="h-4 w-4 ml-1" /></>
                  )}
                </Button>
              </div>
            )}

            {/* ── Step 2: Payment wall ───────────────────────────────────── */}
            {step === 2 && (
              <div className="space-y-4">
                {/* Agent confirmation */}
                <div className="flex items-center gap-3 rounded-xl bg-[#f5f5f5] p-4">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#0a0a0a]">
                    <Bot className="h-5 w-5 text-white" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm text-[#0a0a0a]">
                      {selectedUC?.agentName} created
                    </p>
                    <p className="text-xs text-[#6b6b6b]">
                      Pre-configured with a professional {selectedUC?.label.toLowerCase()} prompt
                    </p>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-green-500 ml-auto shrink-0" />
                </div>

                {/* Payment wall */}
                <div className="rounded-xl border-2 border-dashed border-[#e0e0e0] p-5 text-center space-y-3">
                  <div className="flex justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
                      <Lock className="h-6 w-6 text-amber-600" />
                    </div>
                  </div>
                  <div>
                    <p className="font-semibold text-[#0a0a0a]">Activate with a small credit top-up</p>
                    <p className="text-sm text-[#6b6b6b] mt-1">
                      Your agent is built. Add at least $10 in credit to unlock calling, analytics, and all features. You only pay for what you use — credit never expires.
                    </p>
                  </div>
                  <Button
                    className="w-full"
                    size="lg"
                    onClick={() => setTopUpOpen(true)}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    Add Credit &amp; Activate
                  </Button>
                  <button
                    onClick={async () => { await markComplete(); setStep(3); }}
                    className="text-xs text-[#a0a0a0] hover:text-[#6b6b6b] transition-colors underline"
                  >
                    Skip for now (limited access)
                  </button>
                </div>

                {createdAgentId && (
                  <button
                    onClick={() => { router.push(`/agents/${createdAgentId}`); markComplete(); }}
                    className="text-xs text-[#6b6b6b] hover:text-[#0a0a0a] flex items-center gap-1 transition-colors"
                  >
                    <Bot className="h-3 w-3" /> View your agent configuration →
                  </button>
                )}
              </div>
            )}

            {/* ── Step 3: Done ───────────────────────────────────────────── */}
            {step === 3 && (
              <div className="text-center space-y-4 py-4">
                <div className="flex justify-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
                    <CheckCircle2 className="h-9 w-9 text-green-600" />
                  </div>
                </div>
                <div>
                  <p className="text-xl font-bold text-[#0a0a0a]">Welcome to VoiceOS!</p>
                  <p className="text-sm text-[#6b6b6b] mt-1">
                    Your workspace is ready. Explore your dashboard and start building.
                  </p>
                </div>
                <Button className="w-full" size="lg" onClick={handleFinish} disabled={loading}>
                  {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                  Go to Dashboard
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      <TopUpModal
        open={topUpOpen}
        onClose={() => setTopUpOpen(false)}
        workspaceId={workspaceId}
      />
    </>
  );
}
