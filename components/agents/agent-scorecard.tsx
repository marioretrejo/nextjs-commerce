'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Lightbulb, TrendingUp, PhoneCall, Clock, Star, Smile, RefreshCw } from 'lucide-react';

interface ScorecardData {
  agentName: string;
  kpis: {
    totalCalls: number;
    avgDuration: number;
    conversionRate: number;
    avgQaScore: number | null;
    sentimentScore: number;
    positiveCount: number;
    negativeCount: number;
    outcomes: Record<string, number>;
  };
  recommendations: string[];
}

interface Props {
  agentId: string;
}

function CircularGauge({ value, max = 100, size = 120, label }: { value: number; max?: number; size?: number; label: string }) {
  const pct = Math.min(value / max, 1);
  const radius = (size - 16) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - pct);
  const color = value >= 80 ? '#22c55e' : value >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="flex flex-col items-center gap-1">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#f5f5f5" strokeWidth={10} />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={10}
          strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle" className="rotate-90" style={{ transform: `rotate(90deg) translate(0, 0)`, transformOrigin: `${size / 2}px ${size / 2}px`, fill: '#0a0a0a', fontSize: '1.25rem', fontWeight: 'bold' }}>
          {value}
        </text>
      </svg>
      <span className="text-xs text-[#6b6b6b]">{label}</span>
    </div>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

const OUTCOME_LABELS: Record<string, string> = {
  converted: 'Converted',
  no_answer: 'No Answer',
  voicemail: 'Voicemail',
  rejected: 'Rejected',
  transferred: 'Transferred',
};

const OUTCOME_COLORS: Record<string, string> = {
  converted: 'text-green-600 bg-green-50',
  no_answer: 'text-yellow-600 bg-yellow-50',
  voicemail: 'text-blue-600 bg-blue-50',
  rejected: 'text-red-600 bg-red-50',
  transferred: 'text-purple-600 bg-purple-50',
};

export function AgentScorecard({ agentId }: Props) {
  const [data, setData] = useState<ScorecardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/scorecard`);
      if (res.ok) {
        const d = await res.json() as ScorecardData;
        setData(d);
        setLoaded(true);
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#6b6b6b]" />
        <p className="text-sm text-[#6b6b6b]">Generating scorecard…</p>
      </div>
    );
  }

  if (!loaded || !data) {
    return (
      <div className="text-center py-16">
        <Star className="h-8 w-8 text-[#e0e0e0] mx-auto mb-2" />
        <p className="text-sm text-[#6b6b6b] mb-4">Scorecard will load here</p>
        <Button onClick={load} size="sm">Load Scorecard</Button>
      </div>
    );
  }

  const { kpis, recommendations } = data;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-[#0a0a0a]">Performance Scorecard</h3>
          <p className="text-xs text-[#6b6b6b]">Last 30 days · {kpis.totalCalls} calls</p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> Refresh
        </Button>
      </div>

      {/* Gauges */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-around flex-wrap gap-4">
            <CircularGauge value={kpis.conversionRate} label="Conversion %" />
            <CircularGauge value={kpis.avgQaScore ?? 0} label="Avg QA Score" />
            <CircularGauge value={kpis.sentimentScore} label="Positive Sentiment" />
          </div>
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <PhoneCall className="h-5 w-5 text-[#6b6b6b] shrink-0" />
            <div>
              <p className="text-2xl font-bold text-[#0a0a0a]">{kpis.totalCalls}</p>
              <p className="text-xs text-[#6b6b6b]">Total Calls (30d)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <Clock className="h-5 w-5 text-[#6b6b6b] shrink-0" />
            <div>
              <p className="text-2xl font-bold text-[#0a0a0a]">{formatDuration(kpis.avgDuration)}</p>
              <p className="text-xs text-[#6b6b6b]">Avg Duration</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-[#6b6b6b] shrink-0" />
            <div>
              <p className="text-2xl font-bold text-[#0a0a0a]">{kpis.conversionRate}%</p>
              <p className="text-xs text-[#6b6b6b]">Conversion Rate</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 flex items-center gap-3">
            <Smile className="h-5 w-5 text-[#6b6b6b] shrink-0" />
            <div>
              <p className="text-2xl font-bold text-[#0a0a0a]">{kpis.sentimentScore}%</p>
              <p className="text-xs text-[#6b6b6b]">Positive Sentiment</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Outcome Distribution */}
      {Object.keys(kpis.outcomes).length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-sm">Outcome Distribution</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {Object.entries(kpis.outcomes)
              .sort(([, a], [, b]) => b - a)
              .map(([outcome, count]) => {
                const pct = kpis.totalCalls > 0 ? Math.round((count / kpis.totalCalls) * 100) : 0;
                return (
                  <div key={outcome} className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className={`font-medium px-2 py-0.5 rounded-full ${OUTCOME_COLORS[outcome] ?? 'text-[#6b6b6b] bg-[#f5f5f5]'}`}>
                        {OUTCOME_LABELS[outcome] ?? outcome}
                      </span>
                      <span className="text-[#6b6b6b]">{count} ({pct}%)</span>
                    </div>
                    <div className="h-1.5 bg-[#f5f5f5] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#0a0a0a] rounded-full transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
          </CardContent>
        </Card>
      )}

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <Card className="border-[#e0e0e0]">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-yellow-500" />
              <CardTitle className="text-sm">AI Recommendations</CardTitle>
            </div>
            <CardDescription>Personalised suggestions based on the last 30 days of call data</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recommendations.map((rec, i) => (
              <div key={i} className="flex gap-3 rounded-lg bg-[#f5f5f5] p-3">
                <Badge className="shrink-0 mt-0.5 text-[10px] bg-[#0a0a0a] text-white border-transparent">
                  {i + 1}
                </Badge>
                <p className="text-sm text-[#0a0a0a]">{rec}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {kpis.totalCalls < 3 && (
        <div className="rounded-lg border border-[#e0e0e0] bg-[#f5f5f5] p-4 text-center">
          <p className="text-sm text-[#6b6b6b]">
            Make at least 3 calls to unlock AI-powered recommendations.
          </p>
        </div>
      )}
    </div>
  );
}
