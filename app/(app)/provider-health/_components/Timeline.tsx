import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { TimelineEvent } from "./types";

export function Timeline({ timeline }: { timeline: TimelineEvent[] }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">
          Recent Incidents ({timeline.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-2">
          {timeline.map((ev, i) => (
            <div
              key={i}
              className="flex items-start gap-3 text-xs border-b last:border-0 pb-2 last:pb-0"
            >
              <Clock className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-muted-foreground">
                    {ev.event_type}
                  </span>
                  {ev.provider && (
                    <Badge
                      variant="outline"
                      className="text-xs py-0 capitalize"
                    >
                      {ev.provider}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-muted-foreground whitespace-nowrap">
                {formatDistanceToNow(new Date(ev.created_at), {
                  addSuffix: true,
                })}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
