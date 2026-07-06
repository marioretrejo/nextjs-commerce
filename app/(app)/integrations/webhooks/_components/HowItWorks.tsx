import { Card, CardContent } from "@/components/ui/card";

const STEPS = [
  {
    step: "1",
    title: "Event fires",
    body: "A call ends, campaign completes, or another subscribed event occurs.",
  },
  {
    step: "2",
    title: "Signed POST",
    body: "VoiceOS sends a JSON payload to your URL with X-VoiceOS-Signature for verification.",
  },
  {
    step: "3",
    title: "You respond",
    body: "Return any 2xx status within 30s. Failed deliveries are retried up to 3 times.",
  },
];

export function HowItWorks() {
  return (
    <Card className="bg-[#fafafa] border-[#e5e5e5]">
      <CardContent className="p-4">
        <div className="grid grid-cols-3 gap-4 text-xs">
          {STEPS.map((s) => (
            <div key={s.step} className="flex gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0a0a0a] text-[10px] font-bold text-white">
                {s.step}
              </span>
              <div>
                <p className="font-semibold text-[#0a0a0a]">{s.title}</p>
                <p className="text-[#6b6b6b] mt-0.5">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
