export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatDuration(seconds: number | null | undefined): string {
  if (!seconds || seconds <= 0) return "-";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return `${mins}m ${secs.toString().padStart(2, "0")}s`;
}

export function formatScore(score: number | null | undefined): string {
  if (score === null || score === undefined || Number.isNaN(Number(score))) {
    return "-";
  }
  return `${Math.round(Number(score))}`;
}

export function percent(score: number | null | undefined): string {
  const formatted = formatScore(score);
  return formatted === "-" ? "-" : `${formatted}%`;
}

export function maskSecret(secret: string | null | undefined): string {
  if (!secret) return "Not set";
  return `****${secret.slice(-4)}`;
}
