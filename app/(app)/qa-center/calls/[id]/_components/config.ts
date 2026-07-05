/** Static display-config maps for the call-review page. */

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  analyze: "Analysis run",
  "review_status.change": "Review status changed",
  "comment.create": "Comment added",
  "interaction.create": "Interaction created",
  "interaction.delete": "Interaction deleted",
};

export const SEV_CFG: Record<
  string,
  { bg: string; text: string; border: string; dot: string; label: string }
> = {
  low: {
    bg: "bg-gray-50",
    text: "text-gray-700",
    border: "border-gray-200",
    dot: "bg-gray-400",
    label: "Low",
  },
  medium: {
    bg: "bg-yellow-50",
    text: "text-yellow-800",
    border: "border-yellow-200",
    dot: "bg-yellow-500",
    label: "Medium",
  },
  high: {
    bg: "bg-orange-50",
    text: "text-orange-800",
    border: "border-orange-200",
    dot: "bg-orange-500",
    label: "High",
  },
  critical: {
    bg: "bg-red-50",
    text: "text-red-800",
    border: "border-red-200",
    dot: "bg-red-500",
    label: "Critical",
  },
};

export const CAT_CFG: Record<string, string> = {
  compliance: "bg-red-50 text-red-700 border-red-100",
  quality: "bg-blue-50 text-blue-700 border-blue-100",
  disclosure: "bg-purple-50 text-purple-700 border-purple-100",
  prohibited: "bg-gray-900 text-white border-transparent",
  coaching: "bg-green-50 text-green-700 border-green-100",
};

export const GAUGE_COLORS: Record<string, { stroke: string; text: string }> = {
  green: { stroke: "#16a34a", text: "text-green-600" },
  yellow: { stroke: "#ca8a04", text: "text-yellow-600" },
  orange: { stroke: "#ea580c", text: "text-orange-600" },
  red: { stroke: "#dc2626", text: "text-red-600" },
};

export const SPEAKER_COLORS: Array<{ pill: string; bar: string }> = [
  { pill: "bg-blue-100 text-blue-700 border-blue-200", bar: "bg-blue-300" },
  {
    pill: "bg-purple-100 text-purple-700 border-purple-200",
    bar: "bg-purple-300",
  },
  {
    pill: "bg-emerald-100 text-emerald-700 border-emerald-200",
    bar: "bg-emerald-300",
  },
  {
    pill: "bg-amber-100 text-amber-700 border-amber-200",
    bar: "bg-amber-300",
  },
];

export const REVIEW_STATUSES = [
  "pending_review",
  "in_review",
  "reviewed",
  "approved",
  "disputed",
] as const;

export const REVIEW_STATUS_LABEL: Record<string, string> = {
  pending_review: "Pending Review",
  in_review: "In Review",
  reviewed: "Reviewed",
  approved: "Approved",
  disputed: "Disputed",
};

export const REVIEW_STATUS_COLOR: Record<string, string> = {
  pending_review: "text-gray-500 bg-gray-100 border-gray-200",
  in_review: "text-blue-700 bg-blue-50 border-blue-200",
  reviewed: "text-indigo-700 bg-indigo-50 border-indigo-200",
  approved: "text-green-700 bg-green-50 border-green-200",
  disputed: "text-red-700 bg-red-50 border-red-200",
};
