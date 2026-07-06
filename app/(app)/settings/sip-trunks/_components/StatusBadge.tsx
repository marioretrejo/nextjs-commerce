import { Badge } from "@/components/ui/badge";
import type { SipTrunk } from "@/lib/supabase/types";

export function StatusBadge({ status }: { status: SipTrunk["status"] }) {
  const map: Record<SipTrunk["status"], { label: string; className: string }> =
    {
      active: {
        label: "Active",
        className: "bg-green-50 text-green-700 border-green-200",
      },
      testing: {
        label: "Testing",
        className: "bg-blue-50 text-blue-700 border-blue-200",
      },
      error: {
        label: "Error",
        className: "bg-red-50 text-red-700 border-red-200",
      },
      disabled: {
        label: "Disabled",
        className: "bg-[#f5f5f5] text-[#6b6b6b] border-[#e8e8e8]",
      },
    };
  const s = map[status] ?? map.disabled;
  return (
    <Badge variant="outline" className={s.className}>
      {s.label}
    </Badge>
  );
}
