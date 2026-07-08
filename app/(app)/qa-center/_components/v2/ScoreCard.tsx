"use client";

import type { Call } from "@/lib/supabase/types";
import {
  AlertCircle,
  TrendingUp,
  CheckCircle2,
  AlertTriangle,
} from "lucide-react";

interface ScoreCardProps {
  call: Call | null;
  loading: boolean;
}

export function ScoreCard({ call, loading }: ScoreCardProps) {
  if (loading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-20 bg-gray-200 rounded animate-pulse" />
        <div className="h-20 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (!call) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center text-gray-500">
          <div className="text-4xl mb-2">📊</div>
          <p className="text-sm">Select a call to view scores</p>
        </div>
      </div>
    );
  }

  const score = call.qa_score || 0;
  const sentiment = call.sentiment || "neutral";
  const hasAlerts = (call.qa_details as any)?.alerts?.length > 0;

  function getScoreBg(s: number) {
    if (s >= 80) return "bg-green-50 border-green-200";
    if (s >= 60) return "bg-yellow-50 border-yellow-200";
    return "bg-red-50 border-red-200";
  }

  function getScoreColor(s: number) {
    if (s >= 80) return "text-green-700";
    if (s >= 60) return "text-yellow-700";
    return "text-red-700";
  }

  function getRiskBadge(s: number) {
    if (s >= 80)
      return { bg: "bg-green-100", text: "text-green-800", label: "Low Risk" };
    if (s >= 60)
      return {
        bg: "bg-yellow-100",
        text: "text-yellow-800",
        label: "Medium Risk",
      };
    return { bg: "bg-red-100", text: "text-red-800", label: "High Risk" };
  }

  const risk = getRiskBadge(score);

  return (
    <div className="h-full overflow-auto bg-gray-50">
      <div className="p-6 space-y-6">
        {/* QA Score */}
        <div className={`border-2 rounded-lg p-6 ${getScoreBg(score)}`}>
          <p className="text-xs font-semibold text-gray-600 uppercase mb-3">
            QA Score
          </p>
          <div className="text-center">
            <div className="relative w-32 h-32 mx-auto mb-4">
              <svg className="w-full h-full" viewBox="0 0 120 120">
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="text-gray-300"
                />
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="3"
                  className={getScoreColor(score)}
                  strokeDasharray={`${(score / 100) * 340} 340`}
                  strokeLinecap="round"
                  style={{
                    transform: "rotate(-90deg)",
                    transformOrigin: "60px 60px",
                  }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-4xl font-bold ${getScoreColor(score)}`}>
                  {Math.round(score)}
                </span>
                <span className="text-xs text-gray-600">/100</span>
              </div>
            </div>
            <div
              className={`inline-block px-3 py-1 rounded-full text-sm font-semibold ${risk.bg} ${risk.text}`}
            >
              {risk.label}
            </div>
          </div>
        </div>

        {/* Sentiment */}
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <p className="text-xs font-semibold text-gray-600 uppercase mb-2">
            Sentiment
          </p>
          <div className="flex items-center gap-2">
            {sentiment === "positive" && <span className="text-lg">😊</span>}
            {sentiment === "neutral" && <span className="text-lg">😐</span>}
            {sentiment === "negative" && <span className="text-lg">😞</span>}
            <span className="text-sm font-medium text-gray-800 capitalize">
              {sentiment}
            </span>
          </div>
        </div>

        {/* Categories */}
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <p className="text-xs font-semibold text-gray-600 uppercase mb-4">
            Score Breakdown
          </p>
          <div className="space-y-3">
            {[
              "Opening",
              "Discovery",
              "Objection Handling",
              "Compliance",
              "Closing",
            ].map((category, idx) => {
              const categoryScores = [90, 85, 75, 92, 88];
              const catScore = categoryScores[idx] ?? 0;
              return (
                <div key={category} className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-gray-700 font-medium">
                      {category}
                    </span>
                    <span className={`font-bold ${getScoreColor(catScore)}`}>
                      {catScore}/100
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${
                        catScore >= 80
                          ? "bg-green-600"
                          : catScore >= 60
                            ? "bg-yellow-600"
                            : "bg-red-600"
                      }`}
                      style={{ width: `${catScore}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Strengths */}
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <p className="text-xs font-semibold text-gray-600 uppercase">
              Strengths
            </p>
          </div>
          <ul className="space-y-2 text-sm text-gray-700">
            <li className="flex gap-2">
              <span className="text-green-600 mt-0.5">•</span>
              <span>Excellent greeting and customer rapport</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-600 mt-0.5">•</span>
              <span>Active listening and empathy</span>
            </li>
            <li className="flex gap-2">
              <span className="text-green-600 mt-0.5">•</span>
              <span>Clear product explanation</span>
            </li>
          </ul>
        </div>

        {/* Opportunities */}
        {hasAlerts && (
          <div className="border border-gray-200 rounded-lg p-4 bg-white">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              <p className="text-xs font-semibold text-gray-600 uppercase">
                Opportunities
              </p>
            </div>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex gap-2">
                <span className="text-yellow-600 mt-0.5">•</span>
                <span>Explore client needs more deeply</span>
              </li>
              <li className="flex gap-2">
                <span className="text-yellow-600 mt-0.5">•</span>
                <span>Better objection handling techniques</span>
              </li>
            </ul>
          </div>
        )}

        {/* Recommendations */}
        <div className="border border-gray-200 rounded-lg p-4 bg-white">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <p className="text-xs font-semibold text-gray-600 uppercase">
              Recommendations
            </p>
          </div>
          <p className="text-sm text-gray-700 leading-relaxed">
            Focus on deeper discovery questions at the beginning of calls to
            better understand client needs. This will help craft more tailored
            solutions and increase objection handling effectiveness.
          </p>
        </div>

        {/* Coaching Link */}
        <button className="w-full px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
          View Coaching Plan
        </button>
      </div>
    </div>
  );
}
