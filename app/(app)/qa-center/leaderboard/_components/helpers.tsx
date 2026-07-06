export function scoreColor(score: number): string {
  if (score >= 80) return "text-green-600";
  if (score >= 60) return "text-yellow-600";
  if (score >= 40) return "text-orange-600";
  return "text-red-600";
}

export function scoreBg(score: number): string {
  if (score >= 80) return "bg-green-50 text-green-700 border-green-100";
  if (score >= 60) return "bg-yellow-50 text-yellow-800 border-yellow-100";
  if (score >= 40) return "bg-orange-50 text-orange-800 border-orange-100";
  return "bg-red-50 text-red-800 border-red-100";
}

export function riskBg(score: number): string {
  if (score < 20) return "bg-green-50 text-green-700 border-green-100";
  if (score < 45) return "bg-yellow-50 text-yellow-800 border-yellow-100";
  if (score < 70) return "bg-orange-50 text-orange-800 border-orange-100";
  return "bg-red-50 text-red-800 border-red-100";
}

export function riskLabel(score: number): string {
  if (score < 20) return "Low";
  if (score < 45) return "Medium";
  if (score < 70) return "High";
  return "Critical";
}

export function ScoreCell({ score }: { score: number | undefined }) {
  if (score === undefined || isNaN(score)) {
    return <span className="text-xs text-[#9b9b9b]">—</span>;
  }
  const rounded = Math.round(score);
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${scoreBg(rounded)}`}
    >
      {rounded}
    </span>
  );
}
