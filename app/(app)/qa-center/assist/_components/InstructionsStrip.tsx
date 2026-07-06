import { MessageSquare, ShieldAlert, Zap } from "lucide-react";
import { DEBOUNCE_MS } from "./config";

export function InstructionsStrip() {
  const items = [
    {
      icon: <MessageSquare className="h-4 w-4 text-blue-600" />,
      bg: "bg-blue-50 border-blue-100",
      title: "Paste transcript",
      desc: "Type or paste the call transcript. Update it as the conversation progresses.",
    },
    {
      icon: <Zap className="h-4 w-4 text-yellow-600" />,
      bg: "bg-yellow-50 border-yellow-100",
      title: "Auto-analysis",
      desc: `Enable Active mode — the AI analyzes every ${DEBOUNCE_MS / 1000}s after you stop typing.`,
    },
    {
      icon: <ShieldAlert className="h-4 w-4 text-green-600" />,
      bg: "bg-green-50 border-green-100",
      title: "Act on alerts",
      desc: "Critical alerts appear instantly. Follow suggestions to stay compliant.",
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
      {items.map((item) => (
        <div
          key={item.title}
          className={`rounded-xl border px-4 py-3.5 flex items-start gap-3 ${item.bg}`}
        >
          <div className="shrink-0 mt-0.5">{item.icon}</div>
          <div>
            <p className="text-xs font-semibold text-[#111]">{item.title}</p>
            <p className="text-xs text-[#555] mt-0.5 leading-relaxed">
              {item.desc}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
