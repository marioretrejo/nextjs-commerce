import type { ReactNode } from "react";
import { Activity, MessageSquare, Phone } from "lucide-react";

// ─── Config maps ──────────────────────────────────────────────────────────────

export const SEV: Record<
  string,
  { bg: string; text: string; dot: string; label: string }
> = {
  low: {
    bg: "bg-gray-100",
    text: "text-gray-700",
    dot: "bg-gray-400",
    label: "Low",
  },
  medium: {
    bg: "bg-yellow-50",
    text: "text-yellow-800",
    dot: "bg-yellow-500",
    label: "Medium",
  },
  high: {
    bg: "bg-orange-50",
    text: "text-orange-800",
    dot: "bg-orange-500",
    label: "High",
  },
  critical: {
    bg: "bg-red-50",
    text: "text-red-800",
    dot: "bg-red-500",
    label: "Critical",
  },
};

export const CAT_COLOR: Record<string, string> = {
  compliance: "bg-red-50 text-red-700",
  quality: "bg-blue-50 text-blue-700",
  disclosure: "bg-purple-50 text-purple-700",
  prohibited: "bg-gray-900 text-white",
  coaching: "bg-green-50 text-green-700",
};

export const CHANNEL_ICON: Record<string, ReactNode> = {
  call: <Phone className="h-3.5 w-3.5" />,
  chat: <MessageSquare className="h-3.5 w-3.5" />,
  email: <Activity className="h-3.5 w-3.5" />,
  sms: <MessageSquare className="h-3.5 w-3.5" />,
  social: <Activity className="h-3.5 w-3.5" />,
  other: <Activity className="h-3.5 w-3.5" />,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function ScorePill({
  score,
  size = "sm",
}: {
  score: number;
  size?: "sm" | "lg";
}) {
  const color =
    score >= 80
      ? "text-green-700 bg-green-50 border-green-200"
      : score >= 60
        ? "text-yellow-700 bg-yellow-50 border-yellow-200"
        : score >= 40
          ? "text-orange-700 bg-orange-50 border-orange-200"
          : "text-red-700 bg-red-50 border-red-200";
  const sz =
    size === "lg"
      ? "text-2xl font-bold px-3 py-1"
      : "text-xs font-semibold px-2 py-0.5";
  return (
    <span
      className={`inline-flex items-center rounded-full border ${color} ${sz}`}
    >
      {score}
    </span>
  );
}

export const CRITERIA_LABELS: Record<string, string> = {
  opening: "Call Introduction & Greeting",
  compliance: "Compliance",
  objection_handling: "Objection Handling",
  closing: "Action & Closure",
  empathy: "Empathy",
};

export function ScoreGauge({ score }: { score: number }) {
  const r = 52,
    cx = 64,
    cy = 68;
  const circumference = 2 * Math.PI * r;
  const semi = circumference / 2;
  const filled = (score / 100) * semi;
  const color = score >= 80 ? "#16a34a" : score >= 60 ? "#ca8a04" : "#dc2626";
  const angle = (score / 100) * Math.PI;
  const dotX = cx - r * Math.cos(angle);
  const dotY = cy - r * Math.sin(angle);
  const rot = `rotate(-180, ${cx}, ${cy})`;
  return (
    <svg viewBox="0 0 128 78" className="w-44 mx-auto">
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#e5e7eb"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${semi} ${semi}`}
        transform={rot}
      />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${filled} ${circumference}`}
        transform={rot}
      />
      {score > 0 && <circle cx={dotX} cy={dotY} r="5" fill={color} />}
      <text
        x={cx}
        y={cy - 6}
        textAnchor="middle"
        fontSize="20"
        fontWeight="700"
        fill="#111"
      >
        {score}%
      </text>
      <text x={cx} y={cy + 8} textAnchor="middle" fontSize="8.5" fill="#9b9b9b">
        Overall Score
      </text>
      <text
        x={cx - r + 2}
        y={cy + 20}
        textAnchor="middle"
        fontSize="7.5"
        fill="#c0c0c0"
      >
        0%
      </text>
      <text
        x={cx + r - 2}
        y={cy + 20}
        textAnchor="middle"
        fontSize="7.5"
        fill="#c0c0c0"
      >
        100%
      </text>
    </svg>
  );
}

export function RiskBar({ score }: { score: number }) {
  const color =
    score < 30
      ? "bg-green-500"
      : score < 60
        ? "bg-yellow-500"
        : score < 80
          ? "bg-orange-500"
          : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${score}%` }}
        />
      </div>
      <span className="text-xs font-medium text-[#555] w-6 text-right">
        {score}
      </span>
    </div>
  );
}
