import { Card, CardContent } from "@/components/ui/card";

export function Legend() {
  return (
    <Card className="bg-muted/30">
      <CardContent className="p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Circuit State Legend
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
          <div>
            <span className="font-medium text-green-700">Closed</span> — Normal
            operation
          </div>
          <div>
            <span className="font-medium text-yellow-700">Half-Open</span> —
            Recovering, error rate elevated
          </div>
          <div>
            <span className="font-medium text-red-700">Open</span> — Provider
            failing, fallback active
          </div>
          <div>
            <span className="font-medium text-gray-500">Unknown</span> —
            Insufficient data
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Circuit state is inferred from error rates — it does not reflect a
          real circuit breaker state machine.
        </p>
      </CardContent>
    </Card>
  );
}
