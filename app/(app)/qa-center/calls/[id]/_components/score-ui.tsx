import { scoreColor, riskColor, riskLabel } from "./format";
import { GAUGE_COLORS } from "./config";

export function ScoreGauge({
  score,
  label,
  size = 88,
}: {
  score: number;
  label: string;
  size?: number;
}) {
  const colorKey = scoreColor(score);
  const cfg = GAUGE_COLORS[colorKey]!;
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;
  const cx = size / 2;

  return (
    <div className="flex flex-col items-center gap-1.5">
      <svg
        width={size}
        height={size}
        className="-rotate-90"
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Track */}
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke="#f0f0f0"
          strokeWidth={8}
        />
        {/* Fill */}
        <circle
          cx={cx}
          cy={cx}
          r={r}
          fill="none"
          stroke={cfg.stroke}
          strokeWidth={8}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          style={{ transition: "stroke-dasharray 0.6s ease" }}
        />
      </svg>
      <div className="text-center -mt-[72px] mb-1" style={{ width: size }}>
        <span className={`text-xl font-bold leading-none ${cfg.text}`}>
          {score}
        </span>
      </div>
      <div className="text-center mt-[56px]">
        <p className="text-[11px] font-medium text-[#6b6b6b] leading-tight">
          {label}
        </p>
      </div>
    </div>
  );
}

// ─── Risk Badge ───────────────────────────────────────────────────────────────

export function RiskBadge({ score }: { score: number }) {
  const c = riskColor(score);
  const styles: Record<string, string> = {
    green: "bg-green-50 text-green-700 border-green-200",
    yellow: "bg-yellow-50 text-yellow-800 border-yellow-200",
    orange: "bg-orange-50 text-orange-800 border-orange-200",
    red: "bg-red-50 text-red-800 border-red-200",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${styles[c]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          c === "green"
            ? "bg-green-500"
            : c === "yellow"
              ? "bg-yellow-500"
              : c === "orange"
                ? "bg-orange-500"
                : "bg-red-500"
        }`}
      />
      {riskLabel(score)} ({score})
    </span>
  );
}

// ─── Highlighted Transcript ───────────────────────────────────────────────────
