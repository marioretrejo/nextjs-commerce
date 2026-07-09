export function pickQacAnalysis<
  T extends { overall_score?: number | null; created_at?: string | null },
>(analyses: T[] | null | undefined): T | undefined {
  return [...(analyses ?? [])].sort((a, b) => {
    const scoreDelta =
      Number(b.overall_score !== null && b.overall_score !== undefined) -
      Number(a.overall_score !== null && a.overall_score !== undefined);
    if (scoreDelta !== 0) return scoreDelta;
    return (
      new Date(b.created_at ?? 0).getTime() -
      new Date(a.created_at ?? 0).getTime()
    );
  })[0];
}
