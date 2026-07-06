import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import type { SipTrunk } from "@/lib/supabase/types";
import { StatusBadge } from "./StatusBadge";

export function TrunkCard({
  trunk,
  deleting,
  onEdit,
  onDelete,
}: {
  trunk: SipTrunk;
  deleting: boolean;
  onEdit: (trunk: SipTrunk) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm text-[#0a0a0a]">
                {trunk.name}
              </span>
              <StatusBadge status={trunk.status} />
              <Badge
                variant="outline"
                className="text-xs bg-[#f5f5f5] text-[#6b6b6b] border-[#e8e8e8]"
              >
                {trunk.provider}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-[#6b6b6b]">
              <span>
                <span className="font-medium text-[#0a0a0a]">URL</span>{" "}
                {trunk.sip_host}:{trunk.port ?? 5060}
              </span>
              <span>
                <span className="font-medium text-[#0a0a0a]">Protocol</span>{" "}
                {trunk.protocol ?? "UDP"}
              </span>
              <span>
                <span className="font-medium text-[#0a0a0a]">Username</span>{" "}
                {trunk.username}
              </span>
              <span>
                <span className="font-medium text-[#0a0a0a]">Netmask</span> /
                {trunk.netmask ?? 32}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => onEdit(trunk)}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
              disabled={deleting}
              onClick={() => onDelete(trunk.id)}
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
