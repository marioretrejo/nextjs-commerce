import { Badge } from "@/components/ui/badge";
import { CheckCircle2 } from "lucide-react";
import type { IntegrationStatus } from "@/lib/supabase/types";

export function statusBadge(status: IntegrationStatus | null) {
  if (!status || status === "disconnected") {
    return (
      <Badge className="border-[#e0e0e0] text-[#6b6b6b] bg-white text-xs">
        Disconnected
      </Badge>
    );
  }
  return (
    <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs flex items-center gap-1">
      <CheckCircle2 className="w-3 h-3" />
      Connected
    </Badge>
  );
}
