import { Card, CardContent } from "@/components/ui/card";

export interface MetricCard {
  label: string;
  value: string;
  icon: React.ReactNode;
  sub: string;
}

export function MetricCards({
  loading,
  cards,
}: {
  loading: boolean;
  cards: MetricCard[];
}) {
  return (
    <div className="grid grid-cols-4 gap-4 mb-6">
      {cards.map((m) => (
        <Card key={m.label}>
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm text-[#6b6b6b]">{m.label}</p>
              <span className="text-[#6b6b6b]">{m.icon}</span>
            </div>
            {loading ? (
              <div className="h-8 w-20 bg-[#f5f5f5] rounded animate-pulse" />
            ) : (
              <p className="text-3xl font-bold text-[#0a0a0a]">{m.value}</p>
            )}
            <p className="text-xs text-[#6b6b6b] mt-1">{m.sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
