"use client";

import Link from "next/link";
import {
  ShieldAlert,
  AlertTriangle,
  Users,
  Users2,
  MessageSquare,
  Trophy,
  Shield,
} from "lucide-react";

interface Props {
  highRiskFlags: number;
}

export function QACHeader({ highRiskFlags }: Props) {
  return (
    <div className="flex items-start gap-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111] shrink-0">
        <ShieldAlert className="h-5 w-5 text-white" />
      </div>
      <div className="flex-1">
        <h1 className="text-2xl font-bold tracking-tight text-[#111]">
          QA Center
        </h1>
        <p className="text-sm text-[#6b6b6b]">
          100% QA coverage for call center interactions — AI-powered scoring,
          compliance flags, and agent coaching
        </p>
      </div>
      {highRiskFlags > 0 && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2 shrink-0">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <span className="text-sm font-semibold text-red-700">
            {highRiskFlags} high-risk flag
            {highRiskFlags !== 1 ? "s" : ""}
          </span>
        </div>
      )}
      <Link
        href="/qa-center/customers"
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs font-medium text-[#555] hover:border-[#111] hover:text-[#111] transition-colors shrink-0"
      >
        <Users className="h-3.5 w-3.5" />
        Customers
      </Link>
      <Link
        href="/qa-center/agents"
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs font-medium text-[#555] hover:border-[#111] hover:text-[#111] transition-colors shrink-0"
      >
        <Users2 className="h-3.5 w-3.5" />
        Agents
      </Link>
      <Link
        href="/qa-center/coaching"
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs font-medium text-[#555] hover:border-[#111] hover:text-[#111] transition-colors shrink-0"
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Coaching
      </Link>
      <Link
        href="/qa-center/leaderboard"
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs font-medium text-[#555] hover:border-[#111] hover:text-[#111] transition-colors shrink-0"
      >
        <Trophy className="h-3.5 w-3.5" />
        Leaderboard
      </Link>
      <Link
        href="/qa-center/audit"
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs font-medium text-[#555] hover:border-[#111] hover:text-[#111] transition-colors shrink-0"
      >
        <Shield className="h-3.5 w-3.5" />
        Audit Log
      </Link>
    </div>
  );
}
