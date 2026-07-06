import { Card, CardContent } from "@/components/ui/card";
import { Medal, Trophy } from "lucide-react";
import type { AgentLeaderboardEntry } from "./types";
import { scoreColor } from "./helpers";

interface PodiumProps {
  agent: AgentLeaderboardEntry;
  rank: 1 | 2 | 3;
}

export function PodiumCard({ agent, rank }: PodiumProps) {
  const configs = {
    1: {
      height: "h-40",
      podiumH: "h-16",
      podiumBg: "bg-gradient-to-b from-yellow-400 to-yellow-500",
      ring: "ring-4 ring-yellow-400 ring-offset-2",
      bg: "bg-gradient-to-b from-yellow-50 to-white",
      border: "border-yellow-200",
      icon: <Trophy className="h-5 w-5 text-yellow-500" />,
      label: "🥇 1st Place",
      textColor: "text-yellow-700",
      avatarBg: "bg-yellow-100 text-yellow-800",
    },
    2: {
      height: "h-36",
      podiumH: "h-12",
      podiumBg: "bg-gradient-to-b from-gray-300 to-gray-400",
      ring: "ring-2 ring-gray-300 ring-offset-2",
      bg: "bg-gradient-to-b from-gray-50 to-white",
      border: "border-gray-200",
      icon: <Medal className="h-5 w-5 text-gray-400" />,
      label: "🥈 2nd Place",
      textColor: "text-gray-600",
      avatarBg: "bg-gray-100 text-gray-700",
    },
    3: {
      height: "h-32",
      podiumH: "h-10",
      podiumBg: "bg-gradient-to-b from-orange-300 to-orange-400",
      ring: "ring-2 ring-orange-300 ring-offset-2",
      bg: "bg-gradient-to-b from-orange-50 to-white",
      border: "border-orange-200",
      icon: <Medal className="h-5 w-5 text-orange-400" />,
      label: "🥉 3rd Place",
      textColor: "text-orange-600",
      avatarBg: "bg-orange-100 text-orange-800",
    },
  };

  const cfg = configs[rank];

  return (
    <Card className={`border ${cfg.border} overflow-hidden ${cfg.bg}`}>
      <CardContent className="pt-5 pb-4 flex flex-col items-center text-center gap-3">
        {/* Avatar */}
        <div
          className={`h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold ${cfg.avatarBg} ${cfg.ring}`}
        >
          {agent.name.charAt(0).toUpperCase()}
        </div>

        {/* Name & rank */}
        <div>
          <p className="font-bold text-[#111] text-base leading-tight">
            {agent.name}
          </p>
          <p className={`text-xs font-semibold mt-0.5 ${cfg.textColor}`}>
            {cfg.label}
          </p>
        </div>

        {/* Score */}
        <div className="flex flex-col items-center gap-0.5">
          <span
            className={`text-3xl font-black ${scoreColor(Math.round(agent.avg_overall))}`}
          >
            {Math.round(agent.avg_overall)}
          </span>
          <span className="text-[10px] text-[#9b9b9b] uppercase tracking-wider">
            Avg Score
          </span>
        </div>

        {/* Stats row */}
        <div className="w-full grid grid-cols-2 gap-2 pt-1 border-t border-[#f0f0f0]">
          <div className="text-center">
            <p className="text-sm font-bold text-[#111]">
              {agent.interactions}
            </p>
            <p className="text-[10px] text-[#9b9b9b]">Calls</p>
          </div>
          <div className="text-center">
            <p
              className={`text-sm font-bold ${
                agent.compliance_rate >= 80
                  ? "text-green-600"
                  : agent.compliance_rate >= 60
                    ? "text-yellow-600"
                    : "text-red-600"
              }`}
            >
              {Math.round(agent.compliance_rate)}%
            </p>
            <p className="text-[10px] text-[#9b9b9b]">Compliance</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
