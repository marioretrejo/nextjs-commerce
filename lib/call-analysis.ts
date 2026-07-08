import { groqJson } from "@/lib/groq";

// Shared call QA scoring, used by both the post-call analysis job
// (/api/jobs/analyze-call) and the standalone scorer (/api/qa/score).

export interface QACriterion {
  name: string;
  description: string | null;
  weight: number;
}

export interface CallQAScore {
  score: number; // overall 0-100
  feedback: string; // one-sentence human summary ("" if none)
  breakdown: { name: string; score: number }[]; // per-criterion (empty w/o criteria)
}

function clampScore(n: unknown): number {
  return Math.max(0, Math.min(100, Math.round(Number(n) || 0)));
}

/**
 * Score a call transcript against explicit weighted criteria (preferred), or
 * the agent's system prompt, or a generic quality rubric. Returns an overall
 * score, one-sentence feedback, and a per-criterion breakdown. Uses the shared
 * groqJson helper (with its model fallback chain). Returns null if the LLM is
 * unavailable or produced no usable score.
 */
export async function scoreCallQuality(
  transcript: string,
  opts: { systemPrompt?: string | null; criteria?: QACriterion[] },
): Promise<CallQAScore | null> {
  const criteria = opts.criteria ?? [];

  let scoringSection: string;
  if (criteria.length > 0) {
    const totalWeight = criteria.reduce((s, c) => s + c.weight, 0) || 1;
    scoringSection = `SCORING CRITERIA (weighted — score each proportionally to its weight):
${criteria
  .map(
    (c) =>
      `- ${c.name} (${Math.round((c.weight / totalWeight) * 100)}% of score): ${c.description ?? ""}`,
  )
  .join("\n")}`;
  } else if (opts.systemPrompt) {
    scoringSection = `AGENT INSTRUCTIONS (score how closely the agent followed these):
${opts.systemPrompt.slice(0, 1500)}`;
  } else {
    scoringSection =
      "SCORING: Evaluate overall call quality, professionalism, and helpfulness.";
  }

  const result = await groqJson<{
    overall?: number;
    score?: number;
    feedback?: string;
    scores?: Array<{ name?: string; score?: number }>;
  }>({
    system:
      "You are a QA evaluator for voice call-center agents. Return only valid JSON.",
    prompt: `${scoringSection}

CALL TRANSCRIPT:
${transcript.slice(0, 4000)}

Return ONLY a JSON object with:
- "overall": integer 0-100 (the weighted overall score)
- "feedback": one sentence noting what was done well and the main area for improvement
- "scores": array of {"name": criterion name, "score": integer 0-100} — one per criterion above (empty array if there are no explicit criteria)`,
    maxTokens: 512,
  });

  if (!result) return null;
  const rawOverall =
    typeof result.overall === "number"
      ? result.overall
      : typeof result.score === "number"
        ? result.score
        : null;
  if (rawOverall === null) return null;

  const breakdown = Array.isArray(result.scores)
    ? result.scores
        .filter(
          (s): s is { name: string; score: number } =>
            typeof s?.name === "string" && typeof s?.score === "number",
        )
        .map((s) => ({ name: s.name, score: clampScore(s.score) }))
    : [];

  return {
    score: clampScore(rawOverall),
    feedback: typeof result.feedback === "string" ? result.feedback : "",
    breakdown,
  };
}
