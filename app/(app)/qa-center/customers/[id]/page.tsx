"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  Activity,
  ArrowLeft,
  Calendar,
  Loader2,
  Mail,
  Phone,
  MessageSquare,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface Interaction {
  id: string;
  agent_name: string | null;
  channel: string | null;
  duration_s: number | null;
  created_at: string;
  risk_level: string | null;
  review_status: string | null;
  qac_evaluations: { overall_score: number | null }[] | null;
}

interface JourneyEntry {
  id: string;
  thread_id: string | null;
  interaction_id: string | null;
  sequence_number: number;
  intent_at_call: string | null;
  sentiment_at_call: string | null;
  key_topics: string[] | null;
  unresolved_items: string[] | null;
  created_at: string;
}

interface Insight {
  id: string;
  thread_id: string | null;
  insight_type: string | null;
  content: string;
  confidence: number | null;
  generated_at: string;
  expires_at: string | null;
}

interface CustomerScores {
  health_score: number;
  call_quality_score: number | null;
  sentiment_trend: "improving" | "stable" | "declining" | "unknown";
  unresolved_pressure: number;
  engagement_score: number;
  customer_risk: "low" | "medium" | "high" | "critical";
}

interface CustomerDetail {
  id: string;
  display_name: string;
  canonical_phone: string | null;
  canonical_email: string | null;
  total_calls: number;
  lifetime_sentiment: string | null;
  first_seen_at: string;
  last_seen_at: string;
  notes: string | null;
  recent_interactions: Interaction[];
  journey: JourneyEntry[];
  insights: Insight[];
  scores: CustomerScores;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDuration(s: number | null) {
  if (s == null) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function riskBadgeVariant(r: string | null): "default" | "secondary" | "destructive" | "outline" {
  if (!r) return "outline";
  if (r === "critical" || r === "high") return "destructive";
  if (r === "medium") return "secondary";
  return "outline";
}

function sentimentColor(s: string | null) {
  if (!s) return "text-gray-500";
  const l = s.toLowerCase();
  if (l === "positive") return "text-green-400";
  if (l === "negative") return "text-red-400";
  return "text-yellow-400";
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/qac/customers/${id}`);
        if (!res.ok) throw new Error("Failed to load customer");
        setCustomer(await res.json());
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Failed to load customer");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center gap-3">
        <p className="text-gray-400">Customer not found.</p>
        <Link href="/qa-center/customers" className="text-indigo-400 text-sm hover:underline">
          Back to Customers
        </Link>
      </div>
    );
  }

  const { scores } = customer;

  function healthColor(score: number) {
    if (score >= 70) return "text-green-400";
    if (score >= 50) return "text-yellow-400";
    return "text-red-400";
  }

  function riskColor(r: string) {
    if (r === "low") return "text-green-400";
    if (r === "medium") return "text-yellow-400";
    if (r === "high") return "text-orange-400";
    return "text-red-400";
  }

  function trendIcon(t: string) {
    if (t === "improving") return <TrendingUp className="h-3.5 w-3.5 text-green-400" />;
    if (t === "declining") return <TrendingDown className="h-3.5 w-3.5 text-red-400" />;
    return null;
  }

  function trendColor(t: string) {
    if (t === "improving") return "text-green-400";
    if (t === "declining") return "text-red-400";
    return "text-gray-400";
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Back */}
        <div className="mb-6">
          <Link
            href="/qa-center/customers"
            className="inline-flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Customers
          </Link>
        </div>

        {/* Customer header */}
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 px-6 py-5 mb-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-lg font-bold">
              {customer.display_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold text-white">{customer.display_name}</h1>
              <div className="flex flex-wrap items-center gap-3 mt-1">
                {customer.canonical_phone && (
                  <span className="inline-flex items-center gap-1 text-sm text-gray-400">
                    <Phone className="h-3.5 w-3.5" />
                    {customer.canonical_phone}
                  </span>
                )}
                {customer.canonical_email && (
                  <span className="inline-flex items-center gap-1 text-sm text-gray-400">
                    <Mail className="h-3.5 w-3.5" />
                    {customer.canonical_email}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-gray-800">
            <div>
              <p className="text-xs text-gray-500">Total Calls</p>
              <p className="text-xl font-bold text-white">{customer.total_calls}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Sentiment</p>
              <p className={`text-sm font-semibold capitalize ${sentimentColor(customer.lifetime_sentiment)}`}>
                {customer.lifetime_sentiment ?? "Unknown"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">First Seen</p>
              <p className="text-sm text-gray-300">{formatDate(customer.first_seen_at)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Last Seen</p>
              <p className="text-sm text-gray-300">{formatDate(customer.last_seen_at)}</p>
            </div>
          </div>

          {customer.notes && (
            <p className="mt-4 text-sm text-gray-400 border-t border-gray-800 pt-4">
              {customer.notes}
            </p>
          )}
        </div>

        {/* Customer Health */}
        <section className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Customer Health</h2>
            <span className="text-xs text-gray-500">
              based on {customer.total_calls} call{customer.total_calls !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {/* Health Score */}
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Health Score</p>
              <p className={`text-2xl font-bold ${healthColor(scores.health_score)}`}>
                {scores.health_score}
                <span className="text-sm font-normal text-gray-500">/100</span>
              </p>
            </div>

            {/* Call Quality */}
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Call Quality</p>
              {scores.call_quality_score != null ? (
                <p className={`text-2xl font-bold ${healthColor(scores.call_quality_score)}`}>
                  {scores.call_quality_score}
                  <span className="text-sm font-normal text-gray-500">/100</span>
                </p>
              ) : (
                <p className="text-sm text-gray-600">No evaluations</p>
              )}
            </div>

            {/* Engagement */}
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Engagement</p>
              <p className={`text-2xl font-bold ${healthColor(scores.engagement_score)}`}>
                {scores.engagement_score}
                <span className="text-sm font-normal text-gray-500">/100</span>
              </p>
            </div>

            {/* Sentiment Trend */}
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Sentiment Trend</p>
              <div className="flex items-center gap-1.5 mt-1">
                {trendIcon(scores.sentiment_trend)}
                <p className={`text-sm font-semibold capitalize ${trendColor(scores.sentiment_trend)}`}>
                  {scores.sentiment_trend}
                </p>
              </div>
            </div>

            {/* Risk Level */}
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Risk Level</p>
              <p className={`text-sm font-bold capitalize ${riskColor(scores.customer_risk)}`}>
                {scores.customer_risk}
              </p>
            </div>

            {/* Unresolved Pressure */}
            <div className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3">
              <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Open Items</p>
              <p className={`text-2xl font-bold ${scores.unresolved_pressure > 50 ? "text-red-400" : scores.unresolved_pressure > 20 ? "text-yellow-400" : "text-green-400"}`}>
                {scores.unresolved_pressure}
                <span className="text-sm font-normal text-gray-500">/100</span>
              </p>
            </div>
          </div>
        </section>

        {/* Active Insights */}
        {customer.insights.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Zap className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">Active Insights</h2>
              <span className="text-xs text-gray-500">({customer.insights.length})</span>
            </div>
            <div className="space-y-2">
              {customer.insights.map((ins) => (
                <div
                  key={ins.id}
                  className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {ins.insight_type && (
                        <p className="text-[10px] font-medium uppercase tracking-wider text-indigo-400 mb-1">
                          {ins.insight_type.replace(/_/g, " ")}
                        </p>
                      )}
                      <p className="text-sm text-gray-200">{ins.content}</p>
                    </div>
                    {ins.confidence != null && (
                      <span className="shrink-0 text-xs text-gray-500 whitespace-nowrap">
                        {Math.round(ins.confidence * 100)}% confidence
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-gray-600 mt-2">
                    Generated {formatDate(ins.generated_at)}
                    {ins.expires_at ? ` · Expires ${formatDate(ins.expires_at)}` : ""}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Journey */}
        {customer.journey.length > 0 && (
          <section className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-semibold text-white">Journey</h2>
              <span className="text-xs text-gray-500">({customer.journey.length} entries)</span>
            </div>
            <div className="space-y-2">
              {customer.journey.map((j) => (
                <div
                  key={j.id}
                  className="rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-xs text-gray-500">#{j.sequence_number}</span>
                    {j.sentiment_at_call && (
                      <span className={`text-xs capitalize ${sentimentColor(j.sentiment_at_call)}`}>
                        {j.sentiment_at_call}
                      </span>
                    )}
                    <span className="text-xs text-gray-600 ml-auto">{formatDate(j.created_at)}</span>
                  </div>
                  {j.intent_at_call && (
                    <p className="text-sm text-gray-300 mb-1.5">{j.intent_at_call}</p>
                  )}
                  {j.key_topics && j.key_topics.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {j.key_topics.map((t, i) => (
                        <span
                          key={i}
                          className="rounded-full bg-indigo-500/10 border border-indigo-500/20 px-2 py-0.5 text-[10px] text-indigo-300"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}
                  {j.unresolved_items && j.unresolved_items.length > 0 && (
                    <div className="mt-2">
                      <p className="text-[10px] text-red-400 font-medium mb-1">Unresolved</p>
                      <ul className="space-y-0.5">
                        {j.unresolved_items.map((u, i) => (
                          <li key={i} className="text-xs text-gray-400">· {u}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Recent Interactions */}
        <section>
          <div className="flex items-center gap-2 mb-3">
            <MessageSquare className="h-4 w-4 text-indigo-400" />
            <h2 className="text-sm font-semibold text-white">Recent Interactions</h2>
            <span className="text-xs text-gray-500">({customer.recent_interactions.length})</span>
          </div>
          {customer.recent_interactions.length === 0 ? (
            <div className="rounded-xl border border-gray-800 bg-gray-900/50 px-4 py-8 text-center">
              <p className="text-sm text-gray-500">No interactions linked yet.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {customer.recent_interactions.map((ix) => {
                const score = ix.qac_evaluations?.[0]?.overall_score ?? null;
                return (
                  <Link
                    key={ix.id}
                    href={`/qa-center/calls/${ix.id}`}
                    className="flex items-center gap-4 rounded-lg border border-gray-800 bg-gray-900/50 px-4 py-3 hover:bg-gray-900 hover:border-gray-700 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white truncate">
                          {ix.agent_name ?? "Unknown agent"}
                        </p>
                        {ix.channel && (
                          <span className="text-xs text-gray-500 capitalize">{ix.channel}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Calendar className="h-3 w-3 text-gray-600" />
                        <span className="text-xs text-gray-500">{formatDate(ix.created_at)}</span>
                        {ix.duration_s != null && (
                          <span className="text-xs text-gray-600">{formatDuration(ix.duration_s)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {ix.risk_level && ix.risk_level !== "low" && (
                        <Badge variant={riskBadgeVariant(ix.risk_level)} className="text-[10px] capitalize">
                          {ix.risk_level}
                        </Badge>
                      )}
                      {score != null && (
                        <span
                          className={`text-sm font-bold ${
                            score >= 80
                              ? "text-green-400"
                              : score >= 60
                              ? "text-yellow-400"
                              : "text-red-400"
                          }`}
                        >
                          {score}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
