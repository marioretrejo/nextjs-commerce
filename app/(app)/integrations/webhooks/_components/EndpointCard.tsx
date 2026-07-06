import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trash2, Loader2 } from "lucide-react";
import { format } from "date-fns";
import type { Endpoint } from "./types";
import { DeliveryBadge } from "./DeliveryBadge";

export function EndpointCard({
  ep,
  toggling,
  deleting,
  onToggle,
  onDelete,
}: {
  ep: Endpoint;
  toggling: boolean;
  deleting: boolean;
  onToggle: (ep: Endpoint) => void;
  onDelete: (id: string, url: string) => void;
}) {
  return (
    <Card className={`border-[#e5e5e5] ${!ep.is_active ? "opacity-60" : ""}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm text-[#0a0a0a] truncate">
                {ep.url}
              </span>
              <Badge
                variant={ep.is_active ? "default" : "secondary"}
                className={`text-[10px] ${ep.is_active ? "bg-green-600 text-white border-transparent" : ""}`}
              >
                {ep.is_active ? "Active" : "Disabled"}
              </Badge>
            </div>

            {ep.description && (
              <p className="text-xs text-[#6b6b6b] mt-0.5">{ep.description}</p>
            )}

            <div className="flex flex-wrap gap-1.5 mt-2">
              {ep.events.map((ev) => (
                <span
                  key={ev}
                  className="rounded-md bg-[#f0f0f0] px-2 py-0.5 text-[10px] font-mono text-[#4a4a4a]"
                >
                  {ev}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-4 mt-2 text-xs text-[#a0a0a0]">
              <span>
                Added {format(new Date(ep.created_at), "MMM d, yyyy")}
              </span>
              {ep.last_delivery_at && (
                <span>
                  Last delivery{" "}
                  {format(new Date(ep.last_delivery_at), "MMM d, HH:mm")}
                </span>
              )}
              <DeliveryBadge
                status={ep.last_delivery_status}
                code={ep.last_delivery_status_code}
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={() => onToggle(ep)}
              disabled={toggling}
              className="rounded-lg border border-[#e5e5e5] px-2.5 py-1.5 text-xs text-[#6b6b6b] hover:bg-[#f5f5f5] transition-colors disabled:opacity-50"
              title={ep.is_active ? "Disable" : "Enable"}
            >
              {toggling ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : ep.is_active ? (
                "Disable"
              ) : (
                "Enable"
              )}
            </button>
            <button
              onClick={() => onDelete(ep.id, ep.url)}
              disabled={deleting}
              className="rounded-lg border border-[#e5e5e5] p-1.5 text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
              title="Delete endpoint"
            >
              {deleting ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
            </button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
