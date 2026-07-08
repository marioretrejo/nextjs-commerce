import type {
  QacCriterion,
  QacCriterionResultInput,
  QacScoreResult,
} from "./types";

function clamp(n: unknown, min = 0, max = 100): number {
  const value = Number(n);
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function normalizeResult(value: unknown): QacCriterionResultInput["result"] {
  if (value === "pass" || value === "partial" || value === "fail") {
    return value;
  }
  return "n/a";
}

export function calculateQacScore(
  criteria: QacCriterion[],
  rawResults: Array<Partial<QacCriterionResultInput> & { name?: string }>,
): QacScoreResult {
  let applicableWeight = 0;
  let earnedPoints = 0;

  const results = criteria.map((criterion) => {
    const raw =
      rawResults.find((r) => r.criterion_id === criterion.id) ??
      rawResults.find(
        (r) =>
          typeof r.name === "string" &&
          r.name.toLowerCase() === criterion.name.toLowerCase(),
      );

    const result = normalizeResult(raw?.result);
    const applicable = Boolean(raw?.applicable ?? result !== "n/a");
    const weight = Number(criterion.weight) || 0;

    let points: number | null = null;
    if (applicable && result !== "n/a") {
      applicableWeight += weight;
      if (result === "pass") points = weight;
      if (result === "partial") points = weight * (clamp(raw?.score, 50) / 100);
      if (result === "fail") points = 0;
      earnedPoints += points ?? 0;
    }

    return {
      criterion_id: criterion.id,
      applicable,
      result: applicable ? result : "n/a",
      score: points,
      reason:
        typeof raw?.reason === "string" && raw.reason.trim()
          ? raw.reason.trim()
          : null,
      evidence_json: Array.isArray(raw?.evidence_json) ? raw.evidence_json : [],
    } satisfies QacCriterionResultInput;
  });

  if (applicableWeight <= 0) {
    return {
      overallScore: null,
      notEvaluable: true,
      applicableWeight: 0,
      earnedPoints: 0,
      results,
    };
  }

  return {
    overallScore: Math.round((earnedPoints / applicableWeight) * 10000) / 100,
    notEvaluable: false,
    applicableWeight,
    earnedPoints,
    results,
  };
}
