import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, BellOff } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { AlertIncident } from "./types";
import { SeverityBadge } from "./badges";

export function ActiveIncidentsSection({
  incidents,
  onAck,
  onResolve,
  loading,
}: {
  incidents: AlertIncident[];
  onAck: (id: string) => void;
  onResolve: (id: string) => void;
  loading: boolean;
}) {
  if (!loading && incidents.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
        <BellOff className="h-4 w-4 shrink-0" />
        No active alert incidents
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">
            Active Incidents {loading ? "" : `(${incidents.length})`}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${
                  inc.severity === "critical"
                    ? "border-red-200 bg-red-50"
                    : inc.severity === "warning"
                      ? "border-yellow-200 bg-yellow-50"
                      : "border-blue-200 bg-blue-50"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SeverityBadge severity={inc.severity} />
                    <span className="font-medium truncate">{inc.title}</span>
                    {inc.status === "acknowledged" && (
                      <span className="text-xs text-muted-foreground">
                        (acknowledged)
                      </span>
                    )}
                  </div>
                  {inc.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {inc.description}
                    </p>
                  )}
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {inc.occurrence_count > 1
                      ? `${inc.occurrence_count}× · `
                      : ""}
                    {formatDistanceToNow(new Date(inc.last_seen_at), {
                      addSuffix: true,
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {inc.status === "open" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => onAck(inc.id)}
                    >
                      Ack
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50"
                    onClick={() => onResolve(inc.id)}
                  >
                    Resolve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
