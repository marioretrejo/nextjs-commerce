import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";
import type { Call } from "@/lib/supabase/types";
import { THRESHOLD } from "./types";

export function LowScoreCalls({ calls }: { calls: Call[] }) {
  return (
    <Card className="mb-6">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Low-Score Calls
        </CardTitle>
        <CardDescription>
          Calls scoring below {THRESHOLD}% — review and address issues.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-0">
        <div className="grid grid-cols-[1fr_1fr_1fr_80px_1fr_40px] gap-3 px-5 py-3 border-b border-[#e0e0e0] text-xs font-medium text-[#6b6b6b] uppercase tracking-wide">
          <span>Contact</span>
          <span>Agent</span>
          <span>Outcome</span>
          <span>QA Score</span>
          <span>Date</span>
          <span />
        </div>
        <div className="divide-y divide-[#e0e0e0]">
          {calls.slice(0, 20).map((call) => (
            <div
              key={call.id}
              className="grid grid-cols-[1fr_1fr_1fr_80px_1fr_40px] gap-3 px-5 py-4 text-sm items-center hover:bg-[#f5f5f5]"
            >
              <span className="text-[#0a0a0a] font-medium">
                {call.contact_name ?? "—"}
              </span>
              <span className="text-[#6b6b6b]">
                {call.agent
                  ? (call.agent as unknown as { name: string }).name
                  : "—"}
              </span>
              <span>
                <Badge className="border-[#e0e0e0] text-[#6b6b6b] bg-white text-xs">
                  {call.outcome ?? "unknown"}
                </Badge>
              </span>
              <span className="font-bold text-[#0a0a0a]">{call.qa_score}%</span>
              <span className="text-[#6b6b6b] text-xs">
                {format(new Date(call.created_at), "MMM d, yyyy")}
              </span>
              <Link
                href={`/calls/${call.id}`}
                className="text-[#6b6b6b] hover:text-[#0a0a0a] text-xs underline"
              >
                View
              </Link>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
